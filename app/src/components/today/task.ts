// 「今日」の画面で、やる事を並べる順と、誰の番かの言い方。
import type { Family, Member } from "@/lib/demo-family";
import { endOf, type Milestone, type Status } from "@/lib/milestones";

export interface Task extends Milestone {
  status: Status;
}

const URGENCY: Partial<Record<Status, number>> = { 期限切れ: 0, 期限が近い: 1, 今やる: 2 };

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

/** 担当の呼び名（家族の名前で。いなければ役の言い方） */
export function whoLabel(m: Pick<Milestone, "who">, family: Family, me: Member | null): string {
  if (me && m.who === me.role) return "あなた";
  if (m.who === "家族") return "家族みんな";
  const person = family.members.find((x) => x.role === m.who);
  if (person) return person.name;
  return m.who === "母" ? "ママ" : m.who === "パートナー" ? "パパ" : m.who;
}
