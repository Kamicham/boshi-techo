"use client";

// わが家の設定: 問いに1つずつ答える形。氏名や住所の番地は入れない。
// 「いつもの場所と人」（通う病院・職場・役所の窓口）は一度入れると、下書きやカレンダーで自動で使う。
// 使う人（me）はここで選ぶ（「あなたは？」）。選ばなければママ（母）として出す。
// 生まれた後は、生まれた日と呼び名を前に出し、予定日・妊娠中の働き方・生まれる子の数・里帰りは「生まれる前の事」に畳む（値は消さない）。
// パートナーのいない家族に「パートナー」の欄を突きつけない（保存した家族にパートナーがいなければ「家族を足す」に畳む）。
// シミュレーションのサーバでは、いま見ている作った家族（sim-・pop-）の家族の形といつもの場所を出す。
// 家族の形の保存（/api/family）は「わが家」だけなので、作った家族では見るだけ。いつもの場所（/api/keep）はどの家族でも覚える。
// アカウントの仕組みが動くサーバでは、「わが家」の代わりにログインした人の世帯（持ち主・共同の管理）へ保存する（/api/account/profile）。
// 読むだけの役の世帯は見るだけ。ログイン・同意・招待・書き出し・消すはアカウントの画面（/account）。
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Fold, NextStep, Pill, Why, plainError } from "@/components/ui";
import { SituationForm, tidySituation } from "@/components/settings/SituationForm";
import type { Situation } from "@/lib/situation";
import type { Keep } from "@/lib/keep";
import type { Family, Member } from "@/lib/demo-family";

const ROLES: Member["role"][] = ["母", "パートナー"];
// 役の見出し。「ママ」「パパ」などの呼び名は家族が下の欄で決める（役から決めつけない。総点検 2-2・2026-11-04）
const ROLE_WORD: Record<Member["role"], string> = { 母: "母", パートナー: "パートナー" };

const field = "min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base";

