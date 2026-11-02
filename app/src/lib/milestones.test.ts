import { describe, expect, it } from "vitest";
import { PREGNANCY_ONLY, deadlineKindOf, scheduleFor, statusOf } from "./milestones";
import type { Situation } from "./situation";

// 予定日 2027-05-10 の家族（すべて作った家族）
const due = "2027-05-10";
const both = [{ role: "母" }, { role: "パートナー" }];
const ids = (situation?: Situation, members = both, birthDate?: string) => scheduleFor({ dueDate: due, birthDate, situation, members }).map((m) => m.id);

describe("家族の形で予定を組み替える", () => {
  it("わからない時は今までどおり（職場の事も育休も出る）", () => {
    const x = ids(undefined);
    for (const id of ["tell-work", "maternity-leave", "tell-work-birth", "partner-leave", "child-allowance"]) expect(x).toContain(id);
    for (const id of ["partner-days-off", "child-allowance-change", "single-child-support", "satogaeri-hospital", "nenkin-maternity-exempt"]) expect(x).not.toContain(id);
  });

  it("仕事のない母には職場の事を出さない", () => {
    const x = ids({ motherWork: "仕事なし", partnerWork: "会社員・公務員" });
    for (const id of ["tell-work", "maternity-leave", "nenkin-maternity-exempt"]) expect(x).not.toContain(id);
    // パートナーが会社員なら、生まれた事を職場に伝える（育休・扶養の入口）は残す
    expect(x).toContain("tell-work-birth");
    expect(ids({ motherWork: "仕事なし", partnerWork: "仕事なし" })).not.toContain("tell-work-birth");
  });

  it("出産で辞める母: 職場に伝えるは残し、退職の日と保険の切り替えを足す", () => {
    const x = ids({ motherWork: "出産で辞める" });
    for (const id of ["tell-work", "mother-quit-date", "mother-insurance-switch"]) expect(x).toContain(id);
  });

  it("自営の母: 国民年金と国保の産前産後の免除。予定日の6か月前から", () => {
    const s = scheduleFor({ dueDate: due, situation: { motherWork: "自営・フリー" }, members: both });
    expect(s.find((m) => m.id === "nenkin-maternity-exempt")?.startDate).toBe("2026-11-10");
    expect(s.map((m) => m.id)).toContain("kokuho-maternity-exempt");
    expect(s.map((m) => m.id)).not.toContain("tell-work");
  });

  it("パートナーのいない家族: パートナーの担当は母へ。育休は出さず、ひとり親の制度を足す", () => {
    const s = scheduleFor({ dueDate: due, members: [{ role: "母" }] });
    expect(s.some((m) => m.who === "パートナー")).toBe(false);
    expect(s.find((m) => m.id === "birth-registration")?.who).toBe("母");
    expect(s.map((m) => m.id)).not.toContain("partner-leave");
    expect(s.map((m) => m.id)).toEqual(expect.arrayContaining(["single-child-support", "single-medical"]));
  });

  it("育休を取らない・自営のパートナー: 育休の代わりに休む日を決める", () => {
    for (const sit of [{ partnerLeave: "取らない" }, { partnerWork: "自営・フリー" }] as Situation[]) {
      const x = ids(sit);
      expect(x).not.toContain("partner-leave");
      expect(x).toContain("partner-days-off");
    }
    expect(ids({ partnerLeave: "未定" })).toContain("partner-leave");
  });

  it("第2子: 児童手当は額を変える届け。上の子の預け先を足す", () => {
    const x = ids({ olderChildren: ["2024-04"] });
    expect(x).not.toContain("child-allowance");
    expect(x).toEqual(expect.arrayContaining(["child-allowance-change", "older-child-care"]));
  });

  it("里帰り: 産院の予約・健診代の申請・訪問の依頼。出生届は里帰り先でも", () => {
    const s = scheduleFor({ dueDate: due, situation: { satogaeri: { prefecture: "鹿児島県", city: "鹿児島市" } }, members: both });
    expect(s.map((m) => m.id)).toEqual(expect.arrayContaining(["satogaeri-hospital", "satogaeri-checkup-refund", "satogaeri-visit"]));
    expect(s.find((m) => m.id === "birth-registration")?.hint).toContain("里帰り先");
  });

  it("双子: 見出しに（2人分）。産休は14週前から", () => {
    const s = scheduleFor({ dueDate: due, situation: { babies: 2 }, members: both });
    expect(s.find((m) => m.id === "birth-registration")?.plain).toBe("出生届を出す（2人分）");
    expect(s.find((m) => m.id === "maternity-leave")?.startDate).toBe("2027-02-01");
  });
});

describe("時期", () => {
  it("まだ生まれていない間は、予定日を過ぎても生まれてからの事は「まだ先」", () => {
    const m = scheduleFor({ dueDate: due }).find((x) => x.id === "birth-registration")!;
    expect(m.awaitingBirth).toBe(true);
    expect(statusOf(m, "2027-05-30", new Set())).toBe("まだ先");
  });

  it("生まれた後は、妊娠中だけの事は「過ぎた」", () => {
    const s = scheduleFor({ dueDate: due, birthDate: "2027-03-20" });
    for (const m of s.filter((x) => PREGNANCY_ONLY.has(x.id))) expect(statusOf(m, "2027-03-21", new Set())).toBe("過ぎた");
    expect(statusOf(s.find((x) => x.id === "birth-registration")!, "2027-03-21", new Set())).toBe("今やる");
  });

  it("期限の印: 妊娠の届けは目安、出生届は期限", () => {
    const s = scheduleFor({ dueDate: due });
    expect(deadlineKindOf(s.find((x) => x.id === "pregnancy-report")!)).toBe("目安");
    expect(deadlineKindOf(s.find((x) => x.id === "birth-registration")!)).toBe("期限");
  });

  it("赤ちゃんの予防接種と健診は「健診」で、行き先は小児科など（役所ではない）", () => {
    const s = scheduleFor({ dueDate: due, birthDate: due });
    for (const id of ["vaccines-start", "vaccines-3m", "vaccines-4m", "bcg", "vaccines-7m", "first-birthday-vaccines", "checkup-9-10m"]) {
      const m = s.find((x) => x.id === id)!;
      expect(m.kind).toBe("健診");
      expect(m.needsLocal).toBe(true);
    }
    expect(s.find((x) => x.id === "bcg")?.deadlineDate).toBe("2028-05-09");
  });
});
