// 手帳を始める前の事: 途中から使い始めた家族に、始めた日の前に期限（目安）が過ぎた事のうち、どれを「済んでいますか？」で聞くか。
// 画面は components/today/StartedLate.tsx（いま）と app/start（3つ答えた後の手帳）。
import { addDays } from "./clock";
import type { Milestone } from "./milestones";

/** 始めた日の前、何日までに期限が過ぎた事を聞くか（それより前の事は、多くの家族が済ませているので聞かない） */
export const STARTED_LATE_ASK_DAYS = 60;

/** 始める前の事のうち、聞く物（期限が today の前 STARTED_LATE_ASK_DAYS 日の中。生まれるのを待つ事は除く） */
export function recentlyPassed(schedule: Milestone[], today: string): Milestone[] {
  const edge = addDays(today, -STARTED_LATE_ASK_DAYS);
  return schedule.filter((m) => m.deadlineDate && !m.awaitingBirth && m.deadlineDate < today && m.deadlineDate >= edge);
}
