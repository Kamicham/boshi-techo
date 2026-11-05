// 産休・育休のお金の日（第2波⑤）。法の数え方で出し、近似の所はそう書く。額は割合だけ（円は出さない）。
// - 産後休業は、生まれた日の翌日から56日（労働基準法第65条）。育休はその次の日（生まれた日から57日目）から始まる形で置く
// - 育児休業給付の初回の申請: 育休を始めた日から4か月を経過する日の属する月の末日まで（雇用保険法施行規則第101条の30）
// - 出生時育児休業給付（産後パパ育休）: 生まれた日（予定日より早く生まれた時は予定日）から8週を経過する日の翌日から、
//   その日から2か月を経過する日の属する月の末日まで（同規則第101条の33）
// - 育児休業給付は、育休の181日目から賃金の67%が50%になる（雇用保険法第61条の7）

import { addDays, addMonths } from "./clock";

/** その月の末日 */
export function endOfMonth(s: string): string {
  const [y, m] = s.split("-").map(Number);
  return addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
}

/** 母の育休が始まる日（産後休業の次の日。生まれた日から57日目） */
export function leaveStart(birth: string): string {
  return addDays(birth, 57);
}

/** 育児休業給付の初回の申請（育休を始めた日から、4か月を経過する日の属する月の末日まで） */
export function benefitFirst(birth: string): { start: string; deadline: string } {
  const s = leaveStart(birth);
  return { start: s, deadline: endOfMonth(addDays(addMonths(s, 4), -1)) };
}

/**
 * 出生時育児休業給付（産後パパ育休）の申請。生まれた日（予定日より早く生まれた時は予定日）から8週を経過する日の翌日から、
 * その日から2か月を経過する日の属する月の末日まで。起点の日を1日目に数えるので、始まりは起点の56日後。
 * 産後パパ育休を28日取り終えた時・2回目を終えた時は、その次の日から申請でき、期限もその日から数える（早まる）。
 * 休みの取り方は家族の形に無いので、ここは8週の決まりで置く（basis に但し書き）。
 * 出典（2026-11-05 確認）:
 *   雇用保険法施行規則第101条の33第1項（e-Gov 法令検索 https://laws.e-gov.go.jp/law/350M50002000003 ）
 *   厚生労働省「育児休業等給付の内容と支給申請手続」2026年8月1日改訂版 5頁「(3) 支給申請期間」 https://www.mhlw.go.jp/content/11600000/001461102.pdf
 *   （手引きの例: 3頁 予定日10/6・生まれた日10/1 →「出産予定日から起算して8週間を経過する日の翌日」は12/1。
 *    5頁 予定日10/1・生まれた日10/5 → 申請は11/30から1/31まで。leave-money.test.ts で同じ日を確かめる）
 */
export function papaBenefit(birth: string, due: string): { start: string; deadline: string } {
  const from = birth < due ? due : birth;
  const s = addDays(from, 56);
  return { start: s, deadline: endOfMonth(addDays(addMonths(s, 2), -1)) };
}

/** 給付が67%から50%に下がる日（育休の181日目）と、その30日前（家計を見る1件の始まり） */
export function benefitDrop(birth: string): { start: string; deadline: string } {
  const d = addDays(leaveStart(birth), 180);
  return { start: addDays(d, -30), deadline: d };
}