export default function Settings() {
  const { families, family, reload, setFamilyId, me, setMeId, isDemo, accountsEnabled, account, households, today } = useFamily();
  // 書ける世帯（持ち主・共同の管理）。アカウントの仕組みが動かないサーバでは、今までどおり「わが家」
  const own = households.filter((h) => h.role !== "member");
  const homeId = accountsEnabled ? (own.find((h) => h.id === family.id)?.id ?? own[0]?.id) : families.some((f) => f.id === "mine") ? "mine" : undefined;
  const mine = homeId ? families.find((f) => f.id === homeId) : undefined;
  // デモから「入れる」を押した時に保存する先（家族の設定がまだの世帯も含む）
  const startId = accountsEnabled ? homeId : "mine";
  // デモの家族を見ている時は、わが家の問いを混ぜない（わが家がまだ無い時は、押すと問いを出す）
  const [starting, setStarting] = useState(false);
  const askMine = !isDemo || starting;
  // 問いに出す家族: デモでなければ、いま見ている家族（本番では わが家、シミュレーションでは作った家族）
  const shown = isDemo ? mine : family;
  // 保存する先（いま問いに出している家族。まだ設定の無い世帯は、その世帯）
  const targetId = shown?.id ?? startId;
  const viewOnlyRole = accountsEnabled && households.some((h) => h.id === targetId && h.role === "member");
  // 作った家族（シミュレーション）・読むだけの役の世帯は、家族の形を保存できない
  const canSave = !!targetId && (accountsEnabled ? own.some((h) => h.id === targetId) : targetId === "mine");
  const madeUp = !!shown && !canSave;
  const [form, setForm] = useState({ prefecture: "", city: "", dueDate: "", birthDate: "", childName: "" });
  const [members, setMembers] = useState<Member[]>(ROLES.map((role, i) => ({ id: `m${i}`, name: "", role })));
  const [situation, setSituation] = useState<Situation>({});
  const [msg, setMsg] = useFlash();
  const [saving, setSaving] = useState(false);
  const hasPartner = members.some((m) => m.role === "パートナー" && m.name.trim());
  // 生まれた後か（保存した生まれた日で決める。入れている途中で問いの並びが動かないように）
  const born = !!shown?.birthDate && shown.birthDate <= today;
  // 保存した家族にパートナーがいない（ひとり親など）。空のパートナーの欄は「家族を足す」に畳む
  const noPartnerSaved = !!shown && !shown.members.some((m) => m.role === "パートナー" && m.name.trim());

  useEffect(() => {
    if (!shown) return;
    setSituation(shown.situation ?? {});
    setForm({ prefecture: shown.prefecture, city: shown.city, dueDate: shown.dueDate, birthDate: shown.birthDate ?? "", childName: shown.childName ?? "" });
    // 入れていない役（例: パートナー）も欄は残す
    const have = new Set(shown.members.map((m) => m.role));
    setMembers([...shown.members, ...ROLES.filter((r) => !have.has(r)).map((role, i) => ({ id: `m-new${i}`, name: "", role }))]);
  }, [shown]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = { ...form, members, situation: tidySituation(situation, hasPartner) };
      if (accountsEnabled) await api<{ family: Family }>("/api/account/profile", { body: { ...payload, familyId: targetId } });
      else await api<{ family: Family }>("/api/family", { body: payload });
      await reload();
      if (targetId) setFamilyId(targetId);
      setMsg({ ok: true, text: "保存しました" });
    } catch (e) {
      setMsg({ ok: false, text: `まだ保存できていません。入れた事は画面に残っています（${plainError(e)}）` });
    } finally {
      setSaving(false);
    }
  };

  const dueField = (
    <label className="flex flex-col gap-1 text-base">
      {born ? "出産予定日" : null}
      <input id="due" type="date" required aria-required aria-label="出産予定日" className={field} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
    </label>
  );
  const birthField = (
    <label className="flex flex-col gap-1 text-base">
      生まれた日
      <input id="birth" type="date" className={field} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
    </label>
  );
  const childField = (
    <label className="flex flex-col gap-1 text-base">
      赤ちゃんの呼び名
      <input id="child" className={field} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder={born ? "例: そうた" : "おなかの子"} />
    </label>
  );

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl font-bold">わが家の設定</h1>

      {family.members.length > 0 && (
        <Question q="あなたは？">
          <div className="flex flex-wrap gap-2">
            {family.members.map((m) => {
              const on = me?.id === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMeId(m.id)}
                  aria-pressed={on}
                  className={`min-h-11 rounded-full px-5 text-base font-semibold ${on ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
                >
                  わたしは{m.name}
                </button>
              );
            })}
          </div>
          {isDemo && <p className="text-sm text-muted">いま見ている見本の家族の中から選びます</p>}
        </Question>
      )}

      {!askMine &&
        (process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1" ? (
          <p className="text-sm text-muted">体験版では、自分の家族の手帳はまだ作れません（作った家族の写しを触れます）。</p>
        ) : accountsEnabled && !account ? (
          <NextStep title="いま見ているのは見本の家族です。">
            <Btn href="/start">自分の手帳を作る</Btn>
            <p className="w-full text-sm text-muted">メールに届く6桁の数字で入ります</p>
          </NextStep>
        ) : accountsEnabled && !startId ? (
          <NextStep eyebrow="いま見ているのは見本の家族" title="うちの手帳を作る" sub="作ると、わが家の手帳が始まります">
            <Btn href="/account/new">うちの手帳を作る</Btn>
          </NextStep>
        ) : (
          <NextStep eyebrow="いま見ているのは見本の家族" title="わが家の予定日・町・家族を入れる" sub={mine ? "わが家に切り替えると、わが家の分が出ます" : "入れると、わが家の手帳が始まります"}>
            <Btn onClick={() => (mine ? setFamilyId(mine.id) : setStarting(true))}>わが家に切り替えて入れる</Btn>
          </NextStep>
        ))}

      {askMine && (
        <>
          {/* 作った家族では、予定日・町・家族は見るだけ（いつもの場所は下で覚えられる） */}
          <fieldset disabled={madeUp} className="contents">
            {born ? (
              <Question q="生まれた日と呼び名" n={1}>
                {birthField}
                {childField}
                <Fold title="生まれる前の事" note="出産予定日">
                  {dueField}
                </Fold>
              </Question>
            ) : (
              <Question q="いつ生まれる予定？" n={1}>
                {dueField}
                {/* 妊娠中は呼び名が先（「もう生まれた」を大きく出さない。UX 2026-11-04） */}
                <Fold title="おなかの赤ちゃんの呼び名" note="生まれたら、生まれた日もここで入れます">
                  {birthField}
                  {childField}
                </Fold>
              </Question>
            )}

            <Question q="住んでいる町は？" n={2}>
              <div className="grid grid-cols-[2fr_3fr] gap-2">
                <input id="pref" aria-label="都道府県" className={field} value={form.prefecture} onChange={(e) => setForm({ ...form, prefecture: e.target.value })} placeholder="奈良県" />
                <input id="city" required aria-required aria-label="市区町村" className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="上牧町" />
              </div>
              <p className="text-sm text-muted">町の制度を、その町の物で調べます</p>
            </Question>

            <Question q="家族は？" n={3}>
              {members.map((m, i) => {
                const input = (
                  <div key={m.id} className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-base">
                      <span className="text-sm font-semibold text-muted">{ROLE_WORD[m.role]}</span>
                      <input
                        id={`member-${i}`}
                        className={field}
                        value={m.name}
                        placeholder="呼び名"
                        onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      />
                    </label>
                    {/* 子どもから見た呼び名（任意）。手紙・一冊・映画で、名前に添えて言う（予定表と担当は名前のまま） */}
                    {m.name.trim() && (
                      <label className="flex flex-col gap-1 text-base">
                        <span className="text-sm text-muted">{form.childName.trim() || "子ども"}から見た呼び名（任意・手紙と一冊で）</span>
                        <input
                          id={`member-call-${i}`}
                          className={field}
                          value={m.callName ?? ""}
                          maxLength={10}
                          placeholder="例: ママ・パパ・かあちゃん"
                          onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, callName: e.target.value } : x)))}
                        />
                      </label>
                    )}
                  </div>
                );
                // まだいない役（保存した家族にパートナーがいない）の空の欄は、押した時だけ開く
                if (m.role === "パートナー" && noPartnerSaved && !shown?.members.some((x) => x.id === m.id))
                  return (
                    <details key={m.id} className="group" open={m.name ? true : undefined}>
                      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-base text-muted">
                        <span className="underline underline-offset-2">家族を足す</span>
                        <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
                      </summary>
                      <div className="pt-2">{input}</div>
                    </details>
                  );
                return input;
              })}
            </Question>
          </fieldset>

          <Question q="家族の形は？" n={4}>
            <p className="text-base text-muted">答えると、うちに関係ない予定を出さなくなります。わからない所は、そのままで大丈夫です</p>
            <SituationForm key={shown?.id ?? "new"} value={situation} onChange={setSituation} hasPartner={hasPartner} disabled={madeUp} born={born} />
          </Question>

          {madeUp ? (
            <p role="note" className="rounded-xl bg-rose-soft px-4 py-3 text-base">
              {viewOnlyRole
                ? "読むだけの役なので、家族の形は見るだけです。直すのはうちの手帳の持ち主・共同の管理の人です"
                : "作った家族（シミュレーション）の家族の形は、ここでは見るだけです。保存は「わが家」だけできます"}
            </p>
          ) : (
            <Btn onClick={() => void save()} disabled={saving} full>
              {saving ? "保存しています…" : born ? "生まれた日・町・家族の形を保存する" : "予定日・町・家族の形を保存する"}
            </Btn>
          )}
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "border-l-[3px] border-muted bg-paper font-semibold text-ink"}`}>
              {msg.text}
            </p>
          )}

          {shown ? <KeepForm key={shown.id} familyId={shown.id} /> : <p className="text-sm text-muted">保存すると「いつもの場所と人」を入れられます</p>}
        </>
      )}

      {/* 見本の家族を見ているログイン前の人には出さない（上の「自分の手帳を作る」の箱1つにまとめる） */}
      {accountsEnabled && (account || !isDemo) && (
        <Question q="アカウントと同意">
          <p className="text-base text-muted">
            {account ? "同意の確かめと撤回・家族を招く・書き出す・消すは、ここから" : "ログインすると、うちの手帳・同意・家族の招待が使えます"}
          </p>
          <Btn href={account ? `/account${households.some((h) => h.id === family.id) ? `?familyId=${encodeURIComponent(family.id)}` : ""}` : "/login?next=/account"} kind="secondary">
            {account ? "アカウントの画面へ" : "ログイン・アカウントを作る"}
          </Btn>
        </Question>
      )}

      <Why label="入れた事はどこに？">
        <p>{accountsEnabled ? "うちの手帳の中だけに置きます。" : "この機械の中だけに置きます。"}氏名・住所の番地は入れなくて大丈夫です。</p>
      </Why>
    </main>
  );
}

