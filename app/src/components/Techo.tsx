"use client";

// 「今日」の画面: 開いた瞬間に「今やる1つ」。2つ目からは1行ずつ、まだ先と済んだ事は畳む。
import Link from "next/link";
import { demoAppliedOn, moneyWatch } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clockAt, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { scheduleFor, statusOf, type Milestone } from "@/lib/milestones";
import type { VisitPlan } from "@/lib/visit";
import { api, useFamily } from "./FamilyProvider";
import { Btn, Fold, NextStep, Notice, daysUntil } from "./ui";
import { HelpPlaces } from "./today/HelpPlaces";
import { jpShort } from "./today/dates";
import { TaskRow, isGuide, type ShownTask } from "./today/TaskCard";
import { NowCard } from "./today/NowCard";
import { BirthTripCard } from "./today/BirthTripCard";
import { planBirthTrip } from "@/lib/birth-trip";
import { applyRetime, type Retime } from "@/lib/vax-next";
import { StaleBox } from "./today/StaleBox";
import { StartedLate } from "./today/StartedLate";
import { AdvisorCard } from "./today/AdvisorCard";
import { ConsultAsk } from "./today/ConsultAsk";
import { PhotoNudge } from "./today/PhotoNudge";
import { LetterNews } from "./today/LetterNews";
import { BirthdayCard } from "./today/BirthdayCard";
import { birthdayFor } from "@/lib/media-shared";
import { hideCounts } from "@/lib/situation";
import { byDays, daysLeft, planToday, withAssignee, type Task } from "./today/task";
import { VisitToday, visitIsTop } from "./today/VisitToday";

/** 「済んだにしました・もどす」を出しておく長さ */
const UNDO_MS = 20000;

// ほかの画面が使っている日付の言い方（中身は today/dates.ts）
export { jpDate } from "./today/dates";

