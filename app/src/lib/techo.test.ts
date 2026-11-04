// 体の判断をしない約束: 手帳の画面に出す決まりの文言に、判定の言葉を入れない（なりきり第3回で「異常」の字が怖いと言われた）
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { DEVELOPMENT_NOTE, GROWTH_NOTE, STOOL_ASIDE, STOOL_CHECKS, STOOL_NOTE, STOOL_NOTE_MORE, STOOL_RULE, CONSULT_QUESTION } from "./techo";

const JUDGE = /異常|正常|ふつう|大丈夫です|問題ありません/;

// 手帳の言葉として引く文は、府令様式（2026年4月施行版）の原文のまま。要約・言い換えをしたら、ここで止まる（2026-11-05 統括の決め）
describe("手帳の原文のまま", () => {
  it("便色カード（p.19）: 枠の2つ・本文・注記をそのまま持ち、手帳の文でない #8000 は入れない", () => {
    expect(STOOL_CHECKS).toEqual(["1番～3番に近い色だと思う", "4番～7番だったのが1番～3番に近くなった"]);
    expect(STOOL_RULE).toBe("どちらかが当てはまるときは、胆道閉鎖症などの病気の可能性がありますので、1日も早く小児科医、小児外科医等の診察を受けてください。");
    expect(STOOL_NOTE_MORE).toBe(
      "生後4か月くらいまでは、うんちの色に注意が必要です。生後2週を過ぎても皮膚や白目(しろめ)が黄色い場合、おしっこが濃い黄色の場合にも、すぐに医師等に相談しましょう。",
    );
    expect(STOOL_NOTE).toBe(`『${STOOL_CHECKS[0]}』『${STOOL_CHECKS[1]}』${STOOL_RULE}${STOOL_NOTE_MORE}`);
    expect(STOOL_NOTE).not.toMatch(/#8000|迷う/);
    expect(STOOL_ASIDE).toContain("#8000");
  });
  it("相談の問い（保護者の記録 p.18 ほか）", () => {
    expect(CONSULT_QUESTION).toBe("子育てについて気軽に相談できる人はいますか。");
  });
});

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
