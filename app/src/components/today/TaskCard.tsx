"use client";

// 「今日」の画面の1件: 一番上の大きな1つ（TopTask）と、2つ目からの1行（TaskRow）。
// 表に出すのは、やさしい題・あと◯日・主ボタン1つだけ。根拠と正式な名前は「なぜ？」の中。
import { useEffect, useRef, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { Btn, HandoffRow, NextStep, Pill, Why } from "../ui";
import { MilestoneActions } from "../MilestoneActions";
import { jpShort } from "./dates";
import { daysLeft, isMine, whoLabel, type Task } from "./task";

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
  const days = daysLeft(t, today);
  if (days == null) return null;
  return { days, label: t.status === "まだ先" ? `${jpShort(t.startDate)}から` : `${jpShort(t.deadlineDate!)}まで` };
}

/** 一番上の「今やる1つ」。soon = 自分の今やる事が無く、まだ先の近い事を出した */
export function TopTask(p: Common & { soon?: boolean }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  const eyebrow = p.soon
    ? "もうすぐ"
    : me
      ? isMine(t, me)
        ? "あなたの今やる1つ"
        : `${whoLabel(t, family, me)}の番`
      : `今やる1つ・${whoLabel(t, family, me)}`;
  return (
    <NextStep eyebrow={eyebrow} title={t.plain} sub={t.hint} days={when?.days} dateLabel={when?.label} tone="rose">
      <div className="flex w-full flex-col gap-2">
        <Body {...p} top />
      </div>
    </NextStep>
  );
}

/** 2つ目から: 1行（題・担当の札・あと◯日）。自分の事（使う人がいない時は全部）は押すと開く。ほかの人の番は札だけで開かない */
export function TaskRow(p: Common & { muted?: boolean }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  const others = !!me && !isMine(t, me);
  const showPill = !me || others;
  const line = (
    <>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`text-base leading-snug ${p.muted || others ? "text-muted" : "font-semibold"}`}>{t.plain}</span>
        {showPill && (
          <span>
            <Pill tone={others ? "muted" : "rose"}>{whoLabel(t, family, me)}</Pill>
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        {when && <RowDays days={when.days} upcoming={t.status === "まだ先"} />}
        {!others && (
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        )}
      </span>
    </>
  );

  if (others) {
    return (
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0" aria-label={`${whoLabel(t, family, me)}の番: ${t.plain}`}>
        {line}
      </div>
    );
  }
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">{line}</summary>
      <div className="flex flex-col gap-2 pb-4">
        {when && <span className="tabular text-sm text-muted">{when.label}</span>}
        <p className="text-base">{t.hint}</p>
        <Body {...p} />
      </div>
    </details>
  );
}

/** 下書きの印で済みが変わった事を、今日の画面へ知らせる（Techo が済んだ事を読み直す） */
const notifyDone = () => window.dispatchEvent(new Event("boshi:done"));

function RowDays({ days, upcoming }: { days: number; upcoming: boolean }) {
  const color = upcoming ? "text-muted" : days < 0 || days <= 3 ? "text-alert" : days <= 14 ? "text-warn" : "text-ink";
  const text = days < 0 ? `${-days}日過ぎ` : days === 0 ? "今日" : days === 1 ? "あした" : `あと${days}日`;
  return <span className={`tabular text-sm font-semibold whitespace-nowrap ${color}`}>{text}</span>;
}

/**
 * 開いた中身。
 * 一番上（top）: 主ボタンは1つ。窓口が要る事は「どこへ行くか見る」、書類の事は下書き（MilestoneActions が主を出す）、
 * それ以外は「済んだ」。残り（済んだ・カレンダー）は小さな文字のリンク。
 * 2つ目から: 下書き・窓口は小さく、「済んだ」は枠のボタン。
 */
function Body({ task: t, today, family, me, keep, onDone, top }: Common & { top?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [hasActions, setHasActions] = useState(false);
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
  const notice = !t.deadlineDate; // 期限の無いお知らせ（産休に入れる・健診の回数が変わる、など）
  const doneWord = notice ? "わかった" : "済んだ";
  const doneKind = top ? (hasActions ? "quiet" : "primary") : "secondary";

  return (
    <>
      <div ref={box} className="w-full">
        {top ? (
          <MilestoneActions milestone={t} today={today} primary onDoneChange={notifyDone} />
        ) : (
          <MilestoneActions milestone={t} today={today} compact onDoneChange={notifyDone} />
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-2">
        <Btn kind={doneKind} onClick={onDone} ariaLabel={`${t.plain}を${doneWord}にする`}>
          {doneWord}
        </Btn>
        {calendar && (
          <details className="group/cal text-sm">
            <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 px-1 text-muted">
              <span className="underline underline-offset-2">カレンダーに入れる</span>
              <span className="transition-transform group-open/cal:rotate-90" aria-hidden>
                ›
              </span>
            </summary>
            <div className="pt-1">
              <HandoffRow calendar={calendar} />
            </div>
          </details>
        )}
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
