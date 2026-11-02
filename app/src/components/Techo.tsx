"use client";

// 「今日」の画面: 開いた瞬間に「今やる1つ」。2つ目からは1行ずつ、まだ先と済んだ事は畳む。
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clockAt, diffDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { scheduleFor, statusOf, type Milestone } from "@/lib/milestones";
import { applyAssignments, type Assign, type Assignments } from "@/lib/assign";
import type { VisitPlan } from "@/lib/visit";
import { api, useFamily } from "./FamilyProvider";
import { Fold, NextStep, daysUntil } from "./ui";
import { DemoClock } from "./today/DemoClock";
import { TaskRow, TopTask, type ShownTask } from "./today/TaskCard";
import { StaleBox } from "./today/StaleBox";
import { jpShort } from "./today/dates";
import { AdvisorCard } from "./today/AdvisorCard";
import { byDays, daysLeft, planToday, type Task } from "./today/task";
import { VisitToday, visitIsTop } from "./today/VisitToday";

// ほかの画面が使っている日付の言い方（中身は today/dates.ts）
export { jpDate } from "./today/dates";

export function Techo() {
  const { family, today, setToday, isDemo, me } = useFamily();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [lastDone, setLastDone] = useState<{ id: string; title: string } | null>(null);
  const [doneError, setDoneError] = useState("");
  const [visit, setVisit] = useState<{ next: VisitPlan["next"]; agenda: number } | null>(null);
  const [keep, setKeep] = useState<Keep | null>(null);
  // 下書きに「送った」「使った」の印が付いた事（済んだ事として扱う）
  const [sent, setSent] = useState<Set<string>>(new Set());
  // 済んだ印と下書きの印を読み終わるまで、一番上を出さない（済んだ事が一瞬出るのを防ぐ）
  const [doneReady, setDoneReady] = useState(false);
  const [sentReady, setSentReady] = useState(false);
  // 家族が決め直した担当（/api/assign）
  const [assign, setAssign] = useState<Assignments>({});
  const [assignReady, setAssignReady] = useState(false);
  // 参謀の気づきがあるか（先に数だけ聞く。ある時は、読み込みの間も同じ高さの場所を取っておく）
  const [advisorOpen, setAdvisorOpen] = useState<number | null>(null);
  // 家族の画面などから「この事を今日の画面で開く」（/?focus=<id>）
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
  }, []);

  // 済んだ印（DB の done）と、いつもの場所（病院・窓口）
  useEffect(() => {
    let alive = true;
    setMarked(new Set());
    setLastDone(null);
    setDoneError("");
    setKeep(null);
    setSent(new Set());
    setDoneReady(false);
    setSentReady(false);
    setAssign({});
    setAssignReady(false);
    const fid = encodeURIComponent(family.id);
    api<{ assign: Assignments }>(`/api/assign?familyId=${fid}`)
      .then((j) => alive && setAssign(j.assign ?? {}))
      .catch(() => {})
      .finally(() => alive && setAssignReady(true));
    api<{ done: string[] }>(`/api/done?familyId=${fid}`)
      .then((j) => alive && setMarked(new Set(j.done)))
      .catch((e: Error) => alive && setDoneError(e.message))
      .finally(() => alive && setDoneReady(true));
    api<{ keep: Keep }>(`/api/keep?familyId=${fid}`)
      .then((j) => alive && setKeep(j.keep ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id]);

  // 下書きの印は、ほかの画面・ほかの端末でも付く。開いた時と、画面に戻ってきた時に読み直す
  useEffect(() => {
    let alive = true;
    const fid = encodeURIComponent(family.id);
    const loadSent = () =>
      api<{ drafts: { milestoneId: string }[] }>(`/api/draft?familyId=${fid}`)
        .then((j) => alive && setSent(new Set(j.drafts.map((d) => d.milestoneId))))
        .catch(() => {})
        .finally(() => alive && setSentReady(true));
    // 戻ってきた時は済んだ印も（下書きの印を付けると、サーバ側で同時に済みになるため）
    const load = () => {
      void loadSent();
      api<{ done: string[] }>(`/api/done?familyId=${fid}`)
        .then((j) => alive && setMarked(new Set(j.done)))
        .catch(() => {});
    };
    void loadSent();
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", load);
    // 下書きの印を付けた・外した時（同じ画面のまま、一番上から消す）
    window.addEventListener("boshi:done", load);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", load);
      window.removeEventListener("boshi:done", load);
    };
  }, [family.id]);

  // 参謀の気づきが今あるか（機械で見つけるだけなので速い。Claude が書くのは AdvisorCard が読む時）
  useEffect(() => {
    let alive = true;
    setAdvisorOpen(null);
    const t = setTimeout(() => {
      api<{ open: number }>(`/api/advisor?familyId=${encodeURIComponent(family.id)}&today=${today}&peek=1`)
        .then((r) => alive && setAdvisorOpen(r.open))
        .catch(() => alive && setAdvisorOpen(0));
    }, 300);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [family.id, today]);

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

  // 予定表に、家族が決め直した担当を当てる
  const schedule = useMemo(() => applyAssignments(scheduleFor(family), assign, family.members), [family, assign]);

  const setManyDone = useCallback(
    async (ids: string[]) => {
      setDoneError("");
      const prev = marked;
      setMarked(new Set([...marked, ...ids]));
      const one = ids.length === 1 ? schedule.find((x) => x.id === ids[0]) : undefined;
      setLastDone(one ? { id: one.id, title: one.plain } : null);
      try {
        for (const id of ids) await api("/api/done", { body: { familyId: family.id, milestoneId: id, today } });
      } catch (e) {
        setMarked(prev);
        setLastDone(null);
        setDoneError((e as Error).message);
      }
    },
    [marked, schedule, family.id, today],
  );

  const changeAssign = useCallback(
    async (m: Milestone, a: Assign | null) => {
      setDoneError("");
      const prev = assign;
      const next = { ...assign };
      if (a) next[m.id] = a;
      else delete next[m.id];
      setAssign(next);
      try {
        const r = await api<{ assign: Assignments }>("/api/assign", { body: { familyId: family.id, milestoneId: m.id, assign: a } });
        setAssign(r.assign);
      } catch (e) {
        setAssign(prev);
        setDoneError((e as Error).message);
      }
    },
    [assign, family.id],
  );

  // デモの早送り: 通り過ぎた期限の事は、家族が済ませた前提にする
  const done = useMemo(() => {
    const s = new Set([...marked, ...sent]);
    if (isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) s.add(m.id);
    return s;
  }, [marked, sent, schedule, today, isDemo]);

  const tasks: ShownTask[] = schedule.map((m) => ({ ...m, status: statusOf(m, today, done) }));
  const plan = planToday(tasks, today, me);
  // 時期を過ぎて一番上から外した事（task.ts の stale。まだ無い版でも動くように）
  const stale = ((plan as { stale?: Task[] }).stale ?? []) as ShownTask[];
  const finished = tasks.filter((t) => t.status === "済み");

  const nextVisit = visit?.next ?? null;
  const visitTop = visitIsTop(today, nextVisit);
  const focus = focusId ? tasks.find((t) => t.id === focusId && t.status !== "済み" && t.status !== "過ぎた") ?? null : null;
  const top = visitTop ? null : (focus ?? plan.top);
  // 健診が一番上の日は、一番上に出すはずだった事も「このあと」へ（あと何日の順に入れ直す）
  const pool = visitTop && plan.top ? [plan.top, ...plan.rest] : focus && plan.top && plan.top.id !== focus.id ? [plan.top, ...plan.rest] : plan.rest;
  const restTasks = byDays(pool.filter((t) => t.id !== focus?.id), (t) => daysLeft(t, today));
  const visitRow = nextVisit && !visitTop && diffDays(nextVisit.date, today) > 0 ? nextVisit : null;
  // 「このあと」は、あと何日の順だけ（次の健診の1行も同じ並びに入れる）
  type Row = { kind: "task"; task: Task } | { kind: "visit" };
  const rows = byDays<Row>(
    [...restTasks.map((task) => ({ kind: "task" as const, task })), ...(visitRow ? [{ kind: "visit" as const }] : [])],
    (r) => (r.kind === "visit" ? daysUntil(today, visitRow!.date) : daysLeft(r.task, today)),
  );
  const upcoming = plan.upcoming;
  const common = { today, family, me, keep };
  const rowProps = (t: Task) => ({
    ...common,
    onAssign: (a: Assign | null) => void changeAssign(t, a),
    reassigned: !!assign[t.id],
  });
  const loading = !(doneReady && sentReady && assignReady && advisorOpen !== null);

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

      {!loading && advisorOpen! > 0 && <AdvisorCard key={`${family.id}:${today}`} familyId={family.id} today={today} meId={me?.id} />}

      {loading ? (
        <div className="h-40 rounded-2xl bg-rose-soft/60" aria-hidden />
      ) : visitTop && nextVisit ? (
        <VisitToday family={family} today={today} next={nextVisit} agendaCount={visit?.agenda ?? 0} keep={keep} />
      ) : top ? (
        <TopTask key={`${family.id}:${top.id}`} task={top} soon={!focus && plan.topIsSoon} {...rowProps(top)} onDone={() => void setDone(top, true)} />
      ) : (
        <Calm upcoming={(me && upcoming.find((t) => t.who === "家族" || t.who === me.role)) || upcoming[0]} today={today} />
      )}

      {!loading && rows.length > 0 && (
        <section aria-label="このあと" className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">このあと</h2>
          {rows.map((r) =>
            r.kind === "task" ? (
              <TaskRow key={`${family.id}:${r.task.id}`} task={r.task} {...rowProps(r.task)} onDone={() => void setDone(r.task, true)} />
            ) : (
              <Link key="visit" href="/visit" className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span className="text-base font-semibold">次の健診{visitRow!.time ? ` ${visitRow!.time}` : ""}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular text-sm font-semibold">あと{daysUntil(today, visitRow!.date)}日</span>
                  <span className="text-muted" aria-hidden>
                    ›
                  </span>
                </span>
              </Link>
            ),
          )}
        </section>
      )}

      {!loading && <StaleBox key={family.id} tasks={stale} today={today} family={family} me={me} keep={keep} onDone={(ids) => void setManyDone(ids)} />}

      <Link href="/capture" className="inline-flex min-h-11 items-center gap-1 self-start text-base text-sky underline-offset-2 hover:underline">
        気になった事は、話す・撮るで残す ›
      </Link>

      {!loading && upcoming.length > 0 && (
        <Fold title="まだ先" count={upcoming.length}>
          <div className="flex flex-col">
            {upcoming.map((t) => (
              <TaskRow key={`${family.id}:${t.id}`} task={t} {...rowProps(t)} muted onDone={() => void setDone(t, true)} />
            ))}
          </div>
        </Fold>
      )}

      {!loading && finished.length > 0 && (
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
