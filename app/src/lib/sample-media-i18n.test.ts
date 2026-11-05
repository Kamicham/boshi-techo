// 見本の家族の写真の一言と続柄の注の訳（多言語化・2026-11-05）: lib/i18n/dict/sample-media.ts と lib/sample-media-i18n.ts。
// 種（lib/demo-media.ts）の一言27行と続柄の注のすべてに中文と English の訳があり、数・名前・字がそろう事（sample-book-i18n.test.ts と同じ決まり）。
// 日本語の時・本物の家族の写真・書き直した一言は、受け取った物をそのまま返す事
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { Entries } from "./i18n";
import { AREAS } from "./i18n/dicts";
import sampleBooks from "./i18n/dict/sample-books";
import sampleMedia from "./i18n/dict/sample-media";
import type { MediaData } from "./media-shared";
import { localizeMadeMedia, sampleMediaLine } from "./sample-media-i18n";

vi.mock("server-only", () => ({}));

const LANGS = ["zh", "en"] as const;
const SM: Entries = sampleMedia;
// 種の文は、種のファイルの字から拾う（種の関数は置き場や鍵を読むので、ここでは呼ばない）
const SEED = fs.readFileSync(path.join(__dirname, "demo-media.ts"), "utf8");
const CAPTIONS = [...SEED.matchAll(/caption: "([^"]+)"/g)].map((m) => m[1]);
const RELATIONS = [...new Set([...SEED.matchAll(/relation: "([^"]+)"/g)].map((m) => m[1]))];
const ALL = [...new Set([...CAPTIONS, ...RELATIONS])];
const pairs = () => ALL.flatMap((ja) => LANGS.map((lang) => ({ ja, lang, v: sampleMediaLine(lang, ja) })));

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
] as const;

describe("見本の家族の写真の一言と続柄の注の訳", () => {
  it("種の一言27行と続柄の注2つのすべてに、中文と English の訳がある（この辞書か、見本の一冊・画面の辞書で）", () => {
    expect(CAPTIONS).toHaveLength(27);
    expect(RELATIONS).toEqual(["鹿児島・美咲の母", "大阪・翔太の父"]);
    expect(pairs().filter((p) => !p.v.trim() || p.v === p.ja).map((p) => `${p.lang}: ${p.ja}`)).toEqual([]);
  });

  it("辞書の鍵はどれも種で使う・見本の一冊の辞書と画面の辞書（AREAS）とは鍵が重ならない・AREAS に入れない", () => {
    const used = new Set(ALL);
    expect(Object.keys(SM).filter((k) => !used.has(k))).toEqual([]);
    const other = new Set([...Object.keys(sampleBooks), ...Object.values(AREAS).flatMap((e) => Object.keys(e))]);
    expect(Object.keys(SM).filter((k) => other.has(k))).toEqual([]);
    expect(Object.values(AREAS)).not.toContain(sampleMedia);
  });

  it("訳に日本語が残らない（English に仮名・漢字・日本語の句読点が無い。中文の仮名は子の名前と「まんま」だけ・日本の字体と「」が無い）・数と名前がそろう", () => {
    const bad: string[] = [];
    for (const { ja, lang, v } of pairs()) {
      const o = outside(v);
      if (lang === "en") {
        if (KANA.test(o) || /\p{Script=Han}/u.test(o)) bad.push(`en に仮名か漢字: ${v}`);
        if (/[、。「」『』・！？：（）]/.test(o)) bad.push(`en に日本語の句読点: ${v}`);
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

describe("作った写真の一言を頼みの言葉で返す（lib/sample-media-i18n.ts・/api/media）", () => {
  const row = (data: Partial<MediaData>) => ({ id: "m1", data: { links: {}, shareWithClaude: false as const, variants: {}, ...data } as MediaData });

  it("日本語の時・本物の家族の写真・訳の無い一言は、受け取った物をそのまま返す", () => {
    const made = row({ made: true, caption: "はじめまして", from: { name: "ばあば", relation: "鹿児島・美咲の母" } });
    expect(localizeMadeMedia(made, "ja")).toBe(made);
    const real = row({ caption: "はじめまして", from: { name: "ばあば", relation: "鹿児島・美咲の母" } });
    for (const lang of LANGS) expect(localizeMadeMedia(real, lang)).toBe(real);
    const own = row({ made: true, caption: "家族が書き直した一言" });
    for (const lang of LANGS) expect(localizeMadeMedia(own, lang)).toBe(own);
    expect(sampleMediaLine("ja", "はじめまして")).toBe("はじめまして");
  });

  it("中文・English: 作った写真の一言と続柄の注が訳になり、ほかの欄と元の行は変わらない", () => {
    for (const lang of LANGS) {
      const r = row({ made: true, caption: "鹿児島から箱が届いた。手編みの帽子とお守り", who: "ばあば", from: { name: "ばあば", relation: "鹿児島・美咲の母" }, star: ["a"] });
      const before = structuredClone(r);
      const out = localizeMadeMedia(r, lang);
      expect(r).toEqual(before);
      expect(out.data.caption).toBe(SM["鹿児島から箱が届いた。手編みの帽子とお守り"][lang]);
      expect(out.data.from).toEqual({ name: "ばあば", relation: SM["鹿児島・美咲の母"][lang] });
      expect({ ...out.data, caption: r.data.caption, from: r.data.from }).toEqual(r.data);
      // 見本の一冊の辞書にある一言（はじめまして）も訳になる
      expect(localizeMadeMedia(row({ made: true, caption: "はじめまして" }), lang).data.caption).toBe(lang === "en" ? "Nice to meet you" : "初次见面");
    }
  });
});
