// 辞書の決まり（lib/i18n/dict/・2026-11-05 多言語化 (d)・統括の頼み）。UX の i18n.test.ts が見る所
// （鍵が重ならない・差し込みの名前・空の訳・訳にかな・用語集の訳）には重ねず、その外を見る:
// ① 訳がそろう: すべての鍵に zh と en がある（片方だけの行は、その言葉の画面で日本語のまま出る）
// ② 差し込みの形: fill() が読めない書き方（{n:day} の | 抜け・閉じ忘れ・全角の｛｝）が無い。鍵の {n} は訳でもそのまま出す
//    （{n:day|days} だけにすると数が消える）。数の形 {n:…|…} は英語の訳だけ（日本語と中文に数の形は無い）
// ③ 訳に日本語が残らない（かなの外）: 英語に漢字・日本語の句読点が無い。中文に日本の字体（児・険・帳…）が無い
// どれも、括弧の中に並べた日本語は除く（UX の試験と同じ扱い）
import { describe, expect, it } from "vitest";
import type { Entries, Entry } from ".";
import { AREAS } from "./dicts";
import { GLOSSARY } from "./glossary";

type Row = { area: string; key: string; e: Entry };
const LANGS = ["zh", "en"] as const;
const rowsOf = (areas: Readonly<Record<string, Entries>>): Row[] =>
  Object.entries(areas).flatMap(([area, entries]) => Object.entries(entries).map(([key, e]) => ({ area, key, e })));

/** 括弧の中（並べた日本語）を除いた所 */
const outside = (s: string) => s.replace(/（[^）]*）|\([^)]*\)/g, "");
/** 日本でよく使い、簡体字では別の形になる字（中文の訳に残っていたら訳し忘れ。児→儿・険→险・帳→帐 など） */
const JP_FORMS = new Set(
  "児険帳応対経済証様気時間図読話記録書際歳頼続診検査産業給費療転両親級訪問車婦週齢誕聞帯開閉戻選択終確認願見語葉変換設員帰発達長動働務職場円億違遅過関係実験計収払預銀郵電後飲脈楽薬歯熱圧陣師護増減個単階歩毎誰頭顔髪膚涼湯風漢訳説調報連絡線鉄県窓庁込枠頃駅為",
);

// fill()（lib/i18n/index.ts）と同じ読み方: {名前} と {名前:1の時|ほか}
const SLOT = /\{(\w+)(?::([^|{}]*)\|([^{}]*))?\}/g;
function slots(s: string) {
  const plain = new Set<string>();
  const plural = new Set<string>();
  const rest = s.replace(SLOT, (_whole, name: string, one?: string) => {
    (one === undefined ? plain : plural).add(name);
    return "";
  });
  return { plain, plural, rest };
}

function missing(rows: Row[]): string[] {
  return rows.flatMap(({ area, key, e }) => LANGS.filter((l) => typeof e[l] !== "string").map((l) => `${area}: 「${key}」に ${l} が無い`));
}

function slotProblems(rows: Row[]): string[] {
  const bad: string[] = [];
  for (const { area, key, e } of rows) {
    const k = slots(key);
    if (/[{}｛｝]/.test(k.rest)) bad.push(`${area}: 鍵「${key}」に読めない {…} がある`);
    if (k.plural.size) bad.push(`${area}: 鍵「${key}」に数の形 {…:…|…} がある（数の形は英語の訳だけ）`);
    for (const lang of LANGS) {
      const v = e[lang];
      if (!v) continue;
      const s = slots(v);
      if (/[{}｛｝]/.test(s.rest)) bad.push(`${area}: 「${key}」の ${lang} に読めない {…} がある（画面にそのまま出る）`);
      for (const n of k.plain) if (!s.plain.has(n)) bad.push(`${area}: 「${key}」の ${lang} に {${n}} が無い（数の形だけだと値が出ない）`);
      if (lang === "zh" && s.plural.size) bad.push(`${area}: 「${key}」の zh に数の形 {…:…|…} がある（数の形は英語の訳だけ）`);
    }
  }
  return bad;
}

