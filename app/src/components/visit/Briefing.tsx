"use client";

// 前日と当日の「今やる1つ」: 明日 11:30 健診。持ち物と聞く事は件数だけ出し、押すと開く。
import { clockAt } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { NextStep, Why } from "@/components/ui";
import { bringList, briefingDay, type AgendaItem, type VisitPlan } from "@/lib/visit";

export function Briefing({
  family,
  today,
  next,
  agenda,
  whose,
  children,
}: {
  family: Family;
  today: string;
  next: VisitPlan["next"];
  agenda: AgendaItem[];
  /** 母以外が開いた時の「ママの」 */
  whose?: string;
  children?: React.ReactNode;
}) {
  const when = briefingDay(today, next?.date);
  if (!when || !next) return null;
  const c = clockAt(family, next.date);
  const week = c.phase === "pregnant" ? `${c.pregnancyWeek}週` : "";
  const bring = bringList(family, next.date);
  return (
    <NextStep
      eyebrow={[when === "eve" ? "前の日" : "今日", week, whose].filter(Boolean).join("・")}
      title={`${when === "eve" ? "明日" : "今日"}${next.time ? ` ${next.time}` : ""} 健診`}
    >
      {children}
      <div className="flex w-full flex-wrap gap-x-4">
        <Why label={`持ち物 ${bring.length}`}>
          <ul className="flex flex-col gap-1 text-base text-ink">
            {bring.map((b) => (
              <li key={b}>・{b}</li>
            ))}
          </ul>
          <p>書類の名前は、町や病院で少し違います。</p>
        </Why>
        {agenda.length > 0 && (
          <Why label={`聞く事 ${agenda.length}`}>
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-base text-ink">
              {agenda.map((a) => (
                <li key={a.id}>{a.text}</li>
              ))}
            </ol>
          </Why>
        )}
      </div>
      {when === "eve" && (
        <Why label="録音のひと言">
          <p>診察の最初に「録音してもいいですか」と聞くと、あとで家族で聞き返せます。</p>
        </Why>
      )}
    </NextStep>
  );
}
