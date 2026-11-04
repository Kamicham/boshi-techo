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
