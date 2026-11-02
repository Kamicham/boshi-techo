// ① 入力ゼロ: 話した・撮った・書いた事を、日付つきの記録と予定にする。
// サーバ側だけで使う（画面からは `import type` で型だけ使う）。
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { structured } from "./claude";
import { addDays, addMonths, clockAt, conceptionDate, lmpFromDue } from "./clock";
import { list, put, remove, type Doc } from "./db";
import { DEMO_FAMILY, type Family } from "./demo-family";

export const RECORD_KINDS = ["気がかり", "できごと", "予定", "書類", "メモ"] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];
export type RecordSource = "voice" | "photo" | "text";

/** db の type 'record' の中身（一冊の担当も使う） */
export interface RecordData {
  kind: RecordKind;
  title: string;
  detail: string;
  /** 誰の事・誰が話したか（呼び名） */
  who?: string;
  source: RecordSource;
  /** 提出・申込などの期限（deadlines から来た物） */
  isDeadline?: boolean;
  /** 期限の出どころ（例: 「区役所の通知」） */
  deadlineSource?: string;
  /** 同じ1回の入力から生まれた記録の束 */
  captureId?: string;
  /** デモ用に入れた作った記録 */
  seed?: boolean;
}

export type CaptureRecord = Doc<RecordData>;

/** 家族の記録を新しい順に */
export function listRecords(familyId: string, opts: { limit?: number } = {}): CaptureRecord[] {
  return list<RecordData>(familyId, "record", opts);
}

// ── Claude に渡す形 ──

const Schema = z.object({
  gist: z.string().describe("写真の時だけ: 写っている紙に書いてある事の要点（宛先・期限・持ち物・日時など）。写真以外は空文字"),
  records: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD。その事が起きた日・起きる日。分からなければ今日"),
      kind: z.enum(RECORD_KINDS),
      title: z.string().describe("短い見出し（20字くらいまで）"),
      detail: z.string().describe("家族の言葉を残した中身。気がかりは「次の健診で聞く」と添える"),
      who: z.string().nullable().describe("誰の事・誰が話したか（家族の呼び名）。分からなければ null"),
    }),
  ),
  deadlines: z.array(
    z.object({
      title: z.string().describe("何を、いつまでに（提出・申込・支払いなど）"),
      date: z.string().describe("期限の日 YYYY-MM-DD"),
      source: z.string().describe("どこに書いてあったか・誰が言ったか"),
    }),
  ),
  oneQuestion: z.string().nullable().describe("どうしても足りない事が1つだけある時の質問。無ければ null。2つ以上は聞かない"),
  reply: z.string().describe("家族への短い返事（話し言葉・2文まで）"),
});
export type CaptureOutput = z.infer<typeof Schema>;

const SYSTEM = `あなたの役割は「入力ゼロ」の書記です。家族が話した事・撮った紙・書いた一言を、母子手帳の記録と予定に変えます。家族に入力の手間をかけさせません。
やる事:
- 中身を records に分ける。kind は 気がかり（体や様子で気になる事）／できごと（初めての事・思い出）／予定（健診・見学・約束などの日時）／書類（届いた紙・出した書類）／メモ（それ以外・話しかけた声など）。
- 「来週の火曜」「月末」「3日後」などは、今日の日付から実際の日付（YYYY-MM-DD）に直す。
- 提出・申込・支払いの締切は deadlines に入れる（source に出どころ）。同じ事を records の予定に重ねて書かない。
- 写真なら、写っている紙（役所の封筒・通知、健診の結果の紙、母子手帳のページ、保育園の案内など）を読み、gist に要点を書く。個人番号・住所の番地・電話番号は書き写さない。
- 気がかりは体の判断をせず、家族の言葉のまま記録し、detail の最後に「次の健診で聞く」と添える。急ぎに見える時だけ、reply でかかりつけ・#8000・119 を案内する。
- 健診の結果の紙でも、数値の良い・悪いは言わない。書いてある項目と日付だけ記録する。
- 足りない事は推測で埋めず、どうしても必要な1つだけを oneQuestion で聞く。日付が分からないだけなら今日として記録し、聞かない。
- reply は家族の側に立った短い話し言葉。押し付けない（「〜しましょう」より「手帳に書いておきました」）。`;

const WD = "日月火水木金土";
function withWeekday(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return `${s}（${WD[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}）`;
}

function context(family: Family, today: string): string {
  const clock = clockAt(family, today);
  const members = family.members.map((m) => `${m.name}（${m.role}）`).join("・") || "（呼び名なし）";
  return [
    `今日: ${withWeekday(today)}`,
    `家族の時計: ${clock.label}`,
    `出産予定日: ${family.dueDate}${family.birthDate ? `／生まれた日: ${family.birthDate}` : ""}`,
    `子どもの呼び名: ${family.childName ?? "（まだ）"}`,
    `家族: ${members}`,
    `住む町: ${family.prefecture}${family.city}`,
  ].join("\n");
}

