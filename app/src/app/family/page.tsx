"use client";

// ④ 家族全体の参謀: 一人ずつの「今週のあなたの事」と、負担の偏り・組み替えの提案。
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { addDays } from "@/lib/clock";
import { mondayOf, type Plan } from "@/lib/roles";
import type { Member } from "@/lib/demo-family";

type Phase = "checking" | "empty" | "thinking" | "ready" | "error";

const BAR: Record<Member["role"], string> = { 母: "bg-rose", パートナー: "bg-sky", 祖父母: "bg-ok" };

export default function FamilyPage() {
  const { family, today } = useFamily();
  const [selected, setSelected] = useState<string>("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");
  const week = mondayOf(today);

  const member = family.members.find((m) => m.id === selected) ?? family.members[0];

  // 週が変わったら、保存してある分だけ見に行く（Claude は呼ばない）
  useEffect(() => {
    let alive = true;
    setPhase("checking");
    setError("");
    api<{ plan: Plan | null }>("/api/family-plan", { body: { familyId: family.id, today, cacheOnly: true } })
      .then((r) => {
        if (!alive) return;
        setPlan(r.plan);
        setPhase(r.plan ? "ready" : "empty");
      })
      .catch((e: Error) => {
        if (!alive) return;
        setPlan(null);
        setError(e.message);
        setPhase("error");
      });
    return () => {
      alive = false;
    };
    // 同じ週の中で日を動かしても読み直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, week]);

  const make = useCallback(
    async (refresh: boolean) => {
      setPhase("thinking");
      setError("");
      try {
        const r = await api<{ plan: Plan }>("/api/family-plan", { body: { familyId: family.id, today, refresh } });
        setPlan(r.plan);
        setPhase("ready");
      } catch (e) {
        setError((e as Error).message);
        setPhase(plan ? "ready" : "error");
      }
    },
    [family.id, today, plan],
  );

  if (family.members.length === 0) {
    return (
      <main className="flex flex-col gap-3 px-4 pt-4">
        <h1 className="font-display text-2xl font-bold">家族</h1>
        <p className="text-sm text-muted">「わが家の設定」で家族の呼び名を入れると、一人ずつの今週が出ます。</p>
      </main>
    );
  }

  const nameOf = (id: string) => family.members.find((m) => m.id === id)?.name ?? id;
  const mine = plan?.perMember.find((p) => p.memberId === member.id);
  const big = member.role === "祖父母";

  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">家族の今週</h1>
        <p className="tabular text-sm text-muted">
          {jpDate(week)}〜{jpDate(addDays(week, 6))}の週。今と、この先2週間の事を分けています。
        </p>
      </header>

      <div role="tablist" aria-label="家族の一人ずつ" className="flex gap-2 overflow-x-auto">
        {family.members.map((m) => {
          const on = m.id === member.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(m.id)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${on ? "border-rose bg-rose-soft text-rose" : "border-line bg-card text-muted"}`}
            >
              {m.name}
              <span className="ml-1 text-xs font-normal">（{m.role}）</span>
            </button>
          );
        })}
      </div>

      {phase === "checking" && <p className="text-sm text-muted">保存してある今週の分を見ています…</p>}

      {phase === "empty" && (
        <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
          <p className="text-sm">この週の分担はまだありません。家族みんなの予定と、いまの時期から考えます。</p>
          <button onClick={() => make(false)} className="self-start rounded-lg bg-rose px-5 py-2 font-semibold text-white">
            今週の分担を考える
          </button>
        </section>
      )}

      {phase === "thinking" && (
        <section aria-live="polite" className="flex items-center gap-3 rounded-xl border border-line bg-card p-4 text-sm">
          <span className="size-3 animate-pulse rounded-full bg-rose" aria-hidden />
          家族みんなの今週を考えています。一人ずつの言葉に直すので、30秒ほどかかります…
        </section>
      )}

      {error && <p className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}
      {phase === "error" && (
        <button onClick={() => make(false)} className="self-start rounded-lg border border-line px-4 py-1.5 text-sm">
          もう一度
        </button>
      )}

      {plan && phase !== "thinking" && phase !== "checking" && (
        <>
          <section aria-label={`${member.name}さんの今週`} className={`flex flex-col gap-3 rounded-xl border border-line bg-card p-4 ${big ? "text-xl leading-relaxed" : ""}`}>
            <h2 className={`font-display font-bold ${big ? "text-2xl" : "text-lg"}`}>{member.name}さんの今週</h2>
            {mine?.message && <p className={`rounded-lg bg-rose-soft px-3 py-2 ${big ? "text-xl" : "text-sm"}`}>{mine.message}</p>}
            {mine && mine.items.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {mine.items.map((it, i) => (
                  <li key={i} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-0 last:pb-0">
                    <span className="font-semibold leading-snug">{it.title}</span>
                    <span className={`${big ? "text-xl" : "text-xs"} text-sky`}>{it.by}</span>
                    <span className={`${big ? "text-xl" : "text-xs"} text-muted`}>{it.why}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={big ? "text-xl" : "text-sm text-muted"}>今週、{member.name}さんに頼む事はありません。</p>
            )}
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="font-display text-lg font-bold">負担の偏り</h2>
            <ul className="flex flex-col gap-3">
              {plan.load.map((l) => {
                const m = family.members.find((x) => x.id === l.memberId);
                return (
                  <li key={l.memberId} className="flex flex-col gap-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span className="font-semibold">{nameOf(l.memberId)}</span>
                      <span className="tabular text-xs text-muted">{l.value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-line" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={l.value} aria-label={`${nameOf(l.memberId)}の負担`}>
                      <div className={`h-full rounded-full ${m ? BAR[m.role] : "bg-muted"}`} style={{ width: `${l.value}%` }} />
                    </div>
                    {l.note && <p className="text-xs text-muted">{l.note}</p>}
                  </li>
                );
              })}
            </ul>
          </section>

          {plan.rebalance.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">組み替えの提案</h2>
              {plan.rebalance.map((r, i) => (
                <article key={i} className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4">
                  <p className="text-xs font-semibold text-sky">
                    {nameOf(r.fromMemberId)} → {nameOf(r.toMemberId)}
                  </p>
                  <h3 className="font-semibold leading-snug">{r.title}</h3>
                  <p className="text-sm text-muted">{r.why}</p>
                </article>
              ))}
            </section>
          )}

          <div className="flex items-center gap-3 pb-6">
            <button onClick={() => make(true)} className="rounded-lg border border-line bg-card px-4 py-1.5 text-sm font-semibold">
              作り直す
            </button>
            <span className="tabular text-xs text-muted">{jpDate(plan.today)}に、{plan.considered}件の事から考えました</span>
          </div>
        </>
      )}
    </main>
  );
}
