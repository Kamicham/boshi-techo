"use client";

// 自分の手帳を始める（UI/UX 見直し「自分の手帳の入口」2026-11-04）。
// 先に3つだけ聞いて（予定日か生まれた日・町・あなたは）、記録の無いまま「いま」をその場で出す。
// 答えはこの端末の中だけ（localStorage）。「残す」を押した時に、メールのコードで入って家族の手帳を作る。
// 公開版（体験）では本物の家族の登録を閉じているので、「残す」の手前まで。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { field, Msg } from "@/components/settings/account-ui";
import { clockAt, diffDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { deadlineKindOf, scheduleFor, statusOf } from "@/lib/milestones";
import { planToday, withAssignee } from "@/components/today/task";
import { jpShort } from "@/components/today/dates";
import { recentlyPassed } from "@/lib/started-late";

type Answers = { born: boolean; date: string; prefecture: string; city: string; me: "mother" | "partner" };
const KEY = "boshi.start";
const PUBLIC = process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1";

function realToday(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}
function load(): Answers | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Answers | null;
    return v && typeof v.date === "string" ? v : null;
  } catch {
    return null;
  }
}
function store(a: Answers | null) {
  try {
    if (a) localStorage.setItem(KEY, JSON.stringify(a));
    else localStorage.removeItem(KEY);
  } catch {}
}

/** 3つの答えから、手帳の形（記録なし）を作る。生まれた後に始めた時は、生まれた日を予定日の代わりにも使う（近似） */
function familyOf(a: Answers): Family {
  return {
    id: "start",
    city: a.city.trim(),
    prefecture: a.prefecture.trim(),
    dueDate: a.date,
    ...(a.born ? { birthDate: a.date } : {}),
    members: [a.me === "mother" ? { id: "me", name: "あなた", role: "母" } : { id: "me", name: "あなた", role: "パートナー" }],
  };
}

