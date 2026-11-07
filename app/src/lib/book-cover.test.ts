// 一冊の表紙の期間と宛名（2026-11-06・デモの会話が見つけた⑤）: lib/memory-words の coverPeriod・coverTo。
// 「ひなたへ　1歳までの日々」の表紙が「2026年8月17日 — 2029年4月26日」（2歳の誕生日まで）と出て、
// 題の下にもう1度「ひなたへ」が出ていた。期間の終わりは中身の終わり（作った日）、宛名は題に無い時だけ
import { describe, expect, it } from "vitest";
import { conceptionDate, secondBirthday } from "./clock";
import DEMO_BOOKS from "./demo-books.json";
import { DEMO_FAMILY } from "./demo-family";
import sampleBooks from "./i18n/dict/sample-books";
import { coverPeriod, coverTitleParts, coverTo } from "./memory-words";

const RANGE = { start: conceptionDate(DEMO_FAMILY), end: secondBirthday(DEMO_FAMILY) };
const SB: Record<string, { zh: string; en: string }> = sampleBooks;

describe("一冊の表紙の期間（中身の終わりまで）", () => {
  it("見本の4冊とも、終わりはその一冊を作った日（1歳の一冊は 2028-04-26）。始まりは授かった日のまま", () => {
    const got = DEMO_BOOKS.map((b) => ({ title: b.raw.title, ...coverPeriod({ range: RANGE, asOf: b.asOf }) }));
    expect(got.map((g) => g.start)).toEqual(DEMO_BOOKS.map(() => RANGE.start));
    expect(got.map((g) => g.end)).toEqual(DEMO_BOOKS.map((b) => b.asOf));
    expect(got.find((g) => g.title === "ひなたへ　1歳までの日々")?.end).toBe("2028-04-26");
  });

  it("2歳の誕生日より後に作った一冊でも、終わりは2歳の誕生日（1000日の外へ伸ばさない）", () => {
    expect(coverPeriod({ range: RANGE, asOf: "2030-01-01" }).end).toBe(RANGE.end);
  });
});

describe("一冊の表紙の宛名（題に宛名がある時は重ねない）", () => {
  it("見本の4冊の題は、日本語・English・中文とも宛名を含むので、宛名の行を出さない", () => {
    for (const b of DEMO_BOOKS) {
      expect(coverTo(b.raw.title, "ひなたへ")).toBeNull();
      expect(coverTo(SB[b.raw.title].en, "To Hinata")).toBeNull();
      expect(coverTo(SB[b.raw.title].zh, "给ひなた")).toBeNull();
    }
  });

  it("題に宛名が無い一冊（本物の家族で Claude が別の題を書いた時）は、宛名の行を出す", () => {
    expect(coverTo("はじまりの1年", "ゆいへ")).toBe("ゆいへ");
    expect(coverTo("Our First Year", "To Yui")).toBe("To Yui");
  });
});

describe("一冊の表紙の題の空き（空きの所でだけ分けて全角ほどに広げる・英語の語の間は広げない）", () => {
  it("見本の4冊の題: 日本語と中文は宛名の後の空きで2つに分かれ、English は1つのまま（2026-11-07 English の語の間がどれも広く見えた）", () => {
    for (const b of DEMO_BOOKS) {
      const { zh, en } = SB[b.raw.title];
      expect(coverTitleParts(b.raw.title)).toEqual(["ひなたへ", b.raw.title.slice("ひなたへ".length).trim()]);
      expect(coverTitleParts(zh)).toEqual(["给ひなた", zh.split("\u3000")[1]]);
      expect(coverTitleParts(en)).toEqual([en]);
    }
  });

  it("半角の空白も、日本語・中文の字に接していれば空き。英語の語と語の間・英語と数字の間は空きにしない", () => {
    expect(coverTitleParts("ひなたへ はじまりの日々")).toEqual(["ひなたへ", "はじまりの日々"]);
    expect(coverTitleParts("To Hinata: Your First 1000 Days")).toEqual(["To Hinata: Your First 1000 Days"]);
    expect(coverTitleParts("Our First Year\u3000はじめての1年")).toEqual(["Our First Year", "はじめての1年"]);
    expect(coverTitleParts(" \u3000")).toEqual([]);
  });
});
