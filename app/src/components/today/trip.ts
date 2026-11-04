// 生まれた届けの言い方（UX の見直し C08）。画面の純関数（Claude は呼ばない。外へは何も送らない）。
// 決め方（束を開くか・たたむか）は lib/birth-trip.ts の tripScreen。
import { jpShort } from "./dates";

/** 期限の言い方「あと12日・5/9（日）まで」。今日が期限なら「今日・5/9（日）まで」 */
export function untilWords(left: number, date: string, today: string): string {
  return `${left <= 0 ? "今日" : `あと${left}日`}・${jpShort(date, today)}まで`;
}

/** 期限を言う時の届けの呼び名（法の期限がある届けだけ。ほかは画面の短い題） */
const SHORT: Record<string, string> = {
  "birth-registration": "出生届",
  "child-allowance": "児童手当",
  "child-allowance-change": "児童手当の額の届け",
  // 国保の家族だけ、法の期限（14日以内）がある
  "health-insurance": "赤ちゃんの国保",
};

export function dueName(t: { id: string; plain: string }): string {
  return SHORT[t.id] ?? t.plain;
}

/**
 * 母からパートナーへ、声をかける文（写して LINE などに貼る）。
 * 急かす言い方・損で脅す言い方はしない。期限の日と、どこを見ればよいかだけ
 */
export function nudgeText(left: number, due: { task: { id: string; plain: string }; date: string; left: number }, today: string): string {
  const when = due.left <= 0 ? "今日" : jpShort(due.date, today);
  return `生まれた届け、残りの${left}件をお願いできる？ ${dueName(due.task)}は${when}までだよ。行く順と持ち物は、手帳の「生まれた届けを、まとめて」に出ているよ。`;
}
