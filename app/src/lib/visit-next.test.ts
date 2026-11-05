// 次の健診の日の確かめ（lib/visit-next.ts）。日付はすべて作った日（作った家族: 予定日 2028-03-01）。
import { describe, expect, it } from "vitest";
import { nextOfVisit, type NextCheck, type VisitPlan } from "./visit";
import { afterCheck, afterOrganize, heardFlags, planNextAfterDelete, withHeard } from "./visit-next";

const at = "2027-10-20T03:00:00.000Z";
const fam = { dueDate: "2028-03-01" };
const byDate = (month: number, day: number, weekday: number | null = null) => ({ month, day, weekday });
const wd = (d: string) => new Date(`${d}T00:00:00Z`).getUTCDay();

describe("機械の印（聞き方を強めるだけ）", () => {
  // 2027-10-20 は妊娠21週（国の標準は4週ごと＝2倍は56日）
  const visit = "2027-10-20";
  it("正しく聞こえた日（国の間隔の中・曜日も合う）には印を付けない", () => {
    expect(heardFlags(visit, byDate(11, 17), "2027-11-17", fam)).toEqual([]);
    expect(heardFlags(visit, byDate(11, 17, wd("2027-11-17")), "2027-11-17", fam)).toEqual([]);
    expect(heardFlags(visit, { month: null, day: null, weekday: null }, "2027-11-17", fam)).toEqual([]);
  });
  it("月日を聞き違えて翌年に回った日には、年をまたいだ印と、間隔より先の印", () => {
    expect(heardFlags(visit, byDate(1, 12), "2028-01-12", fam)).toEqual(["rollover", "far"]);
  });
  it("健診と同じ日・言われた曜日と日付の曜日が違う", () => {
    expect(heardFlags(visit, byDate(10, 20), "2027-10-20", fam)).toEqual(["sameDay"]);
    expect(heardFlags(visit, byDate(11, 17, (wd("2027-11-17") + 1) % 7), "2027-11-17", fam)).toEqual(["weekday"]);
  });
  it("妊娠38週（毎週）で3週先・予定日より後", () => {
    expect(heardFlags("2028-02-16", byDate(2, 23), "2028-02-23", fam)).toEqual([]);
    expect(heardFlags("2028-02-16", byDate(3, 8), "2028-03-08", fam)).toEqual(["far", "afterDue"]);
  });
  it("生まれた後の健診では、妊娠中の間隔と予定日を見ない。日が無ければ印も無い", () => {
    expect(heardFlags("2028-03-22", byDate(4, 26), "2028-04-26", { ...fam, birthDate: "2028-02-20" })).toEqual([]);
    expect(heardFlags(visit, byDate(1, 12), null, fam)).toEqual([]);
  });
});

describe("この健診から出た次の健診の日", () => {
  const result = { nextAppointment: { said: "1月12日の10時半", month: 1, day: 12, afterWeeks: null, afterDays: null, afterMonths: null, weekday: null, time: "10:30" } } as never;
  it("確かめる前は聞こえた日と時刻、確かめた後は本人の日、言われていないなら無し", () => {
    expect(nextOfVisit({ nextDate: "2028-01-12", result })).toEqual({ date: "2028-01-12", time: "10:30", checked: false });
    expect(nextOfVisit({ nextDate: "2027-11-17", result, nextCheck: { state: "fixed", date: "2027-11-17", time: "09:00", at } })).toEqual({
      date: "2027-11-17",
      time: "09:00",
      checked: true,
    });
    expect(nextOfVisit({ nextDate: null, result, nextCheck: { state: "none", at } })).toBeNull();
  });
});

describe("結果の画面の答えの後", () => {
  const v = { id: "v1", date: "2027-10-20" };
  const heardNext: VisitPlan["next"] = { date: "2028-01-12", time: "10:30", source: "visit", visitId: "v1", said: "1月12日の10時半" };
  const fixed: NextCheck = { state: "fixed", date: "2027-11-17", time: "10:30", at, by: "ママ" };
  it("直した日が次の予約日と次の予約になる（聞こえた言葉は残す）", () => {
    expect(afterCheck(v, "1月12日の10時半", heardNext, fixed, true)).toEqual({
      nextDate: "2027-11-17",
      planNext: { date: "2027-11-17", time: "10:30", source: "visit", visitId: "v1", said: "1月12日の10時半" },
    });
  });
  it("言われていない: この健診から入った予約を外す。ほかの健診の予約には触らない", () => {
    expect(afterCheck(v, "x", heardNext, { state: "none", at }, true)).toEqual({ nextDate: null, planNext: null });
    const other: VisitPlan["next"] = { date: "2027-11-17", source: "visit", visitId: "v2" };
    expect(afterCheck(v, "x", other, { state: "none", at }, false).planNext).toBe(other);
  });
  it("本人が確かめた日は、手で入れた日より優先。古い健診の答えで、その後の健診の予約は上書きしない", () => {
    const manual: VisitPlan["next"] = { date: "2027-11-18", time: null, source: "manual" };
    expect(afterCheck(v, "x", manual, fixed, true).planNext?.date).toBe("2027-11-17");
    const later: VisitPlan["next"] = { date: "2027-12-15", source: "visit", visitId: "v2" };
    expect(afterCheck(v, "x", later, fixed, false).planNext).toBe(later);
  });
});

