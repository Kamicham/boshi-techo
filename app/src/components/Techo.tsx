"use client";

// 「今日」の画面: 開いた瞬間に「今やる1つ」。2つ目からは1行ずつ、まだ先と済んだ事は畳む。
import Link from "next/link";
import { demoAppliedOn, moneyWatch } from "@/lib/money";
import { useCallback, useEffect, useMemo, useState } from "react";
import { diffDays } from "@/lib/clock";
import { weekBand } from "@/lib/week-band";
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
import { BirthTripCard, TripFolded } from "./today/BirthTripCard";
import { CautionCard } from "./today/CautionCard";
import { planBirthTrip, tripScreen } from "@/lib/birth-trip";
import { applyRetime, type Retime } from "@/lib/vax-next";
import { StaleBox } from "./today/StaleBox";
import { StartedLate } from "./today/StartedLate";
import { AdvisorCard } from "./today/AdvisorCard";
import { ClosedAdvice } from "./today/ClosedAdvice";
import { ConsultAsk } from "./today/ConsultAsk";
import { MilestoneDay } from "./today/MilestoneDay";
import { BumpMoment } from "./today/BumpMoment";
import { LetterNews } from "./today/LetterNews";
import { BirthdayCard } from "./today/BirthdayCard";
import { birthdayFor, bornPromptFor, celebrationFor, welcomeFor } from "@/lib/media-shared";
import { BornPrompt, WelcomeBaby } from "./today/WelcomeBaby";
import { FamilyNews } from "./today/FamilyNews";
import { doneWords, familyNewsFor, type Thanks } from "@/lib/done-words";
import { byDays, daysLeft, planToday, whoLabel, withAssignee, type Task } from "./today/task";
import { bigCardDay, foldNow, type NowRow } from "./today/now-fold";
import { VisitToday, visitIsTop } from "./today/VisitToday";
import { canLocalFor, prepAhead, type Prepared } from "./today/prep";
import { PrepAhead, PrepNote } from "./today/PrepAhead";
import { urgentNear } from "./today/urgent";
import { focusFor, useStageFocus } from "./today/stage-focus";
import { calmWords } from "./today/calm";
import { currentLang, t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { msWords } from "@/lib/i18n/milestone-words";

// 訳さない: 続柄の値（whoLabel が画面の言葉の呼び名にする）
const MOTHER = { who: "母" } as const;
import { DRAFTABLE } from "./MilestoneActions";

/** 「済んだにしました・もどす」を出しておく長さ */
const UNDO_MS = 20000;

// ほかの画面が使っている日付の言い方（中身は today/dates.ts）
export { jpDate } from "./today/dates";

export function Techo() {
  const { family, today, isDemo, me, timeTravel } = useFamily();
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
  // 済んだ印を読み込めなかった時（電波・サーバの入れ替え）。押した印の失敗（doneError）と分け、「元に戻しました」と言わない。reload は「もう一度読む」
  const [loadError, setLoadError] = useState("");
  const [reload, setReload] = useState(0);
  // 誰が済ませたか（家族の一人の id）と、済ませた人へ届いたありがとう（/api/done の doneBy・thanks。11/5 より前の記録には無い）
  const [doneBy, setDoneBy] = useState<Record<string, string>>({});
  const [thanks, setThanks] = useState<Record<string, Thanks>>({});
  const [visit, setVisit] = useState<{ next: VisitPlan["next"]; agenda: number; guess: string | null } | null>(null);
  const [keep, setKeep] = useState<Keep | null>(null);
  // 下書きに「送った」「使った」の印が付いた事（済んだ事として扱う）
  const [sent, setSent] = useState<Set<string>>(new Set());
  // 済んだ印と下書きの印を読み終わるまで、一番上を出さない（済んだ事が一瞬出るのを防ぐ）
  const [doneReady, setDoneReady] = useState(false);
  const [sentReady, setSentReady] = useState(false);
  // 気づいた事があるか（先に数だけ聞く。ある時は、読み込みの間も同じ高さの場所を取っておく）
  const [advisorOpen, setAdvisorOpen] = useState<number | null>(null);
  // 手帳が前に用意した物（下書き・町の窓口。GET /api/prep）と、用意ができた時に読み直す印（UX の見直し C07）
  const [prepared, setPrepared] = useState<Record<string, Prepared>>({});
  const [prepVer, setPrepVer] = useState(0);
  // 母の画面でたたんだ生まれた届け（パートナーの番）を開いているか（UX の見直し C08）
  const [tripOpen, setTripOpen] = useState(false);
  // ほかの画面から「この事を今日の画面で開く」（/?focus=<id>）
  const [focusId, setFocusId] = useState<string | null>(null);
  useEffect(() => {
    setFocusId(new URLSearchParams(window.location.search).get("focus"));
  }, []);
  // 見本の時期の札から開いた時は、札の言葉の事を一番上に（その日だけ。UX の見直し C36・today/stage-focus.ts）
  const stageFocus = useStageFocus();

  /** GET /api/done の返り（fromTecho は担当A の版から。無ければ空として読む） */
  type DoneRes = { done: string[]; fromTecho?: string[]; retime?: Record<string, Retime>; doneOn?: Record<string, string>; doneBy?: Record<string, string>; thanks?: Record<string, Thanks> };
  const readDone = useCallback((j: DoneRes) => {
    setMarked(new Set(Array.isArray(j.done) ? j.done : []));
    setFromTecho(new Set(Array.isArray(j.fromTecho) ? j.fromTecho : []));
    setRetime(j.retime && typeof j.retime === "object" ? j.retime : {});
    setAppliedOn(j.doneOn && typeof j.doneOn === "object" ? j.doneOn : {});
    setDoneBy(j.doneBy && typeof j.doneBy === "object" ? j.doneBy : {});
    setThanks(j.thanks && typeof j.thanks === "object" ? j.thanks : {});
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
    setDoneBy({});
    setThanks({});
    setLastDone(null);
    setDoneError("");
    setLoadError("");
    setKeep(null);
    setSent(new Set());
    setPrepared({});
    setTripOpen(false);
    setDoneReady(false);
    setSentReady(false);
    const fid = encodeURIComponent(family.id);
    api<DoneRes>(`/api/done?familyId=${fid}&today=${today}`)
      .then((j) => {
        if (!alive) return;
        readDone(j);
        setDoneReady(true);
      })
      // 読めなかった時は、済んだ事が「まだ」に見えないよう骨組みのまま（doneReady を立てない）、「もう一度読む」を出す
      .catch((e: Error) => alive && setLoadError(e.message));
    api<{ keep: Keep }>(`/api/keep?familyId=${fid}`)
      .then((j) => alive && setKeep(j.keep ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // 手帳で済んだ事は「今日」までの記録から決まるので、今日が変わった時も読み直す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, today, reload]);

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
    // reload: 「もう一度読む」で上の読み込みが下書きの印も空にするので、ここも読み直す
  }, [family.id, today, readDone, reload]);

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
        await api("/api/done", { method: on ? "POST" : "DELETE", body: { familyId: family.id, milestoneId: m.id, today, ...(on && me ? { by: me.id } : {}) } });
        setDoneBy((d) => {
          const next = { ...d };
          if (on && me) next[m.id] = me.id;
          else delete next[m.id];
          return next;
        });
      } catch (e) {
        setMarked(prev);
        setLastDone(null);
        setDoneError((e as Error).message);
      }
    },
    [marked, family.id, today, me],
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
      // まとめての時の言葉は、描く所で ids の数から作る（「{n}つを済んだにしました」）
      setLastDone(one ? { id: one.id, title: one.plain } : ids.length > 1 ? { id: ids[0], title: "", ids } : null);
      try {
        for (const id of ids) await api("/api/done", { body: { familyId: family.id, milestoneId: id, today, ...(me ? { by: me.id } : {}) } });
        if (me) setDoneBy((d) => ({ ...d, ...Object.fromEntries(ids.map((id) => [id, me.id])) }));
      } catch (e) {
        setMarked(prev);
        setLastDone(null);
        setDoneError((e as Error).message);
      }
    },
    [marked, schedule, family.id, today, me],
  );

  // 済ませた家族の一人へ、ありがとう（先に画面へ。送れなかったら戻す）
  const sendThanks = useCallback(
    async (milestoneId: string) => {
      if (!me) return;
      const prev = thanks;
      setThanks({ ...thanks, [milestoneId]: { by: me.id, today, at: new Date().toISOString() } });
      try {
        await api("/api/done", { method: "PATCH", body: { familyId: family.id, milestoneId, by: me.id, today } });
      } catch (e) {
        setThanks(prev);
        setDoneError(t("ありがとうを、まだ送れていません（{reason}）", { reason: (e as Error).message }));
      }
    },
    [me, thanks, family.id, today],
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
  // 押して来た事（?focus=<id>）か、見本の時期の札の事を一番上に。札が「手帳が気づいた事」の時は、気づきの箱を一番上の札より上に
  const { taskId: focusTaskId, advisorFirst } = focusFor(stageFocus, focusId, today);
  const focus = focusTaskId ? tasks.find((t) => t.id === focusTaskId && t.status !== "済み" && t.status !== "過ぎた") ?? null : null;
  // 生まれた日から15日の間は、届けの束（UX の見直し C08。決め方は lib/birth-trip.ts の tripScreen）:
  // 束が自分の番の画面・まだ誰が行くか決めていない家族は、束を一番上の1枚に（自分の番の最初の届けは、束の中で用意する。一番上の札を重ねない）。
  // 母の画面で、届けをパートナーの番に決めた時は、束を1行にたたみ、一番上は母の今日の一番上（無ければ休む札）。束の届けは「このあと」に出さない
  const trip = planBirthTrip(tasks, today, family.birthDate && family.birthDate <= today ? family.birthDate : undefined, family.situation);
  const ts = tripScreen(
    trip,
    tasks,
    plan,
    me?.role,
    family.members.some((m) => m.role === "パートナー"),
    today,
  );
  const baseTop = ts ? ts.top : plan.top;
  const baseRest = ts ? ts.rest : plan.rest;
  // 始める前の事で「まだ」と答えた事は、見本の家族の一番上と同じ札に上げる（どこへ行くか・書く事のメモ・カレンダー）。
  // 目安は過ぎているので「今からでも」の形（期限切れ）で出す。届けの束・健診の日・押して来た事がある時は、そちらが先（UX 2026-11-04）
  const lateTask = lateOpen.length && !visitTop && !trip && !focus ? tasks.find((t) => t.id === lateOpen[0]) : undefined;
  // 訳さない: 札の種類の値（描く所で訳す）
  const lifted: ShownTask | null = lateTask ? { ...lateTask, status: "期限切れ" } : null;
  const top = visitTop ? null : (focus ?? lifted ?? baseTop);
  // 健診が一番上の日は、一番上に出すはずだった事も「このあと」へ（あと何日の順に入れ直す）
  const pool = (visitTop || lifted) && baseTop ? [baseTop, ...baseRest] : focus && baseTop && baseTop.id !== focus.id ? [baseTop, ...baseRest] : baseRest;
  const restTasks = byDays(pool.filter((t) => t.id !== focus?.id), (t) => daysLeft(t, today));
  const visitRow = nextVisit && !visitTop && diffDays(nextVisit.date, today) > 0 ? nextVisit : null;
  // 「このあと」は、あと何日の順だけ（次の健診の1行も同じ並びに入れる）
  // 妊婦健診の予約がまだで、国の標準の目安が7日以内なら「予約を」の1行（第1波⑧。病院が言った日が正）
  const guess = !nextVisit && visit?.guess && diffDays(visit.guess, today) >= 0 && diffDays(visit.guess, today) <= 7 ? visit.guess : null;
  const rows = byDays<NowRow>(
    [
      ...restTasks.map((task) => ({ kind: "task" as const, task })),
      ...(visitRow ? [{ kind: "visit" as const }] : []),
      // 一番上が空く日は、健診の予約を一番上に出すので、ここには重ねない
      ...(guess && (top || visitTop) ? [{ kind: "prenatal" as const }] : []),
    ],
    (r) => (r.kind === "visit" ? daysUntil(today, visitRow!.date) : r.kind === "prenatal" ? daysUntil(today, guess!) : daysLeft(r.task, today)),
  );
  // 自分の番は3行まで・ほかの人の番は人ごとに1行（家族の声①への直し A。法の期限が明日までの事は畳まない）
  const nowFold = foldNow(rows, me, today);
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
  // 生まれた届けの担当を、まとめて決める（束の見出しの「役所へ行くのは？」）
  const onAssignMany = (ids: string[], who: string) => {
    setKeep((k) => {
      const assign = { ...(k?.assign ?? {}) };
      for (const id of ids) {
        if (who) assign[id] = who;
        else delete assign[id];
      }
      return { ...(k ?? {}), assign };
    });
    void api("/api/keep", { body: { familyId: family.id, keep: { assign: Object.fromEntries(ids.map((id) => [id, who])) } } }).catch(() => {});
  };
  const common = { today, family, me, keep, onAssign, prepared };
  const bday = birthdayFor(family, today);
  // 「生まれました」の儀式: 37週から「生まれたら、ここから」、生まれた日からお七夜の前の日まで「ようこそ」（components/today/WelcomeBaby.tsx）
  const bornPrompt = bornPromptFor(family, today);
  const welcome = welcomeFor(family, today);
  // 節目の日（お七夜・お宮参り・お食い初め・ハーフ・1歳6か月）の1枚（components/today/MilestoneDay.tsx）
  const celebration = celebrationFor(family, today);
  // 束を一番上の1枚に出す（健診の日・押して来た事がある時は、そちらが先）。たたんだ1行は、一番上の札の下にいつも出す
  const tripShown = !!ts?.full && !(visitTop && nextVisit) && !focus;
  const tripFold = ts?.fold ?? null;
  // 法の期限を過ぎてまだの事があり、一番上が目安の事か何も無い時は、ふり返りを開いて一番上に出す（祝いの日は、祝いを上に。ふり返りはいつもの場所）
  const festive = !!bday || welcome !== null || !!celebration;
  const staleFirst = stale.length > 0 && !(visitTop && nextVisit) && !focus && !tripShown && (!top || isGuide(top)) && !festive;
  const loading = !(doneReady && sentReady && advisorOpen !== null);
  const quiet = family.situation?.quiet;
  // 気をつける事の札を出さない日: お祝いの日・届けの束を全部出す日・手帳の気づきが開いている日（大きな札を重ねない）
  // 大きな札の日は、相談の問いも出さず、近づいたらを1行に畳む（家族の声①への直し A）
  const cautionBusy = bigCardDay({ festive, tripShown, advisorOpen });

  // 手帳が先に用意する事（UX の見直し C07）: 一番上の札が用意する1件を含めて3件まで。残りは裏で用意する（本物の家族だけ。PrepAhead）
  const firstPrep = loading || (visitTop && nextVisit) ? null : top;
  const ahead = loading ? [] : prepAhead(tasks, today, me, firstPrep, (t) => canLocalFor(t, family) || t.id in DRAFTABLE);
  // 行の札と帯の下の1行のために、前に用意した物をまとめて読む（読むだけ。Claude は呼ばない）
  const prepIds = loading
    ? ""
    : [
        ...new Set([
          ...(top ? [top.id] : []),
          ...rows.flatMap((r) => (r.kind === "task" ? [r.task.id] : [])),
          ...upcoming.slice(0, 3).map((t) => t.id),
          ...(trip?.items.map((i) => i.task.id) ?? []),
          ...ahead.map((t) => t.id),
        ]),
      ].join(",");
  const meId = me?.id;
  useEffect(() => {
    if (!prepIds) return;
    let alive = true;
    const q = new URLSearchParams({ familyId: family.id, ids: prepIds, ...(meId ? { meId } : {}) });
    api<{ items: Record<string, Prepared> }>(`/api/prep?${q}`)
      .then((j) => alive && setPrepared(j.items ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id, meId, prepIds, prepVer]);
  // 用意ができた時（一番上の札・束の1行目・裏の用意）に読み直す
  useEffect(() => {
    const bump = () => setPrepVer((v) => v + 1);
    window.addEventListener("boshi:prep", bump);
    return () => window.removeEventListener("boshi:prep", bump);
  }, []);


  if (quiet && !showAll) return <QuietDay family={family} quiet={quiet} onShowAll={() => setShowAll(true)} />;

  // 生まれた届けの束（一番上の1枚か、たたんだ1行を開いた時）
  const tripCard = trip ? (
    <BirthTripCard
      key={`${family.id}:trip`}
      trip={trip}
      {...common}
      firstId={ts?.full ? (ts.top?.id ?? null) : null}
      onAssignMany={onAssignMany}
      onDone={(ids) => void setManyDone(ids)}
      onKeep={(date) => {
        setKeep((k) => ({ ...(k ?? {}), birthTrip: { date } }));
        void api("/api/keep", { body: { familyId: family.id, keep: { birthTrip: { date } } } }).catch(() => {});
      }}
    />
  ) : null;

  // 「ほかに今やる事」の1行（予定の事・妊婦健診の予約・次の健診）
  const rowEl = (r: NowRow) =>
    r.kind === "task" ? (
      <TaskRow key={`${family.id}:${r.task.id}`} task={r.task} {...common} onDone={() => void setDone(r.task, true)} />
    ) : r.kind === "prenatal" ? (
      <Link key="prenatal" href="/visit" className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
        <span className="min-w-0">
          <span className="block text-base font-semibold">
            {t("次の妊婦健診を予約する")}
            {me?.role === "パートナー" && <span className="text-sm font-normal text-muted">{t("（{who}の番）", { who: whoLabel(MOTHER, family, me) })}</span>}
          </span>
          <span className="block text-sm text-muted">{t("国の目安では今ごろです。病院で日を言われていたら、そちらに合わせてください")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular text-sm font-semibold">{daysUntil(today, guess!) === 0 ? t("今日ごろ") : t("あと{n}日ごろ", { n: daysUntil(today, guess!) })}</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </span>
      </Link>
    ) : (
      <Link key="visit" href="/visit" className="flex min-h-12 items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
        <span className="text-base font-semibold">
          {t("次の健診")}
          {visitRow!.time ? ` ${visitRow!.time}` : ""}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <span className="tabular text-sm font-semibold">{t("あと{n}日", { n: daysUntil(today, visitRow!.date) })}</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </span>
      </Link>
    );

  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-8">
      <WeekBand family={family} today={today} />
      {/* 手帳がしておいた事（日付）: 窓口の調べと下書き。鍵の無い見本の答えは数えないので、見本では出ない */}
      {!loading && <PrepNote tasks={ahead} prepared={prepared} today={today} />}
      {!loading && <PrepAhead tasks={ahead.filter((t) => t.id !== firstPrep?.id)} family={family} me={me} today={today} enabled={!timeTravel} />}

      {!loading && bornPrompt && <BornPrompt key={`${family.id}:born`} family={family} today={today} />}

      {doneError && (
        <Notice title={t("済んだの印を、まだ保存できていません")} safe={t("押した印は元に戻しました。電波のある所で、もう一度押してください。")} detail={doneError} />
      )}
      {loadError && (
        <Notice title={t("済んだの印を、読み込めませんでした")} safe={t("記録は消えていません。電波のある所で、もう一度読んでください。")} detail={loadError}>
          <Btn kind="secondary" onClick={() => setReload((n) => n + 1)}>
            {t("もう一度読む")}
          </Btn>
        </Notice>
      )}
      {/* 押した場所から見える所（下のタブの上）に、数秒だけ出す */}
      {lastDone && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-20 flex justify-center px-4" style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}>
          <p role="status" className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-xl bg-ink px-4 text-base text-white shadow-lg">
            <span className="min-w-0 py-3">
              {lastDone.ids ? t("{n}つを済んだにしました", { n: lastDone.ids.length }) : t("「{title}」を済んだにしました", { title: msWords(lastDone.title) })}
              {!lastDone.ids && doneWords(lastDone.id, nameIn(family.childName)) && <span className="block text-sm text-white/80">{doneWords(lastDone.id, nameIn(family.childName))}</span>}
            </span>
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
              {t("もどす")}
            </button>
          </p>
        </div>
      )}

      {/* 生まれた日からお七夜の前の日までは、一番上に「ようこそ」の1枚（はじめましての写真・声・家族へ知らせる・届けの一言） */}
      {!loading && welcome !== null && (
        <WelcomeBaby key={`${family.id}:welcome`} family={family} today={today} me={me} reg={tasks.find((t) => t.id === "birth-registration")} by={me?.name} tripBelow={tripShown} />
      )}
      {/* 1歳・2歳の誕生日から2週間は、一番上に誕生日の1枚（開いた手紙・一冊・映画） */}
      {!loading && bday && <BirthdayCard key={`${family.id}:bday${bday}`} family={family} today={today} by={me?.name} age={bday} />}
      {/* 節目の日は、その日から2日の間、一番上に節目の1枚（写真・声・手紙の入口）。やる事はすぐ下 */}
      {!loading && celebration && <MilestoneDay key={`${family.id}:${celebration.id}`} family={family} today={today} m={celebration} />}
      {/* 見本の「もしも」の札・生まれた翌日の札から開いた時は、手帳が気づいた事（組み直し）を一番上の札より上に（UX の見直し C36） */}
      {!loading && advisorFirst && advisorOpen! > 0 && <AdvisorCard key={`${family.id}:${today}`} familyId={family.id} today={today} meId={me?.id} />}
      {loading ? (
        <div className="h-40 rounded-2xl bg-rose-soft/60" aria-hidden />
      ) : visitTop && nextVisit ? (
        <VisitToday family={family} today={today} next={nextVisit} agendaCount={visit?.agenda ?? 0} keep={keep} />
      ) : null}
      {/* 途中から始めた家族: 始める前に目安が過ぎた事を、済んでいるか1回聞く */}
      {!loading && <StartedLate family={family} today={today} onCount={setBeforeCount} onOpen={setLateOpen} lifted={lifted?.id} version={lateVer} forPartner={me?.role === "パートナー"} />}
      {!loading && staleFirst && <StaleBox key={`${family.id}:first`} tasks={stale} {...common} defaultOpen onDone={(ids) => void setManyDone(ids)} />}
      {!loading && tripShown && tripCard}
      {loading || (visitTop && nextVisit) || tripShown ? null : top ? (
        <NowCard
          key={`${family.id}:${top.id}`}
          task={top}
          soon={!focus && !lifted && (!trip || !!tripFold) && plan.topIsSoon}
          {...common}
          onDone={() => void setDone(top, true).then(() => lifted && setLateVer((v) => v + 1))}
        />
      ) : tripFold && me ? (
        // 届けはパートナーの番で、母が今やる事が無い日（UX の見直し C08）
        <NextStep tone="ok" title={t("{name}さんが今やる事はありません", { name: nameIn(me.name) })} sub={t("体を休めてください。")} />
      ) : guess ? (
        // 今やる事が無く、妊婦健診の予約の目安が近い日は「今すぐやる事はありません」と言わず、予約を一番上に（UX 2026-11-04: 大きな箱の真下に「今日ごろ」が出て、言う事が食い違っていた）
        <NextStep
          tone="rose"
          eyebrow={me?.role === "パートナー" ? t("いま、いちばん先の事（{who}の番）", { who: whoLabel(MOTHER, family, me) }) : t("いま、いちばん先の事")}
          title={t("次の妊婦健診を予約する")}
          sub={
            daysUntil(today, guess) === 0
              ? t("国の目安では今ごろです。病院で日を言われていたら、そちらに合わせてください。")
              : t("国の目安ではあと{n}日ごろです。病院で日を言われていたら、そちらに合わせてください。", { n: daysUntil(today, guess) })
          }
        >
          <Btn href="/visit">{t("予約した日を入れる")}</Btn>
        </NextStep>
      ) : (
        <Calm
          upcoming={me ? upcoming.filter((t) => t.who === "家族" || t.who === me.role) : upcoming}
          today={today}
          others={rows.filter((r) => r.kind === "task").length}
          before={beforeCount}
          advisor={advisorOpen! > 0 ? (advisorFirst ? "above" : "below") : undefined}
        />
      )}

      {/* 産後8週（生まれた日から55日目）までは、急ぎの時の入口を一番上の札のすぐ下にも（UX の見直し C02④）。夜中に赤ちゃんの事で開く時期なので、下まで探さずに押せる所へ。
          母にもパートナーにも出す。体の判断はしない（行き先は手当の手順と 119・#8000 への橋）。赤は小さな点だけ・ふつうのリンク（通信が無くても開ける）。下のいつもの入口はそのまま */}
      {!loading && urgentNear(family.birthDate, today) && (
        <a href="/emergency" className="flex min-h-11 items-center gap-2 rounded-xl border border-line bg-card px-4 py-2 text-ink">
          <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-alert" />
          <span className="shrink-0 text-base font-semibold">{t("急ぎの時")}</span>
          <span className="min-w-0 truncate text-sm text-muted">{t("119・#8000・手当の手順")}</span>
          <span aria-hidden className="ml-auto shrink-0 text-muted">
            ›
          </span>
        </a>
      )}

      {/* 母の画面: パートナーの番に決めた生まれた届けは1行に（押すと束が開く。UX の見直し C08） */}
      {!loading && tripFold && (
        <TripFolded fold={tripFold} family={family} today={today} open={tripOpen} onToggle={() => setTripOpen((v) => !v)} />
      )}
      {!loading && tripFold && tripOpen && tripCard}

      {/* 気をつける事の札（寝る所・泣きやまない時・月齢の事故・やらなくていい事・出生届出済証明）: 時期と出典で1回だけ、1日に1枚。
          「今やる1つ」より上に出さない。中身と守る線（静かにする家族・母の画面の生後0〜14日には出さない）は lib/cautions.ts */}
      {!loading && (
        <CautionCard
          key={`${family.id}:caution`}
          family={family}
          today={today}
          role={me?.role === "パートナー" ? "パートナー" : "母"}
          busy={cautionBusy}
        />
      )}

      {/* 手帳が見渡して気づいた事は、一番上の1枚の次に（大きな札を2枚並べない） */}
      {!loading && !advisorFirst && advisorOpen! > 0 && <AdvisorCard key={`${family.id}:${today}`} familyId={family.id} today={today} meId={me?.id} />}

      {/* 家族から: ほかの家族が済ませた事にありがとうを送り、自分に届いたありがとうを見る（家族が2人以上の手帳だけ） */}
      {!loading && (
        <FamilyNews
          news={familyNewsFor(family, me, today, { doneBy, doneOn: appliedOn, thanks })}
          childName={family.childName}
          titleOf={(id) => schedule.find((m) => m.id === id)?.plain ?? ""}
          onThank={(id) => void sendThanks(id)}
        />
      )}

      {!loading && rows.length > 0 && (
        <section aria-label={t("ほかに今やる事")} className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">{t("ほかに今やる事")}</h2>
          {/* 自分の番は3行まで。残りと、ほかの人の番は1行に畳む（法の期限が明日までの事は畳まない。components/today/now-fold.ts） */}
          {nowFold.shown.map(rowEl)}
          {nowFold.more.length > 0 && (
            <RowFold label={t("ほかに{n}件", { n: nowFold.more.length })}>{nowFold.more.map(rowEl)}</RowFold>
          )}
          {nowFold.others.map((g) => (
            <RowFold key={g.who} label={t("{who}さんの番 {n}件", { who: whoLabel({ who: g.who as Task["who"] }, family, me), n: g.rows.length })}>
              {g.rows.map(rowEl)}
            </RowFold>
          ))}
        </section>
      )}

      {!loading && !staleFirst && <StaleBox key={family.id} tasks={stale} {...common} onDone={(ids) => void setManyDone(ids)} />}


      {/* 封をした手紙が開いた日から2週間の一言（誕生日の札が出ている間は、そちらに入れる） */}
      {!loading && !bday && <LetterNews key={`${family.id}:letters`} family={family} today={today} by={me?.name} />}

      {/* 妊娠中の思い出の誘い（エコーの写真・妊娠5か月・おなかへの声・名前・未来の手紙）。月に1回まで、静かにする間は出さない */}
      {!loading && <BumpMoment key={`${family.id}:bump`} family={family} today={today} reportedOn={appliedOn["pregnancy-report"]} />}

      {/* 手帳の毎回の問い「相談できる人はいますか」（時期ごとに1回。答えた時期は出さない） */}
      {!loading && <ConsultAsk key={`${family.id}:consult`} family={family} today={today} meName={me?.name} hold={cautionBusy} />}

      {/* 大きな札の日は、近づいたらを1行に畳む（開けば同じ並びで全部） */}
      {!loading && cautionBusy && upcoming.length > 0 && (
        <section aria-label={t("近づいたら出す事")} className="flex flex-col">
          <RowFold label={t("近づいたら出す事 {n}件", { n: upcoming.length })}>
            {upcoming.map((t) => (
              <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} muted onDone={() => void setDone(t, true)} />
            ))}
          </RowFold>
        </section>
      )}

      {/* 先の事は近い3つだけ。残りは数だけ言い、開けば見られる（2032年まで30行の壁を見せない） */}
      {!loading && !cautionBusy && upcoming.length > 0 && (
        <section aria-label={t("近づいたら出す事")} className="flex flex-col">
          <h2 className="text-sm font-semibold text-muted">{t("近づいたら、ここに出します")}</h2>
          {upcoming.slice(0, 3).map((t) => (
            <TaskRow key={`${family.id}:${t.id}`} task={t} {...common} muted onDone={() => void setDone(t, true)} />
          ))}
          {upcoming.length > 3 && (
            <details className="group">
              <summary className="flex min-h-12 cursor-pointer list-none items-center gap-1 text-base text-muted">
                <span className="underline underline-offset-2">{t("ほかに{n}件あります", { n: upcoming.length - 3 })}</span>
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
        <Fold title={t("済んだ事")} count={finished.length}>
          <ul className="flex flex-col">
            {finished.map((task) => (
              <li key={task.id} className="flex min-h-12 items-center justify-between gap-3 border-b border-line last:border-b-0">
                <span className="min-w-0 text-base text-muted">✓ {msWords(task.plain)}</span>
                {fromTecho.has(task.id) ? (
                  <span className="shrink-0 rounded-full bg-ok/10 px-2 py-0.5 text-sm text-ok">{t("手帳で済み")}</span>
                ) : (
                  marked.has(task.id) && (
                  <button type="button" onClick={() => void setDone(task, false)} className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-2">
                    {t("もどす")}
                  </button>
                  )
                )}
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {/* 「わかった」で閉じた気づきを、文面ごともう一度開ける（見直し C10③。閉じた物が無ければ出ない） */}
      {!loading && <ClosedAdvice familyId={family.id} />}

      {/* 健診のタブを無くしたので、健診の予定と記録への入口はここ（前の日と当日は一番上の1枚になる） */}
      <Link href="/visit" className="inline-flex min-h-11 items-center gap-1 self-start text-base text-ink underline-offset-2 hover:underline">
        {t("健診と予防接種")} ›
      </Link>

      {/* 急ぎの時（窒息・心肺蘇生・119）。通信が無くても開けるよう、ふつうのリンクで開く（sw.js がこのページだけ取っておく） */}
      {/* 赤は命の橋だけ。ふだんは墨色の字と小さな赤い点（安心のデザイン #3） */}
      <a href="/emergency" className="inline-flex min-h-11 items-center gap-2 self-start text-base font-semibold text-ink underline-offset-2 hover:underline">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-alert" aria-hidden />
        {t("急ぎの時")} ›
      </a>

      {/* 見本の家族の時期は、上の帯の「時期を変える」から（最初の1分 2026-11-04） */}
    </main>
  );
}

/** 週数の帯（1行）と、1000日の線。言い方は lib/week-band.ts（つらい別れの間は出さない） */
function WeekBand({ family, today }: { family: Family; today: string }) {
  const b = weekBand(family, today);
  if (!b) return null;
  const { main, pos, walked } = b;
  return (
    <header className="flex flex-col gap-2">
      <h1 className="font-display text-xl font-bold">{main}</h1>
      {pos != null && (
        <div
          className="flex items-center gap-2 text-xs text-muted"
          aria-label={walked ? t("妊娠から2歳までを、歩き終えたところ") : t("妊娠から2歳までの{pct}%のところ", { pct: Math.round(pos * 100) })}
        >
          <span aria-hidden>{t("妊娠")}</span>
          <span className="relative h-1 flex-1 rounded-full bg-line" aria-hidden>
            <span className="absolute inset-y-0 left-0 rounded-full bg-rose/60" style={{ width: `${pos * 100}%` }} />
            <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-rose" style={{ left: `${pos * 100}%` }} />
          </span>
          <span aria-hidden>{t("2歳")}</span>
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
function Calm({ upcoming, today, others = 0, before = 0, advisor }: { upcoming: Task[]; today: string; others?: number; before?: number; advisor?: "above" | "below" }) {
  // 見出しと一言の頭は calm.ts（手帳が気づいた事が出ている日は「急ぐ事はありません」と言わない。統括の足し 3）
  const { title, lead } = calmWords({ before, others, advisor });
  const next = upcoming[0];
  if (!next) return <NextStep tone="ok" title={title} sub={lead || undefined} />;
  // 日付は下の一覧と同じ「11/19（木）ごろから」の形。先の事の一覧は下の「近づいたら、ここに出します」1か所だけ
  // （UX 2026-11-04: ここの「見張っている事」と下の一覧に、同じ事が2回・2つの日付の形で出ていた）
  // English は一言の頭（lead）と次の文の間に空きを入れる
  const head = lead && currentLang() === "en" ? `${lead.trimEnd()} ` : lead;
  const what = msWords(next.plain);
  const sub = next.awaitingPregnancy
    ? t("{lead}次は 授かったら、「{what}」。近づいたら、ここの一番上に出します。", { lead: head, what })
    : next.awaitingBirth
      ? t("{lead}次は 生まれたら、「{what}」。近づいたら、ここの一番上に出します。", { lead: head, what })
      : t("{lead}次は {date}ごろから、「{what}」。近づいたら、ここの一番上に出します。", { lead: head, date: jpShort(next.startDate, today), what });
  return <NextStep tone="ok" title={title} sub={sub} />;
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
        <h1 className="font-display text-2xl leading-snug font-bold">{t("今は、何もしなくて大丈夫です")}</h1>
        <p className="text-base">
          {loss
            ? t("手帳の予定とお知らせは止めています。記録はそのまま残っています。")
            : t("今は赤ちゃんと、ご自分の体を一番に。手帳の予定とお知らせは止めています。")}
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-muted">{t("要る手続き（今日でなくて大丈夫です）")}</h2>
        <ul className="flex flex-col gap-2 text-base">
          {loss ? (
            <>
              <li>{t("妊娠12週を過ぎてからの時は、7日以内に役所へ死産の届け出があります。多くは病院が書類を用意し、家族の代わりの人が出せます。")}</li>
              <li>{t("妊娠12週（85日）を過ぎてからの時は、出産育児一時金と、働いている人は産後の休業の対象です。健康保険と職場に聞いてください。")}</li>
              <li>{t("分からない事は、病院の相談の窓口（医療ソーシャルワーカー）に聞けます。")}</li>
            </>
          ) : (
            <>
              <li>{t("出生届は、生まれた日から14日以内です。赤ちゃんが入院中でも出せます。家族が代わりに出せます。")}</li>
              <li>{t("入院の費用を助ける制度（養育医療）があります。病院の相談の窓口（医療ソーシャルワーカー）に聞いてください。")}</li>
              <li>{t("健診や予防接種の時期は、退院の時に病院と相談して決めます。")}</li>
            </>
          )}
        </ul>
      </section>

      <HelpPlaces family={family} loss={loss} compact />

      <div className="flex flex-wrap gap-2">
        <Btn kind="quiet" onClick={onShowAll}>
          {t("いつもの今日の画面を見る")}
        </Btn>
        <Btn kind="quiet" href="/settings">
          {t("静かにするのをやめる")}
        </Btn>
      </div>
    </main>
  );
}

/** 一覧の中の1行の畳み（「ほかに◯件 ›」「◯◯さんの番 ◯件 ›」「近づいたら出す事 ◯件 ›」）。開くと同じ並びで全部出る */
function RowFold({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-line last:border-b-0">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-2 text-base text-muted">
        <span className="underline underline-offset-2">{label}</span>
        <span className="shrink-0 transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col">{children}</div>
    </details>
  );
}
