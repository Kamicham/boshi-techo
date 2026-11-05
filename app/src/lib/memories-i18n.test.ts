// 思い出の言葉（アルバム・一冊・映画・未来の手紙）が、中文と English で訳される事（多言語化・思い出の画面）。
// 日本語の字は今までの試験（media・letters・film-plan・book-intro）が見る。ここでは同じ関数を3つの言葉で回し、日本語が前と同じ事も1回だけ確かめる
import { createElement, isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { withLang, type Lang } from "./i18n";
import { DICTS } from "./i18n/dicts";
import { tr } from "./i18n/rich";
import { bookIntro } from "./book-intro";
import { letterLine } from "./film-plan";
import { openedNewsLine, opensLine } from "./letters-shared";
import { keptLine, monthGroupOf, voiceTitle, voiceTitleShown } from "./media-shared";
import { dayLong, monthDay, parens } from "./memory-words";

const inLang = <T,>(lang: Lang, fn: () => T) => withLang(lang, fn, DICTS[lang]);
const fam = { dueDate: "2027-05-10", birthDate: "2027-04-26" };
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;

const lines = () => ({
  kept: keptLine(fam, { date: "2027-08-03", milestone: "okuizome" }),
  keptPreg: keptLine(fam, { date: "2027-01-10" }),
  group: monthGroupOf(fam, "2027-08-03").label,
  group0: monthGroupOf(fam, "2027-04-28").label,
  groupPreg: monthGroupOf(fam, "2027-01-10").label,
  opens20: opensLine({ open: "20y", openOn: "2047-04-26" }),
  opensDate: opensLine({ open: "date", openOn: "2030-01-02" }),
  opensNow: opensLine({ open: "now", openOn: null }),
  news2: openedNewsLine({ sealedOn: "2027-06-01", openOn: "2029-06-02" }, fam),
  newsBelly: openedNewsLine({ sealedOn: "2027-03-01", openOn: "2028-04-26" }, fam),
  voice: voiceTitle({ moment: "belly", who: "Aya" }),
  letter: letterLine({ sealedOn: "2027-03-01", openOn: "2028-04-26" }),
  day: dayLong("2026-11-03"),
  md: monthDay("2026-11-03"),
});

describe("思い出の言葉を3つの言葉で", () => {
  it("日本語は前と同じ字（並べる鍵の月齢も日本語のまま）", () => {
    expect(inLang("ja", lines)).toEqual({
      kept: "8月3日・生後3か月・お食い初めのころ",
      keptPreg: "1月10日・妊娠6か月",
      group: "生後3か月（2027年7月26日〜）",
      group0: "生まれて1週間（2027年4月26日〜）",
      groupPreg: "妊娠6か月（2026年12月21日〜）",
      opens20: "20歳の誕生日に（2047年4月26日）開きます",
      opensDate: "2030年1月2日に開きます",
      opensNow: "いつでも読めます",
      news2: "2年前の手紙が開きました",
      newsBelly: "おなかにいた頃の手紙が開きました",
      voice: "Ayaから おなかへ",
      letter: "2027年3月1日に書いて、2028年4月26日に開いた手紙",
      day: "2026年11月3日",
      md: "11月3日",
    });
    // 並べる鍵は言葉で変わらない（中文・English でも同じ月にまとまる）
    expect(inLang("en", () => monthGroupOf(fam, "2027-08-03").key)).toBe(inLang("ja", () => monthGroupOf(fam, "2027-08-03").key));
  });

  it("中文（简体字）", () => {
    expect(inLang("zh", lines)).toEqual({
      kept: "8月3日 · 出生后3个月 · 百日初食礼前后",
      keptPreg: "1月10日 · 妊娠6个月",
      group: "出生后3个月（2027年7月26日起）",
      group0: "出生后第一周（2027年4月26日起）",
      groupPreg: "妊娠6个月（2026年12月21日起）",
      opens20: "在20岁生日（2047年4月26日）开启",
      opensDate: "2030年1月2日开启",
      opensNow: "随时都能读",
      news2: "2年前的信打开了",
      newsBelly: "怀孕时写的信打开了",
      voice: "Aya对肚子说的话",
      letter: "2027年3月1日写下、2028年4月26日打开的信",
      day: "2026年11月3日",
      md: "11月3日",
    });
  });

  it("English", () => {
    expect(inLang("en", lines)).toEqual({
      kept: "Aug 3 · 3 months old · around First-meal ceremony",
      keptPreg: "Jan 10 · Month 6 of pregnancy",
      group: "3 months old (from Jul 26, 2027)",
      group0: "First week after birth (from Apr 26, 2027)",
      groupPreg: "Month 6 of pregnancy (from Dec 21, 2026)",
      opens20: "Opens on the 20th birthday (Apr 26, 2047)",
      opensDate: "Opens on Jan 2, 2030",
      opensNow: "Can be read anytime",
      news2: "A letter from 2 years ago has opened",
      newsBelly: "A letter from the pregnancy has opened",
      voice: "Aya, to the bump",
      letter: "A letter written on Mar 1, 2027, opened on Apr 26, 2028",
      day: "Nov 3, 2026",
      md: "Nov 3",
    });
  });

  it("声の題: サーバが作ったままの題だけを作り直し、家族が付けた題はそのまま出す", () => {
    const made = { title: "Ayaから おなかへ", moment: "belly", who: "Aya" };
    expect(inLang("ja", () => voiceTitleShown(made))).toBe("Ayaから おなかへ");
    expect(inLang("zh", () => voiceTitleShown(made))).toBe("Aya对肚子说的话");
    expect(inLang("en", () => voiceTitleShown(made))).toBe("Aya, to the bump");
    expect(inLang("en", () => voiceTitleShown({ ...made, title: "はじめての笑い声" }))).toBe("はじめての笑い声");
    expect(inLang("en", () => voiceTitleShown({}))).toBe("Voice");
  });

  it("一冊の入口の言葉は、中文・English に仮名が残らない", () => {
    for (const lang of ["zh", "en"] as const)
      for (const o of [
        { childName: "Hana", count: 3, born: true, isDemo: false },
        { childName: null, count: 0, born: false, isDemo: false },
        { childName: "Hana", count: 12, born: true, isDemo: true, trial: true },
      ]) {
        const intro = inLang(lang, () => bookIntro(o));
        for (const [k, v] of Object.entries(intro)) if (typeof v === "string") expect(v, `${lang} ${k}`).not.toMatch(KANA);
      }
  });

  it("英語の文に差し込む書き手の名前は、全角の括弧を半角に（日本語・中文はそのまま）", () => {
    expect(inLang("en", () => parens("Claude Code（Claude Opus 5.5）"))).toBe("Claude Code (Claude Opus 5.5)");
    expect(inLang("zh", () => parens("Claude Code（Claude Opus 5.5）"))).toBe("Claude Code（Claude Opus 5.5）");
    expect(inLang("ja", () => parens("Claude Code（Claude Opus 5.5）"))).toBe("Claude Code（Claude Opus 5.5）");
  });

  it("tr() は訳した文の {名前} に部品を差し込む（語の順が変わっても部品は1つ）", () => {
    const parts = (lang: Lang) =>
      inLang(lang, () => (tr("写真 {n} 枚", { n: createElement("b", null, "12") }) as ReactElement<{ children: unknown[] }>).props.children.map((c) => (isValidElement(c) ? "<b>" : c)));
    expect(parts("ja")).toEqual(["写真 ", "<b>", " 枚"]);
    expect(parts("zh")).toEqual(["照片 ", "<b>", " 张"]);
    expect(parts("en")).toEqual(["Photos: ", "<b>"]);
  });
});
