// ④ 家族全体の参謀: 今週の「やる事」を集め、家族の一人ずつに分ける時の形。
// 画面からも使うので server-only にしない（Claude は呼ばない）。
import { addDays, toDay } from "./clock";
import { scheduleFor, statusOf, type Milestone, type Status } from "./milestones";
import type { Family } from "./demo-family";

/** この先、何日以内の事まで「今週の話」に入れるか */
export const LOOKAHEAD_DAYS = 14;

export interface PlanItem {
  milestoneId: string | null;
  title: string;
  /** なぜこの人に */
  why: string;
  /** いつまでに（言葉で） */
  by: string;
}

export interface MemberPlan {
  memberId: string;
  items: PlanItem[];
  message: string;
}

export interface Load {
  memberId: string;
  /** 0〜100 */
  value: number;
  note: string;
}

export interface Rebalance {
  milestoneId: string | null;
  title: string;
  fromMemberId: string;
  toMemberId: string;
  why: string;
}

export interface Plan {
  week: string;
  today: string;
  perMember: MemberPlan[];
  load: Load[];
  rebalance: Rebalance[];
  /** 考えた時に見ていた事の数 */
  considered: number;
}

/** その週の月曜日（"YYYY-MM-DD"） */
export function mondayOf(day: string): string {
  // 1970-01-01 は木曜日。月曜=0 になるようにずらす
  const dow = (((toDay(day) + 3) % 7) + 7) % 7;
  return addDays(day, -dow);
}

export interface WeekItem extends Milestone {
  status: Status;
}

/**
 * 今と、この先14日以内の事を集める。
 * デモの家族は、通り過ぎた期限の事を済ませた前提にする（今日の画面と同じ）。
 */
export function collectWeek(family: Family, today: string, done: Set<string>, isDemo: boolean): WeekItem[] {
  const schedule = scheduleFor(family);
  const d = new Set(done);
  if (isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) d.add(m.id);
  const horizon = addDays(today, LOOKAHEAD_DAYS);
  return schedule
    .map((m) => ({ ...m, status: statusOf(m, today, d) }))
    .filter((m) => {
      if (m.status === "今やる" || m.status === "期限が近い" || m.status === "期限切れ") return true;
      return m.status === "まだ先" && m.startDate <= horizon;
    });
}
