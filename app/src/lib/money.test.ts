import { describe, expect, it } from "vitest";
import { scheduleFor } from "./milestones";
import { childAllowanceFirstPay, isPaidId, moneyWatch, payWindow } from "./money";

describe("児童手当の最初の振込", () => {
  it("生まれて15日以内の申請は、生まれた月の翌月分から。次の偶数月に前の2か月分", () => {
    // 1/10 生まれ・1/20 申請 → 2月分から → 4月の振込（2・3月分）
    expect(childAllowanceFirstPay("2027-01-20", "2027-01-10")).toBe("2027-04-01");
    // 1/31 生まれ・2/10 申請（15日以内）→ 2月分から → 4月
    expect(childAllowanceFirstPay("2027-02-10", "2027-01-31")).toBe("2027-04-01");
  });
  it("15日を過ぎたら申請の月の翌月分から", () => {
    // 1/10 生まれ・2/20 申請 → 3月分から → 4月の振込（3月分）
    expect(childAllowanceFirstPay("2027-02-20", "2027-01-10")).toBe("2027-04-01");
    // 3/20 申請 → 4月分から → 6月
    expect(childAllowanceFirstPay("2027-03-20", "2027-01-10")).toBe("2027-06-01");
    // 12月の申請 → 1月分から → 翌年2月
    expect(childAllowanceFirstPay("2027-12-05")).toBe("2028-02-01");
  });
  it("見込みの窓はその月の1日〜月末", () => {
    expect(payWindow("child-allowance", "2027-01-20", "2027-01-10")).toEqual({ start: "2027-04-01", deadline: "2027-04-30" });
    expect(payWindow("maternity-allowance-apply", "2027-03-10")).toEqual({ start: "2027-04-09", deadline: "2027-05-09" });
  });
});

describe("届いたか確かめる件", () => {
  const sched = scheduleFor({ dueDate: "2027-01-10", birthDate: "2027-01-10", situation: { motherWork: "会社員・公務員" } } as never, "2027-01-20");
  it("申請が済んだ物だけに出る", () => {
    expect(moneyWatch(sched, new Set(), {}, "2027-01-10")).toEqual([]);
    const w = moneyWatch(sched, new Set(["child-allowance"]), { "child-allowance": "2027-01-20" }, "2027-01-10");
    expect(w.map((m) => m.id)).toEqual(["paid-child-allowance"]);
    expect(w[0].startDate).toBe("2027-04-01");
    expect(w[0].deadlineKind).toBe("目安");
    expect(isPaidId("paid-child-allowance")).toBe(true);
    expect(isPaidId("paid-nothing")).toBe(false);
  });
  it("申請の日が無ければ申請の期限の日で置く", () => {
    const m = sched.find((x) => x.id === "maternity-allowance-apply")!;
    const w = moneyWatch(sched, new Set(["maternity-allowance-apply"]), {}, "2027-01-10");
    expect(w[0].startDate > (m.deadlineDate ?? m.startDate)).toBe(true);
  });
  it("額は出さない", () => {
    const w = moneyWatch(sched, new Set(["child-allowance", "maternity-allowance-apply"]), {}, "2027-01-10");
    for (const m of w) expect(`${m.title}${m.hint}${m.plain}`).not.toMatch(/円/);
  });
});
