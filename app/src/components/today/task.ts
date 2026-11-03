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
 * 期限の無い事（保育園を調べる、など）は、期限のある事より後ろ。
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

/** 期限をこれより多く過ぎた事は、一番上と「このあと」から外して畳む */
export const STALE_DAYS = 30;

/**
 * 時期を過ぎて畳む事か（まだ済みにしていない物）:
 * - 生まれた後の、妊娠中だけの事
 * - 目安の日を過ぎた事（法の期限ではないので、過ぎたらすぐ）
 * - 法の期限を30日より多く過ぎた事
 * 畳んだ事のうち「済みましたか？」で聞くのは、法の期限がある物だけ（asksDone）。ほかは聞かずに隠す
 */
export function isStale(t: Task, today: string): boolean {
  if (t.status === "済み") return false;
  if (t.endsOn && today >= t.endsOn) return true;
  if (!t.deadlineDate || t.status !== "期限切れ") return false;
  if (deadlineKindOf(t) === "目安") return true;
  return daysUntil(today, t.deadlineDate) < -STALE_DAYS;
}

/** 畳んだ事を「済みましたか？」で聞くか（法の期限がある物だけ。目安の物と期限の無い物は聞かない） */
export function asksDone(t: Pick<Milestone, "deadlineDate" | "deadlineKind">): boolean {
  return !!t.deadlineDate && deadlineKindOf(t) === "期限";
}

/** あと何日（まだ先なら始まりまで、期限があれば期限まで。期限の無い事と「生まれたら」の事は null）。並べる順にも使う */
export function daysLeft(t: Task, today: string): number | null {
  if (t.awaitingBirth || t.awaitingPregnancy) return null;
  if (t.status === "まだ先") return daysUntil(today, t.startDate);
  if (t.deadlineDate) return daysUntil(today, t.deadlineDate);
  return null;
}

/** これより先の事は「あと◯日」と数えず、日付で書く */
export const FAR_DAYS = 30;

/** 画面に出す「あと◯日」。30日より先は null（代わりに whenDate の日付を出す） */
export function shownDays(t: Task, today: string): number | null {
  const d = daysLeft(t, today);
  return d != null && d <= FAR_DAYS ? d : null;
}

/** 12月10日（年が今日と違う時は 2027年12月10日） */
export function dateWord(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return date.slice(0, 4) === today.slice(0, 4) ? `${m}月${d}日` : `${y}年${m}月${d}日`;
}

/**
 * 日付の文: 期限なら「2027年12月10日まで」、まだ先なら「12月10日から」。
 * 期限の無い事と「生まれたら」の事は null
 */
export function whenDate(t: Task, today: string): string | null {
  if (t.awaitingBirth || t.awaitingPregnancy) return null;
  if (t.status === "まだ先") return `${dateWord(t.startDate, today)}から`;
  if (t.deadlineDate) return `${dateWord(t.deadlineDate, today)}まで`;
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
   * 時期を過ぎて畳んだ事のうち、法の期限がある物（まだ済みにしていない物）。画面が「済みましたか？」の箱で1回だけまとめて聞く。
   * 目安の物と期限の無い物は、畳んでも聞かない（ここに入れない）。並びは期限の古い順（同じ日なら id の順）
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
  const folded = tasks.filter((t) => isStale(t, today));
  const stale = folded
    .filter(asksDone)
    .sort((a, b) => (a.deadlineDate ?? "").localeCompare(b.deadlineDate ?? "") || a.id.localeCompare(b.id));
  const foldedIds = new Set(folded.map((t) => t.id));
  const live = tasks.filter((t) => !foldedIds.has(t.id));
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

/** 担当の呼び名（家族の名前で。いなければ役の言い方）。「家族」の事は空文字（画面は札を出さない） */
export function whoLabel(m: Pick<Milestone, "who">, family: Family, me: Member | null): string {
  if (m.who === "家族") return "";
  if (me && m.who === me.role) return "あなた";
  const person = family.members.find((x) => x.role === m.who);
  if (person) return person.name;
  return m.who === "母" ? "ママ" : "パートナー";
}
