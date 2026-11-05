// 「いま」の画面を静かにする（家族の声①「要らないのに、頼れる所がずらっと並ぶ。疲れる」への直し A・2026-11-05 作り手が承認したプラン）。
// 考え方は「その時に1つ、聞かれたら全部」。畳んだ物は押せば同じ並びで全部出る（人を当てにいかない）。
// 画面（components/Techo.tsx）と早送りの検査（src/sim/fastforward.test.ts の決まり u）が、同じこの関数を使う。JSX を持たない純関数。
import type { Member } from "@/lib/demo-family";
import { asksDone, daysLeft, isMine, type Task } from "./task";

/** 「ほかに今やる事」で、自分の番を畳まずに出す行の数 */
export const MINE_SHOWN = 3;
/** 法で決まった期限まで、この日数以下（今日・明日・過ぎた物）の行は、誰の番でも畳まない */
export const KEEP_DAYS = 1;

/** 「ほかに今やる事」の1行（予定の事・次の健診・妊婦健診の予約） */
export type NowRow = { kind: "task"; task: Task } | { kind: "visit" } | { kind: "prenatal" };

/** 行の担当の役（健診と予約の行は母の事） */
export function rowWho(r: NowRow): string {
  // 訳さない: 担当の役の値（描く所で whoLabel が名前にする）
  return r.kind === "task" ? r.task.who : "母";
}

/** 畳まない行: 法で決まった期限（asksDone）の残りが1日以下（過ぎた物も） */
export function mustShow(t: Task, today: string): boolean {
  if (!asksDone(t)) return false;
  const d = daysLeft(t, today);
  return d != null && d <= KEEP_DAYS;
}

export interface NowFold<R> {
  /** 畳まずに出す行（元の並びのまま） */
  shown: R[];
  /** 自分の番で畳んだ行（「ほかに◯件 ›」で開く） */
  more: R[];
  /** ほかの人の番（人ごとに1行の「◯◯さんの番 ◯件 ›」。並びは、その人の行が最初に出た順） */
  others: { who: string; rows: R[] }[];
}

/**
 * 「ほかに今やる事」を畳む。自分の番（「家族」の事を含む）は MINE_SHOWN 行まで出し、残りは「ほかに◯件」。
 * ほかの人の番は人ごとに1行にまとめる。法の期限の残り1日以下の行は、誰の番でも畳まずに出す（MINE_SHOWN に数える）。
 * 使う人が決まっていない時（me が無い）は、全部を自分の番として数える。
 */
export function foldNow(rows: readonly NowRow[], me: Member | null, today: string): NowFold<NowRow> {
  const shown: NowRow[] = [];
  const more: NowRow[] = [];
  const others: { who: string; rows: NowRow[] }[] = [];
  let mine = 0;
  for (const r of rows) {
    const who = rowWho(r);
    const isMe = !me || isMine({ who: who as Task["who"] }, me);
    if (r.kind === "task" && mustShow(r.task, today)) {
      shown.push(r);
      if (isMe) mine++;
      continue;
    }
    if (isMe) {
      if (mine < MINE_SHOWN) {
        shown.push(r);
        mine++;
      } else more.push(r);
      continue;
    }
    const g = others.find((x) => x.who === who);
    if (g) g.rows.push(r);
    else others.push({ who, rows: [r] });
  }
  return { shown, more, others };
}

/**
 * 大きな札の日（お祝い・ようこそ・届けの束・手帳の気づき）。この日は、相談の問いを出さず、近づいたらを1行に畳む。
 * 気をつける事の札を出さない日（Techo.tsx の cautionBusy）と同じ決め方。
 */
export function bigCardDay(x: { festive: boolean; tripShown: boolean; advisorOpen: number | null }): boolean {
  return x.festive || x.tripShown || (x.advisorOpen ?? 0) > 0;
}