// 中文の訳が鍵と同じ字でも、訳し忘れとは限らない（{n}件・保育所・住民票は中文でも同じ）ので、字体で見る
function leftJapanese(rows: Row[]): string[] {
  const bad: string[] = [];
  for (const { area, key, e } of rows) {
    if (e.en) {
      const en = outside(e.en);
      if (/\p{Script=Han}/u.test(en)) bad.push(`${area}: 「${key}」の en に漢字が残る`);
      if (/[、。「」『』・]/.test(en)) bad.push(`${area}: 「${key}」の en に日本語の句読点が残る`);
    }
    if (e.zh) {
      const jp = [...new Set([...outside(e.zh)].filter((c) => JP_FORMS.has(c)))];
      if (jp.length) bad.push(`${area}: 「${key}」の zh に日本の字体（${jp.join("")}）が残る`);
    }
  }
  return bad;
}

const rows = rowsOf(AREAS);

describe("辞書の決まり（UX の i18n.test.ts の外）", () => {
  it("① すべての鍵に zh と en がある（片方だけだと、その言葉の画面で日本語のまま出る）", () => {
    expect(rows.length).toBeGreaterThan(0);
    expect(missing(rows)).toEqual([]);
  });

  it("② 差し込みの形が3つの言葉でそろう（fill() が読める・鍵の {n} は訳でもそのまま出る・数の形は英語だけ）", () => {
    expect(slotProblems(rows)).toEqual([]);
  });

  it("③ 訳に日本語が残らない（英語に漢字と日本語の句読点・中文に日本の字体。括弧の中は除く）", () => {
    expect(leftJapanese(rows)).toEqual([]);
    // 字体の一覧に、簡体字でも使う字を入れていない（用語集の中文の正の訳で確かめる）
    for (const g of GLOSSARY) for (const w of [g.zh, ...(g.zhAlt ?? [])]) expect([...w].filter((c) => JP_FORMS.has(c)), w).toEqual([]);
  });

});

describe("辞書の決まりの見方（わざと崩した行で、見落とさない事を確かめる）", () => {
  const bad = rowsOf({
    x: {
      片方だけ: { zh: "只有一种" },
      "あと{n}日": { zh: "还有{n}天", en: "{n:day|days} left" },
      "{n}件": { zh: "{n}件", en: "{n:item} items" },
      "残り{n}回": { zh: "还剩{n:次|次}", en: "{n} more ｛time｝" },
      出生届を出す: { zh: "提交出生登记", en: "Submit the birth registration" },
      児童手当: { zh: "児童手当", en: "Child allowance「児童手当」" },
      保育所: { zh: "保育所", en: "daycare center (保育所)" },
      "住民票を取る": { zh: "领取住民票", en: "Get a certificate of residence (住民票)" },
      健康保険証: { zh: "健康保险证（健康保険証）", en: "health insurance card (健康保険証)" },
    },
  });

  it("① 訳が片方だけの行を拾う", () => {
    expect(missing(bad)).toEqual(["x: 「片方だけ」に en が無い"]);
  });

  it("② 数が消える訳・読めない {…}・中文の数の形を拾う", () => {
    expect(slotProblems(bad)).toEqual([
      "x: 「あと{n}日」の en に {n} が無い（数の形だけだと値が出ない）",
      "x: 「{n}件」の en に読めない {…} がある（画面にそのまま出る）",
      "x: 「{n}件」の en に {n} が無い（数の形だけだと値が出ない）",
      "x: 「残り{n}回」の zh に {n} が無い（数の形だけだと値が出ない）",
      "x: 「残り{n}回」の zh に数の形 {…:…|…} がある（数の形は英語の訳だけ）",
      "x: 「残り{n}回」の en に読めない {…} がある（画面にそのまま出る）",
    ]);
  });

  it("③ 英語に残った漢字と句読点・中文に残った日本の字体を拾う（中文でも同じ字の {n}件・保育所・括弧の中は通す）", () => {
    expect(leftJapanese(bad)).toEqual([
      "x: 「児童手当」の en に漢字が残る",
      "x: 「児童手当」の en に日本語の句読点が残る",
      "x: 「児童手当」の zh に日本の字体（児）が残る",
    ]);
  });
});
