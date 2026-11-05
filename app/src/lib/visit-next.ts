// 次の健診の日の確かめ（2026-11-05 作り手の方針「聞き違いはシステムで0にできない。最後の確かめと OK は本人に残す」・プラン第4版）。
// - 結果の画面で「録音からはこう聞こえました。この日で大丈夫ですか？」を1問だけ聞く。［大丈夫］1回でそのまま進む
// - 手帳の中では、確かめていない日も「録音から聞こえた日・まだ確かめていません」と添えて出し続ける（確かめなくても手帳は止まらない。前日の声かけも出す）。
//   手帳の外へ出る物（カレンダー・LINE・共有の文）と「予約あり」の断定だけ、本人の「大丈夫」の後にする
// - 正本は健診の記録の nextCheck（1つ）。次の予約（plan.next）には印を保存せず、読む時に heard を付ける（withHeard）
// - 機械の印（heardFlags）は聞き方を強めるだけの脇役。直さない・止めない・消さない。Claude を使わない計算
// 画面とサーバの両方で使う純関数（DB・ファイル・Claude を呼ばない）。
import { diffDays, lmpFromDue, toDay } from "./clock";
import { intervalDays } from "./prenatal";
import { isChecked, type AppointmentSaid, type NextCheck, type VisitData, type VisitPlan } from "./visit";

type PlanNext = VisitPlan["next"];

/** 健診1回分のうち、ここで使う所 */
type VisitRef = { id: string; date: string; nextCheck?: NextCheck };

/**
 * 聞き方を強める印（当たった時だけ、結果の画面に1行の注意を足す）。
 * - rollover: 月日で言われ、健診の日より前の月日だったので翌年に回した（12月を2月と聞き違えると、来年の2月になる）
 * - sameDay: 健診と同じ日
 * - weekday: 言われた曜日と、日付の曜日が違う
 * - far: 妊娠中で、国の標準の間隔（lib/prenatal.ts）の2倍より先
 * - afterDue: 妊娠中で、予定日より後
 */
export type HeardFlag = "rollover" | "sameDay" | "weekday" | "far" | "afterDue";

const weekdayOf = (d: string) => new Date(toDay(d) * 86_400_000).getUTCDay();

export function heardFlags(
  visitDate: string,
  a: Pick<AppointmentSaid, "month" | "day" | "weekday"> | null | undefined,
  nextDate: string | null | undefined,
  fam: { dueDate?: string | null; birthDate?: string | null } = {},
): HeardFlag[] {
  if (!nextDate) return [];
  const out: HeardFlag[] = [];
  const byDate = a?.month != null && a?.day != null;
  if (byDate && nextDate.slice(0, 4) !== visitDate.slice(0, 4)) out.push("rollover");
  if (nextDate === visitDate) out.push("sameDay");
  if (byDate && a?.weekday != null && weekdayOf(nextDate) !== a.weekday) out.push("weekday");
  // 妊娠中（健診の日がまだ生まれる前）だけ: 国の標準の間隔と予定日で見る
  const due = fam.dueDate;
  const pregnant = !!due && !(fam.birthDate && fam.birthDate <= visitDate) && visitDate < due;
  if (pregnant) {
    const week = Math.floor(diffDays(visitDate, lmpFromDue(due)) / 7);
    if (diffDays(nextDate, visitDate) > intervalDays(week) * 2) out.push("far");
    if (nextDate > due) out.push("afterDue");
  }
  return out;
}

/**
 * 結果の画面の答えの後の、次の予約日（visit.nextDate）と次の予約（plan.next）。
 * - 大丈夫・直す: nextDate は本人の日。plan.next は、この健診の日の物か・空か・この健診の日以前の古い予約か・これが一番新しい健診の時に、本人の日で書き直す
 *   （本人が確かめた日は、手で入れた日より優先。古い健診の答えで、その後の健診の予約を上書きしない）
 * - 言われていない: nextDate は null。この健診から入った plan.next は外す
 */
export function afterCheck(
  v: VisitRef,
  said: string | null | undefined,
  planNext: PlanNext,
  check: NextCheck,
  newest: boolean,
): { nextDate: string | null; planNext: PlanNext } {
  if (!isChecked(check)) return { nextDate: null, planNext: planNext?.visitId === v.id ? null : (planNext ?? null) };
  const write = !planNext || planNext.visitId === v.id || planNext.date <= v.date || newest;
  return {
    nextDate: check.date,
    planNext: write ? { date: check.date, time: check.time ?? null, source: "visit", visitId: v.id, ...(said ? { said } : {}) } : (planNext ?? null),
  };
}

/**
 * 整理（やり直しを含む）の後の、次の予約日・確かめ・次の予約。
 * - 本人が確かめた日（大丈夫・直す）は上書きしない（plan.next にも触らない）
 * - 「言われていない」の後のやり直しで日が聞こえたら、確かめを外して聞き直す。聞こえなければ「言われていない」のまま
 * - 確かめていない日は今までどおり: 手で入れた先の予約は残し、この健診の日以前の予約は今日の話で置き換える。
 *   予約が聞こえなくなったら、この健診から入った確かめていない予約は外す
 */
export function afterOrganize(
  v: VisitRef & { nextDate?: string | null },
  heard: { date: string; time: string | null; said?: string } | null,
  planNext: PlanNext,
): { nextDate: string | null; nextCheck: NextCheck | undefined; planNext: PlanNext } {
  const c = v.nextCheck;
  if (isChecked(c)) return { nextDate: c.date, nextCheck: c, planNext: planNext ?? null };
  if (c?.state === "none" && !heard) return { nextDate: null, nextCheck: c, planNext: planNext ?? null };
  if (!heard) {
    return { nextDate: null, nextCheck: undefined, planNext: planNext?.visitId === v.id && planNext.source === "visit" ? null : (planNext ?? null) };
  }
  const write = !planNext || planNext.date <= v.date || planNext.visitId === v.id;
  return {
    nextDate: heard.date,
    nextCheck: undefined,
    planNext: write ? { date: heard.date, time: heard.time, source: "visit", visitId: v.id, ...(heard.said ? { said: heard.said } : {}) } : (planNext ?? null),
  };
}

/**
 * 健診を消した後の次の予約: この健診から入った予約は、まだ確かめていなければ外す。
 * 本人が確かめた日は、手で入れた予定として残す（出どころの健診と聞こえた言葉は外す）
 */
export function planNextAfterDelete(planNext: PlanNext, v: VisitRef): PlanNext {
  if (!planNext || planNext.visitId !== v.id) return planNext ?? null;
  return isChecked(v.nextCheck) ? { date: planNext.date, time: planNext.time ?? null, source: "manual" } : null;
}

/**
 * 読む時に付ける印: 健診から入った予約で、その健診の日をまだ本人が確かめていなければ heard: true（保存しない）。
 * 出どころの健診が見つからない（消した健診の古い予約）時も、確かめた印が無いので heard
 */
export function withHeard(planNext: PlanNext, visitOf: (id: string) => Pick<VisitData, "nextCheck"> | undefined): PlanNext {
  if (!planNext || planNext.source !== "visit") return planNext ?? null;
  const v = planNext.visitId ? visitOf(planNext.visitId) : undefined;
  const rest = { ...planNext };
  delete rest.heard;
  return isChecked(v?.nextCheck) ? rest : { ...rest, heard: true };
}