export default function Start() {
  const { account, accountsEnabled, reload, setFamilyId } = useFamily();
  const [a, setA] = useState<Answers>({ born: false, date: "", prefecture: "", city: "", me: "mother" });
  const [step, setStep] = useState<"ask" | "show">("ask");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const today = realToday();

  // 前に答えた事があれば、そのまま手帳を出す。ログインから戻った時（?save=1）は、そのまま残す
  useEffect(() => {
    const saved = load();
    if (!saved) return;
    setA(saved);
    setStep("show");
    if (new URLSearchParams(window.location.search).get("save") === "1" && account) void keep(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [account]);

  const ready = /^\d{4}-\d{2}-\d{2}$/.test(a.date) && a.city.trim().length > 0;
  const tooFar = ready && (a.born ? diffDays(today, a.date) > 731 || a.date > today : diffDays(a.date, today) > 300 || a.date < today);

  const keep = async (ans: Answers) => {
    setBusy(true);
    setMsg(null);
    try {
      const r = await api<{ householdId: string }>("/api/account/household", { body: { name: "わが家", me: ans.me } });
      const f = familyOf(ans);
      await api("/api/account/profile", {
        body: { familyId: r.householdId, dueDate: f.dueDate, birthDate: f.birthDate ?? "", city: f.city, prefecture: f.prefecture, members: [{ id: "m0", name: ans.me === "mother" ? "ママ" : "パートナー", role: f.members[0].role }] },
      });
      store(null);
      await reload();
      setFamilyId(r.householdId);
      window.location.href = `/account/consent?familyId=${encodeURIComponent(r.householdId)}&next=/`;
    } catch (e) {
      setMsg({ ok: false, text: `まだ残せていません（${(e as Error).message}）` });
      setBusy(false);
    }
  };

  if (step === "ask")
    return (
      <main className="flex flex-col gap-5 px-4 pt-6 pb-10">
        <Link href="/" className="inline-flex min-h-11 items-center self-start text-base text-muted">
          ‹ 戻る
        </Link>
        <header className="flex flex-col gap-2">
          <h1 className="font-display text-2xl font-bold">自分の手帳を始める</h1>
          <p className="text-base text-muted">3つだけ。答えると、あなたの手帳がその場で動きます。名前やメールは、残す時に。</p>
        </header>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!ready || tooFar) return;
            store(a);
            setStep("show");
          }}
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 font-display text-lg font-bold">1. いつ？</legend>
            <div className="flex flex-wrap gap-2">
              {[
                { v: false, l: "おなかにいる" },
                { v: true, l: "もう生まれた" },
              ].map((o) => (
                <button key={o.l} type="button" aria-pressed={a.born === o.v} onClick={() => setA({ ...a, born: o.v })} className={`min-h-11 rounded-full px-5 text-base font-semibold ${a.born === o.v ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}>
                  {o.l}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1 text-base">
              {a.born ? "生まれた日" : "出産予定日"}
              <input id="start-date" type="date" required className={field} value={a.date} onChange={(e) => setA({ ...a, date: e.target.value })} />
            </label>
            {tooFar && <p className="text-sm text-alert">{a.born ? "生まれてから2歳までの日を入れてください" : "今日から先、およそ10か月までの日を入れてください"}</p>}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 font-display text-lg font-bold">2. 住んでいる町</legend>
            <p className="text-sm text-muted">手続きの窓口と、町ごとの制度を出すのに使います</p>
            <div className="flex flex-col gap-2">
              <input id="start-pref" aria-label="都道府県" className={field} value={a.prefecture} onChange={(e) => setA({ ...a, prefecture: e.target.value })} placeholder="埼玉県" />
              <input id="start-city" aria-label="市区町村" required className={field} value={a.city} onChange={(e) => setA({ ...a, city: e.target.value })} placeholder="さいたま市" />
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="pb-2 font-display text-lg font-bold">3. あなたは</legend>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["mother", "ママ（母）"],
                  ["partner", "パートナー"],
                ] as const
              ).map(([v, l]) => (
                <button key={v} type="button" aria-pressed={a.me === v} onClick={() => setA({ ...a, me: v })} className={`min-h-11 rounded-full px-5 text-base font-semibold ${a.me === v ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}>
                  {l}
                </button>
              ))}
            </div>
          </fieldset>
          <button disabled={!ready || tooFar} className="min-h-12 rounded-full bg-rose font-display text-lg font-bold text-white disabled:opacity-50">
            手帳を開く
          </button>
          <p className="text-sm text-muted">答えはこの端末の中だけに置きます。まだどこにも送りません。</p>
        </form>
      </main>
    );

  return <Preview a={a} today={today} busy={busy} msg={msg} onEdit={() => setStep("ask")} onKeep={() => (account ? void keep(a) : (window.location.href = "/login?next=" + encodeURIComponent("/start?save=1")))} canKeep={!PUBLIC && accountsEnabled} />;
}

