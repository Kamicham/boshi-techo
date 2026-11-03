// 体の判断をしない約束: 手帳の画面に出す決まりの文言に、判定の言葉を入れない（なりきり第3回で「異常」の字が怖いと言われた）
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEVELOPMENT_NOTE, GROWTH_NOTE, STOOL_NOTE, CONSULT_QUESTION } from "./techo";

const JUDGE = /異常|正常|ふつう|大丈夫です|問題ありません/;

describe("判定の言葉を出さない", () => {
  it("手帳の注意書き", () => {
    for (const s of [GROWTH_NOTE, DEVELOPMENT_NOTE, STOOL_NOTE, CONSULT_QUESTION]) expect(s).not.toMatch(JUDGE);
  });
  it("手帳の画面の部品（コメントを除く文字）", () => {
    const dir = join(__dirname, "../components/techo");
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".tsx"))) {
      const code = readFileSync(join(dir, f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
      expect(code, f).not.toMatch(JUDGE);
    }
  });
});