export function Techo() {
  const { family, today, isDemo, me } = useFamily();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  // 「手帳を始める前の事」の数（StartedLate が数える。「大丈夫」の言い方を変える）
  const [beforeCount, setBeforeCount] = useState(0);
  // 始める前の事で「まだ」と答えた事（一番上の札に上げる）と、済んだ後に読み直す印
  const [lateOpen, setLateOpen] = useState<string[]>([]);
  const [lateVer, setLateVer] = useState(0);
  const [lastDone, setLastDone] = useState<{ id: string; title: string; ids?: string[] } | null>(null);
  // 静かにする家族でも、いつもの今日の画面を見たい時に開ける
  const [showAll, setShowAll] = useState(false);
  // 手帳の記録（接種・健診など）から済みにした事（/api/done の fromTecho。無い版では空）。「戻す」は出さない
  const [fromTecho, setFromTecho] = useState<Set<string>>(new Set());
  // 済んだにした日（お金の手続きの届く見込みを数える。lib/money.ts）
  const [appliedOn, setAppliedOn] = useState<Record<string, string>>({});
  // 予防接種の次の回の打てる最短日（/api/done の retime。手帳の接種の日付から数え直した物）
  const [retime, setRetime] = useState<Record<string, Retime>>({});
  const [doneError, setDoneError] = useState("");
  const [visit, setVisit] = useState<{ next: VisitPlan["next"]; agenda: number; guess: string | null } | null>(null);
  const [keep, setKeep] = useState<Keep | null>(null);
  // 下書きに「送った」「使った」の印が付いた事（済んだ事として扱う）
  const [sent, setSent] = useState<Set<string>>(new Set());
  // 済んだ印と下書きの印を読み終わるまで、一番上を出さない（済んだ事が一瞬出るのを防ぐ）
  const [doneReady, setDoneReady] = useState(false);
  const [sentReady, setSentReady] = useState(false);
  // 気づいた事があるか（先に数だけ聞く。ある時は、読み込みの間も同じ高さの場所を取っておく）
  const [advisorOpen, setAdvisorOpen] = useState<number | null>(null);
  // ほかの画面から「この事を今日の画面で開く」（/?focus=<id>）
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
  }, []);

  /** GET /api/done の返り（fromTecho は担当A の版から。無ければ空として読む） */
  type DoneRes = { done: string[]; fromTecho?: string[]; retime?: Record<string, Retime>; doneOn?: Record<string, string> };
  const readDone = useCallback((j: DoneRes) => {
    setMarked(new Set(Array.isArray(j.done) ? j.done : []));
    setFromTecho(new Set(Array.isArray(j.fromTecho) ? j.fromTecho : []));
    setRetime(j.retime && typeof j.retime === "object" ? j.retime : {});
    setAppliedOn(j.doneOn && typeof j.doneOn === "object" ? j.doneOn : {});
  }, []);

  // 「済んだにしました・もどす」は数秒だけ出す（押し間違えた時に戻せるように）
  useEffect(() => {
    if (!lastDone) return;
    const t = setTimeout(() => setLastDone(null), UNDO_MS);
    return () => clearTimeout(t);
  }, [lastDone]);

  // 済んだ印（DB の done）と、いつもの場所（病院・窓口）
  useEffect(() => {
    let alive = true;
    setMarked(new Set());
    setFromTecho(new Set());
    setRetime({});
    setLastDone(null);
    setDoneError("");
    setKeep(null);
    setSent(new Set());
    setDoneReady(false);
    setSentReady(false);
    const fid = encodeURIComponent(family.id);
    api<DoneRes>(`/api/done?familyId=${fid}&today=${today}`)
      .then((j) => alive && readDone(j))
      .catch((e: Error) => alive && setDoneError(e.message))
      .finally(() => alive && setDoneReady(true));
    api<{ keep: Keep }>(`/api/keep?familyId=${fid}`)
      .then((j) => alive && setKeep(j.keep ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // 手帳で済んだ事は「今日」までの記録から決まるので、今日が変わった時も読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, today]);

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
      api<DoneRes>(`/api/done?familyId=${fid}&today=${today}`)
        .then((j) => alive && readDone(j))
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
  }, [family.id, today, readDone]);

  // 気づいた事が今あるか（機械で見つけるだけなので速い。Claude が書くのは AdvisorCard が読む時）
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
    api<{ plan: VisitPlan; agenda?: unknown[]; prenatal?: { next: string | null } | null }>(`/api/visit?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => alive && setVisit({ next: j.plan?.next ?? null, agenda: j.agenda?.length ?? 0, guess: j.prenatal?.next ?? null }))
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

  // 申請が済んだお金の手続きは、「届いたか確かめる」1件を足す（お金の1000日。lib/money.ts）
  const schedule = useMemo(() => {
    const base = applyRetime(scheduleFor(family, today), retime);
    const applied = new Set([...marked, ...sent, ...fromTecho]);
    // 見本の家族は、期限を過ぎた手続きを始まりから数日後に出したとみなす（lib/money.ts の demoAppliedOn）
    const on = isDemo ? { ...demoAppliedOn(base, today), ...appliedOn } : appliedOn;
    if (isDemo) for (const m of base) if (m.deadlineDate && m.deadlineDate < today) applied.add(m.id);
    const born = family.birthDate && family.birthDate <= today ? family.birthDate : undefined;
    return [...base, ...moneyWatch(base, applied, on, born)];
  }, [family, today, retime, marked, sent, fromTecho, isDemo, appliedOn]);

  const setManyDone = useCallback(
    async (ids: string[]) => {
      setDoneError("");
      const prev = marked;
      setMarked(new Set([...marked, ...ids]));
      const one = ids.length === 1 ? schedule.find((x) => x.id === ids[0]) : undefined;
      // まとめて済んだにした時も「もどす」を出す（安心のデザイン #6）
      setLastDone(one ? { id: one.id, title: one.plain } : ids.length > 1 ? { id: ids[0], title: `${ids.length}つ`, ids } : null);
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

  const undoMany = useCallback(
    async (ids: string[]) => {
      setDoneError("");
      const prev = marked;
      const next = new Set(marked);
      for (const id of ids) next.delete(id);
      setMarked(next);
      setLastDone(null);
      try {
        for (const id of ids) await api("/api/done", { method: "DELETE", body: { familyId: family.id, milestoneId: id, today } });
      } catch (e) {
        setMarked(prev);
        setDoneError((e as Error).message);
      }
    },
    [marked, family.id, today],
  );

  // デモの早送り: 通り過ぎた期限の事は、家族が済ませた前提にする
  const done = useMemo(() => {
    const s = new Set([...marked, ...sent, ...fromTecho]);
    if (isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) s.add(m.id);
    return s;
  }, [marked, sent, fromTecho, schedule, today, isDemo]);

  // 家族みんなの事は、「誰がやる？」で決めた人の番にする（決めていなければ今までどおり全員の事）
  const tasks: ShownTask[] = schedule.map((m) => withAssignee({ ...m, status: statusOf(m, today, done) }, family, keep?.assign));
  const plan = planToday(tasks, today, me);
  // 時期を過ぎて一番上から外した事（task.ts の stale。まだ無い版でも動くように）
  const stale = ((plan as { stale?: Task[] }).stale ?? []) as ShownTask[];
  const finished = tasks.filter((t) => t.status === "済み");

  const nextVisit = visit?.next ?? null;
  const visitTop = visitIsTop(today, nextVisit);
  const focus = focusId ? tasks.find((t) => t.id === focusId && t.status !== "済み" && t.status !== "過ぎた") ?? null : null;
  // 生まれた日から15日の間は、届けの束を一番上に（1件目は下の1枚が用意する。ほかは束の中に並べ、「このあと」には出さない）
  const trip = planBirthTrip(tasks, today, family.birthDate && family.birthDate <= today ? family.birthDate : undefined, family.situation);
  const tripIds = new Set(trip?.items.map((i) => i.task.id) ?? []);
  const baseTop = trip ? trip.items[0].task : plan.top;
  const baseRest = trip ? [plan.top, ...plan.rest].filter((t): t is ShownTask => !!t && !tripIds.has(t.id)) : plan.rest;
  // 始める前の事で「まだ」と答えた事は、見本の家族の一番上と同じ札に上げる（どこへ行くか・書く事のメモ・カレンダー）。
  // 目安は過ぎているので「今からでも」の形（期限切れ）で出す。届けの束・健診の日・押して来た事がある時は、そちらが先（UX 2026-11-04）
  const lateTask = lateOpen.length && !visitTop && !trip && !focus ? tasks.find((t) => t.id === lateOpen[0]) : undefined;
  const lifted: ShownTask | null = lateTask ? { ...lateTask, status: "期限切れ" } : null;
  const top = visitTop ? null : (focus ?? lifted ?? baseTop);
  // 健診が一番上の日は、一番上に出すはずだった事も「このあと」へ（あと何日の順に入れ直す）
  const pool = (visitTop || lifted) && baseTop ? [baseTop, ...baseRest] : focus && baseTop && baseTop.id !== focus.id ? [baseTop, ...baseRest] : baseRest;
  const restTasks = byDays(pool.filter((t) => t.id !== focus?.id), (t) => daysLeft(t, today));
  const visitRow = nextVisit && !visitTop && diffDays(nextVisit.date, today) > 0 ? nextVisit : null;
  // 「このあと」は、あと何日の順だけ（次の健診の1行も同じ並びに入れる）
  // 妊婦健診の予約がまだで、国の標準の目安が7日以内なら「予約を」の1行（第1波⑧。病院が言った日が正）
  const guess = !nextVisit && visit?.guess && diffDays(visit.guess, today) >= 0 && diffDays(visit.guess, today) <= 7 ? visit.guess : null;
  type Row = { kind: "task"; task: Task } | { kind: "visit" } | { kind: "prenatal" };
  const rows = byDays<Row>(
    [
      ...restTasks.map((task) => ({ kind: "task" as const, task })),
      ...(visitRow ? [{ kind: "visit" as const }] : []),
      // 一番上が空く日は、健診の予約を一番上に出すので、ここには重ねない
      ...(guess && (top || visitTop) ? [{ kind: "prenatal" as const }] : []),
    ],
    (r) => (r.kind === "visit" ? daysUntil(today, visitRow!.date) : r.kind === "prenatal" ? daysUntil(today, guess!) : daysLeft(r.task, today)),
  );
  const upcoming = plan.upcoming;
  const onAssign = (milestoneId: string, who: string) => {
    // 先に画面へ（押した手応えを待たせない）。覚えるのは裏で
    setKeep((k) => {
      const assign = { ...(k?.assign ?? {}) };
      if (who) assign[milestoneId] = who;
      else delete assign[milestoneId];
      return { ...(k ?? {}), assign };
    });
    void api("/api/keep", { body: { familyId: family.id, keep: { assign: { [milestoneId]: who } } } }).catch(() => {});
  };
  const common = { today, family, me, keep, onAssign };
  // 法の期限を過ぎてまだの事があり、一番上が目安の事か何も無い時は、ふり返りを開いて一番上に出す
  const staleFirst = stale.length > 0 && !(visitTop && nextVisit) && !focus && (!top || isGuide(top));
  const loading = !(doneReady && sentReady && advisorOpen !== null);
  const quiet = family.situation?.quiet;

  const bday = birthdayFor(family, today);

  if (quiet && !showAll) return <QuietDay family={family} quiet={quiet} onShowAll={() => setShowAll(true)} />;

  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-8">
      <WeekBand family={family} today={today} />

      {doneError && (
        <Notice title="済んだの印を、まだ保存できていません" safe="押した印は元に戻しました。電波のある所で、もう一度押してください。" detail={doneError} />
      )}
      {/* 押した場所から見える所（下のタブの上）に、数秒だけ出す */}
      {lastDone && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-4" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <p role="status" className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 text-base text-white shadow-lg">
            <span className="min-w-0 py-3">{lastDone.ids ? `${lastDone.title}を済んだにしました` : `「${lastDone.title}」を済んだにしました`}</span>
            <button
              type="button"
              onClick={() => {
                if (lastDone.ids) void undoMany(lastDone.ids);
                else {
                  const m = schedule.find((x) => x.id === lastDone.id);
                  if (m) void setDone(m, false);
                }
              }}
              className="min-h-11 shrink-0 px-2 font-semibold underline underline-offset-2"
            >
              もどす
            </button>
          </p>
        </div>
      )}

      {/* 1歳・2歳の誕生日から2週間は、一番上に誕生日の1枚（開いた手紙・一冊・映画） */}
      {!loading && bday && <BirthdayCard key={`${family.id}:bday${bday}`} family={family} today={today} by={me?.name} age={bday} />}
      {loading ? (
        <div className="h-40 rounded-2xl bg-rose-soft/60" aria-hidden />
      ) : visitTop && nextVisit ? (
        <VisitToday family={family} today={today} next={nextVisit} agendaCount={visit?.agenda ?? 0} keep={keep} />
      ) : null}
      {/* 途中から始めた家族: 始める前に目安が過ぎた事を、済んでいるか1回聞く */}
      {!loading && <StartedLate family={family} today={today} onCount={setBeforeCount} onOpen={setLateOpen} lifted={lifted?.id} version={lateVer} forPartner={me?.role === "パートナー"} />}
      {!loading && staleFirst && <StaleBox key={`${family.id}:first`} tasks={stale} {...common} defaultOpen onDone={(ids) => void setManyDone(ids)} />}
      {!loading && trip && !(visitTop && nextVisit) && !focus && (
        <BirthTripCard
          key={`${family.id}:trip`}
          trip={trip}
          {...common}
          onDone={(ids) => void setManyDone(ids)}
          onKeep={(date) => {
            setKeep((k) => ({ ...(k ?? {}), birthTrip: { date } }));
            void api("/api/keep", { body: { familyId: family.id, keep: { birthTrip: { date } } } }).catch(() => {});
          }}
        />
      )}
      {loading || (visitTop && nextVisit) ? null : top ? (
        <NowCard
          key={`${family.id}:${top.id}`}
          task={top}
          soon={!focus && !trip && !lifted && plan.topIsSoon}
          {...common}
          onDone={() => void setDone(top, true).then(() => lifted && setLateVer((v) => v + 1))}
        />
      ) : guess ? (
        // 今やる事が無く、妊婦健診の予約の目安が近い日は「今すぐやる事はありません」と言わず、予約を一番上に（UX 2026-11-04: 大きな箱の真下に「今日ごろ」が出て、言う事が食い違っていた）
        <NextStep
          tone="rose"
          eyebrow={me?.role === "パートナー" ? "いま、いちばん先の事（ママの番）" : "いま、いちばん先の事"}
          title="次の妊婦健診を予約する"
          sub={`国の目安では${daysUntil(today, guess) === 0 ? "今ごろ" : `あと${daysUntil(today, guess)}日ごろ`}です。病院で日を言われていたら、そちらに合わせてください。`}
        >
          <Btn href="/visit">予約した日を入れる</Btn>
        </NextStep>
      ) : (
        <Calm upcoming={me ? upcoming.filter((t) => t.who === "家族" || t.who === me.role) : upcoming} today={today} others={rows.filter((r) => r.kind === "task").length} before={beforeCount} />
      )}

      {/* 手帳が見渡して気づいた事は、一番上の1枚の次に（大きな札を2枚並べない） */}
      {!loading && advisorOpen! > 0 && <AdvisorCard key={`${family.id}:${today}`} familyId={family.id} today={today} meId={me?.id} />}

      {!loading && rows.length > 0 && (
        <section aria-label="ほかに今やる事" className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">ほかに今やる事</h2>
          {rows.map((r) =>
            r.kind === "task" ? (
              <TaskRow key={`${family.id}:${r.task.id}`} task={r.task} {...common} onDone={() => void setDone(r.task, true)} />
            ) : r.kind === "prenatal" ? (
              <Link key="prenatal" href="/visit" className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
                <span className="min-w-0">
                  <span className="block text-base font-semibold">次の妊婦健診を予約する{me?.role === "パートナー" && <span className="text-sm font-normal text-muted">（ママの番）</span>}</span>
                  <span className="block text-sm text-muted">国の目安では今ごろです。病院で日を言われていたら、そちらに合わせてください</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="tabular text-sm font-semibold">{daysUntil(today, guess!) === 0 ? "今日ごろ" : `あと${daysUntil(today, guess!)}日ごろ`}</span>
                  <span className="text-muted" aria-hidden>
                    ›
                  </span>
                </span>
              </Link>
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

      {!loading && !staleFirst && <StaleBox key={family.id} tasks={stale} {...common} onDone={(ids) => void setManyDone(ids)} />}


      {/* 写真の節目の日だけ、1回の一言（月に1回まで。写真を残せる手帳だけ） */}
      {!loading && !bday && <LetterNews key={`${family.id}:letters`} family={family} today={today} by={me?.name} />}
      {!loading && <PhotoNudge key={`${family.id}:photo`} family={family} today={today} />}

      {/* 手帳の毎回の問い「相談できる人はいますか」（時期ごとに1回。答えた時期は出さない） */}
      {!loading && <ConsultAsk key={`${family.id}:consult`} family={family} today={today} meName={me?.name} />}

      {/* 先の事は近い3つだけ。残りは数だけ言い、開けば見られる（2032年まで30行の壁を見せない） */}
      {!loading && upcoming.length > 0 && (
        <section aria-label="近づいたら出す事" className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">近づいたら、ここに出します</h2>
          {upcoming.slice(0, 3).map((t) => (
            <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} muted onDone={() => void setDone(t, true)} />
          ))}
          {upcoming.length > 3 && (
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1 text-base text-muted">
                <span className="underline underline-offset-2">ほかに{upcoming.length - 3}件あります</span>
                <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
              </summary>
              <div className="flex flex-col">
                {upcoming.slice(3).map((t) => (
                  <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} muted onDone={() => void setDone(t, true)} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {!loading && finished.length > 0 && (
        <Fold title="済んだ事" count={finished.length}>
          <ul className="flex flex-col">
            {finished.map((t) => (
              <li key={t.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
                <span className="min-w-0 text-base text-muted">✓ {t.plain}</span>
                {fromTecho.has(t.id) ? (
                  <span className="shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-sm text-ok">手帳で済み</span>
                ) : (
                  marked.has(t.id) && (
                  <button type="button" onClick={() => void setDone(t, false)} className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-2">
                    もどす
                  </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {/* 健診のタブを無くしたので、健診の予定と記録への入口はここ（前の日と当日は一番上の1枚になる） */}
      <Link href="/visit" className="inline-flex min-h-11 items-center gap-1 self-start text-base text-ink underline-offset-2 hover:underline">
        健診と予防接種 ›
      </Link>

      {/* 急ぎの時（窒息・心肺蘇生・119）。通信が無くても開けるよう、ふつうのリンクで開く（sw.js がこのページだけ取っておく） */}
      {/* 赤は命の橋だけ。ふだんは墨色の字と小さな赤い点（安心のデザイン #3） */}
      <a href="/emergency" className="inline-flex min-h-11 items-center gap-2 self-start text-base font-semibold text-ink underline-offset-2 hover:underline">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-alert" aria-hidden />
        急ぎの時 ›
      </a>

      {/* 見本の家族の時期は、上の帯の「時期を変える」から（最初の1分 2026-11-04） */}
    </main>
  );
}

/** 週数の帯（1行）。1000日の何日目かは小さく右に */
function WeekBand({ family, today }: { family: Family; today: string }) {
  // つらい別れの間は、「いつもの今日の画面」を開いても週数・予定日まで・1000日の線を出さない（lib/situation.ts の hideCounts）
  if (hideCounts(family)) return null;
  const c = clockAt(family, today);
  const toDue = diffDays(family.dueDate, today);
  let main: string;
  if (c.phase === "pregnant") {
    // 予定日を過ぎても数え上げない（一番身構える週に、数字を増やさない）
    const due = toDue > 0 ? `予定日まであと${toDue}日` : toDue === 0 ? "今日が予定日" : "予定日のころ";
    main = `${c.pregnancyWeek}週 ・ ${due}`;
  } else if (c.phase === "trying") {
    main = "授かる前";
  } else if (c.phase === "after") {
    main = `${c.label} ・ 1000日を過ぎました`;
  } else {
    main = family.childName ? `${family.childName} ・ ${c.label}` : c.label;
  }
  // 1000日（妊娠から2歳まで）の線の上の今。数字（「1000日の282日目」）は意味が通じなかったので、位置で見せる
  const pos = c.dayOf1000 > 0 && c.phase !== "after" ? Math.min(1, c.dayOf1000 / totalDays(family)) : null;
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-display text-xl font-bold">{main}</h1>
      {pos != null && (
        <div className="flex items-center gap-2 text-xs text-muted" aria-label={`妊娠から2歳までの${Math.round(pos * 100)}%のところ`}>
          <span aria-hidden>妊娠</span>
          <span className="relative h-1 flex-1 rounded-full bg-line" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-full bg-rose/60" style={{ width: `${pos * 100}%` }} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-rose" style={{ left: `${pos * 100}%` }} />
          </span>
          <span aria-hidden>2歳</span>
        </div>
      )}
    </header>
  );
}

/**
 * 今やる事が無い時: 休んでいい、と次に動く日（安心のデザイン #2）。
 * 「大丈夫」を一番大きく。日数は数えず日付で。見張っている近い3件を見せ、見落としの不安を減らす。
 * 町の予定まで確かめたとは書かない（期限表から決まる事だけ）。
 */
function Calm({ upcoming, today, others = 0, before = 0 }: { upcoming: Task[]; today: string; others?: number; before?: number }) {
  // 家族のほかの人の番で、期限のある事が「このあと」に残っている時は、家族全体が大丈夫とは言わない（なりきり sim-15・sim-14）
  // 上に「手帳を始める前の事」（聞く事・まだの事）がある時も、何もしなくて大丈夫とは言わない（2026-11-04）
  // UX 2026-11-04: 上の箱を受ける言い回し（「上の…のほかは」）は一度で読めなかったので、それだけで読める見出しに
  const title = before > 0 ? "ほかに、今すぐやる事はありません" : others > 0 ? "あなたは今週、急ぐ事はありません" : "今週は、何もしなくて大丈夫";
  const next = upcoming[0];
  if (!next) return <NextStep tone="ok" title={title} sub={others > 0 ? "家族の番の事は、下の「このあと」に日付の順で並べています。" : undefined} />;
  // 日付は下の一覧と同じ「11/19（木）ごろから」の形。先の事の一覧は下の「近づいたら、ここに出します」1か所だけ
  // （UX 2026-11-04: ここの「見張っている事」と下の一覧に、同じ事が2回・2つの日付の形で出ていた）
  const when = (t: Task) => (t.awaitingPregnancy ? "授かったら" : t.awaitingBirth ? "生まれたら" : `${jpShort(t.startDate, today)}ごろから`);
  return (
    <NextStep
      tone="ok"
      title={title}
      sub={`${others > 0 ? "家族の番の事は、下の「このあと」に日付の順で並べています。" : ""}次は ${when(next)}、「${next.plain}」。近づいたら、ここの一番上に出します。`}
    />
  );
}

/**
 * 静かにする家族の今日（安心のデザイン #5）。日数・週数・「次は」・お知らせ・祝いの言葉を出さない。色は紙と墨だけ。
 * 体の判断はせず、本当に要る手続きと、話せる所への橋だけを置く。記録は消さない。
 * 出典: 死産の届出に関する規程 第4条（死産後7日以内）。労働基準法第65条（妊娠4か月以上の分娩は死産も含み、産後休業の対象）。
 * 健康保険法第101条（出産育児一時金。妊娠85日以上の分娩は死産・流産も含む）。母子保健法第20条（養育医療）。戸籍法第49条（出生届14日以内）。
 */
function QuietDay({ family, quiet, onShowAll }: { family: Family; quiet: "loss" | "nicu"; onShowAll: () => void }) {
  const loss = quiet === "loss";
  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-8">
      <section className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-5">
        <h1 className="font-display text-2xl leading-snug font-bold">今は、何もしなくて大丈夫です</h1>
        <p className="text-base">
          {loss
            ? "手帳の予定とお知らせは止めています。記録はそのまま残っています。"
            : "今は赤ちゃんと、ご自分の体を一番に。手帳の予定とお知らせは止めています。"}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">要る手続き（今日でなくて大丈夫です）</h2>
        <ul className="flex flex-col gap-2 text-base">
          {loss ? (
            <>
              <li>妊娠12週を過ぎてからの時は、7日以内に役所へ死産の届け出があります。多くは病院が書類を用意し、家族の代わりの人が出せます。</li>
              <li>妊娠12週（85日）を過ぎてからの時は、出産育児一時金と、働いている人は産後の休業の対象です。健康保険と職場に聞いてください。</li>
              <li>分からない事は、病院の相談の窓口（医療ソーシャルワーカー）に聞けます。</li>
            </>
          ) : (
            <>
              <li>出生届は、生まれた日から14日以内です。赤ちゃんが入院中でも出せます。家族が代わりに出せます。</li>
              <li>入院の費用を助ける制度（養育医療）があります。病院の相談の窓口（医療ソーシャルワーカー）に聞いてください。</li>
              <li>健診や予防接種の時期は、退院の時に病院と相談して決めます。</li>
            </>
          )}
        </ul>
      </section>

      <HelpPlaces family={family} loss={loss} />

      <div className="flex flex-wrap gap-2">
        <Btn kind="quiet" onClick={onShowAll}>
          いつもの今日の画面を見る
        </Btn>
        <Btn kind="quiet" href="/settings">
          静かにするのをやめる
        </Btn>
      </div>
    </main>
  );
}
