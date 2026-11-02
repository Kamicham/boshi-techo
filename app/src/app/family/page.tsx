"use client";

// ④ 家族全体の参謀: 開いた時は「わたしの今週」の1つから。ほかの人は名前で切り替える。
// 負担の偏りは、数字の表ではなく1本の帯（誰が何割）で見せる。
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Countdown, daysUntil, Fold, HandoffRow, NextStep, Why } from "@/components/ui";
import { deadlineKindOf, scheduleFor } from "@/lib/milestones";
import { mondayOf, type Plan, type PlanItem } from "@/lib/roles";
import type { Member } from "@/lib/demo-family";

type Phase = "checking" | "empty" | "thinking" | "ready" | "error";

const BAR: Record<Member["role"], string> = { 母: "bg-rose", パートナー: "bg-sky", 祖父母: "bg-ok" };
const DOT: Record<Member["role"], string> = { 母: "text-rose", パートナー: "text-sky", 祖父母: "text-ok" };

export default function FamilyPage() {
  const { family, today, me } = useFamily();
  const [selected, setSelected] = useState<string>("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [phase, setPhase] = useState<Phase>("checking");
  const [error, setError] = useState("");
  // 開いた時に出しているのが「前に考えた分」（その後、やる事や担当が変わった）か
  const [outdated, setOutdated] = useState(false);
  const week = mondayOf(today);

  const member = family.members.find((m) => m.id === selected) ?? me ?? family.members[0];

  // 開いた時・日が変わった時は、覚えてある分だけ見に行く（Claude は呼ばない）。
  // 今の状況の分が無ければ、最後に考えた分を「前に考えた分」として出す（開き直しても消えない）
  useEffect(() => {
    let alive = true;
    setError("");
    api<{ plan: Plan | null; outdated?: boolean }>("/api/family-plan", { body: { familyId: family.id, today, cacheOnly: true } })
      .then((r) => {
        if (!alive) return;
        setPlan(r.plan);
        setOutdated(!!r.outdated);
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
  }, [family.id, today]);

  // 家族を切り替えた時だけ「見ています」に戻す（日を動かした時は、前の結果を出したまま読み直す）
  useEffect(() => {
    setPhase("checking");
    setPlan(null);
  }, [family.id]);

  const make = useCallback(
    async (refresh: boolean) => {
      setPhase("thinking");
      setError("");
      try {
        // 同じ状況なら、サーバが覚えている分をそのまま返す（Claude を呼び直さない）
        const r = await api<{ plan: Plan }>("/api/family-plan", { body: { familyId: family.id, today, refresh } });
        setPlan(r.plan);
        setOutdated(false);
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
      <main className="flex flex-col gap-4 px-4 pt-4">
        <NextStep eyebrow="家族" title="家族を入れる" sub="一人ずつの今週が出ます">
          <Btn href="/settings">家族を入れる</Btn>
        </NextStep>
      </main>
    );
  }

  const nameOf = (id: string) => family.members.find((m) => m.id === id)?.name ?? id;
  const mine = plan?.perMember.find((p) => p.memberId === member.id);
  const big = member.role === "祖父母";
  const isMe = me?.id === member.id;
  const who = isMe ? "わたし" : `${member.name}さん`;
  const [first, ...rest] = mine?.items ?? [];
  // 題は予定表のやさしい言い方、期限は あと◯日（Claude の長い題・日付の文は「なぜ？」の奥へ）
  const schedule = scheduleFor(family);
  const view = (it: PlanItem) => {
    const m = it.milestoneId ? schedule.find((x) => x.id === it.milestoneId) : undefined;
    // 法で決まった期限でない（目安の）事は「あと◯日」と急かさず「目安 ◯月◯日」
    const guide = !!m?.deadlineDate && deadlineKindOf(m) === "目安";
    return {
      title: m?.plain ?? it.title,
      days: m?.deadlineDate && !guide ? daysUntil(today, m.deadlineDate) : null,
      deadline: m?.deadlineDate,
      guide: guide ? `目安 ${jpDate(m!.deadlineDate!)}` : null,
    };
  };
  const top = first ? view(first) : null;
  const openHref = first?.milestoneId ? `/?focus=${encodeURIComponent(first.milestoneId)}` : "/";
  const sendText =
    mine && mine.items.length
      ? [
          `${member.name}さんの今週`,
          ...mine.items.map((it) => {
            const v = view(it);
            return `・${v.title}${v.deadline ? `（${v.guide ? `${v.guide.replace("目安 ", "")}ごろまで` : `${jpDate(v.deadline)}まで`}）` : ""}`;
          }),
        ].join("\n")
      : "";

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="sr-only">家族の今週</h1>

      <div role="tablist" aria-label="家族の一人ずつ" className="flex gap-2 overflow-x-auto">
        {family.members.map((m) => {
          const on = m.id === member.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={on}
              onClick={() => setSelected(m.id)}
              className={`min-h-11 shrink-0 rounded-full border px-4 text-base font-semibold ${on ? "border-rose bg-rose-soft text-rose" : "border-line bg-card text-muted"}`}
            >
              {m.id === me?.id ? "わたし" : m.name}
            </button>
          );
        })}
      </div>

      {phase === "checking" && <p className="text-base text-muted">見ています…</p>}

      {(phase === "empty" || phase === "error") && (
        <NextStep eyebrow={`${jpDate(week)}からの週`} title="今週の分担を考える" sub="家族みんなの予定から、一人ずつに分けます">
          <Btn onClick={() => void make(false)}>{phase === "error" ? "もう一度" : "考える"}</Btn>
        </NextStep>
      )}

      {phase === "thinking" && (
        <p aria-live="polite" className="flex items-center gap-3 rounded-2xl bg-rose-soft p-5 text-lg font-semibold">
          <span className="size-3 animate-pulse rounded-full bg-rose" aria-hidden />
          考えています（30秒ほど）
        </p>
      )}

      {error && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}

      {plan && phase === "ready" && (
        <>
          {outdated && (
            <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-warn/10 px-4 py-2 text-base">
              <span>{jpDate(plan.today)}に考えた分です。その後、やる事や担当が変わりました</span>
              <Btn kind="secondary" onClick={() => void make(false)}>
                考え直す
              </Btn>
            </p>
          )}
          <div className={big ? "text-xl leading-relaxed" : ""}>
            {first && top ? (
              <NextStep eyebrow={`${who}の今週`} title={top.title} days={top.days} dateLabel={top.deadline ? `${jpDate(top.deadline)}まで` : undefined} sub={top.days == null ? (top.guide ?? first.by) : undefined}>
                {isMe ? (
                  <Btn href={openHref}>今日の画面で開く</Btn>
                ) : (
                  <>
                    {sendText && <HandoffRow line={sendText} share={{ title: `${member.name}さんの今週`, text: sendText }} />}
                    <Btn kind="quiet" href={openHref}>
                      今日の画面で開く
                    </Btn>
                  </>
                )}
              </NextStep>
            ) : (
              <NextStep eyebrow={`${who}の今週`} title="今週、頼む事はありません" tone="ok" />
            )}
          </div>

          {first && (
            <Why>
              {top?.title !== first.title && <p className="font-semibold">{first.title}</p>}
              <p>{first.why}</p>
              {top?.days != null && <p>{first.by}</p>}
              {mine?.message && <p>{mine.message}</p>}
            </Why>
          )}

          {rest.length > 0 && (
            <Fold title="ほかの事" count={rest.length}>
              <ul className="flex flex-col gap-3">
                {rest.map((it, i) => {
                  const v = view(it);
                  return (
                    <li key={i} className="flex flex-col gap-0.5 border-b border-line pb-3 last:border-0 last:pb-0">
                      <span className={`leading-snug font-semibold ${big ? "text-xl" : "text-base"}`}>{v.title}</span>
                      {v.days != null ? <Countdown days={v.days} size="sm" /> : <span className={`${big ? "text-lg" : "text-sm"} text-sky`}>{v.guide ?? it.by}</span>}
                      <Why>
                        {v.title !== it.title && <p className="font-semibold">{it.title}</p>}
                        <p>{it.why}</p>
                      </Why>
                    </li>
                  );
                })}
              </ul>
            </Fold>
          )}

          <LoadBand plan={plan} members={family.members} nameOf={nameOf} />

          {plan.rebalance.length > 0 && (
            <Fold title="組み替えの案" count={plan.rebalance.length}>
              {plan.rebalance.map((r, i) => (
                <article key={i} className="flex flex-col gap-1 border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-sky">
                    {nameOf(r.fromMemberId)} → {nameOf(r.toMemberId)}
                  </p>
                  <p className="text-base leading-snug font-semibold">{r.title}</p>
                  <Why>
                    <p>{r.why}</p>
                  </Why>
                </article>
              ))}
            </Fold>
          )}

          <div className="flex items-center gap-2 pb-6">
            <Btn kind="quiet" onClick={() => void make(true)}>
              作り直す
            </Btn>
            <span className="tabular text-sm text-muted">{jpDate(plan.today)}に作成</span>
          </div>
        </>
      )}
    </main>
  );
}

/** 負担の偏り: 1本の帯に、誰が何割かを並べる */
function LoadBand({ plan, members, nameOf }: { plan: Plan; members: Member[]; nameOf: (id: string) => string }) {
  const total = plan.load.reduce((s, l) => s + Math.max(0, l.value), 0);
  if (total === 0) return null;
  const parts = plan.load.map((l) => {
    const m = members.find((x) => x.id === l.memberId);
    return { ...l, role: m?.role, share: Math.max(0, l.value) / total };
  });
  return (
    <section aria-label="負担の偏り" className="flex flex-col gap-2">
      <p className="text-base font-semibold">いまの負担</p>
      <div className="flex h-5 overflow-hidden rounded-full bg-line" role="img" aria-label={parts.map((p) => `${nameOf(p.memberId)} ${Math.round(p.share * 10)}割`).join("、")}>
        {parts.map((p) => (
          <div key={p.memberId} className={`h-full ${p.role ? BAR[p.role] : "bg-muted"}`} style={{ width: `${p.share * 100}%` }} />
        ))}
      </div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-base">
        {parts.map((p) => (
          <span key={p.memberId}>
            <span className={p.role ? DOT[p.role] : "text-muted"} aria-hidden>
              ●
            </span>{" "}
            {nameOf(p.memberId)} <b className="tabular">{Math.round(p.share * 10)}割</b>
          </span>
        ))}
      </p>
      {parts.some((p) => p.note) && (
        <Why>
          {parts
            .filter((p) => p.note)
            .map((p) => (
              <p key={p.memberId}>
                {nameOf(p.memberId)}: {p.note}
              </p>
            ))}
        </Why>
      )}
    </section>
  );
}
