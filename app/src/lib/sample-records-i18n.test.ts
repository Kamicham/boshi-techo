// 見本の家族が話す・撮るで残した記録（作った記録20件）の訳（多言語化⑤・2026-11-05）: lib/i18n/dict/sample-records.ts と lib/sample-records-i18n.ts。
// 種（lib/capture.ts の seedItems）の題と本文のすべてに中文と English の訳があり、数・名前・字がそろう事（sample-media-i18n.test.ts と同じ決まり）。
// 日本語の時・家族が書いた記録・直した記録は、受け取った物をそのまま返す事。Claude に渡す記録（気づき・手帳に聞く）は訳さない事
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { RecordData } from "./capture";
import type { Entries } from "./i18n";
import { AREAS } from "./i18n/dicts";
import sampleBooks from "./i18n/dict/sample-books";
import sampleMedia from "./i18n/dict/sample-media";
import sampleRecords from "./i18n/dict/sample-records";
import { localizeSeedRecord, sampleRecordLine } from "./sample-records-i18n";

vi.mock("server-only", () => ({}));

const LANGS = ["zh", "en"] as const;
const SR: Entries = sampleRecords;
const SRC_DIR = path.join(__dirname, "..");
// 種の文は、種のファイルの字から拾う（seedItems は置き場に書く関数の隣にあるので、ここでは呼ばない）
const CAPTURE = fs.readFileSync(path.join(__dirname, "capture.ts"), "utf8");
const SEED = CAPTURE.slice(CAPTURE.indexOf("function seedItems"), CAPTURE.indexOf("export function seedDemo"));
const ITEMS = [...SEED.matchAll(/title: "([^"]+)", detail: "([^"]+)"/g)].map((m) => ({ title: m[1], detail: m[2] }));
const ALL = [...new Set(ITEMS.flatMap((i) => [i.title, i.detail]))];
const pairs = () => ALL.flatMap((ja) => LANGS.map((lang) => ({ ja, lang, v: sampleRecordLine(lang, ja) })));

const outside = (s: string) => s.replace(/（[^）]*）|\([^)]*\)/g, "");
const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** 日本でよく使い、簡体字では別の形になる字（sample-book-i18n.test.ts と同じ一覧） */
const JP_FORMS = new Set(
  "児険帳応対経済証様気時間図読話記録書際歳頼続診検査産業給費療転両親級訪問車婦週齢誕聞帯開閉戻選択終確認願見語葉変換設員帰発達長動働務職場円億違遅過関係実験計収払預銀郵電後飲脈楽薬歯熱圧陣師護増減個単階歩毎誰頭顔髪膚涼湯風漢訳説調報連絡線鉄県窓庁込枠頃駅為",
);
/** 中文に仮名のまま残す言葉（子の名前と、赤ちゃんの言葉そのもの。sample-book-i18n.test.ts と同じ） */
const ZH_KANA_OK = ["ひなちゃん", "ひなた", "まんま"];
const numbers = (s: string, lang: "ja" | "zh" | "en") =>
  (
    (lang === "en" ? s.replace(/\b(one|first)\b/gi, " 1 ").replace(/\b(two|second)\b/gi, " 2 ") : lang === "zh" ? s.replace(/两/g, " 2 ") : s).match(/\d+/g) ?? []
  ).map(Number);
const NAMES = [
  { ja: "美咲", zh: "美咲", en: "Misaki" },
  { ja: "翔太", zh: "翔太", en: "Shota" },
  { ja: "和子", zh: "和子", en: "Kazuko" },
  { ja: "ひなた", zh: "ひなた", en: "Hinata" },
] as const;

