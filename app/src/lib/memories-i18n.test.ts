// 思い出の言葉（アルバム・一冊・映画・未来の手紙）が、中文と English で訳される事（多言語化・思い出の画面）。
// 日本語の字は今までの試験（media・letters・film-plan・book-intro）が見る。ここでは同じ関数を3つの言葉で回し、日本語が前と同じ事も1回だけ確かめる
import { createElement, isValidElement, type ReactElement } from "react";
import { describe, expect, it } from "vitest";
import { t, withLang, type Lang } from "./i18n";
import { DICTS } from "./i18n/dicts";
import { tr } from "./i18n/rich";
import { bookIntro } from "./book-intro";
import { DEMO_FAMILY } from "./demo-family";
import { filmShots, letterLine } from "./film-plan";
import { openedNewsLine, opensLine } from "./letters-shared";
import { birthNewsText, keptLine, monthGroupOf, voiceTitle, voiceTitleShown } from "./media-shared";
import { dayLong, madeOf, monthDay, nameOf, parens, personOf } from "./memory-words";

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
      news2: "2年前的信开启了",
      newsBelly: "怀孕时写的信开启了",
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
      news2: "A letter from 2 years ago is now open",
      newsBelly: "A letter from the pregnancy is now open",
      voice: "Aya, to the bump",
      letter: "A letter written on Mar 1, 2027, opened on Apr 26, 2028",
      day: "Nov 3, 2026",
      md: "Nov 3",
    });
  });

  it("誕生日の札の手紙と一冊の行（デモの会話が見つけた④・2026-11-06）: 書き手は画面の言葉の呼び名、開いた事は is now open・开启了", () => {
    // components/today/BirthdayCard.tsx と同じ組み方（書き手は personOf。前は childView で、English に「ママ（美咲）」が残った）
    // 手紙の知らせの札（LetterNews.tsx）の下の行も同じ（書き手は personOf・宛先は nameOf＝アルバムのみんなの章と同じ）
    const birthday = () => [
      t("💌 {from}からの手紙が開きました", { from: personOf(DEMO_FAMILY, "美咲") }),
      t("📖 この1年を一冊で読む"),
      t("📖 この2年を一冊で読む"),
      t("{from}から {to}へ", { from: personOf(DEMO_FAMILY, "美咲"), to: nameOf(DEMO_FAMILY, "ひなた") }),
    ];
    expect(inLang("ja", birthday)).toEqual(["💌 ママ（美咲）からの手紙が開きました", "📖 この1年を一冊で読む", "📖 この2年を一冊で読む", "ママ（美咲）から ひなたへ"]);
    expect(inLang("zh", birthday)).toEqual(["💌 妈妈（美咲）写的信开启了", "📖 在一本书里读第一年", "📖 在一本书里读前两年", "妈妈（美咲） 写给 ひなた"]);
    expect(inLang("en", birthday)).toEqual(["💌 A letter from Mom (Misaki) is now open", "📖 Read Year One as a book", "📖 Read Years One and Two as a book", "From Mom (Misaki) to Hinata"]);
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

  it("生まれた翌日に家族へ送る文は画面の言葉で組む（日本語は前と同じ字。名前は English でローマ字）", () => {
    const f = { birthDate: "2027-04-26", childName: "ひなた" };
    const noName = { birthDate: "2027-04-26" };
    expect(inLang("ja", () => [birthNewsText(f), birthNewsText(noName)])).toEqual(["うれしいお知らせです。4月26日に、ひなたが生まれました。", "うれしいお知らせです。4月26日に、赤ちゃんが生まれました。"]);
    expect(inLang("zh", () => [birthNewsText(f), birthNewsText(noName)])).toEqual(["跟大家分享一个好消息：ひなた在4月26日出生了。", "跟大家分享一个好消息：宝宝在4月26日出生了。"]);
    expect(inLang("en", () => [birthNewsText(f), birthNewsText(noName)])).toEqual(["Some happy news: Hinata was born on April 26.", "Some happy news: the baby was born on April 26."]);
  });

  it("tr() は訳した文の {名前} に部品を差し込む（語の順が変わっても部品は1つ）", () => {
    const parts = (lang: Lang) =>
      inLang(lang, () => (tr("写真 {n} 枚", { n: createElement("b", null, "12") }) as ReactElement<{ children: unknown[] }>).props.children.map((c) => (isValidElement(c) ? "<b>" : c)));
    expect(parts("ja")).toEqual(["写真 ", "<b>", " 枚"]);
    expect(parts("zh")).toEqual(["照片 ", "<b>", " 张"]);
    expect(parts("en")).toEqual(["Photos: ", "<b>"]);
  });
});

