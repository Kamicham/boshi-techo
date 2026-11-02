import { describe, expect, it } from "vitest";
import { addMonths, clockAt, conceptionDate, monthsBetween, totalDays } from "./clock";
import { scheduleFor, statusOf } from "./milestones";

const fam = { dueDate: "2027-05-10", birthDate: "2027-05-08" };

describe("家族の時計", () => {
  it("予定日の280日前が0週0日", () => {
    const c = clockAt({ dueDate: "2027-05-10" }, "2026-08-03");
    expect(c.phase).toBe("pregnant");
    expect(c.label).toBe("妊娠0週0日");
  });

  it("予定日はちょうど40週0日", () => {
    expect(clockAt({ dueDate: "2027-05-10" }, "2027-05-10").label).toBe("妊娠40週0日");
  });

  it("1000日の1日目は最終月経から2週後", () => {
    expect(conceptionDate(fam)).toBe("2026-08-17");
    expect(clockAt(fam, "2026-08-17").dayOf1000).toBe(1);
  });

  it("生まれた日と生後の言い方", () => {
    expect(clockAt(fam, "2027-05-08").label).toBe("生まれた日");
    expect(clockAt(fam, "2027-05-20").label).toBe("生後12日");
    expect(clockAt(fam, "2027-08-08").label).toBe("生後3か月");
    expect(clockAt(fam, "2028-11-08").label).toBe("1歳6か月");
  });

  it("1000日はおよそ1000日", () => {
    const n = totalDays(fam);
    expect(n).toBeGreaterThan(980);
    expect(n).toBeLessThan(1010);
  });

  it("月末の月足し", () => {
    expect(addMonths("2027-01-31", 1)).toBe("2027-02-28");
    expect(monthsBetween("2027-01-31", "2027-02-28")).toBe(1);
    expect(monthsBetween("2027-01-31", "2027-02-27")).toBe(0);
  });
});

describe("期限", () => {
  const s = scheduleFor(fam);
  const get = (id: string) => s.find((m) => m.id === id)!;

  it("出生届は生まれた日を含めて14日以内", () => {
    expect(get("birth-registration").deadlineDate).toBe("2027-05-21");
  });

  it("児童手当は翌日から15日以内", () => {
    expect(get("child-allowance").deadlineDate).toBe("2027-05-23");
  });

  it("産前休業は予定日の42日前から", () => {
    expect(get("maternity-leave").startDate).toBe("2027-03-29");
  });

  it("状態の移り変わり", () => {
    const m = get("birth-registration");
    expect(statusOf(m, "2027-05-01", new Set())).toBe("まだ先");
    expect(statusOf(m, "2027-05-09", new Set())).toBe("今やる");
    expect(statusOf(m, "2027-05-19", new Set())).toBe("期限が近い");
    expect(statusOf(m, "2027-05-22", new Set())).toBe("期限切れ");
    expect(statusOf(m, "2027-05-22", new Set(["birth-registration"]))).toBe("済み");
  });

  it("期限の無い事は14日で「過ぎた」になる", () => {
    const m = get("checkup-biweekly");
    expect(statusOf(m, m.startDate, new Set())).toBe("今やる");
    expect(statusOf(m, "2027-02-05", new Set())).toBe("過ぎた");
  });
});
