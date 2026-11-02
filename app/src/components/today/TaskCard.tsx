"use client";

// 「今日」の画面の1件: 一番上の大きな1つ（TopTask）と、2つ目からの1行（TaskRow）。
// 表に出すのは、やさしい題・あと◯日・主ボタン1つだけ。根拠と正式な名前は「なぜ？」の中。
import { useEffect, useRef, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { WHO_CHOICES, type Assign } from "@/lib/assign";
import { deadlineKindOf, type Who } from "@/lib/milestones";
import { Btn, HandoffRow, NextStep, Pill, Why } from "../ui";
import { MilestoneActions } from "../MilestoneActions";
import { jpShort } from "./dates";
import { daysLeft, isMine, whoLabel, type Task } from "./task";

/** 担当を決め直した事（lib/assign の applyAssignments が付ける） */
export type ShownTask = Task & { assignedTo?: string };

interface Common {
  task: ShownTask;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onDone: () => void;
  /** 担当を変える（null = 予定表の目安に戻す）。無ければ担当の選び直しを出さない */
  onAssign?: (a: Assign | null) => void;
  /** 家族が担当を決め直した事か */
  reassigned?: boolean;
}

/** 期限が法で決まっていない（目安の）事か。「あと◯日」と急かさず「目安 ◯/◯」と言う */
export function isGuide(t: Task): boolean {
  return !!t.deadlineDate && deadlineKindOf(t) === "目安";
}

/** いつまで（期限があれば期限、まだ始まっていなければ始まり）。目安の事は guide に日付だけ */
function target(t: Task, today: string): { days: number; label: string } | { guide: string; past: boolean } | null {
  if (t.status !== "まだ先" && isGuide(t)) return { guide: jpShort(t.deadlineDate!), past: t.deadlineDate! < today };
  const days = daysLeft(t, today);
  if (days == null) return null;
  return { days, label: t.status === "まだ先" ? `${jpShort(t.startDate)}から` : `${jpShort(t.deadlineDate!)}まで` };
}

/** 担当の呼び名（人まで決めた時はその人の名前） */
function whoName(t: ShownTask, family: Family, me: Member | null): string {
  if (t.assignedTo) {
    if (me && t.assignedTo === me.id) return "あなた";
    const p = family.members.find((m) => m.id === t.assignedTo);
    if (p) return p.name;
  }
  return whoLabel(t, family, me);
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
        : `${whoName(t, family, me)}の番`
      : `今やる1つ・${whoName(t, family, me)}`;
  const counted = when && "days" in when ? when : null;
  const guide = when && "guide" in when ? when : null;
  return (
    <NextStep eyebrow={eyebrow} title={t.plain} sub={t.hint} days={counted?.days} dateLabel={counted?.label} tone="rose">
      <div className="flex w-full flex-col gap-2">
        {guide && <GuideLine guide={guide.guide} past={guide.past} />}
        <Body {...p} top />
      </div>
    </NextStep>
  );
}

/** 2つ目から: 1行（題・担当の札・あと◯日）。押すと開く（ほかの人の番も、なぜ？・どこへ・担当の変更が見られる） */
export function TaskRow(p: Common & { muted?: boolean }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  const others = !!me && !isMine(t, me);
  const showPill = !me || others || t.who === "家族";
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary
        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2"
        aria-label={others ? `${whoName(t, family, me)}の番: ${t.plain}` : undefined}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-base leading-snug ${p.muted || others ? "text-muted" : "font-semibold"}`}>{t.plain}</span>
          {showPill && (
            <span>
              <Pill tone={others ? "muted" : "rose"}>{whoName(t, family, me)}</Pill>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {when && ("days" in when ? <RowDays days={when.days} upcoming={t.status === "まだ先"} /> : <RowGuide guide={when.guide} />)}
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 pb-4">
        {when && "days" in when && <span className="tabular text-sm text-muted">{when.label}</span>}
        {when && "guide" in when && <GuideLine guide={when.guide} past={when.past} />}
        <p className="text-base">{t.hint}</p>
        {others && <p className="text-sm text-muted">{whoName(t, family, me)}の番です。代わりにやる時や、担当を変える時に開いてください</p>}
        <Body {...p} />
      </div>
    </details>
  );
}

/** 目安の日（法の期限ではない）。過ぎても赤くしない */
function RowGuide({ guide }: { guide: string }) {
  return <span className="tabular text-sm whitespace-nowrap text-muted">目安 {guide.replace(/（.）$/, "")}</span>;
}

function GuideLine({ guide, past }: { guide: string; past: boolean }) {
  return (
    <p className="text-base text-muted">
      目安 <span className="tabular font-semibold text-ink">{guide}</span>
      {past ? "（過ぎていても、今からできます）" : "（法で決まった期限ではありません）"}
    </p>
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
function Body({ task: t, today, family, me, keep, onDone, onAssign, reassigned, top }: Common & { top?: boolean }) {
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
      {onAssign && <AssignPicker task={t} family={family} me={me} reassigned={!!reassigned} onAssign={onAssign} />}
      <Why>
        <span>
          {t.title}（{t.kind}・{whoName(t, family, me)}）
        </span>
        <span>根拠: {t.basis}</span>
        {t.deadlineDate && (
          <span>
            {isGuide(t) ? "目安" : "期限"} {jpShort(t.deadlineDate)}・始まり {jpShort(t.startDate)}
          </span>
        )}
      </Why>
    </>
  );
}

/** 担当を変える（わたし・パートナー・家族みんな・祖父母）。「家族みんな」の事は、誰がやるかまで選べる */
function AssignPicker({ task: t, family, me, reassigned, onAssign }: { task: ShownTask; family: Family; me: Member | null; reassigned: boolean; onAssign: (a: Assign | null) => void }) {
  const hasGp = family.members.some((m) => m.role === "祖父母");
  const roles = WHO_CHOICES.filter((w) => (w === "祖父母" ? hasGp : w === "パートナー" || w === "母" ? family.members.some((m) => m.role === w) || w === me?.role : true));
  const roleWord = (w: Who) => {
    if (me && w === me.role) return "わたし";
    if (w === "家族") return "家族みんな";
    const ps = family.members.filter((m) => m.role === w);
    if (ps.length === 1) return ps[0].name;
    return w === "母" ? "ママ" : w === "パートナー" ? "パートナー" : "祖父母";
  };
  // わたしを先に
  const ordered = me ? [me.role, ...roles.filter((w) => w !== me.role)] : roles;
  const chip = (on: boolean) => `min-h-11 rounded-full border px-3 text-sm font-semibold ${on ? "border-rose bg-rose-soft text-rose" : "border-line bg-card text-muted"}`;
  return (
    <details className="group/as text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-muted">
        <span className="underline underline-offset-2">担当を変える（いま: {whoName(t, family, me)}）</span>
        <span className="transition-transform group-open/as:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex flex-wrap gap-2" role="group" aria-label="担当">
          {ordered.map((w) => (
            <button key={w} type="button" aria-pressed={t.who === w && !t.assignedTo} onClick={() => onAssign({ who: w })} className={chip(t.who === w && !t.assignedTo)}>
              {roleWord(w)}
            </button>
          ))}
        </div>
        {t.who === "家族" && family.members.length > 1 && (
          <div className="flex flex-col gap-1">
            <span className="text-muted">家族みんなの事を、誰がやる？</span>
            <div className="flex flex-wrap gap-2">
              {family.members.map((m) => (
                <button key={m.id} type="button" onClick={() => onAssign({ who: m.role, memberId: m.id })} className={chip(false)}>
                  {me?.id === m.id ? "わたし" : m.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {t.assignedTo && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onAssign({ who: "家族" })} className={chip(false)}>
              家族みんなに戻す
            </button>
          </div>
        )}
        {reassigned && (
          <button type="button" onClick={() => onAssign(null)} className="min-h-11 self-start text-muted underline underline-offset-2">
            はじめの担当に戻す
          </button>
        )}
      </div>
    </details>
  );
}
