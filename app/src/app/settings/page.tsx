"use client";

// わが家の設定: 問いに1つずつ答える形。氏名や住所の番地は入れない。
// 「いつもの場所と人」（通う病院・職場・役所の窓口）は一度入れると、下書きやカレンダーで自動で使う。
// 使う人（me）はここで選ぶ。選ばなければママ（母）として出す。
// シミュレーションのサーバでは、いま見ている作った家族（sim-・pop-）の家族の形といつもの場所を出す。
// 家族の形の保存（/api/family）は「わが家」だけなので、作った家族では見るだけ。いつもの場所（/api/keep）はどの家族でも覚える。
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Fold, NextStep, Pill, Why } from "@/components/ui";
import { SituationForm, tidySituation } from "@/components/settings/SituationForm";
import type { Situation } from "@/lib/situation";
import type { Keep } from "@/lib/keep";
import type { Family, Member } from "@/lib/demo-family";

const ROLES: Member["role"][] = ["母", "パートナー"];
const ROLE_WORD: Record<Member["role"], string> = { 母: "ママ（母）", パートナー: "パートナー" };

const field = "min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base";

export default function Settings() {
  const { families, family, reload, setFamilyId, me, setMeId, isDemo } = useFamily();
  const mine = families.find((f) => f.id === "mine");
  // デモの家族を見ている時は、わが家の問いを混ぜない（わが家がまだ無い時は、押すと問いを出す）
  const [starting, setStarting] = useState(false);
  const askMine = !isDemo || starting;
  // 問いに出す家族: デモでなければ、いま見ている家族（本番では わが家、シミュレーションでは作った家族）
  const shown = isDemo ? mine : family;
  // 作った家族（シミュレーション）は、家族の形を保存できない（/api/family は わが家だけを書く）
  const madeUp = !!shown && shown.id !== "mine";
  const [form, setForm] = useState({ prefecture: "", city: "", dueDate: "", birthDate: "", childName: "" });
  const [members, setMembers] = useState<Member[]>(ROLES.map((role, i) => ({ id: `m${i}`, name: "", role })));
  const [situation, setSituation] = useState<Situation>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const hasPartner = members.some((m) => m.role === "パートナー" && m.name.trim());

  useEffect(() => {
    if (!shown) return;
    setSituation(shown.situation ?? {});
    setForm({ prefecture: shown.prefecture, city: shown.city, dueDate: shown.dueDate, birthDate: shown.birthDate ?? "", childName: shown.childName ?? "" });
    // 入れていない役（例: パートナー）も欄は残す
    const have = new Set(shown.members.map((m) => m.role));
    setMembers([...shown.members, ...ROLES.filter((r) => !have.has(r)).map((role, i) => ({ id: `m-new${i}`, name: "", role }))]);
  }, [shown]);

  const save = async () => {
    setMsg(null);
    try {
      await api<{ family: Family }>("/api/family", { body: { ...form, members, situation: tidySituation(situation, hasPartner) } });
      await reload();
      setFamilyId("mine");
      setMsg({ ok: true, text: "保存しました" });
    } catch (e) {
      setMsg({ ok: false, text: `保存できませんでした: ${(e as Error).message}` });
    }
  };

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-8">
      <h1 className="font-display text-2xl font-bold">わが家の設定</h1>

      {family.members.length > 0 && (
        <Question q="この手帳を使うのは？">
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
          <p className="text-sm text-muted">{isDemo ? "いま見ているデモの家族の中から選びます。" : ""}選ばなければ、ママ（母）の画面で出します</p>
        </Question>
      )}

      {!askMine && (
        <NextStep eyebrow="いま見ているのはデモの家族" title="わが家の予定日・町・家族を入れる" sub={mine ? "わが家に切り替えると、わが家の分が出ます" : "入れると、わが家の手帳が始まります"}>
          <Btn onClick={() => (mine ? setFamilyId("mine") : setStarting(true))}>わが家に切り替えて入れる</Btn>
        </NextStep>
      )}

      {askMine && (
        <>
          {/* 作った家族では、予定日・町・家族は見るだけ（いつもの場所は下で覚えられる） */}
          <fieldset disabled={madeUp} className="contents">
            <Question q="いつ生まれる予定？" n={1}>
              <input id="due" type="date" required aria-required aria-label="出産予定日" className={field} value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              <Fold title="もう生まれた・呼び名">
                <label className="flex flex-col gap-1 text-base">
                  生まれた日
                  <input id="birth" type="date" className={field} value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
                </label>
                <label className="flex flex-col gap-1 text-base">
                  赤ちゃんの呼び名
                  <input id="child" className={field} value={form.childName} onChange={(e) => setForm({ ...form, childName: e.target.value })} placeholder="おなかの子" />
                </label>
              </Fold>
            </Question>

            <Question q="住んでいる町は？" n={2}>
              <div className="grid grid-cols-[2fr_3fr] gap-2">
                <input id="pref" aria-label="都道府県" className={field} value={form.prefecture} onChange={(e) => setForm({ ...form, prefecture: e.target.value })} placeholder="奈良県" />
                <input id="city" required aria-required aria-label="市区町村" className={field} value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} placeholder="上牧町" />
              </div>
              <p className="text-sm text-muted">町の制度を、その町の物で調べます</p>
            </Question>

            <Question q="家族は？" n={3}>
              {members.map((m, i) => (
                <label key={m.id} className="flex flex-col gap-1 text-base">
                  <span className="text-sm font-semibold text-muted">{ROLE_WORD[m.role]}</span>
                  <input
                    id={`member-${i}`}
                    className={field}
                    value={m.name}
                    placeholder="呼び名"
                    onChange={(e) => setMembers(members.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                  />
                </label>
              ))}
            </Question>
          </fieldset>

          <Question q="家族の形は？" n={4}>
            <p className="text-base text-muted">答えると、合わない予定が消えます。わからない所は、そのままで大丈夫です</p>
            <SituationForm value={situation} onChange={setSituation} hasPartner={hasPartner} disabled={madeUp} />
          </Question>

          {madeUp ? (
            <p role="note" className="rounded-xl bg-rose-soft px-4 py-3 text-base">
              作った家族（シミュレーション）の家族の形は、ここでは見るだけです。保存は「わが家」だけできます
            </p>
          ) : (
            <Btn onClick={() => void save()} full>
              保存する
            </Btn>
          )}
          {msg && (
            <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "bg-alert/10 font-semibold text-alert"}`}>
              {msg.text}
            </p>
          )}

          {shown ? <KeepForm key={shown.id} familyId={shown.id} /> : <p className="text-sm text-muted">保存すると「いつもの場所と人」を入れられます</p>}
        </>
      )}

      <Why label="入れた事はどこに？">
        <p>この機械の中だけに置きます。氏名・住所の番地は入れなくて大丈夫です。</p>
      </Why>
    </main>
  );
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
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
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
      .catch((e: Error) => alive && setMsg({ ok: false, text: e.message }));
    return () => {
      alive = false;
    };
  }, [familyId]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const r = await api<{ keep: Keep }>("/api/keep", { body: { familyId, keep: { hospital, work, office } } });
      setKeep(r.keep);
      setMsg({ ok: true, text: "覚えました。次から下書きやカレンダーで使います" });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
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
          <Pill tone="ok">院内の道案内: 覚えています（{jpDate(guide.at.slice(0, 10))}に撮影）</Pill>
          <span className="text-sm text-muted">次の健診で撮ると新しくなります</span>
        </p>
      ) : (
        <p className="text-sm text-muted">院内の道案内は、健診の日に撮ると覚えます</p>
      )}

      <h3 className="pt-2 text-base font-bold">職場</h3>
      <input aria-label="会社名" className={field} value={work.company} onChange={(e) => setWork({ ...work, company: e.target.value })} placeholder="会社名" />
      <input aria-label="上司の名前" className={field} value={work.boss} onChange={(e) => setWork({ ...work, boss: e.target.value })} placeholder="上司の名前" />
      <input aria-label="上司のメール" type="email" inputMode="email" className={field} value={work.email} onChange={(e) => setWork({ ...work, email: e.target.value })} placeholder="上司のメール" />

      <h3 className="pt-2 text-base font-bold">役所の窓口</h3>
      <input aria-label="窓口の名前" className={field} value={office.name} onChange={(e) => setOffice({ ...office, name: e.target.value })} placeholder="例: 町役場 こども課" />
      <input aria-label="窓口の場所" className={field} value={office.address} onChange={(e) => setOffice({ ...office, address: e.target.value })} placeholder="場所（カレンダーに入れるため）" />

      <Btn onClick={() => void save()} disabled={saving || !keep} full>
        {saving ? "覚えています…" : "覚える"}
      </Btn>
      {msg && (
        <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "bg-alert/10 font-semibold text-alert"}`}>
          {msg.text}
        </p>
      )}
      <Why>
        <p>職場あての下書きの【会社名】【上司の名前】が、最初から埋まります。</p>
        <p>役所の窓口と病院は、予定をカレンダーに入れる時の場所に入ります。</p>
        <p>欄を空にして「覚える」を押すと、その事は忘れます。</p>
      </Why>
    </Question>
  );
}
