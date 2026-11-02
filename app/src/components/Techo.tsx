"use client";

// 「今日」の画面: 開いた瞬間に「今やる1つ」。2つ目からは1行ずつ、まだ先と済んだ事は畳む。
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clockAt, diffDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { scheduleFor, statusOf, type Milestone } from "@/lib/milestones";
import type { VisitPlan } from "@/lib/visit";
import { api, useFamily } from "./FamilyProvider";
import { Fold, NextStep, daysUntil } from "./ui";
import { DemoClock } from "./today/DemoClock";
import { TaskRow, TopTask } from "./today/TaskCard";
import { jpShort } from "./today/dates";
import { sortNow, type Task } from "./today/task";
import { VisitToday, visitIsTop } from "./today/VisitToday";

// ほかの画面が使っている日付の言い方（中身は today/dates.ts）
export { jpDate } from "./today/dates";

const NOW = new Set(["今やる", "期限が近い", "期限切れ"]);

export function Techo() {
  const { family, today, setToday, isDemo, me } = useFamily();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [lastDone, setLastDone] = useState<{ id: string; title: string } | null>(null);
  const [doneError, setDoneError] = useState("");
  const [visit, setVisit] = useState<{ next: VisitPlan["next"]; agenda: number } | null>(null);
  const [keep, setKeep] = useState<Keep | null>(null);

  // 済んだ印（DB の done）と、いつもの場所（病院・窓口）
  useEffect(() => {
    let alive = true;
    setMarked(new Set());
    setLastDone(null);
    setDoneError("");
    setKeep(null);
    const fid = encodeURIComponent(family.id);
    api<{ done: string[] }>(`/api/done?familyId=${fid}`)
      .then((j) => alive && setMarked(new Set(j.done)))
      .catch((e: Error) => alive && setDoneError(e.message));
    api<{ keep: Keep }>(`/api/keep?familyId=${fid}`)
      .then((j) => alive && setKeep(j.keep ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id]);

  // 次の健診（健診の画面と同じ GET /api/visit の plan.next）
  useEffect(() => {
    let alive = true;
    api<{ plan: VisitPlan; agenda?: unknown[] }>(`/api/visit?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => alive && setVisit({ next: j.plan?.next ?? null, agenda: j.agenda?.length ?? 0 }))
      .catch(() => alive && setVisit(null));
    return () => {
      alive = false;
    };
  }, [family.id, today]);

  const setDone = useCallback(
    async (m: Milestone, on: boolean) => {
      setDoneError("");
      const prev = marked;
      const next = new Set(marked);
      if (on) next.add(m.id);
      else next.delete(m.id);
      setMarked(next);
      setLastDone(on ? { id: m.id, title: m.plain } : null);
      try {
        await api("/api/done", { method: on ? "POST" : "DELETE", body: { familyId: family.id, milestoneId: m.id, today } });
      } catch (e) {
        setMarked(prev);
        setLastDone(null);
        setDoneError((e as Error).message);
      }
    },
    [marked, family.id, today],
  );

  const schedule = useMemo(() => scheduleFor(family), [family]);

  // デモの早送り: 通り過ぎた期限の事は、家族が済ませた前提にする
  const done = useMemo(() => {
    const s = new Set(marked);
    if (isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) s.add(m.id);
    return s;
  }, [marked, schedule, today, isDemo]);

  const tasks: Task[] = schedule.map((m) => ({ ...m, status: statusOf(m, today, done) }));
  const now = sortNow(
    tasks.filter((t) => NOW.has(t.status)),
    me,
  );
  const upcoming = tasks.filter((t) => t.status === "まだ先");
  const finished = tasks.filter((t) => t.status === "済み");

  const nextVisit = visit?.next ?? null;
  const visitTop = visitIsTop(today, nextVisit);
  const top = visitTop ? null : (now[0] ?? null);
  const rest = visitTop ? now : now.slice(1);
  const common = { today, family, me, keep };

  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-8">
      <WeekBand family={family} today={today} />

      {doneError && (
        <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-base text-alert">
          保存できませんでした: {doneError}
        </p>
      )}
      {lastDone && (
        <p role="status" className="flex items-center justify-between gap-3 rounded-lg bg-ok/10 px-3 text-base text-ok">
          <span className="min-w-0 py-2">「{lastDone.title}」を済みにしました</span>
          <button
            type="button"
            onClick={() => {
              const m = schedule.find((x) => x.id === lastDone.id);
              if (m) void setDone(m, false);
            }}
            className="min-h-11 shrink-0 px-2 font-semibold underline underline-offset-2"
          >
            戻す
          </button>
        </p>
      )}

      {visitTop && nextVisit ? (
        <VisitToday family={family} today={today} next={nextVisit} agendaCount={visit?.agenda ?? 0} keep={keep} />
      ) : top ? (
        <TopTask key={`${family.id}:${top.id}`} task={top} {...common} onDone={() => void setDone(top, true)} />
      ) : (
        <Calm upcoming={upcoming[0]} today={today} />
      )}

      {(rest.length > 0 || (nextVisit && !visitTop && diffDays(nextVisit.date, today) > 0)) && (
        <section aria-label="このあと" className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">このあと</h2>
          {rest.map((t) => (
            <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} onDone={() => void setDone(t, true)} />
          ))}
          {nextVisit && !visitTop && diffDays(nextVisit.date, today) > 0 && (
            <Link href="/visit" className="flex min-h-12 items-center justify-between gap-3 py-2">
              <span className="text-base font-semibold">次の健診{nextVisit.time ? ` ${nextVisit.time}` : ""}</span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="tabular text-sm font-semibold">あと{daysUntil(today, nextVisit.date)}日</span>
                <span className="text-muted" aria-hidden>
                  ›
                </span>
              </span>
            </Link>
          )}
        </section>
      )}

      <Link href="/capture" className="inline-flex min-h-11 items-center gap-1 self-start text-base text-sky underline-offset-2 hover:underline">
        気になった事は、話す・撮るで残す ›
      </Link>

      {upcoming.length > 0 && (
        <Fold title="まだ先" count={upcoming.length}>
          <div className="flex flex-col">
            {upcoming.map((t) => (
              <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} muted onDone={() => void setDone(t, true)} />
            ))}
          </div>
        </Fold>
      )}

      {finished.length > 0 && (
        <Fold title="済んだ事" count={finished.length}>
          <ul className="flex flex-col">
            {finished.map((t) => (
              <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
                <span className="min-w-0 text-base text-muted">✓ {t.plain}</span>
                {marked.has(t.id) && (
                  <button type="button" onClick={() => void setDone(t, false)} className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-2">
                    戻す
                  </button>
                )}
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {isDemo && <DemoClock family={family} today={today} setToday={setToday} />}
    </main>
  );
}

/** 週数の帯（1行）。1000日の何日目かは小さく右に */
function WeekBand({ family, today }: { family: Family; today: string }) {
  const c = clockAt(family, today);
  const toDue = diffDays(family.dueDate, today);
  let main: string;
  if (c.phase === "pregnant") {
    const due = toDue > 0 ? `予定日まであと${toDue}日` : toDue === 0 ? "今日が予定日" : `予定日から${-toDue}日`;
    main = `${c.pregnancyWeek}週 ・ ${due}`;
  } else if (c.phase === "trying") {
    main = "授かる前";
  } else if (c.phase === "after") {
    main = `${c.label} ・ 1000日を過ぎました`;
  } else {
    main = family.childName ? `${family.childName} ・ ${c.label}` : c.label;
  }
  return (
    <header className="flex items-baseline justify-between gap-3">
      <h1 className="font-display text-xl font-bold">{main}</h1>
      {c.dayOf1000 > 0 && c.phase !== "after" && <span className="tabular shrink-0 text-xs text-muted">1000日の{c.dayOf1000}日目</span>}
    </header>
  );
}

/** 今やる事が無い時: 休んでいい、と次に来る事 */
function Calm({ upcoming, today }: { upcoming?: Task; today: string }) {
  if (!upcoming) return <NextStep tone="ok" title="今週は何もしなくて大丈夫" />;
  return (
    <NextStep
      tone="ok"
      eyebrow="今週は何もしなくて大丈夫"
      title={`次は「${upcoming.plain}」`}
      days={daysUntil(today, upcoming.startDate)}
      dateLabel={`${jpShort(upcoming.startDate)}から`}
    />
  );
}
