// 引っ越した時の行と、早く生まれた時のパートナーの行（見直し C10①②）。家族は作った物（見本の家族の形を借りる）。
// 期限は初日を数えない（引っ越した日の翌日を1日目とする）。法の行は法の条文、町ごとに違う行は「町の運用・町の制度」として書き分ける。
import { describe, expect, it } from "vitest";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { MILESTONES, PARENT_FILINGS, scheduleFor } from "./milestones";
import { DRAFTABLE } from "./draft-kinds";

const MOVED = ["moved-tennyu", "moved-child-allowance", "moved-checkup-tickets", "moved-medical-card"];
const rows = (f: Family, today?: string) => scheduleFor(f, today).filter((m) => MOVED.includes(m.id) || m.id === "partner-leave-earlier");
const byId = (f: Family, id: string, today?: string) => scheduleFor(f, today).find((m) => m.id === id);

// 見本の家族: 妊娠24週（2027-01-18）に横浜市からさいたま市へ。上の子はいない。生まれる前の日で見る
const PREG = { ...DEMO_FAMILY, birthDate: undefined } as Family;

describe("引っ越した時の行（見直し C10①）", () => {
  it("妊娠中に引っ越した家族: 転入届（14日）と受診券。子がいないので児童手当と医療証は出ない", () => {
    const ids = rows(PREG).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["moved-tennyu", "moved-checkup-tickets"]));
    expect(ids).not.toContain("moved-child-allowance");
    expect(ids).not.toContain("moved-medical-card");
    const t = byId(PREG, "moved-tennyu")!;
    expect(t.startDate).toBe("2027-01-18");
    expect(t.deadlineDate).toBe("2027-02-01"); // 1/18 の翌日から数えて14日目
    expect(t.basis).toContain("住民基本台帳法第22条");
    // 受診券は町の運用（法を出典にしない）・期限の日は置かない（次の健診の前に）
    const k = byId(PREG, "moved-checkup-tickets")!;
    expect(k.basis).toMatch(/^町の運用/);
    expect(k.basis).not.toMatch(/法第/);
    expect(k.deadlineDate).toBeUndefined();
    expect(k.pregnancyOnly).toBe(true);
  });

  it("生まれた後に引っ越した家族: 転入届・児童手当（15日）・医療証（1か月の目安）。受診券は出ない", () => {
    const f = { ...DEMO_FAMILY, movedOn: "2027-06-10" } as Family;
    const ids = rows(f, "2027-06-11").map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["moved-tennyu", "moved-child-allowance", "moved-medical-card"]));
    expect(ids).not.toContain("moved-checkup-tickets");
    const ca = byId(f, "moved-child-allowance", "2027-06-11")!;
    expect(ca.deadlineDate).toBe("2027-06-25"); // 6/10 の翌日から数えて15日目
    expect(ca.basis).toContain("児童手当法第8条第3項");
    const mc = byId(f, "moved-medical-card", "2027-06-11")!;
    // 1か月後の 7/10 は土曜なので、目安の日も次の開庁日の 7/12（月）にする（見直し①）
    expect(mc.deadlineOnHoliday).toBe("2027-07-10");
    expect(mc.deadlineDate).toBe("2027-07-12");
    expect(mc.deadlineKind).toBe("目安");
    expect(mc.basis).toMatch(/^町の制度/);
    // 法律上の親が出す届けは、担当をパートナーに決め打ちしない
    expect(PARENT_FILINGS.has("moved-child-allowance") && PARENT_FILINGS.has("moved-medical-card")).toBe(true);
    expect(ca.who).toBe("家族");
  });

  it("上の子がいる家族は、妊娠中に引っ越しても児童手当と医療証が出る", () => {
    const f = { ...PREG, situation: { ...DEMO_FAMILY.situation, olderChildren: true } } as Family;
    const ids = rows(f).map((m) => m.id);
    expect(ids).toEqual(expect.arrayContaining(["moved-tennyu", "moved-child-allowance", "moved-medical-card", "moved-checkup-tickets"]));
  });

  it("引っ越していない家族・町が同じ家族には出ない", () => {
    const none = { ...DEMO_FAMILY, previousCity: undefined, previousPrefecture: undefined, movedOn: undefined } as Family;
    expect(rows(none).filter((m) => MOVED.includes(m.id))).toEqual([]);
    const same = { ...DEMO_FAMILY, previousCity: "さいたま市", previousPrefecture: "埼玉県" } as Family;
    expect(rows(same).filter((m) => MOVED.includes(m.id))).toEqual([]);
  });

  it("引っ越す前の日には出さない（作った家族は先の引っ越しを持っている。見本の家族は24週の 1/18）", () => {
    for (const day of ["2026-09-28", "2027-01-17"]) expect(rows(PREG, day).filter((m) => MOVED.includes(m.id)), day).toEqual([]);
    expect(rows(PREG, "2027-01-18").map((m) => m.id)).toEqual(expect.arrayContaining(["moved-tennyu", "moved-checkup-tickets"]));
  });

  it("授かる前に引っ越した家族には、受診券の行を出さない", () => {
    const f = { ...PREG, movedOn: "2026-07-01" } as Family;
    expect(rows(f).map((m) => m.id)).not.toContain("moved-checkup-tickets");
  });

  it("短い題は20字・一言は40字まで。下書きの種類がある", () => {
    for (const id of [...MOVED, "partner-leave-earlier"]) {
      const m = MILESTONES.find((x) => x.id === id)!;
      expect(m.plain.length, id).toBeLessThanOrEqual(20);
      expect(m.hint.length, id).toBeLessThanOrEqual(40);
      expect(DRAFTABLE[id], id).toBeTruthy();
      expect(`${m.plain}${m.hint}`, id).not.toMatch(/パパ/);
    }
  });
});

