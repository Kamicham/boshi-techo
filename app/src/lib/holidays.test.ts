// 役所の休みと次の開庁日（lib/holidays.ts・見直し①）。祝日法で数えた日が内閣府の表と合うか、期限の動かし方を見る。
import { describe, expect, it } from "vitest";
import { addDays } from "./clock";
import { CAO_YEARS, equinoxDay, holidayName, holidaysOf, holidayWhy, isOfficeHoliday, lawHolidays, nextOpenDay, prevOpenDay, weekday } from "./holidays";

const sorted = (m: Map<string, string>) => [...m.entries()].sort(([a], [b]) => a.localeCompare(b));

describe("祝日の表", () => {
  it("祝日法で数えた日と名前が、内閣府の表（2022〜2027年）と1日も違わない（2020・2021年はオリンピックの特別措置で動いたので除く）", () => {
    for (let y = 2022; y <= CAO_YEARS.to; y++) expect(sorted(lawHolidays(y)), String(y)).toEqual(sorted(holidaysOf(y)));
  });

  it("春分・秋分の近似の式は、内閣府の表の2020〜2027年とすべて合う", () => {
    for (let y = CAO_YEARS.from; y <= CAO_YEARS.to; y++) {
      expect(holidayName(`${y}-03-${String(equinoxDay(y, "春分")).padStart(2, "0")}`), `${y} 春分`).toBe("春分の日");
      expect(holidayName(`${y}-09-${String(equinoxDay(y, "秋分")).padStart(2, "0")}`), `${y} 秋分`).toBe("秋分の日");
    }
  });

  it("2028年から先は祝日法で数える（振替休日・国民の休日も）", () => {
    // 2028: 春分 3/20（月）・秋分 9/22（金）
    expect(holidayName("2028-03-20")).toBe("春分の日");
    expect(holidayName("2028-09-22")).toBe("秋分の日");
    // 2029: 建国記念の日 2/11 が日曜 → 2/12 が休日。昭和の日 4/29 が日曜 → 4/30。秋分 9/23 が日曜 → 9/24
    expect(holidayName("2029-02-12")).toBe("休日");
    expect(holidayName("2029-04-30")).toBe("休日");
    expect(holidayName("2029-09-24")).toBe("休日");
    // 憲法記念日が日曜の年（2026 は表・2037 は法）: 5/4・5/5 は祝日なので、振替は 5/6
    expect(holidayName("2037-05-06")).toBe("休日");
    // 国民の休日: 敬老の日と秋分の日に挟まれた日（2032-09-21＝敬老の日 9/20（月）と秋分の日 9/22（水）の間）
    expect(holidayName("2032-09-20")).toBe("敬老の日");
    expect(holidayName("2032-09-21")).toBe("休日");
    expect(holidayName("2032-09-22")).toBe("秋分の日");
  });

  it("曜日は 1970-01-01 の木曜から数える", () => {
    expect(weekday("1970-01-01")).toBe(4);
    expect(weekday("2027-05-09")).toBe(0);
    expect(weekday("2027-05-10")).toBe(1);
  });
});

describe("役所の休みと次の開庁日", () => {
  it("土日・祝日と休日・12/29〜1/3 は休み", () => {
    for (const d of ["2027-05-08", "2027-05-09", "2027-05-03", "2027-05-04", "2027-05-05", "2027-03-22", "2027-12-29", "2027-12-31", "2028-01-03", "2026-09-22"]) expect(isOfficeHoliday(d), d).toBe(true);
    for (const d of ["2027-05-06", "2027-05-10", "2027-12-28", "2028-01-04", "2027-03-23"]) expect(isOfficeHoliday(d), d).toBe(false);
  });

  it("期限が休みなら次の開庁日・休みでなければそのまま。休みが続けば続いた後", () => {
    // 見本の家族（2027-04-26 生まれ）の出生届: 14日目の 5/9 は日曜 → 5/10（月）
    expect(nextOpenDay(addDays("2027-04-26", 13))).toBe("2027-05-10");
    expect(nextOpenDay("2027-05-10")).toBe("2027-05-10");
    // 5/1（土）から: 5/2（日）・5/3〜5/5（祝日）を越えて 5/6（木）
    expect(nextOpenDay("2027-05-01")).toBe("2027-05-06");
    // 年末年始: 12/29 から 1/3 を越え、2028-01-04（火）
    expect(nextOpenDay("2027-12-29")).toBe("2028-01-04");
    // 前の開庁日（目安の日を、町ごとの期限の一番早い所より後ろへ動かさない時）
    expect(prevOpenDay("2027-05-05")).toBe("2027-04-30");
    expect(prevOpenDay("2027-05-06")).toBe("2027-05-06");
  });

  it("休みの理由の言い方", () => {
    expect(holidayWhy("2027-05-09")).toBe("日曜");
    expect(holidayWhy("2027-05-03")).toBe("憲法記念日");
    expect(holidayWhy("2027-03-22")).toBe("休日（振替休日か国民の休日）");
    expect(holidayWhy("2027-12-30")).toBe("年末年始");
    expect(holidayWhy("2027-05-10")).toBeUndefined();
  });
});