describe("整理（やり直しを含む）の後", () => {
  const heard = { date: "2028-01-12", time: "10:30", said: "1月12日の10時半" };
  it("本人が確かめた日は、やり直しで聞こえた日に戻さない（予定にも触らない）", () => {
    const check: NextCheck = { state: "fixed", date: "2027-11-17", time: "10:30", at };
    const plan: VisitPlan["next"] = { date: "2027-11-17", time: "10:30", source: "visit", visitId: "v1" };
    expect(afterOrganize({ id: "v1", date: "2027-10-20", nextDate: "2027-11-17", nextCheck: check }, heard, plan)).toEqual({
      nextDate: "2027-11-17",
      nextCheck: check,
      planNext: plan,
    });
  });
  it("確かめていない日は聞こえた日で入れ直す。手で入れた先の予約は残す", () => {
    expect(afterOrganize({ id: "v1", date: "2027-10-20" }, heard, null)).toEqual({
      nextDate: "2028-01-12",
      nextCheck: undefined,
      planNext: { date: "2028-01-12", time: "10:30", source: "visit", visitId: "v1", said: "1月12日の10時半" },
    });
    const manual: VisitPlan["next"] = { date: "2027-11-17", source: "manual" };
    expect(afterOrganize({ id: "v1", date: "2027-10-20" }, heard, manual).planNext).toBe(manual);
  });
  it("予約が聞こえなくなったら、この健診から入った確かめていない予約を外す", () => {
    const plan: VisitPlan["next"] = { date: "2028-01-12", source: "visit", visitId: "v1" };
    expect(afterOrganize({ id: "v1", date: "2027-10-20", nextDate: "2028-01-12" }, null, plan)).toEqual({ nextDate: null, nextCheck: undefined, planNext: null });
  });
  it("言われていないの後: 聞こえなければそのまま。日が聞こえたら聞き直す", () => {
    const none: NextCheck = { state: "none", at };
    expect(afterOrganize({ id: "v1", date: "2027-10-20", nextCheck: none }, null, null)).toEqual({ nextDate: null, nextCheck: none, planNext: null });
    const out = afterOrganize({ id: "v1", date: "2027-10-20", nextCheck: none }, heard, null);
    expect(out.nextCheck).toBeUndefined();
    expect(out.nextDate).toBe("2028-01-12");
  });
});

describe("健診を消した後と、読む時の印", () => {
  const plan: VisitPlan["next"] = { date: "2027-11-17", time: "10:30", source: "visit", visitId: "v1", said: "x" };
  it("確かめていない日は外し、確かめた日は手で入れた予定として残す", () => {
    expect(planNextAfterDelete(plan, { id: "v1", date: "2027-10-20" })).toBeNull();
    expect(planNextAfterDelete(plan, { id: "v1", date: "2027-10-20", nextCheck: { state: "ok", date: "2027-11-17", time: "10:30", at } })).toEqual({
      date: "2027-11-17",
      time: "10:30",
      source: "manual",
    });
    expect(planNextAfterDelete(plan, { id: "v9", date: "2027-10-20" })).toBe(plan);
  });
  it("健診から入った日で、まだ確かめていなければ heard。手で入れた日・確かめた日には付けない", () => {
    expect(withHeard(plan, () => ({}))?.heard).toBe(true);
    expect(withHeard(plan, () => undefined)?.heard).toBe(true);
    expect(withHeard({ ...plan, heard: true }, () => ({ nextCheck: { state: "ok", date: "2027-11-17", at } }))?.heard).toBeUndefined();
    expect(withHeard({ date: "2027-11-17", source: "manual" }, () => ({}))?.heard).toBeUndefined();
    expect(withHeard(null, () => ({}))).toBeNull();
  });
});