// 家族のデータの名前を、思い出の画面（アルバム・一冊・映画・印刷）で画面の言葉に（lib/i18n/names.ts を memory-words の nameOf・personOf で通す）
describe("思い出の画面の名前", () => {
  const demo = DEMO_FAMILY; // 作った家族（美咲＝ママ・翔太＝パパ）
  const real = { ...DEMO_FAMILY, id: "mine" }; // 本物の家族（同じ名前でも、中文の ばあば は書いたまま）

  it("子どもから見た呼び名つきの札（ママ（美咲））と、名前1つ。日本語は1字も変えない", () => {
    const row = (f: typeof demo) => [personOf(f, "美咲"), personOf(f, "翔太"), personOf(f, "ばあば"), nameOf(f, "ひなた"), nameOf(f, "じいじ")];
    expect(inLang("ja", () => row(demo))).toEqual(["ママ（美咲）", "パパ（翔太）", "ばあば", "ひなた", "じいじ"]);
    expect(inLang("en", () => row(demo))).toEqual(["Mom (Misaki)", "Dad (Shota)", "Grandma", "Hinata", "Grandpa"]);
    expect(inLang("en", () => row(real))).toEqual(["Mom (Misaki)", "Dad (Shota)", "Grandma", "Hinata", "Grandpa"]);
    // 中文: ばあば・じいじは作った家族の時だけ 外婆・爷爷（本物の家族は父方か母方か分からないので書いたまま）
    expect(inLang("zh", () => row(demo))).toEqual(["妈妈（美咲）", "爸爸（翔太）", "外婆", "ひなた", "爷爷"]);
    expect(inLang("zh", () => row(real))).toEqual(["妈妈（美咲）", "爸爸（翔太）", "ばあば", "ひなた", "じいじ"]);
    expect(nameOf(demo, undefined)).toBeUndefined();
  });

  it("声の題の名前: サーバが作った題だけ画面の言葉で作り直す（保存する日本語の題は名前を変えない）", () => {
    const v = { title: "ばあばから ひなたへ", who: "ばあば", spokenTo: "ひなた" };
    expect(inLang("ja", () => voiceTitleShown(v, madeOf(demo)))).toBe("ばあばから ひなたへ");
    expect(inLang("en", () => voiceTitleShown(v, madeOf(demo)))).toBe("From Grandma to Hinata");
    expect(inLang("zh", () => voiceTitleShown(v, madeOf(demo)))).toBe("外婆对ひなた说的话");
    expect(inLang("zh", () => voiceTitleShown(v, madeOf(real)))).toBe("ばあば对ひなた说的话");
    expect(inLang("ja", () => voiceTitle(v, { made: true }))).toBe("ばあばから ひなたへ");
    // 家族が付けた題はそのまま
    expect(inLang("en", () => voiceTitleShown({ ...v, title: "ばあばの子守唄" }, madeOf(demo)))).toBe("ばあばの子守唄");
  });

  it("映画のみんなの章: 一言の無い写真の「{name}から」も画面の言葉の名前で（書き出す動画＝日本語は前と同じ）", () => {
    const media = [
      { id: "p1", kind: "photo", date: "2027-05-01" },
      { id: "g1", kind: "photo", date: "2027-05-06", from: { name: "ばあば" } },
    ];
    const film = [{ mediaId: "p1", sec: 4, caption: "一", voiceId: "" }];
    const caps = (lang: Lang, made: boolean) => inLang(lang, () => filmShots(film, media, [], { made }).flatMap((s) => (s.kind === "photo" ? [s.caption] : [])));
    expect(caps("ja", true)).toEqual(["一", "ばあばから"]);
    expect(inLang("ja", () => filmShots(film, media).flatMap((s) => (s.kind === "photo" ? [s.caption] : [])))).toEqual(["一", "ばあばから"]);
    expect(caps("en", true)).toEqual(["一", "From Grandma"]);
    expect(caps("zh", true)).toEqual(["一", "来自外婆"]);
    expect(caps("zh", false)).toEqual(["一", "来自ばあば"]);
  });
});
