import { describe, expect, it } from "vitest";
import { scheduleFor } from "./milestones";
import { backDays, satogaeriReach } from "./satogaeri";

const home = { city: "江東区", prefecture: "東京都" };
const sched = (situation: object) =>
  scheduleFor({ dueDate: "2027-01-10", birthDate: "2027-01-10", ...home, situation } as never, "2027-01-20");
const byId = (situation: object) => new Map(sched(situation).map((m) => [m.id, m]));

describe("里帰り先の近さ", () => {
  it("同じ市・同じ県・ほかの県・わからない", () => {
    expect(satogaeriReach(home, { satogaeri: true, satogaeriPlace: { prefecture: "東京都", city: "江東区" } })).toBe("同じ市");
    expect(satogaeriReach(home, { satogaeri: true, satogaeriPlace: { prefecture: "東京都", city: "八王子市" } })).toBe("同じ県");
    expect(satogaeriReach(home, { satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" } })).toBe("ほかの県");
    expect(satogaeriReach(home, { satogaeri: true })).toBe("わからない");
    expect(satogaeriReach({}, { satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" } })).toBe("わからない");
  });
  it("戻る日は時期の答えから（決めていなければ1か月健診のあと）", () => {
    expect(backDays()).toBe(35);
    expect(backDays("1か月健診のあと")).toBe(35);
    expect(backDays("産後2か月ごろ")).toBe(60);
    expect(backDays("それより長く")).toBe(90);
  });
});

describe("2つの町の予定", () => {
  it("同じ市なら遠方向けの事を出さない", () => {
    const m = byId({ satogaeri: true, satogaeriPlace: { prefecture: "東京都", city: "江東区" } });
    for (const id of ["satogaeri-visit", "satogaeri-checkup-refund", "satogaeri-local", "satogaeri-return"]) expect(m.has(id)).toBe(false);
    expect(m.has("satogaeri-hospital")).toBe(true);
  });
  it("町がわからない時は今までどおり出し、里帰り先の町の調べは出さない", () => {
    const m = byId({ satogaeri: true });
    expect(m.has("satogaeri-visit")).toBe(true);
    expect(m.has("satogaeri-checkup-refund")).toBe(true);
    expect(m.has("satogaeri-return")).toBe(true);
    expect(m.has("satogaeri-local")).toBe(false);
  });
  it("ほかの県: 里帰り先の町の名前が題と出生届に入る", () => {
    const m = byId({ satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" } });
    expect(m.get("satogaeri-local")?.title).toContain("霧島市");
    expect(m.get("birth-registration")?.hint).toBe("14日以内。江東区・霧島市・本籍地で出せる");
    expect(m.get("birth-registration")?.basis).toContain("第25条");
  });
  it("同じ県なら健診代の申請の一言を変える（申請の1件は残す）", () => {
    const m = byId({ satogaeri: true, satogaeriPlace: { prefecture: "東京都", city: "八王子市" } });
    expect(m.get("satogaeri-checkup-refund")?.hint).toContain("県の中は受診券が使える事が多い");
  });
  it("戻る日の段取りと健診代の申請は、戻る時期から置く", () => {
    const later = byId({ satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" }, satogaeriBack: "産後2か月ごろ" });
    expect(later.get("satogaeri-return")?.deadlineDate).toBe("2027-03-11");
    expect(later.get("satogaeri-return")?.startDate).toBe("2027-02-25");
    expect(later.get("satogaeri-checkup-refund")?.startDate).toBe("2027-03-11");
    const plain = byId({ satogaeri: true, satogaeriPlace: { prefecture: "鹿児島県", city: "霧島市" } });
    expect(plain.get("satogaeri-return")?.deadlineDate).toBe("2027-02-14");
    expect(plain.get("satogaeri-return")?.basis).toContain("戻る時期を決めていない");
  });
  it("里帰りしない家族には何も出ない", () => {
    const m = byId({ satogaeri: false });
    expect([...m.keys()].some((id) => id.startsWith("satogaeri"))).toBe(false);
  });
});
