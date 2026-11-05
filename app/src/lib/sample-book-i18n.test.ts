// 見本の一冊の訳（多言語化⑤・2026-11-05）: lib/i18n/dict/sample-books.ts の訳と、lib/sample-book-i18n.ts の差し替え。
// 4冊（lib/demo-books.json）のすべての文に中文と English の訳があり、数・用語集・名前と呼び名・段落と引用がそろう事。
// 日本語の時と、家族が作り直した一冊は、受け取った物をそのまま返す事
import { describe, expect, it, vi } from "vitest";
import type { Book, BookContent } from "./book";
import seeds from "./demo-books.json";
import type { Entries } from "./i18n";
import { AREAS, DICTS } from "./i18n/dicts";
import sampleBooks from "./i18n/dict/sample-books";
import { GLOSSARY } from "./i18n/glossary";
import { localizeSampleBook, sampleBookLine } from "./sample-book-i18n";

vi.mock("server-only", () => ({}));

type L = "zh" | "en";
const LANGS = ["zh", "en"] as const;
const SB: Entries = sampleBooks;
type Seed = { asOf: string; generatedAt: string; sourceCount: number; raw: BookContent };
const BOOKS = seeds as unknown as Seed[];

/** 一冊の訳す文（空の一言は除く） */
function linesOf(r: BookContent): string[] {
  return [
    r.title,
    r.dedication,
    r.closing,
    ...r.chapters.flatMap((c) => [c.title, c.text, ...c.moments.map((m) => m.text), ...c.photos.map((p) => p.line), ...c.voices.map((v) => v.line)]),
    ...r.film.map((x) => x.caption),
  ].filter(Boolean);
}
const ALL = [...new Set(BOOKS.flatMap((b) => linesOf(b.raw)))];

/** 訳（この辞書か、前からの辞書。お宮参り・ハーフバースデーは前からの辞書） */
const tr = (lang: L, s: string): string | undefined => SB[s]?.[lang] ?? DICTS[lang][s];
const pairs = () => ALL.flatMap((ja) => LANGS.map((lang) => ({ ja, lang, v: tr(lang, ja) ?? "" })));

/** 括弧の中（並べた日本語）を除いた所（dict-rules.test.ts と同じ） */
const outside = (s: string) => s.replace(/（[^）]*）|\([^)]*\)/g, "");
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** 日本でよく使い、簡体字では別の形になる字（dict-rules.test.ts と同じ一覧） */
const JP_FORMS = new Set(
  "児険帳応対経済証様気時間図読話記録書際歳頼続診検査産業給費療転両親級訪問車婦週齢誕聞帯開閉戻選択終確認願見語葉変換設員帰発達長動働務職場円億違遅過関係実験計収払預銀郵電後飲脈楽薬歯熱圧陣師護増減個単階歩毎誰頭顔髪膚涼湯風漢訳説調報連絡線鉄県窓庁込枠頃駅為",
);
/** 中文に仮名のまま残す言葉（子の名前と、赤ちゃんの言葉そのもの） */
const ZH_KANA_OK = ["ひなちゃん", "ひなた", "まんま"];

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
/** 文の中の数。English は月の名前と one/first・two/second・three/third を、中文は 两・满月（1か月）を数に直して数える */
function numbers(s: string, lang: "ja" | L): number[] {
  let x = s;
  if (lang === "en")
    x = x
      .replace(new RegExp(`\\b(${MONTHS.join("|")})\\b`, "g"), (m) => ` ${MONTHS.indexOf(m) + 1} `)
      .replace(/\b(one|first)\b/gi, " 1 ")
      .replace(/\b(two|second)\b/gi, " 2 ")
      .replace(/\b(three|third)\b/gi, " 3 ");
  if (lang === "zh") x = x.replace(/满月/g, " 1 ").replace(/两/g, " 2 ");
  return (x.match(/\d+/g) ?? []).map(Number);
}
const count = (xs: readonly number[]) => xs.reduce((m, n) => m.set(n, (m.get(n) ?? 0) + 1), new Map<number, number>());

