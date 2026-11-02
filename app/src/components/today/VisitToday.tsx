"use client";

// 健診の前日・当日だけ、一番上の1つを健診にする（「明日 11:30 健診」→ 健診を開く）。
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { bringList, briefingDay, visitLabel, type VisitPlan } from "@/lib/visit";
import { Btn, HandoffRow, NextStep } from "../ui";

export function visitIsTop(today: string, next: VisitPlan["next"] | null | undefined): boolean {
  return !!next && !!briefingDay(today, next.date);
}

export function VisitToday({
  family,
  today,
  next,
  agendaCount,
  keep,
}: {
  family: Family;
  today: string;
  next: NonNullable<VisitPlan["next"]>;
  agendaCount: number;
  keep: Keep | null;
}) {
  const when = briefingDay(today, next.date);
  const day = when === "eve" ? "明日" : "今日";
  const bring = bringList(family, next.date).length;
  const hospital = keep?.hospital?.name;
  const sub = [`持ち物 ${bring}つ`, agendaCount > 0 ? `聞く事 ${agendaCount}つ` : null].filter(Boolean).join("・");
  return (
    <NextStep eyebrow={`${visitLabel(family, next.date)}の健診${hospital ? `・${hospital}` : ""}`} title={`${day}${next.time ? ` ${next.time}` : ""} 健診`} sub={sub} tone="rose">
      <Btn href="/visit">健診を開く</Btn>
      {hospital && <HandoffRow place={hospital} />}
    </NextStep>
  );
}
