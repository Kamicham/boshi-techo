// 「今日」の画面で、やる事を並べる順と、誰の番かの言い方。
import type { Family, Member } from "@/lib/demo-family";
import { deadlineKindOf, endOf, type Milestone, type Status } from "../../lib/milestones";
import { diffDays } from "../../lib/clock";

const daysUntil = (today: string, date: string) => diffDays(date, today);

export interface Task extends Milestone {
  status: Status;
}

const URGENCY: Partial<Record<Status, number>> = { 期限切れ: 0, 期限が近い: 1, 今やる: 2 };

/** 今やる事の状態 */
export const NOW: ReadonlySet<Status> = new Set<Status>(["今やる", "期限が近い", "期限切れ"]);

/** 自分の「まだ先」のうち、これだけ近ければ「もうすぐ」として先に出す */
export const SOON_DAYS = 14;

/** この人の担当か（「家族」は全員の担当） */
export function isMine(m: Pick<Milestone, "who">, me: Member | null): boolean {
  if (!me) return false;
  return m.who === "家族" || m.who === me.role;
}

/**
 * 今やる事の並べ方: 期限切れ・期限が近い物 → 使う人の担当 → 期限のある物 → 終わりが近い順。
 * 期限の無い「お知らせ」（健診が毎週になる、など）は、期限のある事より後ろ。
 */
export function sortNow(tasks: Task[], me: Member | null): Task[] {
  const key = (t: Task) => [URGENCY[t.status] ?? 3, isMine(t, me) ? 0 : 1, t.deadlineDate ? 0 : 1] as const;
  return [...tasks].sort((a, b) => {
    const ka = key(a);
    const kb = key(b);
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return ka[i] - kb[i];
    return endOf(a).localeCompare(endOf(b));
  });
}

/** 期限をこれより多く過ぎた事は、一番上と「このあと」から外し、stale（済みましたか？）へ回す */
export const STALE_DAYS = 30;

/**
 * 時期を過ぎて畳む事か（まだ済みにしていない物）:
 * - 生まれた後の、妊娠中だけの事（期限のある物だけ。「健診が毎週になる」のようなお知らせは聞かずに消す）
 * - 期限を30日より多く過ぎた事（目安の物は、過ぎたらすぐ）
 */
export function isStale(t: Task, today: string): boolean {
  if (t.status === "済み") return false;
  if (t.endsOn && today >= t.endsOn) return !!t.deadlineDate;
  if (!t.deadlineDate || t.status !== "期限切れ") return false;
  // 法の期限ではない「目安」は、過ぎたら赤く一番上に出さず、すぐ「済みましたか？」へ回す
  if (deadlineKindOf(t) === "目安") return true;
  return daysUntil(today, t.deadlineDate) < -STALE_DAYS;
}

/** あと何日（まだ先なら始まりまで、期限があれば期限まで。期限の無いお知らせと「生まれたら」の事は null） */
export function daysLeft(t: Task, today: string): number | null {
  if (t.awaitingBirth) return null;
  if (t.status === "まだ先") return daysUntil(today, t.startDate);
  if (t.deadlineDate) return daysUntil(today, t.deadlineDate);
  return null;
}

/** 「このあと」の並べ方: あと何日の順だけ（担当では分けない）。日数の無いお知らせは後ろ */
export function byDays<T>(items: T[], days: (x: T) => number | null): T[] {
  const k = (x: T) => days(x) ?? Number.POSITIVE_INFINITY;
  return [...items].sort((a, b) => k(a) - k(b));
}

export interface TodayPlan {
  /** 一番上の1つ */
  top: Task | null;
  /** 一番上が「もうすぐ」（自分の今やる事が無く、まだ先の近い事を出した） */
  topIsSoon: boolean;
  /** このあと（日数の順） */
  rest: Task[];
  /** まだ先（畳む。「このあと」に出した物は除く。「生まれたら」の事もここ） */
  upcoming: Task[];
  /**
   * 時期を過ぎて畳んだ事（まだ済みにしていない物）。画面が「済みましたか？」の箱で1回だけまとめて聞く。
   * 中身は isStale: 生まれた後の妊娠中だけの事（期限のある物）と、期限を30日より多く過ぎた事。
   * 並びは期限の古い順（同じ日なら id の順）
   */
  stale: Task[];
}

/**
 * 今日の画面の割り振り。
 * 使う人（me）がいる時、一番上は必ずその人の事（家族みんなの事を含む）。
 * 自分の今やる事が無ければ、自分の「まだ先」で14日以内の物を「もうすぐ」として先に出す。
 * ほかの人の番は「このあと」の1行だけ。
 */
export function planToday(tasks: Task[], today: string, me: Member | null): TodayPlan {
  const stale = tasks
    .filter((t) => isStale(t, today))
    .sort((a, b) => (a.deadlineDate ?? "").localeCompare(b.deadlineDate ?? "") || a.id.localeCompare(b.id));
  const staleIds = new Set(stale.map((t) => t.id));
  // 生まれた後の妊娠中だけの事は、期限の有る無しにかかわらず今やるに出さない
  const live = tasks.filter((t) => !staleIds.has(t.id) && !(t.endsOn && today >= t.endsOn));
  const now = sortNow(
    live.filter((t) => NOW.has(t.status)),
    me,
  );
  const later = live.filter((t) => t.status === "まだ先");
  if (!me) {
    return { top: now[0] ?? null, topIsSoon: false, rest: byDays(now.slice(1), (t) => daysLeft(t, today)), upcoming: later, stale };
  }
  const mineNow = now.filter((t) => isMine(t, me));
  const others = now.filter((t) => !isMine(t, me));
  const soon = later
    .filter((t) => isMine(t, me) && !t.awaitingBirth && daysUntil(today, t.startDate) <= SOON_DAYS)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const soonIds = new Set(soon.map((t) => t.id));
  const upcoming = later.filter((t) => !soonIds.has(t.id));
  if (mineNow.length > 0) {
    return { top: mineNow[0], topIsSoon: false, rest: byDays([...mineNow.slice(1), ...others, ...soon], (t) => daysLeft(t, today)), upcoming, stale };
  }
  if (soon.length > 0) {
    return { top: soon[0], topIsSoon: true, rest: byDays([...soon.slice(1), ...others], (t) => daysLeft(t, today)), upcoming, stale };
  }
  return { top: null, topIsSoon: false, rest: byDays(others, (t) => daysLeft(t, today)), upcoming, stale };
}

/** 担当の呼び名（家族の名前で。いなければ役の言い方） */
export function whoLabel(m: Pick<Milestone, "who">, family: Family, me: Member | null): string {
  if (me && m.who === me.role) return "あなた";
  if (m.who === "家族") return "家族みんな";
  const person = family.members.find((x) => x.role === m.who);
  if (person) return person.name;
  return m.who === "母" ? "ママ" : m.who === "パートナー" ? "パパ" : m.who;
}
