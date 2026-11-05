"use client";

// 健診の前日・当日だけ、一番上の1つを健診にする（「明日 11:30 健診」→ 健診を開く）。
import { clockAt, clockShort } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { currentLang, t } from "@/lib/i18n";
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
  const time = next.time;
  const title = when === "eve" ? (time ? t("明日 {time} 健診", { time }) : t("明日 健診")) : time ? t("今日 {time} 健診", { time }) : t("今日 健診");
  const bring = bringList(family, next.date).length;
  const hospital = keep?.hospital?.name;
  const sub = [t("持ち物 {n}つ", { n: bring }), agendaCount > 0 ? t("先生に聞く事 {n}つ", { n: agendaCount }) : null].filter(Boolean).join(t("・"));
  // 時期の言い方: 日本語は健診の画面と同じ visitLabel（lib/visit.ts）、ほかの言葉は週数・月齢の言い方（lib/clock.ts の clockShort）
  const label = currentLang() === "ja" ? visitLabel(family, next.date) : clockShort(clockAt(family, next.date));
  return (
    <NextStep eyebrow={hospital ? t("{label}の健診・{hospital}", { label, hospital }) : t("{label}の健診", { label })} title={title} sub={sub} tone="rose">
      <Btn href="/visit">{t("健診を開く")}</Btn>
      {hospital && <HandoffRow place={hospital} />}
    </NextStep>
  );
}