type Flash = { ok: boolean; text: string } | null;

/** 保存の知らせ。「保存しました」は数秒で消す（うまくいかなかった時の知らせは残す） */
function useFlash(): [Flash, (m: Flash) => void] {
  const [msg, setMsg] = useState<Flash>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const set = useCallback((m: Flash) => {
    clearTimeout(timer.current);
    setMsg(m);
    if (m?.ok) timer.current = setTimeout(() => setMsg(null), 3000);
  }, []);
  return [msg, set];
}

/** 問い1つ分の大きな箱 */
function Question({ q, n, children }: { q: string; n?: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="flex items-baseline gap-2 font-display text-xl font-bold">
        {n != null && <span className="tabular text-base text-rose">{n}</span>}
        {q}
      </h2>
      {children}
    </section>
  );
}

/** いつもの場所と人（GET/POST /api/keep） */
function KeepForm({ familyId }: { familyId: string }) {
  const [keep, setKeep] = useState<Keep | null>(null);
  const [hospital, setHospital] = useState({ name: "", phone: "" });
  const [work, setWork] = useState({ company: "", boss: "", email: "" });
  const [office, setOffice] = useState({ name: "", address: "" });
  const [msg, setMsg] = useFlash();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ keep: Keep }>(`/api/keep?familyId=${encodeURIComponent(familyId)}`)
      .then(({ keep: k }) => {
        if (!alive) return;
        setKeep(k);
        setHospital({ name: k.hospital?.name ?? "", phone: k.hospital?.phone ?? "" });
        setWork({ company: k.work?.company ?? "", boss: k.work?.boss ?? "", email: k.work?.email ?? "" });
        setOffice({ name: k.office?.name ?? "", address: k.office?.address ?? "" });
      })
      .catch((e: Error) => alive && setMsg({ ok: false, text: plainError(e) }));
    return () => {
      alive = false;
    };
  }, [familyId, setMsg]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ keep: Keep }>("/api/keep", { body: { familyId, keep: { hospital, work, office } } });
      setKeep(r.keep);
      setMsg({ ok: true, text: "保存しました" });
    } catch (e) {
      setMsg({ ok: false, text: plainError(e) });
    } finally {
      setSaving(false);
    }
  };

  const guide = keep?.hospital?.guide;

  return (
    <Question q="いつもの場所と人" n={5}>
      <p className="text-base text-muted">一度入れると、次から自動で使います</p>

      <h3 className="pt-1 text-base font-bold">通う病院</h3>
      <input aria-label="病院の名前" className={field} value={hospital.name} onChange={(e) => setHospital({ ...hospital, name: e.target.value })} placeholder="病院の名前" />
      <div className="flex gap-2">
        <input aria-label="病院の電話" type="tel" inputMode="tel" className={field} value={hospital.phone} onChange={(e) => setHospital({ ...hospital, phone: e.target.value })} placeholder="電話" />
        {keep?.hospital?.phone && (
          <Btn kind="secondary" href={`tel:${keep.hospital.phone.replace(/[^\d+]/g, "")}`}>
            かける
          </Btn>
        )}
      </div>
      {guide ? (
        <p className="flex flex-wrap items-center gap-2 text-base">
          <Pill tone="ok">病院の中の案内: {jpDate(guide.at.slice(0, 10))}に撮った物があります</Pill>
          <span className="text-sm text-muted">次の健診で撮り直せます</span>
        </p>
      ) : (
        <p className="text-sm text-muted">健診の日に病院の中の案内を撮っておくと、次から迷わずに行けます</p>
      )}

      <h3 className="pt-2 text-base font-bold">職場</h3>
      <input aria-label="会社名" className={field} value={work.company} onChange={(e) => setWork({ ...work, company: e.target.value })} placeholder="会社名" />
      <details className="group" open={work.boss || work.email ? true : undefined}>
        <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-base text-muted">
          <span className="underline underline-offset-2">職場に伝える時に使う欄（あとででよい）</span>
          <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
        </summary>
        <div className="flex flex-col gap-3 pt-2">
          <input aria-label="上司の名前" className={field} value={work.boss} onChange={(e) => setWork({ ...work, boss: e.target.value })} placeholder="上司の名前" />
          <input aria-label="上司のメール" type="email" inputMode="email" className={field} value={work.email} onChange={(e) => setWork({ ...work, email: e.target.value })} placeholder="上司のメール" />
        </div>
      </details>

      <h3 className="pt-2 text-base font-bold">役所の窓口</h3>
      <input aria-label="窓口の名前" className={field} value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} placeholder="例: 町役場 こども課" />
      <input aria-label="窓口の場所" className={field} value={office.address} onChange={(e) => setOffice({ ...office, address: e.target.value })} placeholder="場所（カレンダーに入れるため）" />

      <Btn onClick={() => void save()} disabled={saving || !keep} full>
        {saving ? "保存しています…" : "場所と人を保存する"}
      </Btn>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "border-l-[3px] border-muted bg-paper font-semibold text-ink"}`}>
          {msg.text}
        </p>
      )}
      <Why>
        <p>職場あての下書きの【会社名】【上司の名前】が、最初から埋まります。</p>
        <p>役所の窓口と病院は、予定をカレンダーに入れる時の場所に入ります。</p>
        <p>欄を空にして「場所と人を保存する」を押すと、その事は消えます。</p>
      </Why>
    </Question>
  );
}
