// 長い悪い入力でも、宛先を分ける・空欄を探すのが一瞬で終わる（2026-11-07 Claude Security の F2 と全体監査の実測）。
// 前は main 0a02166 で、宛先2万字の表示1回に1秒（空白の並び）〜1時間近く（「(cc」＋空白＝三乗）、本文2万字で3〜14秒、
// イベントループが塞がった（公開版では匿名の体験の人も下書きを直せる）。直した後も、宛先の分け方は前と同じ。
import { describe, expect, it, vi } from "vitest";
import { findBlanks } from "./blanks";
import { splitTo } from "./drafts";

vi.mock("server-only", () => ({}));

const N = 20_000;
const BAD: Record<string, string> = {
  "空白の並び＋x": " ".repeat(N - 1) + "x",
  "英字の並び（@ が無い）": "a".repeat(N),
  "読点の並び＋x": "、".repeat(N - 1) + "x",
  "(cc＋空白の並び": "(cc" + " ".repeat(N - 3),
  "日付の空欄「【 】月【 】日」×2500": "【 】月【 】日".repeat(2500),
  "名前の無い空欄「【】」×1万（1行）": "【】".repeat(N / 2),
  "名前の無い空欄「【】」を1行ずつ1万行": "【】\n".repeat(10_000),
  "空欄60個の後に日付の空欄2000個": "【】".repeat(60) + "【 】月【 】日".repeat(2000),
};

const took = (f: () => unknown) => {
  const t = performance.now();
  f();
  return performance.now() - t;
};

describe("長い悪い入力（F2）", () => {
  for (const [label, s] of Object.entries(BAD)) {
    it(`${label}: 宛先を分けるのも、宛先・件名・本文の空欄を探すのも 50ms 以内`, () => {
      expect(took(() => splitTo(s))).toBeLessThan(50);
      expect(took(() => findBlanks({ to: s, title: s, body: s }))).toBeLessThan(50);
    });
  }

  it("1つの欄で見る空欄は60まで", () => {
    expect(findBlanks({ to: "", title: "", body: "【】".repeat(100) })).toHaveLength(60);
  });
});

describe("宛先の分け方は前と同じ（main 0a02166 の splitTo と、よくある形10件・ランダム2万件で突き合わせた）", () => {
  it.each([
    ["株式会社さくら 人事部 田中様 <tanaka@sakura.co.jp>", { name: "株式会社さくら 人事部 田中様", email: "tanaka@sakura.co.jp", cc: "" }],
    ["【会社名】 【部署名】 【上司の名前】様（CC：【人事のメールアドレス】）", { name: "【会社名】 【部署名】 【上司の名前】様", email: "", cc: "【人事のメールアドレス】" }],
    ["宛先: 山田課長（yamada@example.co.jp）", { name: "山田課長", email: "yamada@example.co.jp", cc: "" }],
    ["田中部長 / tanaka@x.jp、", { name: "田中部長", email: "tanaka@x.jp", cc: "" }],
    ["株式会社さくら\n人事部\n\n田中様 \n", { name: "株式会社さくら 人事部 田中様", email: "", cc: "" }],
    ["(cc: boss@x.jp) 山田様", { name: "山田様", email: "boss@x.jp", cc: "" }],
  ])("%s", (to, want) => {
    expect(splitTo(to)).toEqual(want);
  });
});
