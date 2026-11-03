// 安心のデザイン #5: 「静かにする」の値は決まった2つだけ保存する
import { describe, expect, it } from "vitest";
import { cleanQuiet } from "./situation";

describe("cleanQuiet", () => {
  it("loss と nicu は残す", () => {
    expect(cleanQuiet("loss")).toBe("loss");
    expect(cleanQuiet("nicu")).toBe("nicu");
  });
  it("決まりに無い値は捨てる", () => {
    for (const v of ["other", true, null, undefined, 1]) expect(cleanQuiet(v)).toBeUndefined();
  });
});
