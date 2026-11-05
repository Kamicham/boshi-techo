// 名前を画面の言葉で書く（lib/i18n/names.ts）の試験。日本語は1字も変えない
import { describe, expect, it } from "vitest";
import { withLang, type Lang } from ".";
import { DICTS } from "./dicts";
import { isMadeId, labelIn, nameIn } from "./names";

const at = <T>(lang: Lang, fn: () => T): T => withLang(lang, fn, DICTS[lang]);

describe("名前を画面の言葉で", () => {
  it("日本語は1字も変えない", () => {
    for (const n of ["ひなた", "美咲", "翔太", "ばあば", "じいじ", "健太"]) {
      expect(nameIn(n)).toBe(n);
      expect(nameIn(n, { made: true })).toBe(n);
    }
    expect(labelIn("ママ（美咲）")).toBe("ママ（美咲）");
    expect(nameIn(undefined)).toBeUndefined();
  });
  it("English: 見本の家族の名前はローマ字、ばあば・じいじは Grandma・Grandpa。表に無い名前はそのまま", () => {
    expect(at("en", () => [nameIn("ひなた"), nameIn("美咲"), nameIn("翔太"), nameIn("ばあば"), nameIn("じいじ"), nameIn("健太")])).toEqual([
      "Hinata",
      "Misaki",
      "Shota",
      "Grandma",
      "Grandpa",
      "健太",
    ]);
    expect(at("en", () => labelIn("ママ（美咲）"))).toBe("Mom (Misaki)");
    expect(at("en", () => labelIn("パートナー（翔太）"))).toBe("Partner (Shota)");
    expect(at("en", () => labelIn("ママ"))).toBe("Mom");
  });
  it("中文: 名前は日本語のまま。ばあば・じいじは作った家族の時だけ 外婆・爷爷（本物の家族は父方か母方か分からない）", () => {
    expect(at("zh", () => [nameIn("ひなた"), nameIn("美咲"), nameIn("ばあば"), nameIn("じいじ")])).toEqual(["ひなた", "美咲", "ばあば", "じいじ"]);
    expect(at("zh", () => [nameIn("ばあば", { made: true }), nameIn("じいじ", { made: true })])).toEqual(["外婆", "爷爷"]);
    expect(at("zh", () => labelIn("ママ（美咲）"))).toBe("妈妈（美咲）");
  });
  it("作った家族の id（見本・体験の写し・30家族・1000組）", () => {
    expect(["demo-sato", `try-${"a".repeat(32)}`, "sim-01", "pop-0001"].map(isMadeId)).toEqual([true, true, true, true]);
    expect(["mine", "h_123", "", null, undefined, "try-x"].map(isMadeId)).toEqual([false, false, false, false, false, false]);
  });
});
