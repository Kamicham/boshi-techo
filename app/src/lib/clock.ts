// 家族の時計: 「今日」が家族の1000日のどこにいるかを計算する。
// 1000日 = 妊娠の始まり（最終月経から2週後）〜 2歳の誕生日。
// 日付はすべて "YYYY-MM-DD"（日本時間の暦日）で扱い、時刻は持たない。

export type Phase = "trying" | "pregnant" | "child" | "after";

export interface FamilyDates {
  /** 出産予定日 */
  dueDate: string;
  /** 生まれた日（まだなら undefined） */
  birthDate?: string;
}

export interface ClockState {
  today: string;
  phase: Phase;
  /** 妊娠週数（妊娠中のみ）: 0週0日 = 最終月経の初日 */
  pregnancyWeek?: number;
  pregnancyDay?: number;
  /** 生後日数（生まれた日 = 0） */
  ageDays?: number;
  /** 満月齢 */
  ageMonths?: number;
  /** 1000日のうち何日目か（妊娠の始まり = 1日目） */
  dayOf1000: number;
  /** 人が読む言い方（例: 「妊娠24週3日」「生後3か月」） */
  label: string;
}

const MS_PER_DAY = 86_400_000;

export function toDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

export function fromDay(n: number): string {
  return new Date(n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function addDays(s: string, days: number): string {
  return fromDay(toDay(s) + days);
}

export function diffDays(a: string, b: string): number {
  return toDay(a) - toDay(b);
}

/** 月を足す。月末を超える日は、その月の末日に寄せる（1/31 + 1か月 = 2/28） */
export function addMonths(s: string, months: number): string {
  const [y, m, d] = s.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return fromDay(Math.round(Date.UTC(ny, nm, Math.min(d, last)) / MS_PER_DAY));
}

/** 満月齢（誕生日の同じ日付で1つ増える） */
export function monthsBetween(birth: string, today: string): number {
  let months = 0;
  while (diffDays(addMonths(birth, months + 1), today) <= 0) months++;
  return months;
}

/** 最終月経の初日（予定日 - 280日） */
export function lmpFromDue(dueDate: string): string {
  return addDays(dueDate, -280);
}

/** 1000日の1日目（最終月経から2週後 = 受精のころ） */
export function conceptionDate(f: FamilyDates): string {
  return addDays(lmpFromDue(f.dueDate), 14);
}

/** 1000日の最後の日（2歳の誕生日。生まれていなければ予定日から数える） */
export function secondBirthday(f: FamilyDates): string {
  return addMonths(f.birthDate ?? f.dueDate, 24);
}

export function totalDays(f: FamilyDates): number {
  return diffDays(secondBirthday(f), conceptionDate(f)) + 1;
}

export function clockAt(f: FamilyDates, today: string): ClockState {
  const start = conceptionDate(f);
  const dayOf1000 = diffDays(today, start) + 1;
  const born = f.birthDate && diffDays(today, f.birthDate) >= 0;

  if (born) {
    const ageDays = diffDays(today, f.birthDate!);
    const ageMonths = monthsBetween(f.birthDate!, today);
    const after = diffDays(today, secondBirthday(f)) > 0;
    let label: string;
    if (ageDays === 0) label = "生まれた日";
    else if (ageDays < 28) label = `生後${ageDays}日`;
    else if (ageMonths < 12) label = `生後${ageMonths}か月`;
    else label = `${Math.floor(ageMonths / 12)}歳${ageMonths % 12 ? `${ageMonths % 12}か月` : ""}`;
    return { today, phase: after ? "after" : "child", ageDays, ageMonths, dayOf1000, label };
  }

  const sinceLmp = diffDays(today, lmpFromDue(f.dueDate));
  // 妊娠週数は最終月経の初日から数える（医療での数え方）。それより前は「授かる前」
  if (sinceLmp < 0) {
    return { today, phase: "trying", dayOf1000, label: "授かる前" };
  }
  const pregnancyWeek = Math.floor(sinceLmp / 7);
  const pregnancyDay = sinceLmp % 7;
  return {
    today,
    phase: "pregnant",
    pregnancyWeek,
    pregnancyDay,
    dayOf1000,
    label: `妊娠${pregnancyWeek}週${pregnancyDay}日`,
  };
}