describe("見本の家族の記録（話す・撮るの時系列）の訳", () => {
  it("種の20件の題と本文のすべてに、中文と English の訳がある（この辞書か、見本の一冊・画面の辞書で）", () => {
    expect(ITEMS).toHaveLength(20);
    expect(pairs().filter((p) => !p.v.trim() || p.v === p.ja).map((p) => `${p.lang}: ${p.ja}`)).toEqual([]);
  });

  it("辞書の鍵はどれも種で使う・見本の一冊・写真の一言・画面の辞書（AREAS）とは鍵が重ならない・AREAS に入れない", () => {
    const used = new Set(ALL);
    expect(Object.keys(SR).filter((k) => !used.has(k))).toEqual([]);
    const other = new Set([...Object.keys(sampleBooks), ...Object.keys(sampleMedia), ...Object.values(AREAS).flatMap((e) => Object.keys(e))]);
    expect(Object.keys(SR).filter((k) => other.has(k))).toEqual([]);
    expect(Object.values(AREAS)).not.toContain(sampleRecords);
  });

  it("訳に日本語が残らない（English に仮名・漢字・日本語の句読点が無い。中文の仮名は子の名前と「まんま」だけ・日本の字体と「」が無い）・数と名前がそろう", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) {
      const o = outside(v);
      if (lang === "en") {
        if (KANA.test(o) || /\p{Script=Han}/u.test(o)) bad.push(`en に仮名か漢字: ${v}`);
        if (/[、。「」『』・！？：（）〜]/.test(o)) bad.push(`en に日本語の句読点: ${v}`);
      } else {
        if (KANA.test(ZH_KANA_OK.reduce((x, w) => x.split(w).join(""), o))) bad.push(`zh に仮名: ${v}`);
        const jp = [...new Set([...o].filter((c) => JP_FORMS.has(c)))];
        if (jp.length) bad.push(`zh に日本の字体（${jp.join("")}）: ${v}`);
        if (/[「」『』]/.test(v)) bad.push(`zh の引用は “” で: ${v}`);
      }
      const have = numbers(v, lang);
      for (const n of numbers(ja, "ja")) if (!have.includes(n)) bad.push(`${lang}: ${n} が無い: ${ja}`);
      for (const n of NAMES) if (ja.includes(n.ja) && !v.includes(n[lang])) bad.push(`${lang}: 「${n.ja}」→「${n[lang]}」が無い: ${v}`);
    }
    expect(bad).toEqual([]);
  });
});

describe("作った記録を頼みの言葉で返す（lib/sample-records-i18n.ts・/api/capture の GET）", () => {
  const rec = (data: Partial<RecordData>) => ({ id: "r1", date: "2027-01-01", data: { kind: "できごと", source: "voice", title: "", detail: "", ...data } as RecordData });

  it("日本語の時・家族が書いた記録・直した記録は、受け取った物をそのまま返す", () => {
    const seed = rec({ seed: true, title: "初めての胎動", detail: "ソファで休んでいたら、おなかの中でポコッと。泡がはじけるみたいだった。" });
    expect(localizeSeedRecord(seed, "ja")).toBe(seed);
    const own = rec({ title: "初めての胎動", detail: "ソファで休んでいたら、おなかの中でポコッと。泡がはじけるみたいだった。" });
    for (const lang of LANGS) expect(localizeSeedRecord(own, lang)).toBe(own);
    const edited = rec({ seed: true, title: "家族が直した題", detail: "家族が直した本文" });
    for (const lang of LANGS) expect(localizeSeedRecord(edited, lang)).toBe(edited);
  });

  it("中文・English: 作った記録の題と本文が訳になり、ほかの欄と元の行は変わらない", () => {
    for (const lang of LANGS) {
      const r = rec({ seed: true, title: "出生届を出した", detail: "翔太が区役所へ。14日以内に間に合った。", who: "翔太", source: "text", kind: "書類" });
      const before = structuredClone(r);
      const out = localizeSeedRecord(r, lang);
      expect(r).toEqual(before);
      expect(out.data.title).toBe(SR["出生届を出した"][lang]);
      expect(out.data.detail).toBe(SR["翔太が区役所へ。14日以内に間に合った。"][lang]);
      expect({ ...out.data, title: r.data.title, detail: r.data.detail }).toEqual(r.data);
      // 見本の一冊の辞書にある題（名前を「ひなた」に決めた）も訳になる
      expect(localizeSeedRecord(rec({ seed: true, title: "名前を「ひなた」に決めた", detail: "" }), lang).data.title).toBe(lang === "en" ? "We named you “Hinata”" : "决定了名字叫“ひなた”");
    }
  });

  it("訳すのは /api/capture の GET だけ。Claude に渡す記録（気づき・手帳に聞く）は日本語のまま", () => {
    expect(fs.readFileSync(path.join(SRC_DIR, "app/api/capture/route.ts"), "utf8")).toMatch(/listRecords\(family\.id\)\.map\(\(r\) => localizeSeedRecord\(r, lang\)\)/);
    for (const f of ["app/api/advisor/route.ts", "lib/ask/tools.ts", "lib/capture.ts"]) expect(fs.readFileSync(path.join(SRC_DIR, f), "utf8"), f).not.toMatch(/sample-records-i18n|localizeSeedRecord/);
  });
});
