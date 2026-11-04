// 頼れる所の #8000 の行に、「#」の番号につながらない時のふつうの番号を添える（急ぎの時の画面と同じ番号。表は lib/emergency-lines.ts の N8000）。
import { describe, expect, it } from "vitest";
import { N8000 } from "@/lib/emergency-lines";
import { helpRows } from "./help-rows";

const row8000 = (prefecture: string, city = "", loss = false) => helpRows({ prefecture, city }, true, loss).find((r) => r.href === "tel:%238000");

describe("頼れる所の #8000 の行（つながらない時のふつうの番号）", () => {
  it("家族の県が分かる時は、その県の #8000 のふつうの番号を添える", () => {
    expect(row8000("東京都", "世田谷区")?.alt).toEqual({ instead: "#8000", tel: N8000["東京都"], where: "東京都" });
    expect(row8000("埼玉県", "さいたま市")?.alt).toEqual({ instead: "#8000", tel: "048-833-7911", where: "埼玉県" });
  });

  it("県の名の「都・府・県」が無くても同じ県に寄せる", () => {
    expect(row8000("沖縄", "那覇市")?.alt).toEqual({ instead: "#8000", tel: "098-888-5230", where: "沖縄県" });
  });

  it("県が分からない時は添えない（#8000 の行は出す）", () => {
    expect(row8000("")).toBeDefined();
    expect(row8000("")?.alt).toBeUndefined();
    expect(row8000("どこか")?.alt).toBeUndefined();
  });

  it("#8000 の行のほかには添えない", () => {
    const withAlt = helpRows({ prefecture: "高知県", city: "高知市" }, false).filter((r) => r.alt);
    expect(withAlt.map((r) => r.href)).toEqual(["tel:%238000"]);
  });

  it("つらい別れのあと（loss）は、#8000 の行ごと出さない", () => {
    expect(row8000("東京都", "世田谷区", true)).toBeUndefined();
  });
});
