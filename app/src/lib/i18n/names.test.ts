// 名前を画面の言葉で書く（lib/i18n/names.ts）の試験。日本語は1字も変えない
import { describe, expect, it } from "vitest";
import { registrationLine } from "../../components/today/welcome";
import { msWords } from "./milestone-words";
import { DEMO_FAMILY } from "../demo-family";
import { scheduleFor } from "../milestones";
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
    // 見本の記録で話した人（美咲の母）
    expect(at("en", () => nameIn("和子"))).toBe("Kazuko");
    expect(at("en", () => labelIn("ママ（美咲）"))).toBe("Mom (Misaki)");
    expect(at("en", () => labelIn("パートナー（翔太）"))).toBe("Partner (Shota)");
    expect(at("en", () => labelIn("ママ"))).toBe("Mom");
  });
  it("中文: 名前は日本語のまま。ばあば・じいじは作った家族の時だけ 外婆・爷爷（本物の家族は父方か母方か分からない）", () => {
    expect(at("zh", () => [nameIn("ひなた"), nameIn("美咲"), nameIn("ばあば"), nameIn("じいじ")])).toEqual(["ひなた", "美咲", "ばあば", "じいじ"]);
    expect(at("zh", () => [nameIn("ばあば", { made: true }), nameIn("じいじ", { made: true })])).toEqual(["外婆", "爷爷"]);
    expect(at("zh", () => labelIn("ママ（美咲）"))).toBe("妈妈（美咲）");
  });
  it("出生届の一言（いまの「ようこそ」の1枚）も、English は名前をローマ字で", () => {
    const m = scheduleFor(DEMO_FAMILY, DEMO_FAMILY.birthDate!).find((x) => x.id === "birth-registration")!;
    const [mother, partner] = DEMO_FAMILY.members;
    const toPartner = { ...m, status: "今やる" as const, who: "パートナー" as const };
    const en = at("en", () => registrationLine(DEMO_FAMILY, mother, toPartner));
    expect(en).toContain("Shota's turn");
    expect(at("en", () => registrationLine(DEMO_FAMILY, partner, { ...m, status: "今やる" as const }))).toContain("So Misaki can rest.");
    expect(en).not.toMatch(/翔太|美咲/);
    // 日本語は前と同じ
    expect(registrationLine(DEMO_FAMILY, mother, toPartner)).toContain("翔太の番です");
  });
  it("作った家族の id（見本・体験の写し・30家族・1000組）", () => {
    expect(["demo-sato", `try-${"a".repeat(32)}`, "sim-01", "pop-0001"].map(isMadeId)).toEqual([true, true, true, true]);
    expect(["mine", "h_123", "", null, undefined, "try-x"].map(isMadeId)).toEqual([false, false, false, false, false, false]);
  });
});

describe("予定の名前に入る呼び名", () => {
  it("English では見本の家族の呼び名をローマ字に（「Tell 翔太's work…」と漢字のまま出ていた）。日本語は1字も変えない", () => {
    expect(msWords("翔太の職場に生まれた事を伝える")).toBe("翔太の職場に生まれた事を伝える");
    expect(at("en", () => msWords("翔太の職場に生まれた事を伝える"))).toBe("Tell Shota's work the baby is born");
    expect(at("en", () => msWords("翔太の育休の始まりを早める"))).toBe("Move up the start of Shota's childcare leave");
    // 表に無い呼び名はそのまま
    expect(at("en", () => msWords("健太の職場に生まれた事を伝える"))).toBe("Tell 健太's work the baby is born");
    // 中文は漢字の名前のまま
    expect(at("zh", () => msWords("翔太の職場に生まれた事を伝える"))).toBe("告诉翔太的工作单位宝宝出生了");
  });
});