/** 記録なしの「いま」: 予定と町だけで、やる事の並びを出す */
function Preview({ a, today, busy, msg, onEdit, onKeep, canKeep }: { a: Answers; today: string; busy: boolean; msg: { ok: boolean; text: string } | null; onEdit: () => void; onKeep: () => void; canKeep: boolean }) {
  const family = useMemo(() => familyOf(a), [a]);
  const me = family.members[0];
  const plan = useMemo(() => {
    // 始める前に期限が過ぎた事は、済んだ事として扱う（保存した時のサーバと同じ: 途中から使い始めた家族）
    const schedule = scheduleFor(family, today);
    const done = new Set(schedule.filter((m) => m.deadlineDate && !m.awaitingBirth && m.deadlineDate < today).map((m) => m.id));
    const tasks = schedule.map((m) => withAssignee({ ...m, status: statusOf(m, today, done) }, family, undefined));
    return { ...planToday(tasks, today, me), count: tasks.filter((t) => t.status !== "済み").length, before: recentlyPassed(schedule, today) };
  }, [family, today, me]);
  const c = clockAt(family, today);
  const toDue = diffDays(family.dueDate, today);
  const top = plan.top;
  const next = [...plan.rest, ...plan.upcoming].slice(0, 3);
  // 今やる事が無い時期: 「いま」と同じ言い方で、次に動く事と日付を出す
  const when = (t: (typeof next)[number]) =>
    t.status === "まだ先" ? (t.awaitingBirth ? "生まれたら" : `${jpShort(t.startDate, today)}ごろから`) : t.deadlineDate ? `${jpShort(t.deadlineDate, today)}まで` : "";

  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-10">
      <div className="flex min-h-11 items-center justify-between gap-2 rounded-full bg-rose-soft px-4 text-sm">
        <span>
          あなたの手帳 ・ <b>{c.label.replace(/(\d+週)\d+日/, "$1")}</b>
        </span>
        <button type="button" onClick={onEdit} className="min-h-11 font-semibold text-rose">
          答えを直す
        </button>
      </div>
      <h1 className="font-display text-xl font-bold">
        {c.phase === "pregnant" ? `${c.pregnancyWeek}週 ・ 予定日まであと${toDue}日` : c.label}
        <span className="block text-base font-normal text-muted">
          {family.prefecture}
          {family.city}・2歳までにやる事 {plan.count}件を、手帳が時期ごとに出します
        </span>
      </h1>

      {top && (
        <section className="flex flex-col gap-2 rounded-3xl bg-rose-soft px-5 py-5">
          <p className="text-sm font-semibold text-muted">{plan.topIsSoon ? "もうすぐ" : "次にやる事"}</p>
          <h2 className="font-display text-2xl leading-snug font-bold">{top.plain}</h2>
          {top.hint && <p className="text-base">{top.hint}</p>}
          {top.deadlineDate && (
            <p className="text-base text-muted">
              {deadlineKindOf(top)} <b className="text-ink">{jpShort(top.deadlineDate, today)}</b>{deadlineKindOf(top) === "目安" ? " ごろまでに" : " まで"}
            </p>
          )}
          {top.needsLocal && (
            <p className="rounded-xl bg-card/70 px-3 py-2 text-base">
              残すと、手帳が{family.city}の窓口・持ち物を調べて、書く事のメモまで作っておきます
            </p>
          )}
        </section>
      )}

      {!top && next[0] && (
        <section className="flex flex-col gap-2 rounded-3xl border border-line bg-card px-5 py-5">
          <h2 className="font-display text-2xl leading-snug font-bold">{plan.before.length > 0 ? "始める前の事のほかは、急ぐ事はありません" : "今週は、何もしなくて大丈夫"}</h2>
          <p className="text-base">
            次に動くのは「{next[0].plain}」（{when(next[0])}）。近づいたら、手帳が一番上に出します。
          </p>
        </section>
      )}

      {next.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-muted">このあと</h2>
          <ul className="flex flex-col divide-y divide-line">
            {next.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-base">
                <span className="min-w-0">{t.plain}</span>
                <span className="shrink-0 text-sm text-muted">{when(t)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.before.length > 0 && (
        <section className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold text-muted">始める前に目安が過ぎた事（残すと、済んでいるかを聞きます）</h2>
          <ul className="flex flex-col divide-y divide-line">
            {plan.before.map((t) => (
              <li key={t.id} className="flex items-baseline justify-between gap-3 py-2 text-base">
                <span className="min-w-0">{t.plain}</span>
                <span className="shrink-0 text-sm text-muted">目安 {jpShort(t.deadlineDate!, today)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-3 rounded-3xl bg-sky-soft px-5 py-5">
        <h2 className="font-display text-lg font-bold">この手帳を残しますか</h2>
        <p className="text-base">メールのコードで入ると、済んだ印が残り、家族と分け合えて、話した事・撮った紙・写真が手帳に積み上がります。</p>
        {canKeep ? (
          <Btn onClick={onKeep} disabled={busy} full>
            {busy ? "手帳を作っています…" : "残す（メールで入る）"}
          </Btn>
        ) : (
          <p className="rounded-xl bg-card/70 px-3 py-2 text-base">この体験版では、本物の家族の手帳はまだ残せません。見本の家族の手帳で、記録がたまった後の姿を触れます。</p>
        )}
        <Btn href="/" kind="secondary" full>
          見本の家族の手帳を見る
        </Btn>
      </section>
      <Msg msg={msg} />
    </main>
  );
}
