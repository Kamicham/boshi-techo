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
import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Fold, NextStep, Pill, Why, plainError } from "@/components/ui";
import { SituationForm, tidySituation } from "@/components/settings/SituationForm";
import type { Situation } from "@/lib/situation";
import type { Keep } from "@/lib/keep";
import { legacyWorkOwner, workOf, type Work } from "@/lib/whose";
import { NOT_MOVED, townChanged } from "@/lib/move";
import { addDays } from "@/lib/clock";
import type { Family, Member } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";

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
  // 町を変えた時に聞く「引っ越した日」（空なら今日）と「町の名前を直しただけ」（見直し C10①）
  const [movedOn, setMovedOn] = useState("");
  const [notMoved, setNotMoved] = useState(false);
  const [msg, setMsg] = useFlash();
  const [saving, setSaving] = useState(false);
  const hasPartner = members.some((m) => m.role === "パートナー" && m.name.trim());
  // 保存した町から変えたか（サーバの「町を変えた」と同じ見方＝lib/move.ts の townChanged）
  const townEdited = !!shown && townChanged(shown, form);
  // 生まれた後か（保存した生まれた日で決める。入れている途中で問いの並びが動かないように）
  const born = !!shown?.birthDate && shown.birthDate <= today;
  // 保存した家族にパートナーがいない（ひとり親など）。空のパートナーの欄は「家族を足す」に畳む
  const noPartnerSaved = !!shown && !shown.members.some((m) => m.role === "パートナー" && m.name.trim());

  useEffect(() => {
    if (!shown) return;
    setSituation(shown.situation ?? {});
    setForm({ prefecture: shown.prefecture, city: shown.city, dueDate: shown.dueDate, birthDate: shown.birthDate ?? "", childName: shown.childName ?? "" });
    setMovedOn("");
    setNotMoved(false);
    // 入れていない役（例: パートナー）も欄は残す
    const have = new Set(shown.members.map((m) => m.role));
    setMembers([...shown.members, ...ROLES.filter((r) => !have.has(r)).map((role, i) => ({ id: `m-new${i}`, name: "", role }))]);
  }, [shown]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const payload = {
        ...form,
        members,
        situation: tidySituation(situation, hasPartner),
        ...(townEdited ? { movedOn: notMoved ? NOT_MOVED : movedOn || today } : {}),
      };
      if (accountsEnabled) await api<{ family: Family }>("/api/account/profile", { body: { ...payload, familyId: targetId } });
      else await api<{ family: Family }>("/api/family", { body: payload });
      await reload();
      if (targetId) setFamilyId(targetId);
      setMsg({ ok: true, text: t("保存しました") });
    } catch (e) {
      setMsg({ ok: false, text: t("まだ保存できていません。入れた事は画面に残っています（{reason}）", { reason: plainError(e) }) });
    } finally {
      setSaving(false);
    }
  };

  const dueField = (
    <label className="flex flex-col gap-1 text-base">
      {born ? t("出産予定日") : null}
      <input id="due" type="date" required aria-required aria-label={t("出産予定日")} className={field} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
    </label>
  );
  const birthField = (
    <label className="flex flex-col gap-1 text-base">
      {t("生まれた日")}
      <input id="birth" type="date" className={field} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
    </label>
  );
  const childField = (
    <label className="flex flex-col gap-1 text-base">
      {t("赤ちゃんの呼び名")}
      <input id="child" className={field} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder={born ? t("例: そうた") : t("おなかの子")} />
    </label>
  );

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl font-bold">{t("わが家の設定")}</h1>

      {family.members.length > 0 && (
        <Question q={t("あなたは？")}>
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
                  {t("わたしは{name}", { name: nameIn(m.name) })}
                </button>
              );
            })}
          </div>
          {isDemo && <p className="text-sm text-muted">{t("いま見ている見本の家族の中から選びます")}</p>}
        </Question>
      )}

      {!askMine &&
        (process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1" ? (
          <p className="text-sm text-muted">{t("体験版では、自分の家族の手帳はまだ作れません（作った家族の写しを触れます）。")}</p>
        ) : accountsEnabled && !account ? (
          <NextStep title={t("いま見ているのは見本の家族です。")}>
            <Btn href="/start">{t("自分の手帳を作る")}</Btn>
            <p className="w-full text-sm text-muted">{t("メールに届く6桁の数字で入ります")}</p>
          </NextStep>
        ) : accountsEnabled && !startId ? (
          <NextStep eyebrow={t("いま見ているのは見本の家族")} title={t("うちの手帳を作る")} sub={t("作ると、わが家の手帳が始まります")}>
            <Btn href="/account/new">{t("うちの手帳を作る")}</Btn>
          </NextStep>
        ) : (
          <NextStep
            eyebrow={t("いま見ているのは見本の家族")}
            title={t("わが家の予定日・町・家族を入れる")}
            sub={mine ? t("わが家に切り替えると、わが家の分が出ます") : t("入れると、わが家の手帳が始まります")}
          >
            <Btn onClick={() => (mine ? setFamilyId(mine.id) : setStarting(true))}>{t("わが家に切り替えて入れる")}</Btn>
          </NextStep>
        ))}

      {askMine && (
        <>
          {/* 作った家族では、予定日・町・家族は見るだけ（いつもの場所は下で覚えられる） */}
          <fieldset disabled={madeUp} className="contents">
            {born ? (
              <Question q={t("生まれた日と呼び名")} n={1}>
                {birthField}
                {childField}
                <Fold title={t("生まれる前の事")} note={t("出産予定日")}>
                  {dueField}
                </Fold>
              </Question>
            ) : (
              <Question q={t("いつ生まれる予定？")} n={1}>
                {dueField}
                {/* 妊娠中は呼び名が先（「もう生まれた」を大きく出さない。UX 2026-11-04） */}
                <Fold title={t("おなかの赤ちゃんの呼び名")} note={t("生まれたら、生まれた日もここで入れます")}>
                  {birthField}
                  {childField}
                </Fold>
              </Question>
            )}

            <Question q={t("住んでいる町は？")} n={2}>
              <div className="grid grid-cols-[2fr_3fr] gap-2">
                {/* 訳さない: 町の名前の例（町の名前は日本語で入れてもらう＝窓口の調べ・県の番号の表が日本語の名前で引く。中文・English は下の一行で「日本語で」と添える） */}
                <input id="pref" aria-label={t("都道府県")} className={field} value={form.prefecture} onChange={(e) => setForm({ ...form, prefecture: e.target.value })} placeholder="奈良県" />
                {/* 訳さない: 町の名前の例（上と同じ） */}
                <input id="city" required aria-required aria-label={t("市区町村")} className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="上牧町" />
              </div>
              <p className="text-sm text-muted">{t("町の制度を、その町の物で調べます")}</p>
              {townEdited && (
                <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
                  <label className="flex flex-col gap-1 text-base">
                    <span className="text-sm font-semibold text-muted">{t("引っ越した日（転入届などの期限を、この日から数えます）")}</span>
                    <input
                      type="date"
                      aria-label={t("引っ越した日")}
                      className={field}
                      value={movedOn || today}
                      min={addDays(today, -366)}
                      max={today}
                      disabled={notMoved}
                      onChange={(e) => setMovedOn(e.target.value)}
                    />
                  </label>
                  <label className="flex min-h-11 items-center gap-2 text-base">
                    <input type="checkbox" className="h-5 w-5" checked={notMoved} onChange={(e) => setNotMoved(e.target.checked)} />
                    {t("町の名前を直しただけ（引っ越していない）")}
                  </label>
                </div>
              )}
            </Question>

            <Question q={t("家族は？")} n={3}>
              {members.map((m, i) => {
                const input = (
                  <div key={m.id} className="flex flex-col gap-2">
                    <label className="flex flex-col gap-1 text-base">
                      <span className="text-sm font-semibold text-muted">{t(ROLE_WORD[m.role])}</span>
                      <input
                        id={`member-${i}`}
                        className={field}
                        value={m.name}
                        placeholder={t("呼び名")}
                        onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                      />
                    </label>
                    {/* 子どもから見た呼び名（任意）。手紙・一冊・映画で、名前に添えて言う（予定表と担当は名前のまま） */}
                    {m.name.trim() && (
                      <label className="flex flex-col gap-1 text-base">
                        <span className="text-sm text-muted">{t("{child}から見た呼び名（任意・手紙と一冊で）", { child: nameIn(form.childName.trim()) || t("子ども") })}</span>
                        <input
                          id={`member-call-${i}`}
                          className={field}
                          value={m.callName ?? ""}
                          maxLength={10}
                          placeholder={t("例: ママ・パパ・かあちゃん")}
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
                        <span className="underline underline-offset-2">{t("家族を足す")}</span>
                        <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
                      </summary>
                      <div className="pt-2">{input}</div>
                    </details>
                  );
                return input;
              })}
            </Question>
          </fieldset>

          <Question q={t("家族の形は？")} n={4}>
            <p className="text-base text-muted">{t("答えると、うちに関係ない予定を出さなくなります。わからない所は、そのままで大丈夫です")}</p>
            <SituationForm key={shown?.id ?? "new"} value={situation} onChange={setSituation} hasPartner={hasPartner} disabled={madeUp} born={born} />
          </Question>

          {madeUp ? (
            <p role="note" className="rounded-xl bg-rose-soft px-4 py-3 text-base">
              {viewOnlyRole
                ? t("読むだけの役なので、家族の形は見るだけです。直すのはうちの手帳の持ち主・共同の管理の人です")
                : t("作った家族（シミュレーション）の家族の形は、ここでは見るだけです。保存は「わが家」だけできます")}
            </p>
          ) : (
            <Btn onClick={() => void save()} disabled={saving} full>
              {saving ? t("保存しています…") : born ? t("生まれた日・町・家族の形を保存する") : t("予定日・町・家族の形を保存する")}
            </Btn>
          )}
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "border-l-[3px] border-muted bg-paper font-semibold text-ink"}`}>
              {msg.text}
            </p>
          )}

          {shown ? <KeepForm key={`${shown.id}:${shown.prefecture}${shown.city}`} familyId={shown.id} members={shown.members} /> : <p className="text-sm text-muted">{t("保存すると「いつもの場所と人」を入れられます")}</p>}
        </>
      )}

      {/* 見本の家族を見ているログイン前の人には出さない（上の「自分の手帳を作る」の箱1つにまとめる） */}
      {accountsEnabled && (account || !isDemo) && (
        <Question q={t("アカウントと同意")}>
          <p className="text-base text-muted">
            {account ? t("同意の確かめと撤回・家族を招く・書き出す・消すは、ここから") : t("ログインすると、うちの手帳・同意・家族の招待が使えます")}
          </p>
          <Btn href={account ? `/account${households.some((h) => h.id === family.id) ? `?familyId=${encodeURIComponent(family.id)}` : ""}` : "/login?next=/account"} kind="secondary">
            {account ? t("アカウントの画面へ") : t("ログイン・アカウントを作る")}
          </Btn>
        </Question>
      )}

      <Why label={t("入れた事はどこに？")}>
        {/* 2つの文を1つの鍵に（English では文の間に空きが要る） */}
        <p>{accountsEnabled ? t("うちの手帳の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。") : t("この機械の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。")}</p>
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

/** 設定で入れる職場の欄（部署・人事は下書きの画面で覚える。ここで送らないので消えない） */
type WorkForm = { company: string; boss: string; email: string };
const toWorkForm = (w?: Work): WorkForm => ({ company: w?.company ?? "", boss: w?.boss ?? "", email: w?.email ?? "" });

/**
 * 職場が人ごとになった版（見直し C09）が本番に届くのは 11/6 の朝の組み直し。それより前に書いた「いつもの」は、職場の欄が1つの版で入れた物。
 * 今はそれを母（いなければ家族の最初の人）の職場として読むので、2人以上の家族には、設定で一言添える。
 * 日付で分けるのは近似（その後に「いつもの」のどれかを保存すると消える）
 */
const WORK_SPLIT_AT = "2026-11-05T15:00:00.000Z";

/** 設定の画面で人を呼ぶ形（今日の画面と同じく、名前をそのまま。名前が無ければ役の呼び方） */
function whoLabel(m: Member): string {
  return nameIn(m.name.trim()) || t(m.role === "母" ? "ママ" : "パートナー");
}

/** いつもの場所と人（GET/POST /api/keep）。職場は人ごと（members＝保存した家族の人） */
function KeepForm({ familyId, members }: { familyId: string; members: Member[] }) {
  const [keep, setKeep] = useState<Keep | null>(null);
  const [hospital, setHospital] = useState({ name: "", phone: "" });
  // 職場は、読んだ「いつもの」から人ごとに出し、直した人の分だけここに持つ（家族の欄で人が増えても読み直さない）
  const [workEdits, setWorkEdits] = useState<Record<string, WorkForm>>({});
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
        setWorkEdits({});
        setOffice({ name: k.office?.name ?? "", address: k.office?.address ?? "" });
      })
      .catch((e: Error) => alive && setMsg({ ok: false, text: plainError(e) }));
    return () => {
      alive = false;
    };
  }, [familyId, setMsg]);

  const owner = legacyWorkOwner({ members });
  const people = members.filter((m) => m.name.trim() || m.id === owner?.id);
  const savedWork = (id: string) => toWorkForm(keep ? workOf(keep, { members }, id) : undefined);
  const workFor = (id: string) => workEdits[id] ?? savedWork(id);
  const oldOneWork =
    people.length >= 2 &&
    !!keep?.work &&
    Object.values(keep.work).some((v) => typeof v === "string" && v.trim()) &&
    !keep.workBy &&
    (keep.updatedAt ?? "") < WORK_SPLIT_AT;
  const others = people.filter((m) => m.id !== owner?.id);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const workBy = Object.fromEntries(people.map((m) => [m.id, workFor(m.id)]));
      const r = await api<{ keep: Keep }>("/api/keep", { body: { familyId, keep: { hospital, workBy, office } } });
      setKeep(r.keep);
      setWorkEdits({});
      setMsg({ ok: true, text: t("保存しました") });
    } catch (e) {
      setMsg({ ok: false, text: plainError(e) });
    } finally {
      setSaving(false);
    }
  };

  const guide = keep?.hospital?.guide;

  return (
    <Question q={t("いつもの場所と人")} n={5}>
      <p className="text-base text-muted">{t("一度入れると、次から自動で使います")}</p>

      <h3 className="pt-1 text-base font-bold">{t("通う病院")}</h3>
      <input aria-label={t("病院の名前")} className={field} value={hospital.name} onChange={(e) => setHospital({ ...hospital, name: e.target.value })} placeholder={t("病院の名前")} />
      <div className="flex gap-2">
        <input aria-label={t("病院の電話")} type="tel" inputMode="tel" className={field} value={hospital.phone} onChange={(e) => setHospital({ ...hospital, phone: e.target.value })} placeholder={t("電話")} />
        {keep?.hospital?.phone && (
          <Btn kind="secondary" href={`tel:${keep.hospital.phone.replace(/[^\d+]/g, "")}`}>
            {t("かける")}
          </Btn>
        )}
      </div>
      {guide ? (
        <p className="flex flex-wrap items-center gap-2 text-base">
          <Pill tone="ok">{t("病院の中の案内: {date}に撮った物があります", { date: jpDate(guide.at.slice(0, 10)) })}</Pill>
          <span className="text-sm text-muted">{t("次の健診で撮り直せます")}</span>
        </p>
      ) : (
        <p className="text-sm text-muted">{t("健診の日に病院の中の案内を撮っておくと、次から迷わずに行けます")}</p>
      )}

      {people.map((m) => {
        const who = whoLabel(m);
        const w = workFor(m.id);
        const saved = savedWork(m.id);
        const set = (p: Partial<WorkForm>) => setWorkEdits((e) => ({ ...e, [m.id]: { ...w, ...p } }));
        return (
          <Fragment key={m.id}>
            <h3 className="pt-2 text-base font-bold">{t("{who}の職場", { who })}</h3>
            {oldOneWork && m.id === owner?.id && (
              <p className="text-sm text-muted">
                {t("職場の欄が1つだった時に入れた職場は、{who}の職場として読んでいます。{other}の職場だった時は、ここで直してください", {
                  who,
                  other: others.length === 1 ? whoLabel(others[0]) : t("ほかの人"),
                })}
              </p>
            )}
            <input aria-label={t("{who}の会社名", { who })} className={field} value={w.company} onChange={(e) => set({ company: e.target.value })} placeholder={t("会社名")} />
            {/* 開いておくかは保存した値で決める（打っている間に閉じない） */}
            <details className="group" open={saved.boss || saved.email ? true : undefined}>
              <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-base text-muted">
                <span className="underline underline-offset-2">{t("職場に伝える時に使う欄（あとででよい）")}</span>
                <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
              </summary>
              <div className="flex flex-col gap-3 pt-2">
                <input aria-label={t("{who}の上司の名前", { who })} className={field} value={w.boss} onChange={(e) => set({ boss: e.target.value })} placeholder={t("上司の名前")} />
                <input aria-label={t("{who}の上司のメール", { who })} type="email" inputMode="email" className={field} value={w.email} onChange={(e) => set({ email: e.target.value })} placeholder={t("上司のメール")} />
              </div>
            </details>
          </Fragment>
        );
      })}

      <h3 className="pt-2 text-base font-bold">{t("役所の窓口")}</h3>
      {keep?.office?.staleFrom && (
        <p className="text-sm text-muted">
          {t("前の町（{town}）の窓口です。下書きと予定の場所には使いません。新しい町の窓口に直すか、手続きの「どこへ行くか見る」で覚え直します", { town: keep.office.staleFrom })}
        </p>
      )}
      <input aria-label={t("窓口の名前")} className={field} value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} placeholder={t("例: 町役場 こども課")} />
      <input aria-label={t("窓口の場所")} className={field} value={office.address} onChange={(e) => setOffice({ ...office, address: e.target.value })} placeholder={t("場所（カレンダーに入れるため）")} />

      <Btn onClick={() => void save()} disabled={saving || !keep} full>
        {saving ? t("保存しています…") : t("場所と人を保存する")}
      </Btn>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "border-l-[3px] border-muted bg-paper font-semibold text-ink"}`}>
          {msg.text}
        </p>
      )}
      <Why>
        <p>{t("職場あての下書きの【会社名】【上司の名前】が、書く人の職場で最初から埋まります（パートナーの育休の申し出は、パートナーの職場で）。")}</p>
        <p>{t("役所の窓口と病院は、予定をカレンダーに入れる時の場所に入ります。")}</p>
        <p>{t("欄を空にして「場所と人を保存する」を押すと、その事は消えます。")}</p>
      </Why>
    </Question>
  );
}
