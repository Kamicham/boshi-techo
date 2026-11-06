// 今日の画面と同意の文の言葉の粗（デモの会話が見つけた⑧・2026-11-06）が戻らない事を見る。
// ① 「◯◯の番」の名前に「さん」を付けない（components/draft/DraftPanel.tsx の注と同じ決まり）。
//    畳みの行「{who}さんの番 {n}件」（Techo）と、届けの束の「翔太さんの番です」（BirthTripCard）が、
//    「翔太の番」と同じ画面に混ざっていた
// ② 初めての人に分かりにくい言葉「手帳の機械で」「機械で確かめた事」を、画面の辞書に置かない
//    （Claude への頼みの文の見出し「機械で確かめた事:」は画面に出ないので、そのまま＝api/advisor/_lib/write.ts）
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AREAS } from "@/lib/i18n/dicts";

const SRC = path.resolve(__dirname, "../..");
const KEYS = Object.values(AREAS).flatMap((e) => Object.keys(e));

/** 試験の外のコード（.ts・.tsx） */
function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return sources(p);
    return /\.tsx?$/.test(d.name) && !/\.test\.tsx?$/.test(d.name) ? [p] : [];
  });
}

describe("「◯◯の番」に「さん」を付けない", () => {
  it("辞書の鍵に「さんの番」が無い・畳みの行は「{who}の番 {n}件」", () => {
    expect(KEYS.filter((k) => k.includes("さんの番"))).toEqual([]);
    expect(KEYS).toContain("{who}の番 {n}件");
  });

  it("コード（注も）に「さんの番」が無い・届けの束の名前に「{name}さん」を付けない", () => {
    expect(sources(SRC).filter((f) => fs.readFileSync(f, "utf8").includes("さんの番")).map((f) => path.relative(SRC, f))).toEqual([]);
    expect(fs.readFileSync(path.join(__dirname, "BirthTripCard.tsx"), "utf8")).not.toMatch(/t\("\{name\}さん"/);
  });
});

describe("初めての人に分かりにくい言葉を画面に出さない", () => {
  it("辞書の鍵に「手帳の機械」「機械で確かめた事」が無く、言い換えた言葉がある", () => {
    expect(KEYS.filter((k) => k.includes("手帳の機械") || k.includes("機械で確かめた事"))).toEqual([]);
    expect(KEYS).toContain("手帳が記録と日付から確かめた事");
  });
});
