// 産休・育休のお金の日（第2波⑤）。法の数え方で出し、近似の所はそう書く。額は割合だけ（円は出さない）。
// - 産後休業は、生まれた日の翌日から56日（労働基準法第65条）。育休はその次の日（生まれた日から57日目）から始まる形で置く
// - 育児休業給付の初回の申請: 育休を始めた日から4か月を経過する日の属する月の末日まで（雇用保険法施行規則第101条の30）
// - 出生時育児休業給付（産後パパ育休）: 生まれた日から8週を経過する日の翌日から、2か月を経過する日の属する月の末日まで（同規則第101条の33）
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

/** 出生時育児休業給付（産後パパ育休）の申請（生まれた日から8週を経過する日の翌日から、2か月を経過する日の属する月の末日まで） */
export function papaBenefit(birth: string): { start: string; deadline: string } {
  const s = addDays(birth, 56);
  return { start: s, deadline: endOfMonth(addDays(addMonths(s, 2), -1)) };
}

/** 給付が67%から50%に下がる日（育休の181日目）と、その30日前（家計を見る1件の始まり） */
export function benefitDrop(birth: string): { start: string; deadline: string } {
  const d = addDays(leaveStart(birth), 180);
  return { start: addDays(d, -30), deadline: d };
}