export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface CaptureInput {
  family: Family;
  today: string;
  source: RecordSource;
  /** 話した・書いた文（写真なら添え書き） */
  text?: string;
  /** 撮った写真（data URL の画像ブロック） */
  image?: Anthropic.Beta.BetaImageBlockParam;
  /** 聞き返しへの答え（前回の材料と質問つき） */
  followUp?: { basis: string; question: string; answer: string };
}

export interface CaptureResult {
  captureId: string;
  records: CaptureRecord[];
  deadlines: CaptureOutput["deadlines"];
  oneQuestion: string | null;
  reply: string;
  /** 聞き返しに答えた時に、合わせて処理し直す材料（文字・写真の要点） */
  basis: string;
}

/** 1回の入力を Claude で記録と予定にし、保存する */
export async function capture(input: CaptureInput, replaceCaptureId?: string): Promise<CaptureResult> {
  const { family, today, source } = input;
  const label = source === "voice" ? "話した事（文字起こし）" : source === "photo" ? "撮った写真" : "書いた事";
  const parts: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (input.image) parts.push(input.image);
  let prompt = `${context(family, today)}\n\n`;
  if (input.followUp) {
    prompt += `前回の材料:\n${input.followUp.basis}\n\n手帳からの質問: ${input.followUp.question}\n家族の答え: ${input.followUp.answer}\n\n前回の材料と答えを合わせて、記録と予定を作り直してください。もう質問はしない（oneQuestion は null）。`;
  } else {
    prompt += `${label}:\n${input.text?.trim() || "（文字なし）"}`;
  }
  parts.push({ type: "text", text: prompt });

  const out = await structured(Schema, SYSTEM, parts, { maxTokens: 6000 });

  // 聞き返しの後は、前回の記録を作り直した物で置き換える
  if (replaceCaptureId) {
    for (const r of listRecords(family.id)) if (r.data.captureId === replaceCaptureId) remove(r.id);
  }
  const captureId = replaceCaptureId ?? randomUUID();
  const records: CaptureRecord[] = [];
  for (const r of out.records) {
    const data: RecordData = { kind: r.kind, title: r.title, detail: r.detail, source, captureId };
    if (r.who) data.who = r.who;
    records.push(put<RecordData>(family.id, "record", data, { date: isDate(r.date) ? r.date : today }));
  }
  for (const d of out.deadlines) {
    const date = isDate(d.date) ? d.date : today;
    // 同じ日の予定が records にもあれば、別に足さず「期限」の印を付ける
    const i = records.findIndex((r) => r.data.kind === "予定" && r.date === date);
    if (i >= 0) {
      const r = records[i];
      records[i] = put<RecordData>(family.id, "record", { ...r.data, isDeadline: true, deadlineSource: d.source }, { id: r.id, date });
      continue;
    }
    records.push(
      put<RecordData>(
        family.id,
        "record",
        { kind: "予定", title: d.title, detail: `期限。出どころ: ${d.source}`, source, isDeadline: true, deadlineSource: d.source, captureId },
        { date },
      ),
    );
  }

  const basis =
    input.followUp
      ? `${input.followUp.basis}\n質問: ${input.followUp.question}\n答え: ${input.followUp.answer}`
      : [source === "photo" ? `写真の要点: ${out.gist}` : "", input.text?.trim() ? `${label}: ${input.text.trim()}` : ""].filter(Boolean).join("\n");

  return {
    captureId,
    records,
    deadlines: out.deadlines,
    oneQuestion: input.followUp ? null : out.oneQuestion,
    reply: out.reply,
    basis,
  };
}

// ── デモの家族の1000日（すべて作った話） ──

type SeedItem = { at: string; kind: RecordKind; title: string; detail: string; who?: string; source: RecordSource };

