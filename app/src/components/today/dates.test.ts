import { describe, expect, it } from "vitest";
import { jpDate, jpShort } from "./dates";

describe("日付の言い方（第31回: 年が違う日にだけ年を付ける）", () => {
  it("同じ年は年を付けない", () => {
    expect(jpShort("2026-11-26", "2026-11-04")).toBe("11/26（木）");
    expect(jpDate("2026-11-26", "2026-11-04")).toBe("11月26日（木）");
  });
  it("年が違えば年を付ける", () => {
    expect(jpShort("2029-01-26", "2027-11-20")).toBe("2029/1/26（金）");
    expect(jpDate("2030-01-26", "2027-11-20")).toBe("2030年1月26日（土）");
  });
  it("today が無ければ前の形のまま", () => {
    expect(jpShort("2029-01-26")).toBe("1/26（金）");
  });
});
