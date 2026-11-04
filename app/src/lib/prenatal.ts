// 妊婦健診の次の回と、受診券の残り（第1波⑧）。
// 国の標準の間隔（厚生労働省「妊婦に対する健康診査についての望ましい基準」平成27年告示第226号）:
//   妊娠23週まで4週に1回・24〜35週は2週に1回・36週から出産まで毎週。標準14回（公費は全市区町村が14回以上＝こども家庭庁 2024年4月1日）。
// 病院が言った日が正。ここは予約がまだの時の目安だけ。体の判断はしない（健診の結果の欄は読まない）。
// 画面とサーバの両方で使う純関数。
import { addDays, diffDays, lmpFromDue } from "./clock";

/** 受診券の既定の数（国の標準。町で違う。家族が直せる） */
export const STANDARD_TICKETS = 14;

/** その週数での、次の健診までの間隔（日） */
export function intervalDays(week: number): number {
  if (week < 24) return 28;
  if (week < 36) return 14;
  return 7;
}

/** 間隔の言い方 */
export function intervalWord(week: number): string {
  return week < 24 ? "4週ごと" : week < 36 ? "2週ごと" : "毎週";
}

export interface PrenatalState {
  /** 次の健診の目安の日（予定日を過ぎた・生まれた後は null） */
  next: string | null;
  /** 次の目安の週数での間隔の言い方 */
  interval: string;
  /** 受けた回（同じ日は1回） */
  used: number;
  total: number;
  /** 町の数か、家族が直した数か */
  totalSource: "国の標準" | "家族";
  remaining: number;
  /** 券の数を超えた */
  over: boolean;
  /** 家族が残した払った額の合計（円） */
  paidYen: number;
}

/**
 * 妊婦健診の状態。checkups は受けた日（妊娠中の健診の記録・手帳の妊婦健診のページの日付）。
 * 妊娠8週より前の受診（妊娠の確認。自費が多い）は券の数に入れない（近似）
 */
export function prenatalState(
  f: { dueDate: string; birthDate?: string },
  today: string,
  checkups: string[],
  opts: { tickets?: number; paid?: { date: string; yen: number }[] } = {},
): PrenatalState | null {
  if (f.birthDate && f.birthDate <= today) return null;
  const lmp = lmpFromDue(f.dueDate);
  if (today < lmp) return null;
  const from = addDays(lmp, 8 * 7);
  const days = [...new Set(checkups.filter((d) => d >= from && d <= today))].sort();
  const weekOf = (d: string) => Math.floor(diffDays(d, lmp) / 7);
  let next: string | null = null;
  if (today < f.dueDate) {
    const last = days[days.length - 1];
    if (last) {
      next = addDays(last, intervalDays(weekOf(last)));
      // 帯の境目（24週・36週）をまたぐ時は、境目の日で止める（近似）
      for (const w of [24, 36]) {
        const edge = addDays(lmp, w * 7);
        if (last < edge && next > edge) next = edge;
      }
    } else {
      next = today < from ? from : today;
    }
    if (next < today) next = today;
    if (next >= f.dueDate) next = null;
  }
  const total = opts.tickets && opts.tickets > 0 ? opts.tickets : STANDARD_TICKETS;
  return {
    next,
    interval: intervalWord(next ? weekOf(next) : weekOf(today)),
    used: days.length,
    total,
    totalSource: opts.tickets && opts.tickets > 0 ? "家族" : "国の標準",
    remaining: Math.max(0, total - days.length),
    over: days.length > total,
    paidYen: (opts.paid ?? []).reduce((s, p) => s + (Number.isFinite(p.yen) && p.yen > 0 ? p.yen : 0), 0),
  };
}