function seedItems(): SeedItem[] {
  const f = DEMO_FAMILY;
  const lmp = lmpFromDue(f.dueDate);
  const wk = (w: number, d = 0) => addDays(lmp, w * 7 + d);
  const birth = f.birthDate!;
  const mo = (m: number, d = 0) => addDays(addMonths(birth, m), d);
  return [
    { at: addDays(conceptionDate(f), 26), kind: "できごと", title: "妊娠が分かった", detail: "朝、検査薬で陽性。翔太に伝えたら、しばらく黙ってから「ほんとに？」って。", who: "美咲", source: "voice" },
    { at: wk(7, 3), kind: "気がかり", title: "つわりで朝ごはんが入らない", detail: "朝はほとんど食べられず、夕方に少し楽になる。仕事中もつらい。次の健診で聞く。", who: "美咲", source: "voice" },
    { at: wk(9, 2), kind: "書類", title: "母子健康手帳を受け取った", detail: "区役所で受け取り。妊婦健診の受診票の冊子もいっしょに（写真から要点だけ）。", who: "美咲", source: "photo" },
    { at: wk(16, 4), kind: "メモ", title: "鹿児島の母に報告した", detail: "和子さんが電話口で泣いていた。「大きな字で写真を送ってね」と。", who: "和子", source: "voice" },
    { at: wk(18, 5), kind: "できごと", title: "初めての胎動", detail: "ソファで休んでいたら、おなかの中でポコッと。泡がはじけるみたいだった。", who: "美咲", source: "voice" },
    { at: wk(20, 1), kind: "メモ", title: "翔太がおなかに話しかけた声", detail: "「ひなた、聞こえる？パパだよ。今日は寒かったね」。毎晩の話しかけを録り始めた。", who: "翔太", source: "voice" },
    { at: wk(24, 2), kind: "気がかり", title: "夜に足がつる", detail: "明け方にふくらはぎがつって目が覚める。週に2〜3回。次の健診で聞く。", who: "美咲", source: "voice" },
    { at: wk(28), kind: "できごと", title: "名前を「ひなた」に決めた", detail: "二人で候補を出し合って、最後は声に出して呼びやすい名前に。", who: "翔太", source: "voice" },
    { at: wk(33, 6), kind: "予定", title: "両親学級（デモ用の例）", detail: "沐浴の練習。翔太が抱っこ役。", who: "翔太", source: "photo" },
    { at: wk(35, 3), kind: "書類", title: "入院の持ち物リスト", detail: "産院の案内の紙から: 母子健康手帳・保険証・パジャマ・産褥ショーツなど（写真から要点だけ）。", who: "美咲", source: "photo" },
    { at: birth, kind: "できごと", title: "ひなたが生まれた", detail: "予定日より2日早く。翔太が最初に名前を呼んだら、少しだけ泣き止んだ。", who: "翔太", source: "voice" },
    { at: addDays(birth, 10), kind: "書類", title: "出生届を出した", detail: "翔太が区役所へ。14日以内に間に合った。", who: "翔太", source: "text" },
    { at: addDays(birth, 46), kind: "できごと", title: "初めて笑った", detail: "おむつを替えている時に、こちらを見てにこっと。和子さんにすぐ動画を送った。", who: "美咲", source: "voice" },
    { at: addDays(birth, 63), kind: "気がかり", title: "夕方になるとよく泣く", detail: "毎日17時ごろから1時間くらい泣き続ける。抱っこで少し落ち着く。次の健診で聞く。", who: "美咲", source: "voice" },
    { at: mo(4, 5), kind: "できごと", title: "寝返りした", detail: "プレイマットの上で、右にころん。本人もびっくりした顔。", who: "翔太", source: "voice" },
    { at: mo(6, 2), kind: "メモ", title: "ばあばとビデオ通話", detail: "和子さんの「ひなちゃん」に手をばたばた。月に一度の約束にした。", who: "和子", source: "text" },
    { at: mo(8, 3), kind: "予定", title: "保育園の見学（デモ用の例）", detail: "家から歩いて10分の園。慣らし保育の期間を聞く。", who: "美咲", source: "photo" },
    { at: mo(10, 1), kind: "できごと", title: "初めての「まんま」", detail: "おかゆを見て「まんま」。翔太は「パパ」が先だと思っていた。", who: "美咲", source: "voice" },
    { at: mo(12), kind: "できごと", title: "1歳の誕生日", detail: "一升餅を背負って、3歩だけ歩いた。", who: "翔太", source: "voice" },
    { at: mo(17, 10), kind: "気がかり", title: "言葉がまだ少ない気がする", detail: "話す言葉は「まんま」「わんわん」くらい。1歳6か月健診で聞く。", who: "美咲", source: "voice" },
  ];
}

/** デモの家族に作った記録を入れる（同じ id で上書きするので、何度呼んでも増えない） */
export function seedDemo(): CaptureRecord[] {
  return seedItems().map((s, i) =>
    put<RecordData>(
      DEMO_FAMILY.id,
      "record",
      { kind: s.kind, title: s.title, detail: s.detail, who: s.who, source: s.source, seed: true },
      { id: `record:${DEMO_FAMILY.id}:seed:${String(i + 1).padStart(2, "0")}`, date: s.at },
    ),
  );
}
