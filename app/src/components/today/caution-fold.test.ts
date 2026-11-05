// 気をつける事の札の引用の畳み方（家族の声①への直し A）。見本の家族の1000日に出る札すべてで、強く注意する引用が表に残る事を確かめる。
import { describe, expect, it } from "vitest";
import { addDays, conceptionDate, secondBirthday } from "@/lib/clock";
import { cautionFor, type Caution } from "@/lib/cautions";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { QUOTES_SHOWN, foldQuotes } from "./caution-fold";

/** 見本の家族の1000日に、母とパートナーの画面へ出る札（読んでいない端末で） */
function demoCards(): Caution[] {
  const out = new Map<string, Caution>();
  const end = secondBirthday(DEMO_FAMILY);
  for (let d = conceptionDate(DEMO_FAMILY); d <= end; d = addDays(d, 1)) {
    for (const role of ["母", "パートナー"] as const) {
      const c = cautionFor(DEMO_FAMILY, d, { ids: [] }, { role, busy: false });
      if (c && !out.has(c.id)) out.set(c.id, c);
    }
  }
  return [...out.values()];
}

describe("気をつける事の札の引用を畳む", () => {
  it("表には最初の2つと、強く注意する引用（赤・太字）。残りの数は「全部読む」に。並びは変えない", () => {
    const qs = [{ text: "a" }, { text: "b" }, { text: "c" }, { text: "d", tone: "alert" }, { text: "e" }, { text: "f", tone: "bold" }];
    const { shown, folded } = foldQuotes(qs);
    expect(shown.map((q) => q.text)).toEqual(["a", "b", "d", "f"]);
    expect(folded).toBe(2);
    expect(foldQuotes(qs.slice(0, 2)).folded).toBe(0);
  });

  it("見本の家族の1000日に出る札すべてで、強く注意する引用は畳まない", () => {
    const cards = demoCards();
    expect(cards.length).toBeGreaterThan(3);
    for (const c of cards) {
      const { shown, folded } = foldQuotes(c.quotes);
      for (const q of c.quotes.filter((q) => q.tone)) expect(shown, `${c.id}: ${q.text}`).toContain(q);
      expect(shown.filter((q) => !q.tone).length, c.id).toBeLessThanOrEqual(QUOTES_SHOWN);
      expect(shown.length + folded).toBe(c.quotes.length);
      // 元の並びのまま（表の引用は、元の引用の並びの部分列）
      const idx = shown.map((q) => c.quotes.indexOf(q));
      expect(idx, c.id).toEqual([...idx].sort((a, b) => a - b));
    }
    // 寝る所の札: ベッドガードの「絶対に使用しないでください」（太字）は、7つの引用の6つ目でも表に残る
    const sleep = cards.find((c) => c.id === "sleep");
    if (sleep) expect(foldQuotes(sleep.quotes).shown.some((q) => q.text.includes("ベッドガード"))).toBe(true);
  });
});
