// 見本の答えの返事（reply-text.ts）: 中文・English の画面で、見本の返事の文がすべて辞書にあり、日本語の画面は1字も変えない
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLocale, type Lang } from "@/lib/i18n";
import { DICTS, tFor } from "@/lib/i18n/dicts";
import { SAMPLE_MARK_SHOWN, sampleReplyShown } from "./reply-text";

vi.mock("server-only", () => ({}));

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
const KANA = /[぀-ヿ]/;

function inLang<T>(lang: Lang, fn: () => T): T {
  vi.stubGlobal("window", {});
  try {
    setLocale(lang, DICTS[lang]);
    return fn();
  } finally {
    setLocale("ja", {});
    vi.unstubAllGlobals();
  }
}

// lib/capture.ts が渡す形（家族の時計など、空行、見出しの行、家族の文）
const HEAD = "今日: 2026-11-05（木）";
const said = (label: string, text: string) => `${HEAD}\n\n${label}:\n${text}`;
const INPUTS = [
  said("話した事（文字起こし）", "今日は夜に胎動をたくさん感じた。"), // 話した・メモ
  said("話した事（文字起こし）", "お腹が張って気になる"), // 話した・気がかり
  said("書いた事", "散歩に行った"), // 書いた・メモ
  said("書いた事", "夜に眠れない"), // 書いた・気がかり
  said("書いた事", "出血があった"), // 急ぎ（気がかり）
];
// 体験版・鍵あり（今日の上限に達した見本）・鍵なし（見本の家族）
const ENVS = [
  { BOSHI_PUBLIC: "1", ANTHROPIC_API_KEY: "" },
  { BOSHI_PUBLIC: "", ANTHROPIC_API_KEY: "test-key-not-real" },
  { BOSHI_PUBLIC: "", ANTHROPIC_API_KEY: "" },
];

/** 見本の答え（lib/samples.ts）が実際に組む返事を、3つの場合ですべて集める */
async function sampleReplies(): Promise<string[]> {
  const { sampleAnswer } = await import("@/lib/samples");
  const replies = new Set<string>();
  for (const env of ENVS) {
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    for (const text of INPUTS) replies.add((sampleAnswer("capture", text) as { reply: string }).reply);
    replies.add((sampleAnswer("capture", [{ type: "image" }, { type: "text", text: said("撮った写真", "（文字なし）") }]) as { reply: string }).reply);
    replies.add((sampleAnswer("capture-page", [{ type: "image" }, { type: "text", text: HEAD }]) as { reply: string }).reply);
    vi.unstubAllEnvs();
  }
  return [...replies];
}

afterEach(() => vi.unstubAllEnvs());

describe("見本の答えの返事", () => {
  it("札はサーバの札（lib/samples.ts の SAMPLE_MARK）と同じ字", () => {
    expect(read("lib/samples.ts")).toContain(`export const SAMPLE_MARK = "${SAMPLE_MARK_SHOWN}";`);
  });

  it("見本の返事は、体験版・鍵あり・鍵なし、話した・書いた・撮った・手帳のページで組まれる（ここで集めた返事を下で全部見る）", async () => {
    const replies = await sampleReplies();
    // 話した×2・書いた×2（急ぎは書いた・気がかりと同じ返事）・写真・手帳のページ が、3つの場合で別の文になる
    expect(replies.length).toBe(18);
    for (const r of replies) expect(r.startsWith(SAMPLE_MARK_SHOWN), r).toBe(true);
  });

  it("日本語の画面: 1字も変えない", async () => {
    for (const r of await sampleReplies()) expect(sampleReplyShown(r)).toBe(r);
  });

  it("中文・English: 見本の返事の文はすべて辞書にあり、かなが残らない", async () => {
    const replies = await sampleReplies();
    for (const lang of ["zh", "en"] as const) {
      inLang(lang, () => {
        for (const r of replies) {
          const shown = sampleReplyShown(r);
          expect(shown, `${lang}: ${r}`).not.toBe(r);
          expect(shown, `${lang}: ${r}`).not.toMatch(KANA);
        }
      });
    }
    inLang("en", () => {
      expect(sampleReplyShown(replies[0])).toBe("(Sample answer) Saved what you said as a note, word for word. This trial doesn't call Claude, so it shows sample answers.");
    });
    inLang("zh", () => {
      expect(sampleReplyShown(replies[0])).toBe("（示例回答）已把你说的话原样记为备忘。这个体验版不调用 Claude，显示的是示例回答。");
    });
  });

  it("Claude が書いた返事（札が無い）と、辞書に無い文を含む見本は、日本語のまま（半分だけ訳さない）", () => {
    inLang("zh", () => {
      const claude = "健診の日を予定に入れました。";
      expect(sampleReplyShown(claude)).toBe(claude);
      const odd = `${SAMPLE_MARK_SHOWN}話した事を、そのままメモに残しました。まだ訳の無い文です。`;
      expect(sampleReplyShown(odd)).toBe(odd);
      const noStop = `${SAMPLE_MARK_SHOWN}話した事を、そのままメモに残しました`;
      expect(sampleReplyShown(noStop)).toBe(noStop);
    });
  });

  it("話す・撮るの画面は、返事をこの部品に通して出す", () => {
    const src = read("components/capture/CaptureScreen.tsx");
    expect(src).toContain("{sampleReplyShown(last.reply)}");
    expect(src).not.toContain("{last.reply}");
  });
});

describe("体験版の「話す」の見本の文", () => {
  const asr = read("lib/asr.ts");
  const note = asr.match(/const DEMO_NOTE = "([^"]+)";/)?.[1] ?? "";

  it("頼みの言葉で引く（話すの口が langOf を渡す）。健診の見本の録音は日本語のまま", () => {
    expect(note).not.toBe("");
    expect(asr).toContain('kind === "visit" ? DEMO_TRANSCRIPT : tFor(lang, DEMO_NOTE)');
    expect(read("app/api/capture/voice/route.ts")).toContain('"note", family.id, langOf(req))');
  });

  it("3つの言葉の文がある（日本語は元の文のまま）", () => {
    expect(tFor("ja", note)).toBe(note);
    for (const lang of ["zh", "en"] as const) {
      const s = tFor(lang, note);
      expect(s, lang).not.toBe(note);
      expect(s, lang).not.toMatch(KANA);
    }
  });
});
