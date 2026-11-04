import { describe, expect, it } from "vitest";
import { bookIntro, cameFromTecho, minnaVoiceLabel } from "./book-intro";

const JUDGE = /異常|正常|ふつう|大丈夫です|問題ありません/;

describe("一冊の最初の箱", () => {
  it("記録0件: 子の呼び名で「◯◯に渡す、一冊の本」・件数・最初の1つを残す", () => {
    const x = bookIntro({ childName: "ひなた", count: 0, born: false, isDemo: false });
    expect(x.kind).toBe("gather");
    expect(x.title).toBe("ひなたに渡す、一冊の本");
    expect(x.sub).toContain("いまは0件");
    expect(x.cta).toBe("最初の1つを残す");
  });
  it("呼び名が無ければ「赤ちゃんに渡す、一冊の本」", () => {
    expect(bookIntro({ count: 0, born: false, isDemo: false }).title).toBe("赤ちゃんに渡す、一冊の本");
  });
  it("妊娠中で少ない時も同じ箱。件数を出し、最初の1つとは言わない", () => {
    const x = bookIntro({ childName: "ひなた", count: 4, born: false, isDemo: false });
    expect(x.kind).toBe("gather");
    expect(x.sub).toContain("いまは4件");
    expect(x.cta).not.toContain("最初");
  });
  it("記録がある時: 大見出しは「記録を本にまとめる」、押すと何が起きるかの1行、「一冊」は小見出しだけ", () => {
    const x = bookIntro({ childName: "ひなた", count: 120, born: true, isDemo: true });
    expect(x.kind).toBe("make");
    expect(x.title).toBe("記録を本にまとめる");
    expect(x.cta).toBe("本にまとめてみる");
    expect(x.sub).toContain("120件");
    expect(x.sub).toContain("作り直せます");
    const all = [x.eyebrow, x.title, x.sub, x.cta].join("\n");
    expect(all.match(/一冊/g)?.length).toBe(1);
  });
  it("見本の家族で記録0件は、見本の記録を入れる", () => {
    expect(bookIntro({ count: 0, born: false, isDemo: true }).kind).toBe("seed");
  });
  it("本物の家族で記録0件の時だけ「見本の家族の一冊を読む ›」。開く日は、同梱した見本の一冊のいちばん後ろの日（見直し C38 ④）", async () => {
    const zero = bookIntro({ childName: "ひなた", count: 0, born: false, isDemo: false });
    expect(zero.kind === "gather" && zero.sample).toBe(true);
    const few = bookIntro({ childName: "ひなた", count: 4, born: false, isDemo: false });
    expect(few.kind === "gather" && few.sample).toBe(false);
    const { SAMPLE_BOOK_DAY } = await import("./book-intro");
    const seeds = (await import("./demo-books.json")).default as { asOf: string }[];
    expect(SAMPLE_BOOK_DAY).toBe(seeds.map((s) => s.asOf).sort().at(-1));
  });
  it("判定の言葉を出さない", () => {
    for (const count of [0, 3, 50]) for (const born of [true, false]) {
      const x = bookIntro({ count, born, isDemo: false });
      expect([x.title, x.sub, x.cta].join("")).not.toMatch(JUDGE);
    }
  });
});

describe("手帳へ戻る・みんなの章の声", () => {
  it("手帳のタブから来た時だけ", () => {
    expect(cameFromTecho("?from=techo")).toBe(true);
    expect(cameFromTecho("")).toBe(false);
    expect(cameFromTecho("?from=tab")).toBe(false);
  });
  it("「ばあばの声（17秒）」", () => {
    expect(minnaVoiceLabel("ばあば", 16.6)).toBe("ばあばの声（17秒）");
    expect(minnaVoiceLabel("じいじ")).toBe("じいじの声");
  });
});

describe("体験版の一冊の箱（Claude を呼ばない・2026-11-05）", () => {
  it("記録がある日は、作る代わりに、前に Claude が書いた見本の一冊の日へ", () => {
    for (const [count, born] of [
      [3, false],
      [120, true],
    ] as const) {
      const x = bookIntro({ childName: "ひなた", count, born, isDemo: true, trial: true });
      expect(x.kind).toBe("read");
      expect(x.cta).toBe("2歳の日の一冊を読む ›");
      expect(x.sub).toContain("この体験版では Claude を呼ばない");
      expect(x.sub).toContain("妊娠30週・生後2か月・2歳");
    }
  });
  it("記録が0件なら、今までどおり見本の記録を入れる", () => {
    expect(bookIntro({ count: 0, born: false, isDemo: true, trial: true }).kind).toBe("seed");
  });
  it("言葉の「妊娠30週・生後2か月・2歳」は、持っている見本の一冊3冊の日と合う（2歳の一冊は SAMPLE_BOOK_DAY）", async () => {
    const seeds = (await import("./demo-books.json")).default as { asOf: string }[];
    const { clockAt } = await import("./clock");
    const { DEMO_FAMILY } = await import("./demo-family");
    const { SAMPLE_BOOK_DAY, SAMPLE_BOOK_LATER } = await import("./book-intro");
    const labels = seeds.map((b) => clockAt(DEMO_FAMILY, b.asOf).label);
    expect(labels).toHaveLength(3);
    expect(labels[0]).toMatch(/^妊娠30週/);
    expect(labels[1]).toMatch(/^生後2か月/);
    expect(labels[2]).toMatch(/^2歳/);
    expect(seeds[2].asOf).toBe(SAMPLE_BOOK_DAY);
    expect(SAMPLE_BOOK_LATER).toContain("妊娠30週・生後2か月・2歳");
  });
});
