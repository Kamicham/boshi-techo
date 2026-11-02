"use client";

// 「今日」の画面の1件: 一番上の大きな1つ（TopTask）と、2つ目からの1行（TaskRow）。
// 表に出すのは、やさしい題・あと◯日・主ボタン1つだけ。根拠と正式な名前は「なぜ？」の中。
import { useEffect, useRef, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { Btn, HandoffRow, NextStep, Pill, Why, daysUntil } from "../ui";
import { MilestoneActions } from "../MilestoneActions";
import { jpShort } from "./dates";
import { isMine, whoLabel, type Task } from "./task";

interface Common {
  task: Task;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onDone: () => void;
}

/** いつまで（期限があれば期限、まだ始まっていなければ始まり） */
function target(t: Task, today: string): { days: number; label: string } | null {
  if (t.status === "まだ先") return { days: daysUntil(today, t.startDate), label: `${jpShort(t.startDate)}から` };
  if (t.deadlineDate) return { days: daysUntil(today, t.deadlineDate), label: `${jpShort(t.deadlineDate)}まで` };
  return null;
}

/** 一番上の「今やる1つ」 */
export function TopTask(p: Common) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  const mine = isMine(t, me);
  const eyebrow = me ? (mine ? "あなたの今やる1つ" : `${whoLabel(t, family, me)}の番`) : `今やる1つ・${whoLabel(t, family, me)}`;
  return (
    <NextStep eyebrow={eyebrow} title={t.plain} sub={t.hint} days={when?.days} dateLabel={when?.label} tone="rose">
      <div className="flex w-full flex-col gap-2">
        <Body {...p} />
      </div>
    </NextStep>
  );
}

/** 2つ目から: 1行（題・あと◯日）。押すと開く */
export function TaskRow(p: Common & { muted?: boolean }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
        <span className={`min-w-0 text-base leading-snug ${p.muted ? "text-muted" : "font-semibold"}`}>{t.plain}</span>
        <span className="flex shrink-0 items-center gap-2">
          {when && <RowDays days={when.days} upcoming={t.status === "まだ先"} />}
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 pb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={isMine(t, me) ? "rose" : "muted"}>{whoLabel(t, family, me)}</Pill>
          {when && <span className="tabular text-sm text-muted">{when.label}</span>}
        </div>
        <p className="text-base">{t.hint}</p>
        <Body {...p} />
      </div>
    </details>
  );
}

function RowDays({ days, upcoming }: { days: number; upcoming: boolean }) {
  const color = upcoming ? "text-muted" : days < 0 || days <= 3 ? "text-alert" : days <= 14 ? "text-warn" : "text-ink";
  const text = days < 0 ? `${-days}日過ぎ` : days === 0 ? "今日" : days === 1 ? "あした" : `あと${days}日`;
  return <span className={`tabular text-sm font-semibold ${color}`}>{text}</span>;
}

/** 開いた中身: 町の調べ・下書き（あれば主）→ 済んだ → なぜ？・カレンダー */
function Body({ task: t, today, family, me, keep, onDone }: Common) {
  const box = useRef<HTMLDivElement>(null);
  const [hasActions, setHasActions] = useState(false);
  // HandoffRow は端末（iPhone か）で中身が変わるので、サーバの描画と食い違わないよう開いてから出す
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // MilestoneActions は、下書きも町の調べも無い事では何も出さない。出た時だけ、それを主にする
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const check = () => setHasActions(el.childElementCount > 0);
    check();
    const ob = new MutationObserver(check);
    ob.observe(el, { childList: true });
    return () => ob.disconnect();
  }, [t.id]);

  const place = t.kind === "健診" ? keep?.hospital?.name : t.kind === "手続き" ? keep?.office?.address || keep?.office?.name : undefined;
  const calendar = t.deadlineDate
    ? { title: `${t.plain}（期限）`, date: t.deadlineDate, details: `${t.hint}\n${t.title}\n根拠: ${t.basis}`, place: place || undefined }
    : undefined;
  const notice = !t.deadlineDate; // 期限の無いお知らせ（健診の回数が変わる、など）

  return (
    <>
      <div ref={box} className="w-full">
        <MilestoneActions milestone={t} today={today} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn kind={hasActions ? "secondary" : "primary"} onClick={onDone}>
          {notice ? "わかった" : "済んだ"}
        </Btn>
        {mounted && calendar && <HandoffRow calendar={calendar} />}
      </div>
      <Why>
        <span>
          {t.title}（{t.kind}・{whoLabel(t, family, me)}）
        </span>
        <span>根拠: {t.basis}</span>
        {t.deadlineDate && <span>期限 {jpShort(t.deadlineDate)}・始まり {jpShort(t.startDate)}</span>}
      </Why>
    </>
  );
}
