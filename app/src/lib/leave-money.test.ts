import { describe, expect, it } from "vitest";
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
    expect(papaBenefit("2027-01-10")).toEqual({ start: "2027-03-07", deadline: "2027-05-31" });
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
  it("パパの14日の1件は、14日未満か長さがわからない時だけ", () => {
    const base = { motherWork: "会社員・公務員", partnerWork: "会社員・公務員", partnerLeave: "取る" };
    expect(ids({ ...base, partnerLeaveLen: "14日未満" }, both)).toContain("partner-leave-14");
    expect(ids(base, both)).toContain("partner-leave-14");
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
