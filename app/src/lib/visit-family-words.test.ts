// 健診のまとめを、家族の言葉（简体中文・English）でも書く（作り手の決め事②・lib/i18n/claude-lang.ts の organizeLangNote）。
// 統括の決まり（11/5 17:4x）:
// - 日本語の画面の整理の頼み（ORGANIZE_SYSTEM・organizePrompt の字）と受け取る形（OrganizedSchema）は1字も変えない。下の字と指紋（sha256）は、直す前の字を固定した物
//   （zod・SDK を上げて受け取る形の指紋だけが変わった時は、中身を見比べてから直す）
// - zh・en の分は切り替えの印 CLAUDE_LANG.visit の裏（今は off）。API で確かめるまで on にしない
// 見る事: ① 日本語・印 off の頼みは前のまま ② zh・en で on の時だけ family を頼む ③ 数のそろわない family は捨てる
// ④ 送る文の日本語は前のまま・家族の言葉の時は family.summary と訳した枠 ⑤ 結果の画面の行の選び方 ⑥ 整理を始める口から保存までのつながり
// Claude には一度もつながない（SDK は偽物。鍵の値は claude() の確かめを通すだけの偽物）。DB は一時フォルダ（わが家の app/data には触らない）。
// 家族・健診の話はすべて作った物
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { afterAll, describe, expect, it, vi } from "vitest";
import { jpDate } from "@/components/today/dates";
import { withLang, type Lang } from "./i18n";
import { CLAUDE_LANG, LANG_FOR_CLAUDE, organizeLangNote } from "./i18n/claude-lang";
import { DICTS } from "./i18n/dicts";
import {
  FamilyWordsSchema,
  OrganizedSchema,
  OrganizedWithFamilySchema,
  SEND_WORD_KEYS,
  SUMMARY_LINE,
  clip,
  familyMessage,
  familyOf,
  familySendTexts,
  lineMessage,
  resultLines,
  sendLangChoice,
  sendWordsFrom,
  type FamilyWords,
  type Organized,
  type VisitData,
  type VisitResult,
} from "./visit";
import { ORGANIZE_SYSTEM, organizeCall, organizePrompt, organizedResult } from "./visit-organize";

vi.mock("server-only", () => ({}));

