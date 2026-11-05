// 話す・撮る・書くの頼みに、画面の言葉を伝える（作り手 11/5 夕の決め事①・lib/i18n/claude-lang.ts）
// - 日本語の画面と、切り替えの印（CLAUDE_LANG.capture）が off の時は、Claude への頼みの字が前と1字も同じ
//   （統括の決まり 11/5 17:4x: 本番のわが家は日本語の画面で Claude を使っている）。下の日本語の頼みは、直す前の組み立てと同じ字を固定した物
// - 印が on の時だけ、家族の時計などの段のすぐ後に「画面の言葉」の段が入る。家族の文は最後の段のまま（見本の答え lib/samples.ts が読む形）
// - 紙の母子手帳のページを撮る頼み（captureTechoPage）は今回の外（紙の欄に合わせて書く）
// Claude には一度もつながない（SDK は偽物。鍵の値は claude() の確かめを通すだけの偽物）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import type { Lang } from "./i18n";
import { CALL_119, CLAUDE_LANG, LANG_FOR_CLAUDE, captureLangNote, claudeLangOn, organizeLangNote } from "./i18n/claude-lang";

vi.mock("server-only", () => ({}));

/** 偽の Claude に届いた頼み（structured → parse） */
const calls: { messages: { content: { type: string; text?: string }[] }[] }[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        parse: async (p: (typeof calls)[number] & { model?: string }) => {
          calls.push(p);
          return {
            model: p.model,
            usage: { input_tokens: 10, output_tokens: 10 },
            stop_reason: "end_turn",
            parsed_output: { gist: "", records: [], deadlines: [], techo: [], oneQuestion: null, reply: "手帳に書いておきました。" },
          };
        },
        create: async () => {
          throw new Error("話す・撮るでは使わない");
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-capture-lang-test-"));
process.env.BOSHI_DATA_DIR = dir;
for (const k of ["BOSHI_PUBLIC", "BOSHI_SIM", "BOSHI_SIM_BUDGET_USD", "BOSHI_SIM_HOUSEHOLD_USD", "BOSHI_DAILY_USD", "BOSHI_HOUSEHOLD_DAILY_USD", "ANTHROPIC_API_KEY"]) delete process.env[k];
afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  fs.rmSync(dir, { recursive: true, force: true });
});

const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");
/** 見本の家族（予定日 2027-05-10）の妊娠中の1日 */
const TODAY = "2027-02-20";
const HEAD = [
  "今日: 2027-02-20（土）",
  "家族の時計: 妊娠28週5日",
  "出産予定日: 2027-05-10／生まれた日: 2027-04-26",
  "子どもの呼び名: ひなた",
  "家族: 美咲（母）・翔太（パートナー）",
  "住む町: 埼玉県さいたま市",
].join("\n");

type Shape = { name: string; source: "voice" | "text" | "photo"; text?: string; followUp?: { basis: string; question: string; answer: string }; ja: string };
const SHAPES: Shape[] = [
  { name: "書いた", source: "text", text: "  お腹が張って気になる \n", ja: `${HEAD}\n\n書いた事:\nお腹が張って気になる` },
  { name: "話した", source: "voice", text: "今日は夜に胎動をたくさん感じた。", ja: `${HEAD}\n\n話した事（文字起こし）:\n今日は夜に胎動をたくさん感じた。` },
  { name: "撮った（添え書きなし）", source: "photo", ja: `${HEAD}\n\n撮った写真:\n（文字なし）` },
  {
    name: "聞き返しへの答え",
    source: "voice",
    followUp: { basis: "話した事: 健診の予約を取った", question: "健診は何日ですか？", answer: "来週の水曜" },
    ja: `${HEAD}\n\n前回の材料:\n話した事: 健診の予約を取った\n\n手帳からの質問: 健診は何日ですか？\n家族の答え: 来週の水曜\n\n前回の材料と答えを合わせて、記録と予定を作り直してください。もう質問はしない（oneQuestion は null）。`,
  },
];
const OTHERS = ["zh", "en"] as const;

async function promptOf(shape: Shape, lang: Lang | undefined, on?: boolean) {
  const { capturePromptText } = await import("./capture");
  const { DEMO_FAMILY } = await import("./demo-family");
  return capturePromptText({ family: DEMO_FAMILY, today: TODAY, source: shape.source, text: shape.text, followUp: shape.followUp, lang }, on);
}

describe("日本語の画面の頼みは、前と1字も同じ", () => {
  it("切り替えの印は、API で3つの言葉を確かめるまで off（統括の決まり。on にする時はこの試験も直す）", () => {
    expect(CLAUDE_LANG.capture).toBe(false);
  });

  it("書いた・話した・撮った・聞き返しへの答え: 日本語（言葉なしも）は前の字のまま。印を on にしても変わらない", async () => {
    for (const s of SHAPES) {
      for (const lang of ["ja", undefined] as const) {
        expect(await promptOf(s, lang), `${s.name}・${lang}`).toBe(s.ja);
        expect(await promptOf(s, lang, true), `${s.name}・${lang}・on`).toBe(s.ja);
      }
    }
  });

  it("中文・English の画面でも、印が off なら日本語と同じ字", async () => {
    for (const s of SHAPES) for (const lang of OTHERS) expect(await promptOf(s, lang, false), `${s.name}・${lang}`).toBe(s.ja);
  });

  it("capture() が Claude へ送る文は、この組み立てのまま（中文の画面でも、今は日本語の画面と同じ字）", async () => {
    const { sendingAs } = await import("./claude");
    const { capture } = await import("./capture");
    const { DEMO_FAMILY } = await import("./demo-family");
    process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
    const who = { householdId: "sim-capture-lang-test", kind: "sim" as const, accountId: null, subjectIds: [], legacy: true };
    const sent: string[] = [];
    for (const lang of ["ja", "zh", "en"] as const) {
      calls.length = 0;
      await sendingAs(who, () => capture({ family: { ...DEMO_FAMILY, id: `capture-lang-${lang}` }, today: TODAY, source: "text", text: "お腹が張って気になる", lang }));
      expect(calls, lang).toHaveLength(1);
      const blocks = calls[0].messages.flatMap((m) => m.content).filter((b) => b.type === "text");
      sent.push(blocks.map((b) => b.text).join(""));
    }
    delete process.env.ANTHROPIC_API_KEY;
    expect(sent).toEqual([SHAPES[0].ja, SHAPES[0].ja, SHAPES[0].ja]);
  });
});

