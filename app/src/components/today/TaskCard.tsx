"use client";

// 「今日」の画面の1件: 一番上の大きな1つ（TopTask）と、2つ目からの1行（TaskRow）。
// 表に出すのは、やさしい題・あと◯日・主ボタン1つだけ。根拠と正式な名前は「なぜ？」の中。
import { useEffect, useRef, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { deadlineKindOf } from "@/lib/milestones";
import { Btn, CopyButton, HandoffRow, NextStep, Pill, Why } from "../ui";
import { callMemo } from "@/lib/vax-next";
import { MilestoneActions } from "../MilestoneActions";
import { jpShort } from "./dates";
import { FAR_DAYS, daysLeft, isMine, whenDate, whoLabel, type Task } from "./task";

/** 今日の画面に出す1件。shared = もとは家族みんなの事で、担当を選べる（together = 2人でと決めた） */
export type ShownTask = Task & { shared?: boolean; together?: boolean };

export interface Common {
  task: ShownTask;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onDone: () => void;
  /** 家族みんなの事の担当を決める（家族の id か "together"。"" は決め直し） */
  onAssign?: (milestoneId: string, who: string) => void;
}

/** 期限が法で決まっていない（目安の）事か。「あと◯日」と急かさず「目安 ◯/◯」と言う */
export function isGuide(t: Task): boolean {
  return !!t.deadlineDate && deadlineKindOf(t) === "目安";
}

/** いつまで（期限があれば期限、まだ始まっていなければ始まり）。目安の事は guide に日付だけ */
type When = { days: number; label: string } | { guide: string; past: boolean } | { far: string } | null;
function target(t: Task, today: string): When {
  if (t.status !== "まだ先" && isGuide(t)) {
    const d = t.deadlineDate!;
    return { guide: jpShort(d, today), past: d < today };
  }
  const days = daysLeft(t, today);
  if (days == null) return null;
  // 30日より先は「あと377日」と数えず、日付で書く
  if (days > FAR_DAYS) {
    const w = whenDate(t, today);
    return w ? { far: w } : null;
  }
  return { days, label: t.status === "まだ先" ? `${jpShort(t.startDate, today)}から` : `${jpShort(t.deadlineDate!, today)}まで` };
}

/** 一番上の「今やる1つ」。soon = 自分の今やる事が無く、まだ先の近い事を出した */
export function TopTask(p: Common & { soon?: boolean; eyebrowOverride?: string; children?: React.ReactNode }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  // 担当の呼び名（「家族」の事は空なので、担当名を出さない）
  const who = whoLabel(t, family, me);
  const eyebrow = p.eyebrowOverride ?? (p.soon ? "もうすぐ" : me && isMine(t, me) ? "次にやる事" : who ? `${who}の番` : "次にやる事");
  const counted = when && "days" in when ? when : null;
  const guide = when && "guide" in when ? when : null;
  const far = when && "far" in when ? when.far : null;
  return (
    <NextStep
      eyebrow={eyebrow}
      title={t.plain}
      sub={t.hint}
      days={counted?.days}
      dateLabel={counted ? (t.status === "まだ先" ? counted.label : jpShort(t.deadlineDate!, p.today)) : undefined}
      daysKind={t.status === "まだ先" ? "start" : "deadline"}
      tone="rose"
    >
      <div className="flex w-full flex-col gap-2">
        {guide && <GuideLine guide={guide.guide} past={guide.past} />}
        {far && <span className="tabular text-sm text-muted">{far}</span>}
        {p.children}
        <TaskBody {...p} top />
      </div>
    </NextStep>
  );
}

/** 2つ目から: 1行（題・担当の札・あと◯日）。押すと開く（ほかの人の番も、なぜ？・どこへが見られる） */
export function TaskRow(p: Common & { muted?: boolean }) {
  const { task: t, today, family, me } = p;
  const when = target(t, today);
  const others = !!me && !isMine(t, me);
  const who = whoLabel(t, family, me);
  // 担当の札は、担当名がある時だけ。家族みんなの事でまだ決めていない時は「誰がやる？」、2人でと決めた時は「2人で」
  const showPill = !!who && (!me || others);
  const sharedPill = !who && t.shared ? (t.together ? "2人で" : "誰がやる？") : null;
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary
        className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2"
        aria-label={others && who ? `${who}の番: ${t.plain}` : undefined}
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-base leading-snug ${p.muted || others ? "text-muted" : "font-semibold"}`}>{t.plain}</span>
          {showPill && (
            <span>
              <Pill tone={others ? "muted" : "rose"}>{who}の番</Pill>
            </span>
          )}
          {sharedPill && (
            <span>
              <Pill tone="muted">{sharedPill}</Pill>
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {when && ("days" in when ? <RowDays days={when.days} upcoming={t.status === "まだ先"} start={jpShort(t.startDate, today)} /> : "guide" in when ? <RowGuide guide={when.guide} /> : <span className="tabular text-sm whitespace-nowrap text-muted">{when.far}</span>)}
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 pb-4">
        {when && "days" in when && <span className="tabular text-sm text-muted">{when.label}</span>}
        {when && "guide" in when && <GuideLine guide={when.guide} past={when.past} />}
        <p className="text-base">{t.hint}</p>
        {others && who && <p className="text-sm text-muted">{who}の番です。代わりにやってもかまいません</p>}
        <TaskBody {...p} />
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
      {past ? "（過ぎていても、今からできます）" : "ごろまでに"}
    </p>
  );
}

/** 下書きの印で済みが変わった事を、今日の画面へ知らせる（Techo が済んだ事を読み直す） */
const notifyDone = () => window.dispatchEvent(new Event("boshi:done"));

/**
 * 1行の日数。赤は法の期限の残り1日以下だけ。過ぎた事は責めずに「今からでも」（安心のデザイン #1）
 * まだ先の事は「15日後から」と数えず、上の大きな箱と同じ「11/19（木）ごろから」の形で（UX 2026-11-04: 同じ事が2つの形で出ていた）
 */
function RowDays({ days, upcoming, start }: { days: number; upcoming: boolean; start: string }) {
  const color = upcoming ? "text-muted" : days < 0 ? "text-ink" : days <= 1 ? "text-alert" : days <= 3 ? "text-warn" : "text-ink";
  const text = upcoming
    ? days <= 0
      ? "今日から"
      : days === 1
        ? "あしたから"
        : `${start}ごろから`
    : days < 0
      ? "今からでも"
      : days === 0
        ? "今日まで"
        : days === 1
          ? "あしたまで"
          : `あと${days}日`;
  return <span className={`tabular text-sm font-semibold whitespace-nowrap ${color}`}>{text}</span>;
}

/**
 * 開いた中身。
 * 一番上（top）: 主ボタンは1つ。窓口が要る事は「どこへ行くか見る」、書類の事は下書き（MilestoneActions が主を出す）、
 * それ以外は「済んだ」。残り（済んだ・カレンダー）は小さな文字のリンク。
 * 2つ目から: 下書き・窓口は小さく、「済んだ」は枠のボタン。
 */
/** 家族みんなの事の「誰がやる？」（押すと決まり、その人の番になる。もう一度押すと決め直せる） */
function WhoPicker({ task: t, family, onAssign }: Pick<Common, "task" | "family" | "onAssign">) {
  if (!t.shared || !onAssign) return null;
  const current = t.together ? "together" : (family.members.find((m) => m.role === t.who)?.id ?? "");
  const choices = [...family.members.map((m) => ({ id: m.id, label: m.name })), { id: "together", label: "2人で" }];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={`${t.plain}を誰がやるか`}>
      <span className="text-sm text-muted">{current ? "やる人" : "誰がやる？"}</span>
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={current === c.id}
          onClick={() => onAssign(t.id, current === c.id ? "" : c.id)}
          className={`min-h-11 rounded-full border px-4 text-base ${current === c.id ? "border-rose bg-rose text-white" : "border-line bg-card text-ink"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** 行を開いた時の中身（下書き・町の調べ・カレンダー・担当）。ふり返りの「まだ」からも使う */
export function TaskBody({ task: t, today, family, me, keep, onDone, onAssign, top }: Common & { top?: boolean }) {
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
      <WhoPicker task={t} family={family} onAssign={onAssign} />
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
      {t.retime && (
        <CopyButton
          label="予約の電話メモをコピー"
          text={callMemo({ childName: family.childName, birthDate: family.birthDate, plain: t.plain, start: t.startDate, doses: t.retime.doses, lastDate: t.retime.lastDate, lastFacility: t.retime.lastFacility })}
        />
      )}
      <Why>
        <span>
          {t.title}（{[t.kind, whoLabel(t, family, me)].filter(Boolean).join("・")}）
        </span>
        <span>根拠: {t.basis}</span>
        {t.retimeNote && <span>打てる最短日: {jpShort(t.startDate, today)}（{t.retimeNote}。回数や間隔が標準と違う時は小児科で確かめる）</span>}
        {t.deadlineDate && (
          <span>
            始まり {jpShort(t.startDate, today)}・{isGuide(t) ? "目安" : "期限"} {jpShort(t.deadlineDate, today)}
          </span>
        )}
      </Why>
    </>
  );
}
