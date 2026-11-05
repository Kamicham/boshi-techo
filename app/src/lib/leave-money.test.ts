import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "./demo-family";
import { benefitDrop, benefitFirst, endOfMonth, leaveStart, papaBenefit } from "./leave-money";
import { scheduleFor } from "./milestones";
import { bringList } from "./visit";

describe("産休・育休のお金の日", () => {
  it("月末", () => {
    expect(endOfMonth("2027-02-10")).toBe("2027-02-28");
    expect(endOfMonth("2028-02-10")).toBe("2028-02-29");
    expect(endOfMonth("2027-12-03")).toBe("2027-12-31");
  });
  it("育休は生まれた日から57日目に始まり、初回の申請は4か月を経過する日の月末まで", () => {
    // 2027-01-10 生まれ: 産後休業は 1/11〜3/7（56日）、育休は 3/8 から。4か月を経過する日は 7/7 → 7/31
    expect(leaveStart("2027-01-10")).toBe("2027-03-08");
    expect(benefitFirst("2027-01-10")).toEqual({ start: "2027-03-08", deadline: "2027-07-31" });
  });
  it("産後パパ育休の給付は8週を過ぎた次の日から、2か月を経過する日の月末まで", () => {
    expect(papaBenefit("2027-01-10", "2027-01-10")).toEqual({ start: "2027-03-07", deadline: "2027-05-31" });
  });
  it("産後パパ育休の給付: 予定日より早く生まれた時は予定日から、遅く生まれた時は生まれた日から数える（雇用保険法施行規則第101条の33）", () => {
    // 見本の家族（予定日 5/10・2週早い 4/26 生まれ）。前は生まれた日から数えて 6/21〜8/31 を出していた
    expect(papaBenefit("2027-04-26", "2027-05-10")).toEqual({ start: "2027-07-05", deadline: "2027-09-30" });
    expect(papaBenefit("2027-05-20", "2027-05-10")).toEqual({ start: "2027-07-15", deadline: "2027-09-30" });
    // 厚生労働省「育児休業等給付の内容と支給申請手続」2026年8月1日改訂版の例と同じ日
    expect(papaBenefit("2026-10-01", "2026-10-06").start).toBe("2026-12-01"); // 3頁: 予定日10/6から起算して8週間を経過する日の翌日は12/1
    expect(papaBenefit("2026-10-05", "2026-10-01")).toEqual({ start: "2026-11-30", deadline: "2027-01-31" }); // 5頁: 11/30から1/31まで
  });
  it("見本の家族の予定でも、産後パパ育休の給付の申請は予定日から数えた 7/5〜9/30（期限）。一言も「予定日から」", () => {
    const m = scheduleFor(DEMO_FAMILY, "2027-05-01").find((x) => x.id === "partner-childcare-benefit")!;
    expect(m.startDate).toBe("2027-07-05");
    expect(m.deadlineDate).toBe("2027-09-30");
    expect(m.deadlineKind).toBe("期限");
    expect(m.hint).toBe("予定日から8週を過ぎてから。勤め先がハローワークへ");
    expect(m.basis).toContain("予定日より早く生まれた時は予定日");
    // まだ生まれていない時は予定日から（日は同じ）。予定日どおりに生まれた家族の一言は今までどおり
    const before = scheduleFor({ ...DEMO_FAMILY, birthDate: undefined }, "2027-04-01").find((x) => x.id === "partner-childcare-benefit")!;
    expect([before.startDate, before.deadlineDate]).toEqual(["2027-07-05", "2027-09-30"]);
    expect(before.hint).toBe("生まれて8週を過ぎてから。勤め先がハローワークへ");
  });
  it("給付が下がるのは育休の181日目。その30日前から1件", () => {
    expect(benefitDrop("2027-01-10")).toEqual({ start: "2027-08-05", deadline: "2027-09-04" });
  });
});

describe("出し分け", () => {
  const ids = (situation: object, members?: object[]) =>
    scheduleFor({ dueDate: "2027-01-10", birthDate: "2027-01-10", situation, ...(members ? { members } : {}) } as never, "2027-01-20").map((m) => m.id);
  const both = [
    { id: "m", name: "母", role: "母" },
    { id: "p", name: "父", role: "パートナー" },
  ];
  it("会社員の母には出産手当金・育休の給付・下がる前の1件が出て、自営と仕事なしの母には出ない", () => {
    const w = ids({ motherWork: "会社員・公務員" });
    for (const id of ["maternity-allowance-cert", "maternity-allowance-apply", "childcare-benefit-first", "benefit-drop"]) expect(w).toContain(id);
    for (const mw of ["自営・フリー", "仕事なし"]) for (const id of ["maternity-allowance-apply", "childcare-benefit-first", "benefit-drop"]) expect(ids({ motherWork: mw })).not.toContain(id);
  });
  it("出産で辞める母には出産手当金だけ（育休の給付は出ない）", () => {
    const q = ids({ motherWork: "出産で辞める" });
    expect(q).toContain("maternity-allowance-apply");
    expect(q).not.toContain("childcare-benefit-first");
  });
  it("パパの14日の1件は、14日未満と答えた時だけ。長さがわからない時は育休の相談の一言に足す", () => {
    const base = { motherWork: "会社員・公務員", partnerWork: "会社員・公務員", partnerLeave: "取る" };
    expect(ids({ ...base, partnerLeaveLen: "14日未満" }, both)).toContain("partner-leave-14");
    expect(ids(base, both)).not.toContain("partner-leave-14");
    const pl = scheduleFor({ dueDate: "2027-01-10", situation: base, members: both } as never, "2026-10-01").find((m) => m.id === "partner-leave");
    expect(pl?.hint).toContain("14日以上");
    expect(ids({ ...base, partnerLeaveLen: "2週間〜1か月" }, both)).not.toContain("partner-leave-14");
    expect(ids({ ...base, partnerLeave: "取らない" }, both)).not.toContain("partner-leave-14");
  });
});

describe("1か月健診の持ち物", () => {
  const f = { dueDate: "2027-01-10", birthDate: "2027-01-10" };
  it("雇われて働く母には出産手当金の申請書が足され、仕事なしの母には足されない", () => {
    expect(bringList({ ...f, situation: { motherWork: "会社員・公務員" } }, "2027-02-10")).toContain("出産手当金の申請書（医師の証明の欄がまだなら）");
    expect(bringList({ ...f, situation: { motherWork: "仕事なし" } }, "2027-02-10").join()).not.toContain("出産手当金");
    expect(bringList({ ...f, situation: { motherWork: "会社員・公務員" } }, "2027-04-10").join()).not.toContain("出産手当金");
  });
});
