"use client";

// 前日と当日の声かけ: 録音のひと言・持ち物・聞く事。
import { clockAt } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { bringList, briefingDay, type AgendaItem, type VisitPlan } from "@/lib/visit";

export function Briefing({ family, today, next, agenda }: { family: Family; today: string; next: VisitPlan["next"]; agenda: AgendaItem[] }) {
  const when = briefingDay(today, next?.date);
  if (!when || !next) return null;
  const c = clockAt(family, next.date);
  const what = c.phase === "pregnant" ? `${c.pregnancyWeek}週の健診` : "健診";
  const day = when === "eve" ? "明日" : "今日";
  return (
    <section aria-label="健診の声かけ" className="flex flex-col gap-3 rounded-xl border-2 border-rose bg-rose-soft p-4">
      <p className="text-xs font-semibold tracking-widest text-rose">{when === "eve" ? "前日の声かけ" : "今日の声かけ"}</p>
      <h2 className="font-display text-xl font-bold leading-snug">
        {day}は{what}です{next.time ? `（${next.time}）` : ""}。
      </h2>
      <p className="text-sm leading-relaxed">
        先生の説明を録音しておくと、あとで家族で聞き返せます。最初に「録音してもいいですか」と一言どうぞ。
      </p>
      <div>
        <h3 className="mb-1 text-sm font-semibold">持ち物</h3>
        <ul className="grid grid-cols-2 gap-1 text-sm">
          {bringList(family, next.date).map((b) => (
            <li key={b} className="rounded-lg bg-card px-2 py-1">{b}</li>
          ))}
        </ul>
        <p className="mt-1 text-xs text-muted">書類の名前は、町や病院によって少し違います。</p>
      </div>
      {agenda.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold">聞く事（{agenda.length}）</h3>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            {agenda.map((a) => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
