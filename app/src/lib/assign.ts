// 家族が決め直した担当（「この事は誰がやるか」）。家族ごとに覚え、今日の画面・家族の画面・下書きの書き手に効かせる。
// 予定表（lib/milestones.ts）の who は「目安」。家族が変えた時だけ、ここの値で上書きする。
// 画面からもサーバからも使うので server-only にしない（DB を読むのは app/api/assign）。
import type { Member } from "./demo-family";
import type { Who } from "./milestones";

export interface Assign {
  /** 役（わたし・パートナー・家族みんな・祖父母）。memberId があれば、その人の役 */
  who: Who;
  /** 「家族」の事を、家族の中の誰がやるかまで決めた時（同じ役の人が2人いる時も見分ける） */
  memberId?: string;
}

export type Assignments = Record<string, Assign>;

export const WHO_CHOICES: Who[] = ["母", "パートナー", "家族", "祖父母"];

/** 予定表の事に、家族が決め直した担当を当てる（決めていない事はそのまま） */
export function applyAssignments<T extends { id: string; who: Who }>(items: T[], a: Assignments | null | undefined, members?: Member[]): (T & { assignedTo?: string })[] {
  if (!a) return items;
  return items.map((m) => {
    const x = a[m.id];
    if (!x) return m;
    const person = x.memberId ? members?.find((p) => p.id === x.memberId) : undefined;
    // 人を決めた時は、その人の役にする（今日の画面の「わたしの番か」がそのまま効く）
    return { ...m, who: person ? person.role : x.who, assignedTo: person?.id };
  });
}

/** 送られた担当が正しい形か（API で使う） */
export function isAssign(v: unknown, members: Member[]): v is Assign {
  if (!v || typeof v !== "object") return false;
  const o = v as Assign;
  if (!WHO_CHOICES.includes(o.who)) return false;
  if (o.memberId !== undefined && !members.some((m) => m.id === o.memberId)) return false;
  return true;
}
