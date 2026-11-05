"use client";

// 前日と当日の「今やる1つ」: 明日 11:30 健診。持ち物と聞く事は件数だけ出し、押すと開く。
// 録音から聞こえただけで、まだ本人が確かめていない日（next.heard）も声かけは出す。「録音から聞こえた日・まだ確かめていません」と［確かめる］を添える
// （2026-11-05 作り手の決め: 確かめなくても手帳は止まらない。カレンダー・LINE・共有の文は「大丈夫」の後だけ）
import { clockAt, clockShort } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { dot } from "@/lib/memory-words";
import { Btn, NextStep, Why } from "@/components/ui";
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
  /** 母以外が開いた時の「ママの健診」（訳した字） */
  whose?: string;
  children?: React.ReactNode;
}) {
  const when = briefingDay(today, next?.date);
  if (!when || !next) return null;
  const c = clockAt(family, next.date);
  // 週数だけの短い言い方（日本語は「28週」のまま。中文「28周」・English「Week 28」）
  const week = c.phase === "pregnant" ? clockShort(c, true) : "";
  const bring = bringList(family, next.date);
  const time = next.time;
  const title = when === "eve" ? (time ? t("明日 {time} 健診", { time }) : t("明日 健診")) : time ? t("今日 {time} 健診", { time }) : t("今日 健診");
  return (
    <NextStep
      eyebrow={[when === "eve" ? t("前の日") : t("今日"), week, whose].filter(Boolean).join(dot())}
      title={title}
      sub={next.heard ? t("録音から聞こえた日・まだ確かめていません") : undefined}
    >
      {next.heard && next.visitId && (
        <Btn kind="secondary" href={`/visit/${next.visitId}`}>
          {t("確かめる")}
        </Btn>
      )}
      {children}
      <div className="flex w-full flex-wrap gap-x-4">
        <Why label={t("持ち物 {n}", { n: bring.length })}>
          <ul className="flex flex-col gap-1 text-base text-ink">
            {/* 持ち物の名前は lib/visit.ts の bringList が日本語で返す。窓口で見せる物なので、訳にも日本語を括弧で並べる */}
            {bring.map((b) => (
              <li key={b}>・{t(b)}</li>
            ))}
          </ul>
          <p>{t("書類の名前は、町や病院で少し違います。")}</p>
        </Why>
        {agenda.length > 0 && (
          <Why label={t("先生に聞く事 {n}", { n: agenda.length })}>
            {/* 聞く事の文は家族が書いた言葉・前回の整理で Claude が書いた質問なので、訳さずにそのまま出す */}
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-base text-ink">
              {agenda.map((a) => (
                <li key={a.id}>{a.text}</li>
              ))}
            </ol>
          </Why>
        )}
      </div>
      {when === "eve" && (
        <Why label={t("録音のひと言")}>
          <p>{t("診察の最初に「録音してもいいですか」と聞くと、あとで家族で聞き返せます。")}</p>
        </Why>
      )}
    </NextStep>
  );
}
