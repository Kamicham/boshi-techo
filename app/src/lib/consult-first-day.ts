// 「困った時に相談できる人はいますか？」を、使い始めた日には聞かない（初めての日は、手帳に慣れる事だけにする）。
// 使い始めた日 = family.startedOn（家族を作った日・予定日を変えた日。app/api/family・account/profile が入れる）。
// startedOn の無い家族（見本の家族・古い形）は、最初の日が分からないので今までどおり聞く。見本の家族とその体験の写しは常に今までどおり。
// 画面を持たない純粋な関数（試験は consult-first-day.test.ts）。
import { isDemoLike } from "./trial-cookie";

export function consultWaitsFirstDay(family: { id: string; startedOn?: string }, today: string): boolean {
  if (isDemoLike(family.id)) return false;
  if (!family.startedOn) return false;
  return today <= family.startedOn;
}

/** 問いの下に添える一言（答えた後に本当に起きる事だけ: 答えは「相談した記録」に残る。「いない」「頼みにくい」なら町の相談先を出す） */
export const CONSULT_AFTER_NOTE = "答えは手帳の「相談した記録」に残ります。「いない」の時は、町の相談先をすぐ出します";
