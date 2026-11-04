// 引っ越しと、生まれた日を入れた日（見直し C10）。家族も町の名前も作った物（町は実在の市の名前だけを使う）。
import { describe, expect, it } from "vitest";
import type { Family } from "./demo-family";
import { birthKnownField, moveFields, NOT_MOVED, officeOf, townChanged } from "./move";

const PRIOR = { id: "move-test", city: "横浜市", prefecture: "神奈川県", dueDate: "2027-05-10", members: [] } as unknown as Family;
const TODAY = "2027-01-20";

describe("町を変えた時の前の町と引っ越した日", () => {
  it("町を変えたら、前の町と、家族が答えた引っ越した日を覚える", () => {
    const m = moveFields(PRIOR, { city: "さいたま市", prefecture: "埼玉県", movedOn: "2027-01-18" }, TODAY);
    expect(m).toEqual({ previousCity: "横浜市", previousPrefecture: "神奈川県", movedOn: "2027-01-18", moved: true });
  });

  it("引っ越した日を答えない・読めない・今日より先・1年より前の時は、今日（保存した日）", () => {
    for (const movedOn of [undefined, "", "2027/01/18", "2027-02-30x", "2027-01-21", "2025-12-01"]) {
      expect(moveFields(PRIOR, { city: "さいたま市", prefecture: "埼玉県", movedOn }, TODAY).movedOn).toBe(TODAY);
    }
    // 1年（366日）前までは答えのとおり
    expect(moveFields(PRIOR, { city: "さいたま市", prefecture: "埼玉県", movedOn: "2026-01-19" }, TODAY).movedOn).toBe("2026-01-19");
  });

  it("同じ町のまま・都道府県だけ変えた時・町の名前を直しただけの時", () => {
    const before = { ...PRIOR, previousCity: "川崎市", previousPrefecture: "神奈川県", movedOn: "2026-10-01" } as Family;
    // 同じ町: 前の引っ越しの欄のまま
    expect(moveFields(before, { city: "横浜市", prefecture: "神奈川県" }, TODAY)).toEqual({ previousCity: "川崎市", previousPrefecture: "神奈川県", movedOn: "2026-10-01", moved: false });
    // 都道府県だけ変えても町を変えた事になる（同じ名前の町がほかの県にある）
    expect(townChanged(PRIOR, { city: "横浜市", prefecture: "埼玉県" })).toBe(true);
    // 町の名前を直しただけ（引っ越していない）
    expect(moveFields(before, { city: "横浜市中区", prefecture: "神奈川県", movedOn: NOT_MOVED }, TODAY)).toEqual({ previousCity: "川崎市", previousPrefecture: "神奈川県", movedOn: "2026-10-01", moved: false });
    // 前の町が無い（初めて保存する）家族は引っ越しではない
    expect(moveFields(null, { city: "さいたま市", prefecture: "埼玉県" }, TODAY).moved).toBe(false);
  });
});

describe("生まれた日を入れた日", () => {
  it("生まれた日を新しく入れた・変えた日は今日。同じままなら前のまま。生まれた日を消したら無し", () => {
    expect(birthKnownField(PRIOR, "2027-04-26", "2027-05-03")).toEqual({ birthKnownOn: "2027-05-03" });
    expect(birthKnownField({ birthDate: "2027-04-26", birthKnownOn: "2027-05-03" }, "2027-04-26", "2027-05-20")).toEqual({ birthKnownOn: "2027-05-03" });
    expect(birthKnownField({ birthDate: "2027-04-26", birthKnownOn: "2027-05-03" }, "2027-04-25", "2027-05-20")).toEqual({ birthKnownOn: "2027-05-20" });
    expect(birthKnownField({ birthDate: "2027-04-26" }, undefined, "2027-05-20")).toEqual({});
  });

  it("11/5 より前に生まれた日を入れた家族（入れた日を持たない）は、同じ生まれた日のまま保存しても足さない＝生まれた日から数える", () => {
    expect(birthKnownField({ birthDate: "2026-10-30" }, "2026-10-30", "2026-11-06")).toEqual({});
  });
});

describe("前の町の役所の窓口", () => {
  it("印の付いた窓口は無い事にする（下書き・予定の場所に使わない）", () => {
    expect(officeOf({ name: "横浜市役所", staleFrom: "横浜市" })).toBeUndefined();
    expect(officeOf({ name: "さいたま市役所" })).toEqual({ name: "さいたま市役所" });
    expect(officeOf({ name: "さいたま市役所", staleFrom: "" })).toEqual({ name: "さいたま市役所", staleFrom: "" });
    expect(officeOf(undefined)).toBeUndefined();
  });
});