/** 偽の Claude に届いた頼み（structured → parse） */
type Sent = { model?: string; system: { text: string }[]; messages: { content: unknown }[]; output_config: { format: { schema: Record<string, unknown> }; effort?: string } };
const calls: Sent[] = [];
/** 偽の Claude が返す家族の言葉（受け取る形に family がある時だけ使う） */
let familyReply: FamilyWords | undefined;
function replyFor(p: Sent): unknown {
  const props = p.output_config.format.schema.properties as Record<string, unknown> | undefined;
  return props && "family" in props ? { ...ORGANIZED, family: familyReply } : ORGANIZED;
}
vi.mock("@anthropic-ai/sdk", () => {
  class APIError extends Error {
    status?: number;
  }
  class Anthropic {
    static APIError = APIError;
    static RateLimitError = class extends APIError {};
    static AuthenticationError = class extends APIError {};
    beta = {
      messages: {
        parse: async (p: Sent) => {
          calls.push(p);
          return { model: p.model, usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn", parsed_output: replyFor(p) };
        },
        create: async () => {
          throw new Error("健診の整理では使わない");
        },
      },
    };
  }
  return { default: Anthropic };
});
// 関所は移る前の通し方（わが家と同じ。next-check.test.ts と同じ）。世帯をまたぐ試験は api-household.test.ts
vi.mock("@/app/api/_lib/household", async (orig) => {
  const real = await orig<typeof import("@/app/api/_lib/household")>();
  return {
    ...real,
    familyFor: async (_req: Request, familyId: unknown) => {
      const { getFamily } = await import("@/lib/family");
      const id = String(familyId);
      return {
        id,
        kind: "demo",
        family: getFamily(id),
        account: null,
        role: "owner",
        can: () => true,
        who: { householdId: id, kind: "demo", accountId: null, subjectIds: [], legacy: true },
        ctx: null,
        legacy: true,
      };
    },
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-visit-family-words-test-"));
process.env.BOSHI_DATA_DIR = dir;
for (const k of ["BOSHI_PUBLIC", "BOSHI_SIM", "BOSHI_SIM_BUDGET_USD", "BOSHI_SIM_HOUSEHOLD_USD", "BOSHI_DAILY_USD", "BOSHI_HOUSEHOLD_DAILY_USD", "ANTHROPIC_API_KEY"]) delete process.env[k];
afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  fs.rmSync(dir, { recursive: true, force: true });
});

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");
const OTHERS = ["zh", "en"] as const;
const KANA = /[぀-ヿ]/;

// ───────── 作った健診の整理（妊娠28週・2027-02-15 は月曜） ─────────

const ORGANIZED: Organized = {
  summary: ["28週の健診で、体重・血圧・エコーを見ました", "赤ちゃんは頭が下で、子宮の出口の長さも測りました", "里帰り先の病院に早めに電話する"],
  said: [{ point: "赤ちゃんは頭が下", quote: "頭が下で、頭位ですね", at: null }],
  todo: [
    { what: "里帰り先の病院に電話する", when: "早めに", quote: "まず向こうの病院に早めに電話してください" },
    { what: "紹介状を受付に頼む", when: null, quote: "移る時期が決まったら受付に言ってください" },
  ],
  nextAppointment: { said: "2週間後の月曜日", month: null, day: null, afterWeeks: 2, afterDays: null, afterMonths: null, weekday: 1, time: "10:30" },
  numbers: [
    { name: "血圧", value: "112の68", quote: "血圧が112の68です" },
    { name: "子宮頸管長", value: "35ミリ", quote: "35ミリです" },
  ],
  terms: [{ term: "子宮頸管長", quote: "子宮頸管長も測りますね", plain: "子宮の出口の長さ。お産の前に短くなっていく" }],
  questions: [{ question: "張りが1時間に何回なら電話しますか", why: "回数の目安が言われなかった" }],
  answered: [
    { ask: "夜に足がつる", answer: "寝る前にふくらはぎを伸ばす", quote: "寝る前にふくらはぎを伸ばすストレッチをしてみて" },
    { ask: "里帰りの手続きはいつまで？", answer: null, quote: null },
  ],
};
const ZH: FamilyWords = {
  summary: ["28周的检查，看了体重、血压和B超", "宝宝头朝下，也量了子宫出口的长度", "尽早给回乡分娩的医院打电话"],
  said: ["宝宝头朝下"],
  todo: [
    { what: "给回乡分娩的医院打电话", when: "尽早" },
    { what: "请前台开转诊信", when: null },
  ],
  numbers: [
    { name: "血压", value: "112/68" },
    { name: "宫颈长度", value: "35毫米" },
  ],
  terms: ["子宫出口的长度。分娩前会慢慢变短"],
  questions: ["宫缩1小时几次就该打电话？"],
  answered: ["睡前拉伸小腿", null],
};
const EN: FamilyWords = {
  summary: ["A 28-week checkup: weight, blood pressure and ultrasound", "The baby is head-down; the length of the cervix was measured", "Call the hospital back home soon"],
  said: ["The baby is head-down"],
  todo: [
    { what: "Call the hospital back home", when: "soon" },
    { what: "Ask reception for a referral letter", when: null },
  ],
  numbers: [
    { name: "Blood pressure", value: "112/68" },
    { name: "Cervical length", value: "35 mm" },
  ],
  terms: ["The length of the exit of the uterus. It gets shorter before birth"],
  questions: ["How many contractions an hour should make me call?"],
  answered: ["Stretch your calves before bed", null],
};
const withFamily = (lang: "zh" | "en"): VisitResult => ({ ...ORGANIZED, family: lang === "zh" ? ZH : EN, lang });

// ───────── 整理の頼み（直す前の字） ─────────

const ASR_VISIT: VisitData = {
  kind: "visit",
  date: "2027-02-15",
  label: "妊娠28週",
  status: "organizing",
  agenda: [
    { id: "a", text: "夜に足がつる", from: "気がかり" },
    { id: "b", text: "里帰りの手続きはいつまで？", from: "前回の質問" },
  ],
  transcript: {
    text: "はい、こんにちは。\n体重が0.8キロ増えています。",
    segments: [
      { start: 0, end: 3, text: "はい、こんにちは。" },
      { start: 65.4, end: 70, text: "体重が0.8キロ増えています。" },
    ],
    duration: 70,
    source: "asr",
  },
};
const ASR_PROMPT = `健診の日: 2027-02-15（妊娠28週）
家族: 美咲（母）、翔太（パートナー）
今日聞く予定だった事:
- 夜に足がつる
- 里帰りの手続きはいつまで？

文字起こし（[分:秒] は録音の時刻）:
[0:00] はい、こんにちは。
[1:05] 体重が0.8キロ増えています。`;
const TEXT_VISIT: VisitData = {
  kind: "visit",
  date: "2027-02-15",
  label: "妊娠28週",
  status: "organizing",
  transcript: { text: "はい、こんにちは。\n体重が0.8キロ増えています。", segments: [{ text: "はい、こんにちは。" }, { text: "体重が0.8キロ増えています。" }], source: "text" },
};
const TEXT_PROMPT = `健診の日: 2027-02-15（妊娠28週）
家族: （未設定）
今日聞く予定だった事:
（なし）

文字起こし:
はい、こんにちは。
体重が0.8キロ増えています。`;
const SHAPES = [
  { name: "録音から（時刻つき・聞く事2つ）", v: ASR_VISIT, members: ["美咲（母）", "翔太（パートナー）"], ja: ASR_PROMPT },
  { name: "文字で渡した（デモ・聞く事なし・家族なし）", v: TEXT_VISIT, members: [], ja: TEXT_PROMPT },
];
/** 受け取る形の指紋（API へ送る JSON Schema。直す前の OrganizedSchema から取った） */
const ORGANIZED_FORMAT_SHA = "f7b05affdecb8055c794cbe5a86a7d2f2df92d3e9643883d9d6203dd07de17c9";
const formatOf = (schema: Parameters<typeof betaZodOutputFormat>[0]) => betaZodOutputFormat(schema).schema as { properties: Record<string, unknown>; required: string[] };

describe("① 日本語の画面（と印が off の間）の整理の頼みは、前と1字も同じ", () => {
  it("切り替えの印は、API で3つの言葉を確かめるまで off（統括の決まり。on にする時はこの試験も直す）", () => {
    expect(CLAUDE_LANG.visit).toBe(false);
  });

  it("頼みの役目（ORGANIZE_SYSTEM）と受け取る形（OrganizedSchema）は、直す前の字のまま", () => {
    expect(ORGANIZE_SYSTEM.length).toBe(996);
    expect(sha(ORGANIZE_SYSTEM)).toBe("f765ef5cdb9cc97841773c719cc0482ae982faed3c21147ef2c49941dcdf89e3");
    expect(ORGANIZE_SYSTEM.startsWith("あなたの役目: 妊婦健診・乳幼児健診の録音の文字起こしを、家族があとで読み返せる形に整理する。")).toBe(true);
    expect(sha(JSON.stringify(formatOf(OrganizedSchema)))).toBe(ORGANIZED_FORMAT_SHA);
    expect(Object.keys(formatOf(OrganizedSchema).properties)).toEqual(["summary", "said", "todo", "nextAppointment", "numbers", "terms", "questions", "answered"]);
  });

  it("organizePrompt の字は前のまま（録音から・文字で渡した）", () => {
    for (const s of SHAPES) expect(organizePrompt(s.v, s.members), s.name).toBe(s.ja);
  });

  it("日本語・言葉なしは、印を on にしても OrganizedSchema そのものと前の字。中文・English も印が off なら同じ", () => {
    for (const s of SHAPES) {
      for (const lang of ["ja", null, undefined] as const) {
        for (const on of [false, true]) {
          const c = organizeCall(s.v, s.members, lang, on);
          expect(c.schema, `${s.name}・${lang}・${on}`).toBe(OrganizedSchema);
          expect(c.prompt, `${s.name}・${lang}・${on}`).toBe(s.ja);
          expect(c.lang).toBeNull();
        }
      }
      for (const lang of OTHERS) {
        const c = organizeCall(s.v, s.members, lang, false);
        expect(c.schema).toBe(OrganizedSchema);
        expect(c.prompt, `${s.name}・${lang}`).toBe(s.ja);
        expect(c.lang).toBeNull();
        // 印を渡さない時は CLAUDE_LANG.visit（今は off）
        expect(organizeCall(s.v, s.members, lang).prompt).toBe(s.ja);
      }
    }
  });
});

describe("② zh・en で印が on の時だけ、家族の言葉（family）を頼む", () => {
  it("受け取る形に family が足され、頼みの最後に家族の言葉の段が1つ入る（ほかは日本語の頼みと同じ字）", () => {
    for (const s of SHAPES) {
      for (const lang of OTHERS) {
        const c = organizeCall(s.v, s.members, lang, true);
        expect(c.schema).toBe(OrganizedWithFamilySchema);
        expect(c.lang).toBe(lang);
        expect(c.prompt).toBe(s.ja + organizeLangNote(lang, true));
        expect(c.prompt.slice(s.ja.length)).toBe(`\n\n家族の言葉: ${LANG_FOR_CLAUDE[lang]}${organizeLangNote(lang, true).slice(`\n\n家族の言葉: ${LANG_FOR_CLAUDE[lang]}`.length)}`);
      }
    }
  });

  it("family の形: 7つの欄がそろい、日本語の欄の形はそのまま（OrganizedSchema は変えない）", () => {
    const plain = formatOf(OrganizedSchema);
    const more = formatOf(OrganizedWithFamilySchema);
    expect(more.required).toEqual([...plain.required, "family"]);
    for (const k of Object.keys(plain.properties)) expect(more.properties[k], k).toEqual(plain.properties[k]);
    const fam = more.properties.family as { required: string[]; description?: string };
    expect(fam.required).toEqual(["summary", "said", "todo", "numbers", "terms", "questions", "answered"]);
    expect(fam.description).toContain("引用（quote）は入れない");
    // 返ってくる形を読める（null は null のまま）
    expect(OrganizedWithFamilySchema.parse({ ...ORGANIZED, family: ZH }).family).toEqual(ZH);
    expect(FamilyWordsSchema.parse(EN)).toEqual(EN);
  });
});

describe("③ 数のそろわない family は捨てる（日本語だけで出す）", () => {
  it("頼まなかった時は、受け取ったまま（前と同じ物）", () => {
    expect(organizedResult(ORGANIZED, null)).toBe(ORGANIZED);
  });

  it("そろう時だけ family と lang を残す。そろわない・無い時は、日本語の欄だけ（family も lang も付けない）", () => {
    expect(organizedResult({ ...ORGANIZED, family: ZH }, "zh")).toEqual({ ...ORGANIZED, family: ZH, lang: "zh" });
    const short: FamilyWords[] = [
      { ...ZH, summary: ZH.summary.slice(0, 2) },
      { ...ZH, said: [] },
      { ...ZH, todo: ZH.todo.slice(0, 1) },
      { ...ZH, numbers: [...ZH.numbers, { name: "体重", value: "+0.8公斤" }] },
      { ...ZH, terms: [] },
      { ...ZH, questions: [] },
      { ...ZH, answered: ["睡前拉伸小腿"] },
    ];
    for (const f of short) {
      const out = organizedResult({ ...ORGANIZED, family: f }, "zh");
      expect(out).toEqual(ORGANIZED);
      expect("family" in out || "lang" in out).toBe(false);
    }
    expect(organizedResult(ORGANIZED, "en")).toEqual(ORGANIZED);
    // 保存した物を読む時も、数がそろわなければ使わない
    expect(familyOf({ ...ORGANIZED, family: { ...ZH, said: [] }, lang: "zh" })).toBeNull();
    expect(familyOf({ ...ORGANIZED, family: ZH })).toBeNull();
    expect(familyOf(withFamily("zh"))).toEqual({ lang: "zh", words: ZH });
  });
});

describe("④ 家族に送る文", () => {
  const at = "2027-02-15T03:00:00.000Z";
  const base = { date: "2027-02-15", label: "妊娠28週", nextDate: "2027-03-01" };
  const checked = { ...base, nextCheck: { state: "ok" as const, date: "2027-03-01", time: "10:30", at } };

  it("日本語の文（3行の全文・LINE・題）は、家族の言葉があっても前と同じ字", () => {
    for (const v of [base, checked]) {
      for (const lang of OTHERS) {
        const ja = { ...v, result: ORGANIZED };
        const both = { ...v, result: withFamily(lang) };
        expect(withLang("ja", () => familyMessage(both, jpDate))).toBe(withLang("ja", () => familyMessage(ja, jpDate)));
        expect(withLang("ja", () => lineMessage(both))).toBe(withLang("ja", () => lineMessage(ja)));
      }
    }
    expect(withLang("ja", () => familyMessage({ ...checked, result: withFamily("zh") }, jpDate))).toBe(
      "2月15日（月）の健診（妊娠28週）\n・28週の健診で、体重・血圧・エコーを見ました\n・赤ちゃんは頭が下で、子宮の出口の長さも測りました\n・里帰り先の病院に早めに電話する\n次の健診: 3月1日（月） 10:30",
    );
  });

  it("中文: まとめの行は family.summary、枠・日付・呼び名は中文。次の健診は本人が確かめた日だけ", () => {
    expect(familySendTexts({ ...checked, result: withFamily("zh") }, DICTS.zh, jpDate)).toEqual({
      lang: "zh",
      message: "2月15日（周一）的健康检查（妊娠28周）\n• 28周的检查，看了体重、血压和B超\n• 宝宝头朝下，也量了子宫出口的长度\n• 尽早给回乡分娩的医院打电话\n下次健康检查：3月1日（周一） 10:30",
      line: "2/15 健康检查（妊娠28周）\n28周的检查，看了体重、血压和B超\n宝宝头朝下，也量了子宫出口的长度\n下次：3/1 10:30",
      title: "妊娠28周的健康检查",
    });
    const heard = familySendTexts({ ...base, result: withFamily("zh") }, DICTS.zh, jpDate);
    expect(heard?.message).not.toContain("下次");
    expect(heard?.line).not.toContain("下次");
  });

  it("English: 同じく family.summary と English の枠", () => {
    expect(familySendTexts({ ...checked, result: withFamily("en") }, DICTS.en, jpDate)).toEqual({
      lang: "en",
      message:
        "Checkup on Mon, Feb 15 (28 weeks pregnant)\n• A 28-week checkup: weight, blood pressure and ultrasound\n• The baby is head-down; the length of the cervix was measured\n• Call the hospital back home soon\nNext checkup: Mon, Mar 1 10:30",
      line: "2/15 checkup (28 weeks pregnant)\nA 28-week checkup: weight, blood pressure and ultrasound\nThe baby is head-down; the length of the cervix was measured\nNext: 3/1 10:30",
      title: "28 weeks pregnant checkup",
    });
  });

  it("画面へ渡す枠の言葉（sendWords）だけで組んでも、辞書全部で組んだ文と同じ（呼び名の形ごと）。日本語のかなが残らない", () => {
    for (const lang of OTHERS) {
      const words = sendWordsFrom(DICTS[lang]);
      expect(Object.keys(words).sort(), lang).toEqual([...SEND_WORD_KEYS].sort());
      for (const label of ["妊娠28週", "妊娠1週", "妊娠の前", "生まれた日", "生後12日", "生後1か月", "1歳3か月"]) {
        for (const v of [base, checked]) {
          const one = { ...v, label, result: withFamily(lang) };
          const full = familySendTexts(one, DICTS[lang], jpDate);
          expect(familySendTexts(one, words, jpDate), `${lang}・${label}`).toEqual(full);
          for (const s of [full!.message, full!.line, full!.title]) expect(s, `${lang}・${label}`).not.toMatch(KANA);
        }
      }
    }
  });

  it("家族の言葉が無い・数がそろわない・枠の訳が無い時は作らない（日本語の文だけ）", () => {
    expect(familySendTexts({ ...checked, result: ORGANIZED }, DICTS.zh, jpDate)).toBeNull();
    expect(familySendTexts({ ...checked, result: { ...withFamily("zh"), family: { ...ZH, summary: ["一行"] } } }, DICTS.zh, jpDate)).toBeNull();
    expect(familySendTexts({ ...checked, result: withFamily("zh") }, {}, jpDate)).toBeNull();
    expect(familySendTexts({ ...checked, result: undefined }, DICTS.zh, jpDate)).toBeNull();
  });

  it("LINE の文の家族の言葉の行は、言葉ごとの長さで切る", () => {
    const long = { ...ZH, summary: ["长".repeat(100), "二", "三"] };
    const line = familySendTexts({ ...base, result: { ...ORGANIZED, family: long, lang: "zh" } }, DICTS.zh, jpDate)!.line;
    expect(line.split("\n")[1]).toBe(clip("长".repeat(100), 60));
  });

  it("送る文の言葉: 家族の言葉がある時だけ2つから選べる。選ぶ前は、画面の言葉が家族の言葉ならそれ、ほかは日本語", () => {
    expect(sendLangChoice(null, "zh", null)).toEqual({ choices: [], lang: "ja" });
    expect(sendLangChoice(undefined, "en", "en")).toEqual({ choices: [], lang: "ja" });
    expect(sendLangChoice("zh", "zh", null)).toEqual({ choices: ["ja", "zh"], lang: "zh" });
    expect(sendLangChoice("zh", "ja", null)).toEqual({ choices: ["ja", "zh"], lang: "ja" });
    expect(sendLangChoice("zh", "en", null)).toEqual({ choices: ["ja", "zh"], lang: "ja" });
    expect(sendLangChoice("zh", "ja", "zh").lang).toBe("zh");
    expect(sendLangChoice("en", "en", "ja").lang).toBe("ja");
    // 選べない言葉が残っていたら、選ぶ前と同じ
    expect(sendLangChoice("zh", "zh", "en").lang).toBe("zh");
  });
});

describe("⑤ 結果の画面の行の選び方", () => {
  const japaneseOnly = (r: Organized) => ({
    lang: null,
    summary: r.summary.map((text) => ({ text, ja: null })),
    first: { text: clip(r.summary[0] ?? "", SUMMARY_LINE * 2), ja: null },
    said: r.said.map((x) => ({ text: x.point, ja: null })),
    todo: r.todo.map((x) => ({ what: { text: x.what, ja: null }, when: x.when ? { text: x.when, ja: null } : null })),
    numbers: r.numbers.map((n) => ({ name: { text: n.name, ja: null }, value: { text: n.value, ja: null } })),
    terms: r.terms.map((x) => ({ text: x.plain, ja: null })),
    questions: r.questions.map((q) => ({ text: q.question, ja: null })),
    answered: r.answered.map((a) => (a.answer ? { text: a.answer, ja: null } : null)),
  });

  it("家族の言葉が無い時・画面の言葉が違う時・数がそろわない時は、日本語だけ（前と同じ字）", () => {
    for (const screen of ["ja", "zh", "en"] as Lang[]) expect(resultLines(ORGANIZED, screen), screen).toEqual(japaneseOnly(ORGANIZED));
    expect(resultLines(withFamily("zh"), "ja")).toEqual(japaneseOnly(ORGANIZED));
    expect(resultLines(withFamily("zh"), "en")).toEqual(japaneseOnly(ORGANIZED));
    expect(resultLines(withFamily("en"), "zh")).toEqual(japaneseOnly(ORGANIZED));
    expect(resultLines({ ...withFamily("zh"), family: { ...ZH, questions: [] } }, "zh")).toEqual(japaneseOnly(ORGANIZED));
    // 空のまとめ（前と同じく空の1行目）
    const empty = { ...ORGANIZED, summary: [] };
    expect(resultLines(empty, "ja").first).toEqual({ text: "", ja: null });
  });

  it("その言葉の画面で開いた時だけ、家族の言葉を大きく・日本語の元の文を小さく。引用は行に入れない", () => {
    const l = resultLines(withFamily("zh"), "zh");
    expect(l.lang).toBe("zh");
    expect(l.summary).toEqual(ZH.summary.map((text, i) => ({ text, ja: ORGANIZED.summary[i] })));
    expect(l.first).toEqual({ text: ZH.summary[0], ja: ORGANIZED.summary[0] });
    expect(l.said).toEqual([{ text: "宝宝头朝下", ja: "赤ちゃんは頭が下" }]);
    expect(l.todo).toEqual([
      { what: { text: "给回乡分娩的医院打电话", ja: "里帰り先の病院に電話する（早めに）" }, when: { text: "尽早", ja: null } },
      { what: { text: "请前台开转诊信", ja: "紹介状を受付に頼む" }, when: null },
    ]);
    expect(l.numbers).toEqual([
      { name: { text: "血压", ja: "血圧" }, value: { text: "112/68", ja: "112の68" } },
      { name: { text: "宫颈长度", ja: "子宮頸管長" }, value: { text: "35毫米", ja: "35ミリ" } },
    ]);
    expect(l.terms).toEqual([{ text: ZH.terms[0], ja: ORGANIZED.terms[0].plain }]);
    expect(l.questions).toEqual([{ text: ZH.questions[0], ja: ORGANIZED.questions[0].question }]);
    expect(l.answered).toEqual([{ text: "睡前拉伸小腿", ja: "寝る前にふくらはぎを伸ばす" }, null]);
    const flat = JSON.stringify(l);
    for (const q of [...ORGANIZED.said.map((x) => x.quote), ...ORGANIZED.todo.map((x) => x.quote), ...ORGANIZED.numbers.map((x) => x.quote)]) expect(flat).not.toContain(q);
    expect(resultLines(withFamily("en"), "en").said).toEqual([{ text: "The baby is head-down", ja: "赤ちゃんは頭が下" }]);
  });

  it("家族の言葉が空の行・日本語と同じ字の行は、日本語だけ。いつまでにが無い訳は日本語のいつまでに", () => {
    const fam: FamilyWords = { ...ZH, said: ["  "], numbers: [{ name: "血压", value: "112の68" }, ZH.numbers[1]], todo: [{ what: "给回乡分娩的医院打电话", when: null }, ZH.todo[1]] };
    const l = resultLines({ ...ORGANIZED, family: fam, lang: "zh" }, "zh");
    expect(l.said).toEqual([{ text: "赤ちゃんは頭が下", ja: null }]);
    expect(l.numbers[0].value).toEqual({ text: "112の68", ja: null });
    expect(l.todo[0]).toEqual({ what: { text: "给回乡分娩的医院打电话", ja: "里帰り先の病院に電話する（早めに）" }, when: { text: "早めに", ja: null } });
  });

  it("まとめが長い時の1行目は、家族の言葉を言葉ごとの長さで、日本語の元の文を前と同じ長さで切る", () => {
    const r = { ...ORGANIZED, summary: ["あ".repeat(100), ...ORGANIZED.summary], family: { ...ZH, summary: ["长".repeat(200), ...ZH.summary] }, lang: "zh" as const };
    expect(resultLines(r, "zh").first).toEqual({ text: clip("长".repeat(200), 120), ja: clip("あ".repeat(100), SUMMARY_LINE * 2) });
  });
});

describe("⑥ 整理を始める口（finish）から保存まで（偽の Claude）", () => {
  let n = 60;
  /** 見本の家族の写しで、新しい健診を1つ作る */
  async function newVisit() {
    const { createVisit } = await import("@/app/api/visit/_lib/server");
    return createVisit(`try-${String(n++).padStart(32, "0")}`, "2027-02-15").id;
  }
  /** 文字で渡して整理を始め、終わるまで待つ（cookie の言葉＝頼んだ人の画面の言葉） */
  async function finish(id: string, lang: Lang | null) {
    const { POST } = await import("@/app/api/visit/[id]/finish/route");
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (lang) headers.cookie = `boshi_lang=${lang}`;
    const req = new Request(`http://localhost/api/visit/${id}/finish`, { method: "POST", headers, body: JSON.stringify({ transcriptText: "はい、こんにちは。\n頭が下で、頭位ですね。" }) });
    calls.length = 0;
    const res = await POST(req, { params: Promise.resolve({ id }) });
    expect(res.status).toBe(200);
    const { isRunning, requireVisit } = await import("@/app/api/visit/_lib/server");
    // 裏の処理が「できた」を書き、終わりの印（running）を外すまで待つ（続けてやり直しを押せるように）
    await vi.waitFor(
      () => {
        expect(requireVisit(id).data.status).toBe("done");
        expect(isRunning(id)).toBe(false);
      },
      { timeout: 5000 },
    );
    expect(calls).toHaveLength(1);
    return { sent: calls[0], saved: requireVisit(id).data };
  }
  async function view(id: string) {
    const { GET } = await import("@/app/api/visit/[id]/route");
    const res = await GET(new Request(`http://localhost/api/visit/${id}`), { params: Promise.resolve({ id }) });
    return ((await res.json()) as { visit: Record<string, unknown> }).visit;
  }

  it("印が off の今: 日本語・中文・English の画面のどれから始めても、前と同じ役目・頼み・受け取る形で頼み、前と同じ形で残す", async () => {
    const { CHARTER } = await import("@/lib/claude");
    process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
    try {
      for (const lang of ["ja", "zh", "en", null] as const) {
        const id = await newVisit();
        const { sent, saved } = await finish(id, lang);
        expect(sent.system[0].text).toBe(`${CHARTER}\n\n${ORGANIZE_SYSTEM}`);
        expect(sent.messages[0].content).toBe(organizePrompt(saved, ["美咲（母）", "翔太（パートナー）"]));
        expect(sha(JSON.stringify(sent.output_config.format.schema)), String(lang)).toBe(ORGANIZED_FORMAT_SHA);
        expect(sent.output_config.effort).toBe("medium");
        expect(saved.result).toEqual(ORGANIZED);
        // 健診の返事にも、送る文の枠の言葉は付かない（前と同じ返事）
        expect("sendWords" in (await view(id))).toBe(false);
      }
    } finally {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  it("印を on にした時（API で確かめた後）: 中文の画面から始めると family も頼み、そろえば family と lang を残し、健診の返事に枠の言葉が付く", async () => {
    const flags = CLAUDE_LANG as { capture: boolean; visit: boolean };
    process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
    flags.visit = true;
    try {
      familyReply = ZH;
      const id = await newVisit();
      const { sent, saved } = await finish(id, "zh");
      expect(sent.messages[0].content).toBe(organizePrompt(saved, ["美咲（母）", "翔太（パートナー）"]) + organizeLangNote("zh", true));
      expect(Object.keys(sent.output_config.format.schema.properties as object)).toContain("family");
      expect(saved.result).toEqual({ ...ORGANIZED, family: ZH, lang: "zh" });
      expect((await view(id)).sendWords).toEqual(sendWordsFrom(DICTS.zh));

      // やり直しは、押した人の言葉で頼み直す（日本語の画面なら前の頼みと形。family は残らない）
      const again = await finish(id, "ja");
      expect(sha(JSON.stringify(again.sent.output_config.format.schema))).toBe(ORGANIZED_FORMAT_SHA);
      expect(again.saved.result).toEqual(ORGANIZED);

      // 数がそろわない family は捨てる
      familyReply = { ...ZH, summary: ZH.summary.slice(0, 1) };
      const other = await newVisit();
      expect((await finish(other, "zh")).saved.result).toEqual(ORGANIZED);
      expect("sendWords" in (await view(other))).toBe(false);
    } finally {
      flags.visit = false;
      familyReply = undefined;
      delete process.env.ANTHROPIC_API_KEY;
    }
  });
});