/** 名前と呼び名（日本語 → 中文・English）。sample-books.ts の頭の決め事と同じ */
const NAMES: readonly { ja: string; zh: string; en: string }[] = [
  { ja: "美咲", zh: "美咲", en: "Misaki" },
  { ja: "翔太", zh: "翔太", en: "Shota" },
  { ja: "ひなちゃん", zh: "ひなちゃん", en: "Hina-chan" },
  { ja: "ひなた", zh: "ひなた", en: "Hinata" },
  { ja: "ママ", zh: "妈妈", en: "Mom" },
  { ja: "パパ", zh: "爸爸", en: "Dad" },
  { ja: "ばあば", zh: "外婆", en: "Grandma" },
  { ja: "じいじ", zh: "爷爷", en: "Grandpa" },
];

describe("見本の一冊の訳（lib/i18n/dict/sample-books.ts）", () => {
  it("4冊のすべての文に、中文と English の訳がある（この辞書か、前からの辞書で）", () => {
    expect(ALL.length).toBeGreaterThan(100);
    expect(pairs().filter((p) => !p.v.trim()).map((p) => `${p.lang}: ${p.ja.slice(0, 30)}`)).toEqual([]);
  });

  it("辞書の鍵はどれも4冊のどこかで使う・前からの辞書（AREAS）とは鍵が重ならない・AREAS に入れない（画面に送らない）", () => {
    const used = new Set(ALL);
    expect(Object.keys(SB).filter((k) => !used.has(k))).toEqual([]);
    const areaKeys = new Set(Object.values(AREAS).flatMap((e) => Object.keys(e)));
    expect(Object.keys(SB).filter((k) => areaKeys.has(k))).toEqual([]);
    expect(Object.values(AREAS)).not.toContain(sampleBooks);
    for (const e of Object.values(SB)) for (const lang of LANGS) expect(e[lang]?.trim(), JSON.stringify(e)).toBeTruthy();
  });

  it("訳に日本語が残らない: English に仮名・漢字・日本語の句読点が無い。中文の仮名は子の名前と「まんま」だけ・日本の字体と「」が無い（括弧の中は除く）", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) {
      const o = outside(v);
      if (lang === "en") {
        if (KANA.test(o) || /\p{Script=Han}/u.test(o)) bad.push(`en に仮名か漢字: ${v.slice(0, 40)}`);
        if (/[、。「」『』・！？：（）]/.test(o)) bad.push(`en に日本語の句読点: ${v.slice(0, 40)}`);
      } else {
        const rest = ZH_KANA_OK.reduce((s, w) => s.split(w).join(""), o);
        if (KANA.test(rest)) bad.push(`zh に仮名: ${v.slice(0, 40)}（${ja.slice(0, 20)}）`);
        const jp = [...new Set([...o].filter((c) => JP_FORMS.has(c)))];
        if (jp.length) bad.push(`zh に日本の字体（${jp.join("")}）: ${v.slice(0, 40)}`);
        if (/[「」『』]/.test(v)) bad.push(`zh の引用は “” で: ${v.slice(0, 40)}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("数が残る（日付・週数・月齢・歩数。日本語の数はどれも訳にある）", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) {
      const have = count(numbers(v, lang));
      for (const [n, k] of count(numbers(ja, "ja"))) if ((have.get(n) ?? 0) < k) bad.push(`${lang}: ${n} が ${k} 個要る（${(have.get(n) ?? 0)} 個）: ${ja.slice(0, 30)}`);
    }
    expect(bad).toEqual([]);
  });

  it("用語集の言葉は用語集の訳で。窓口の言葉（母子健康手帳・出生届）は日本語も並べる", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs())
      for (const g of GLOSSARY) {
        const w = [g.ja, ...(g.jaAlt ?? [])].find((x) => ja.includes(x));
        if (!w) continue;
        const words = [g[lang], ...((lang === "zh" ? g.zhAlt : g.enAlt) ?? [])];
        if (!words.some((x) => v.toLowerCase().includes(x.toLowerCase()))) bad.push(`${lang}: 「${w}」→「${words.join("／")}」が無い: ${v.slice(0, 40)}`);
        if (g.counter && !v.includes(w)) bad.push(`${lang}: 窓口の言葉「${w}」を括弧で並べていない: ${v.slice(0, 40)}`);
      }
    expect(bad).toEqual([]);
  });

  it("名前と呼び名がそろう（中文は日本語の名前のまま、English はローマ字。ママ＝妈妈／Mom・ばあば＝外婆／Grandma など）", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) for (const n of NAMES) if (ja.includes(n.ja) && !v.includes(n[lang])) bad.push(`${lang}: 「${n.ja}」→「${n[lang]}」が無い: ${v.slice(0, 40)}`);
    expect(bad).toEqual([]);
    // ママとパパの書き方の一冊（1歳）には、訳でも美咲・翔太の名が出ない
    const y1 = BOOKS.find((b) => linesOf(b.raw).some((s) => s.includes("ママ")))!;
    for (const lang of LANGS) {
      const all = linesOf(y1.raw)
        .map((s) => tr(lang, s) ?? "")
        .join("\n");
      expect(all).not.toMatch(/美咲|翔太|Misaki|Shota/);
    }
  });

  it("段落の数（改行2つ）がそろい、引用は落とさない（「」の数だけ “” があり、“ と ” の数が合う）", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) {
      if (ja.split("\n\n").length !== v.split("\n\n").length) bad.push(`${lang}: 段落の数が違う: ${ja.slice(0, 30)}`);
      const open = (v.match(/“/g) ?? []).length;
      if ((ja.match(/「/g) ?? []).length > open) bad.push(`${lang}: 引用が落ちた: ${ja.slice(0, 30)}`);
      if (open !== (v.match(/”/g) ?? []).length) bad.push(`${lang}: “ と ” の数が合わない: ${v.slice(0, 40)}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("見本の一冊を頼みの言葉で返す（lib/sample-book-i18n.ts・/api/book）", () => {
  const asBook = (s: Seed): Book => ({
    ...structuredClone(s.raw),
    familyId: "demo-sato",
    asOf: s.asOf,
    generatedAt: s.generatedAt,
    sourceCount: s.sourceCount,
    range: { start: "2026-08-03", end: "2029-04-26" },
    childName: "ひなた",
    bundled: true,
  });

  it("日本語の時・家族が作り直した一冊（bundled でない）・一冊が無い時は、受け取った物をそのまま返す", () => {
    for (const s of BOOKS) {
      const b = asBook(s);
      expect(localizeSampleBook(b, "ja")).toBe(b);
      const own = { ...b, bundled: undefined };
      for (const lang of LANGS) expect(localizeSampleBook(own, lang)).toBe(own);
    }
    expect(localizeSampleBook(null, "en")).toBeNull();
    expect(sampleBookLine("ja", BOOKS[0].raw.title)).toBe(BOOKS[0].raw.title);
    expect(sampleBookLine("en", "辞書に無い文")).toBe("辞書に無い文");
  });

  it("中文・English: すべての文が訳になり、時期・日付・写真と声の番号・秒数は変わらない。宛名は English だけローマ字。元の一冊は変えない", () => {
    for (const s of BOOKS)
      for (const lang of LANGS) {
        const b = asBook(s);
        const before = structuredClone(b);
        const out = localizeSampleBook(b, lang);
        expect(b).toEqual(before);
        expect(out.childName).toBe(lang === "en" ? "Hinata" : "ひなた");
        expect([out.title, out.dedication, out.closing]).toEqual([b.title, b.dedication, b.closing].map((x) => tr(lang, x)));
        expect(out.chapters.map((c) => c.period)).toEqual(b.chapters.map((c) => c.period));
        out.chapters.forEach((c, i) => {
          const o = b.chapters[i];
          expect([c.title, c.text]).toEqual([tr(lang, o.title), tr(lang, o.text)]);
          expect(c.moments).toEqual(o.moments.map((m) => ({ date: m.date, text: tr(lang, m.text) })));
          expect(c.photos).toEqual(o.photos.map((p) => ({ mediaId: p.mediaId, line: p.line ? tr(lang, p.line) : "" })));
          expect(c.voices).toEqual(o.voices.map((v) => ({ voiceId: v.voiceId, line: v.line ? tr(lang, v.line) : "" })));
        });
        expect(out.film).toEqual(b.film.map((x) => ({ ...x, caption: x.caption ? tr(lang, x.caption) : "" })));
        expect(out.cover).toBe(b.cover);
        if (lang === "en") for (const line of linesOf(out)) expect(outside(line), line).not.toMatch(KANA);
      }
  });
});
