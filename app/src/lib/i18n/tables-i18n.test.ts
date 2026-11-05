// 画面が t(x.label) の形で訳すデータの表の字が、どれも辞書（zh・en）にある事（2026-11-05: 妊娠中の思い出の誘い「名前のこと」などが、
// 描く所では t() を通していたのに辞書に無く、中文・English でも日本語のまま出ていた。画面の試験 screens.test.ts は、値が変数になると読めない）。
import { describe, expect, it } from "vitest";
import { BUMP_MOMENTS } from "../media-shared";
import { DICTS } from "./dicts";

const missing = (words: readonly string[]) => words.filter((w) => !DICTS.zh[w] || !DICTS.en[w]);

describe("データの表の字は、辞書にある", () => {
  it("妊娠中の思い出の誘い（BUMP_MOMENTS）", () => {
    expect(missing(BUMP_MOMENTS.flatMap((m) => [m.label, m.say, m.action, ...(m.note ? [m.note] : [])]))).toEqual([]);
  });
});
