// 安心のデザイン #1: 赤は法の期限の残り1日以下だけ。過ぎた事・始まりの日は責めない色と言葉
import { describe, expect, it } from "vitest";
import { countdownLook } from "./countdown";

describe("countdownLook", () => {
  it("赤は残り1日以下の期限だけ", () => {
    expect(countdownLook(0).color).toBe("text-alert");
    expect(countdownLook(1).color).toBe("text-alert");
    expect(countdownLook(2).color).toBe("text-warn");
    expect(countdownLook(3).color).toBe("text-warn");
    expect(countdownLook(4).color).toBe("text-ink");
  });
  it("過ぎた期限は赤くせず「今からでも」", () => {
    for (const d of [-1, -5, -30]) {
      expect(countdownLook(d).color).toBe("text-ink");
      expect(countdownLook(d).text).toBe("今からでもできます");
      expect(countdownLook(d).text).not.toMatch(/過ぎ/);
    }
  });
  it("始まりの日は、近くても色を付けない", () => {
    for (const d of [-2, 0, 1, 2, 10]) expect(countdownLook(d, "start").color).toBe("text-ink");
    expect(countdownLook(1, "start").text).toBe("あしたから");
    expect(countdownLook(5, "start").text).toBe("5日後から");
  });
});