describe("早く生まれた時のパートナーの行（見直し C10②）", () => {
  it("2週早く生まれた見本の家族: 生まれた日から予定日の前日まで（パートナーの担当・名前で呼ぶ）", () => {
    const t = byId(DEMO_FAMILY, "partner-leave-earlier", "2027-04-27")!;
    expect(t.startDate).toBe("2027-04-26");
    expect(t.deadlineDate).toBe("2027-05-09");
    expect(t.deadlineKind).toBe("目安");
    expect(t.who).toBe("パートナー");
    expect(t.plain).toBe("翔太の育休の始まりを早める");
    expect(t.basis).toContain("育児・介護休業法第7条第1項");
    expect(t.basis).toContain("施行規則第10条第1号");
    expect(t.basis).toContain("第14条");
    expect(t.title).toContain("産後パパ育休");
  });

  it("6日以内・遅く生まれた・まだ生まれていない・パートナーが育休を取らない家族には出ない", () => {
    expect(byId({ ...DEMO_FAMILY, birthDate: "2027-05-04" } as Family, "partner-leave-earlier", "2027-05-05")).toBeUndefined();
    expect(byId({ ...DEMO_FAMILY, birthDate: "2027-05-03" } as Family, "partner-leave-earlier", "2027-05-04")).toBeTruthy();
    expect(byId({ ...DEMO_FAMILY, birthDate: "2027-05-20" } as Family, "partner-leave-earlier", "2027-05-21")).toBeUndefined();
    expect(byId(DEMO_FAMILY, "partner-leave-earlier", "2027-04-20")).toBeUndefined();
    const noLeave = { ...DEMO_FAMILY, situation: { ...DEMO_FAMILY.situation, partnerLeave: "取らない" } } as Family;
    expect(byId(noLeave, "partner-leave-earlier", "2027-04-27")).toBeUndefined();
    const single = { ...DEMO_FAMILY, members: DEMO_FAMILY.members.filter((m) => m.role === "母") } as Family;
    expect(byId(single, "partner-leave-earlier", "2027-04-27")).toBeUndefined();
  });
});