describe("印が on の時（中文・English）", () => {
  it("家族の時計などの段のすぐ後に「画面の言葉」の段が1つ入り、ほかは日本語の頼みと同じ字", async () => {
    for (const s of SHAPES) {
      for (const lang of OTHERS) {
        const note = captureLangNote(lang, true);
        expect(await promptOf(s, lang, true), `${s.name}・${lang}`).toBe(s.ja.replace(`${HEAD}\n\n`, `${HEAD}${note}\n\n`));
      }
    }
  });

  it("段の中に空行が無い（家族の文は最後の段のまま）。言葉の名前と、言い換えない119の文を含む", () => {
    for (const lang of OTHERS) {
      const note = captureLangNote(lang, true);
      expect(note.startsWith("\n\n画面の言葉: ")).toBe(true);
      expect(note.slice(2), lang).not.toMatch(/\n\s*\n/);
      expect(note).toContain(LANG_FOR_CLAUDE[lang]);
      expect(note).toContain(`「${CALL_119[lang]}」`);
      // 記録は家族の言葉のまま・紙の母子手帳の欄は前のまま
      expect(note).toContain("records と deadlines");
      expect(note).toContain("techo は前のとおり");
    }
    expect(captureLangNote("ja", true)).toBe("");
    expect(captureLangNote(null, true)).toBe("");
    for (const lang of OTHERS) expect(captureLangNote(lang, false)).toBe("");
  });

  it("119 の文は、急ぎの橋の訳（dict/answers.ts）と同じ字", () => {
    const answers = read("lib/i18n/dict/answers.ts");
    for (const lang of OTHERS) expect(answers, lang).toContain(CALL_119[lang]);
  });

  it("鍵の無い見本の答え（lib/samples.ts）は、段が入っても日本語の頼みと同じ答え（家族の文・急ぎ・話した／書いた の読み分け）", async () => {
    const { sampleAnswer } = await import("./samples");
    const cases: Shape[] = [...SHAPES.slice(0, 2), { name: "急ぎ", source: "text", text: "出血があった", ja: `${HEAD}\n\n書いた事:\n出血があった` }];
    for (const s of cases) {
      const ja = sampleAnswer("capture", s.ja);
      for (const lang of OTHERS) expect(sampleAnswer("capture", await promptOf(s, lang, true)), `${s.name}・${lang}`).toEqual(ja);
    }
    expect((sampleAnswer("capture", cases[2].ja) as { records: { urgent: boolean }[] }).records[0].urgent).toBe(true);
  });
});

describe("口（API）が頼みの言葉を渡す", () => {
  it("話す・撮る・書く・聞き返しへの答え・手帳に聞くの「記録する」", () => {
    for (const f of ["app/api/capture/route.ts", "app/api/capture/voice/route.ts", "app/api/capture/photo/route.ts", "app/api/capture/answer/route.ts", "app/api/ask/act/route.ts"]) {
      const src = read(f);
      expect(src, f).toMatch(/import \{[^}]*\blangOf\b[^}]*\} from "@\/lib\/i18n\/dicts";/);
      expect(src, f).toContain("lang: langOf(req) }");
    }
  });
});

describe("確かめの時だけ、その場の環境変数で印を on にできる（scripts/lang-check.mts）", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("BOSHI_CLAUDE_LANG の capture は話す・撮る・書くだけ、visit は健診のまとめだけ。無ければ off。日本語の画面はいつも足さない", () => {
    vi.stubEnv("BOSHI_CLAUDE_LANG", "");
    expect([claudeLangOn("capture"), claudeLangOn("visit")]).toEqual([false, false]);
    expect(captureLangNote("zh")).toBe("");
    vi.stubEnv("BOSHI_CLAUDE_LANG", "capture");
    expect(captureLangNote("zh")).toBe(captureLangNote("zh", true));
    expect(organizeLangNote("zh")).toBe("");
    vi.stubEnv("BOSHI_CLAUDE_LANG", "visit");
    expect(captureLangNote("en")).toBe("");
    expect(organizeLangNote("en")).toBe(organizeLangNote("en", true));
    vi.stubEnv("BOSHI_CLAUDE_LANG", " capture , visit ");
    expect([claudeLangOn("capture"), claudeLangOn("visit")]).toEqual([true, true]);
    expect(captureLangNote("ja")).toBe("");
    expect(organizeLangNote("ja")).toBe("");
  });

  it("本番・体験版・なりきりの置き場には入れない（入るのは確かめの台本の中だけ）", () => {
    const app = (f: string) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
    for (const f of ["Dockerfile", "fly.toml", "scripts/serve-prod.sh", "scripts/deploy-local.sh", "scripts/release-prod.sh", "scripts/sync-deploy.sh", "scripts/sim-server.sh"]) {
      expect(app(f), f).not.toContain("BOSHI_CLAUDE_LANG");
    }
  });
});
