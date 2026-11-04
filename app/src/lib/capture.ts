// ① 入力ゼロ: 話した・撮った・書いた事を、日付つきの記録と予定にする。
// サーバ側だけで使う（画面からは `import type` で型だけ使う）。
import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import { getPlan, ongoingVisit, savePlan } from "@/app/api/visit/_lib/server";
import { EVERYDAY_MODEL, sampleMode, structured } from "./claude";
import { addDays, addMonths, clockAt, conceptionDate, lmpFromDue } from "./clock";
import { list, patch, put, remove, type Doc } from "./db";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { TECHO_PAGES, TECHO_PAGE_IDS, type TechoPageId, type TechoSource } from "./techo";
import { HttpError } from "./http-error";
import { cleanManual, temperatureRecord, type ManualInput } from "./manual-entry";
import { addTecho, removePendingByCapture, toNumber, VALUE_KEYS, type TechoDoc } from "./techo-store";
import { concernSide, type VisitData, type VisitPlan } from "./visit";

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
  /** その日のうちに医療機関へ連絡した方がよさそうに見えた（判断ではなく、連絡を勧める印） */
  urgent?: boolean;
}

export type CaptureRecord = Doc<RecordData>;

/** 家族の記録を新しい順に */
export function listRecords(familyId: string, opts: { limit?: number } = {}): CaptureRecord[] {
  return list<RecordData>(familyId, "record", opts);
}

// ── Claude に渡す形 ──

/** 手帳の記録の候補（府令様式のページ・欄）。値は文字で受け取り、techo-store が決まりどおりに整える */
const TechoItem = z.object({
  page: z.enum(TECHO_PAGE_IDS as unknown as [TechoPageId, ...TechoPageId[]]).describe("府令様式のどのページの記録か"),
  date: z.string().describe("YYYY-MM-DD。その事の日（できた日・健診の日・接種した日など）。分からなければ今日（紙の写真で日付が書いていない時は空文字でよい）"),
  dateWritten: z.boolean().describe("date が、紙に書いてある日・家族が言った日（「今日」「昨日」も含む）なら true。書いていない・言っていないので今日や推測で入れた時は false"),
  title: z.string().describe("一覧に出す短い見出し（例: 寝返り・BCG・妊娠24週の健診）"),
  who: z.string().nullable().describe("誰の事・誰が書いた／話したか（家族の呼び名）。気持ちの記録は話した人。分からなければ null"),
  values: z
    .array(z.object({ key: z.string().describe("欄の名前（下の一覧のキーだけ）"), value: z.string().describe("書いてある・話したとおりの値。読めない・聞いていない欄は入れない") }))
    .describe("そのページの欄"),
});

/** Claude に渡す、ページと欄の一覧 */
const TECHO_GUIDE = TECHO_PAGES.map((p) => `- ${p.id}（${p.title}）: ${(VALUE_KEYS[p.id] as readonly string[]).join(", ")}`).join("\n");

const TECHO_RULES = `手帳の記録（techo）の決まり:
- ページと欄は次の一覧だけ。キーの単位は名前のとおり（Kg=キログラム、G=グラム、Cm=センチ、bpHigh/bpLow=血圧の上と下）。
${TECHO_GUIDE}
- 体の数字（体重・身長・頭囲・血圧・週数など）は、家族がはっきり言った値か、紙にはっきり書いてある値だけを写す。計算・推測・平均で数字を作らない。読めない・言っていない欄は入れない（空のまま）。
- 子どもの体重は、書いてある・言ったとおりに単位を付けて写す（例: 「4,120g」「4.12kg」）。成長（growth）と乳幼児健診（child-checkup）は weightKg、出生（birth）と新生児（newborn）は weightG に入れる。単位が欄と違っても、そのまま写してよい（直すのは機械）。体重をメモの文だけに入れない。
- できた日（development）の item は次から選ぶ: 首すわり・寝返り・ひとりすわり・はいはい・つかまり立ち・つたい歩き・ひとり歩き・指さし・意味のあることば。
- 便の色（stool）は、家族が便色カードの番号（1〜7）を言った時か、手帳に番号が書いてある時だけ colorNo に入れる。色を見て番号を決めない。
- 予防接種（vaccine）は、打った事が分かる時だけ（予定は入れない）。
- 気持ち（feeling）は家族の言葉のまま text に。who は話した人。
- 相談した事（consult）は、誰に相談したか（whom）と中身（text）。
- 良い・悪い・正常・異常は書かない。記録になる事が無ければ techo は空の配列。`;

const Schema = z.object({
  gist: z.string().describe("写真の時だけ: 写っている紙に書いてある事の要点（宛先・期限・持ち物・日時など）。写真以外は空文字"),
  records: z.array(
    z.object({
      date: z.string().describe("YYYY-MM-DD。その事が起きた日・起きる日。分からなければ今日"),
      kind: z.enum(RECORD_KINDS),
      title: z.string().describe("短い見出し（20字くらいまで）"),
      detail: z
        .string()
        .describe(
          "家族の言葉を残した中身。気がかりは最後に「次の健診で聞く」と添える。urgent が true の時だけ、最後は「次の健診で聞く」ではなく「その日のうちに産院へ電話」と添える（子どもの事なら「その日のうちにかかりつけへ電話。迷ったら #8000」）",
        ),
      urgent: z
        .boolean()
        .describe(
          "その日のうちに医療機関へ連絡した方がよさそうに見える時だけ true（出血・強い痛み・胎動が少ない・破水らしい・水も飲めない・子どもの高熱やぐったり など）。体の判断ではなく連絡を勧める印。それ以外は false",
        ),
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
  techo: z.array(TechoItem).describe("母子手帳のページに入る記録（できた日・体重などの数字・接種した・気持ち・便色の番号・相談した事など）。無ければ空の配列"),
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
- 気がかりは体の判断をせず、家族の言葉のまま記録し、detail の最後に「次の健診で聞く」と添える。
- 出血・強い痛み・胎動が少ない・破水らしい・水も飲めない・子どもの高熱やぐったり など、その日のうちに医療機関へ連絡した方がよさそうに見える時は、その記録の urgent を true にし、detail の最後は「次の健診で聞く」ではなく「その日のうちに産院へ電話」と添える（子どもの事なら「その日のうちにかかりつけへ電話。迷ったら #8000」）。大丈夫・心配ないとは言わず、診断もせず、連絡を勧める言い方にする。reply でも連絡先を案内する: 妊娠中・産後の体はかかりつけの産院（夜間も）・119、子どもは #8000（子ども医療電話相談）。
- 健診の結果の紙でも、数値の良い・悪いは言わない。書いてある項目と日付だけ記録する。
- 足りない事は推測で埋めず、どうしても必要な1つだけを oneQuestion で聞く。日付が分からないだけなら今日として記録し、聞かない（撮った紙の手帳の記録は、techo の dateWritten を false にするだけでよい。家族が候補の日付を直せる）。
- 母子手帳のページに入る事（できた日・体重などの数字・接種した・気持ち・便色の番号・相談した事など）は、records とは別に techo にも入れる。家族が後で「OK」を押して確定するので、候補として出す。
- reply は家族の側に立った短い話し言葉。押し付けない（「〜しましょう」より「手帳に書いておきました」）。
- 急ぎでない気がかりは、手帳が次の健診の「先生に聞く事」にも並べ、返事の最後にそう書き足す。reply では、そこには触れない（同じ事を2回言わない）。

${TECHO_RULES}`;

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
  /** 手帳に入れる候補（pending:true。家族の「OK」で確定） */
  techo: TechoDoc[];
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

  const out = await structured(Schema, SYSTEM, parts, { model: EVERYDAY_MODEL, maxTokens: 6000, task: "capture" });

  // 見本の答え（鍵の無い見本の家族）は、同じ入力なら毎回同じ。同じ日に同じ文を送り直しても（写真は除く）記録へ足さず、前に入れた同じ見本を置き換える
  if (!replaceCaptureId && source !== "photo" && sampleMode() && out.records[0]) {
    const first = out.records[0];
    const prev = listRecords(family.id).find((r) => r.data.captureId && r.data.source === source && r.data.kind === first.kind && r.data.title === first.title && r.date === (isDate(first.date) ? first.date : today));
    if (prev) replaceCaptureId = prev.data.captureId;
  }
  // 聞き返しの後は、前回の記録を作り直した物で置き換える
  if (replaceCaptureId) {
    const gone = new Set<string>();
    for (const r of listRecords(family.id))
      if (r.data.captureId === replaceCaptureId) {
        remove(r.id);
        gone.add(r.id);
      }
    removePendingByCapture(family.id, replaceCaptureId);
    dropFromAgenda(family.id, gone, today);
  }
  const captureId = replaceCaptureId ?? randomUUID();
  const records: CaptureRecord[] = [];
  for (const r of out.records) {
    const data: RecordData = { kind: r.kind, title: r.title, detail: r.detail, source, captureId };
    if (r.who) data.who = r.who;
    if (r.urgent) data.urgent = true;
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

  // 手帳の候補。話した・書いた時は、元の言葉に無い数字を捨てる（Claude が数字を作らない歯止め）
  const said = input.followUp ? `${input.followUp.basis}\n${input.followUp.answer}` : (input.text ?? "");
  const techo = addTecho(
    family.id,
    out.techo.map((t) => {
      const item = techoFromItem(t, source === "photo" && !input.followUp ? null : said);
      // 撮った紙で日付が書いていない時だけ、今日にせずページの題と生まれた日から推す（話した時は今まで通り今日）
      return source === "photo" ? withDateCheck(item, t, family, today) : item;
    }),
    { today, source, pending: true, captureId },
  );

  const basis =
    input.followUp
      ? `${input.followUp.basis}\n質問: ${input.followUp.question}\n答え: ${input.followUp.answer}`
      : [source === "photo" ? `写真の要点: ${out.gist}` : "", input.text?.trim() ? `${label}: ${input.text.trim()}` : ""].filter(Boolean).join("\n");

  const oneQuestion = input.followUp ? null : out.oneQuestion;
  // 聞き返しは、画面を開き直しても答えられるようにサーバに残す（答える・やめると消す）
  if (oneQuestion) saveAsk(family.id, { captureId, question: oneQuestion, basis, source }, today);

  // 急ぎでない気がかりは、次の健診の「先生に聞く事」にも並べる（返事の最後は決まった文。Claude の言い換えにしない）
  const sides = addConcernsToAgenda(family, records, today);
  return {
    captureId,
    records,
    deadlines: out.deadlines,
    oneQuestion,
    reply: withAgendaNote(out.reply, agendaNote(sides, family.childName)),
    basis,
    techo,
  };
}

// ── 話した・打った気がかりを、次の健診の「先生に聞く事」へ（見直し C03・2026-11-04） ──
// 記録はそのまま1つ。「先生に聞く事」（visit-plan の concerns）には、記録の id で1行だけ並べる（二重に持たない）。
// 急ぎの記録は入れない（その日のうちに電話する物で、次の健診まで待たせない）。

/** 子の事と読める呼び方（生まれた後に、だれの健診で聞くかを見分ける。components/capture/urgent-note.ts と同じ見分け方） */
const CHILD_WORDS = /赤ちゃん|あかちゃん|子ども|子供|こども|ベビー|娘|息子|この子/;

/**
 * 気がかりを、だれの健診で聞くか（chosen は家族が打つ時に選んだ物）。
 * - 上の子の事（「上の子」・上の子の呼び名）: older（この子とママの健診には並べない）
 * - その日にまだ生まれていない: ママ
 * - 生まれた後: 子の呼び名・赤ちゃん等なら子。分からなければ印を付けない（健診の画面の決まり concernSide が、生まれた後は子の欄に回す。
 *   ママの健診は産後1か月で終わるので、ママの欄に入れると行き場が無くなる。who は話した人の事もある＝seedItems の「夕方になるとよく泣く」）
 */
export function concernOwner(
  family: Pick<Family, "birthDate" | "childName" | "situation">,
  date: string,
  who?: string | null,
  chosen?: "child" | "mother",
): "child" | "mother" | "older" | undefined {
  if (chosen) return chosen;
  const w = who?.trim() ?? "";
  const child = family.childName?.trim();
  if (w && !(child && w.includes(child)) && (/上の子/.test(w) || (family.situation?.olderKids ?? []).some((k) => k.name && w.includes(k.name)))) return "older";
  if (!family.birthDate || date < family.birthDate) return "mother";
  if (w && ((child && w.includes(child)) || CHILD_WORDS.test(w))) return "child";
  return undefined;
}

type Concern = VisitPlan["concerns"][number];
type AgendaSide = "child" | "mother";

/**
 * 「先生に聞く事」に足す。話した・打った気がかりの記録（addConcernsToAgenda）と、手帳に聞くの「健診で聞く事に足す」（/api/ask/act）が、
 * 同じ決まりでここを通る（どちらの順で入っても1行。見直し C03 の続き・2026-11-05）:
 * - 同じ id・同じ文が、次の健診の分・今日の健診の「今日聞く事」のどこかにもう並んでいれば足さない
 * - 今日の健診がもう始まっていて、ママの側の物は、その健診の「今日聞く事」へ（/api/visit/plan と同じ）。ほかは次の健診の分へ
 * id は、記録から入った行は記録の id、手帳に聞くから入った行は新しい id（どちらも randomUUID なので、ぶつからない）。
 * 足した物だけを返す。
 */
export function addToAgenda(familyId: string, items: { c: Concern; side: AgendaSide }[], today: string): { c: Concern; side: AgendaSide }[] {
  if (!items.length) return [];
  const plan = getPlan(familyId);
  const v = ongoingVisit(familyId, today);
  const seen = new Set<string>(
    [...plan.concerns, ...(v?.data.carried?.concerns ?? []), ...(v?.data.agenda ?? [])].flatMap((c) => [c.id, c.text.trim()]),
  );
  const added: { c: Concern; side: AgendaSide }[] = [];
  for (const it of items) {
    const text = it.c.text.trim().slice(0, 300);
    if (!text || seen.has(it.c.id) || seen.has(text)) continue;
    added.push({ c: { ...it.c, text }, side: it.side });
    seen.add(it.c.id).add(text);
  }
  const toVisit = v ? added.filter((a) => a.side === "mother").map((a) => a.c) : [];
  const toPlan = added.map((a) => a.c).filter((c) => !toVisit.includes(c));
  if (toPlan.length) savePlan(familyId, { ...plan, concerns: [...plan.concerns, ...toPlan] });
  if (v && toVisit.length)
    patch<VisitData>(v.id, {
      agenda: [...(v.data.agenda ?? []), ...toVisit.map((c) => ({ id: c.id, text: c.text, from: "気がかり" as const }))],
      carried: { prevCarriedFrom: v.data.carried?.prevCarriedFrom, concerns: [...(v.data.carried?.concerns ?? []), ...toVisit] },
    });
  return added;
}

/**
 * 記録のうち、急ぎでない気がかりを「先生に聞く事」に足す。足した物の欄（mother／child）を返す。
 * 同じ記録（id）・同じ文がもう並んでいれば足さない（addToAgenda）。妊娠中の事を生まれた後に話した時（ふり返り）は並べない。
 */
export function addConcernsToAgenda(family: Family, records: CaptureRecord[], today: string, chosen?: AgendaSide): AgendaSide[] {
  const born = family.birthDate && family.birthDate <= today ? family.birthDate : null;
  const items: { c: Concern; side: AgendaSide }[] = [];
  for (const r of records) {
    if (r.data.kind !== "気がかり" || r.data.urgent || !r.data.title.trim()) continue;
    const date = r.date ?? today;
    const owner = concernOwner(family, date, r.data.who, chosen);
    if (owner === "older") continue;
    const c = { id: r.id, text: r.data.title, date, ...(owner ? { for: owner } : {}) };
    const side = concernSide(c, born);
    if (side !== "past") items.push({ c, side });
  }
  return addToAgenda(family.id, items, today).map((a) => a.side);
}

/** 消した記録から足した「先生に聞く事」を外す（聞き返しで作り直した時） */
function dropFromAgenda(familyId: string, ids: Set<string>, today: string): void {
  if (!ids.size) return;
  const plan = getPlan(familyId);
  if (plan.concerns.some((c) => ids.has(c.id))) savePlan(familyId, { ...plan, concerns: plan.concerns.filter((c) => !ids.has(c.id)) });
  const v = ongoingVisit(familyId, today);
  if (v && (v.data.agenda ?? []).some((a) => ids.has(a.id)))
    patch<VisitData>(v.id, {
      agenda: (v.data.agenda ?? []).filter((a) => !ids.has(a.id)),
      carried: v.data.carried && { ...v.data.carried, concerns: v.data.carried.concerns.filter((c) => !ids.has(c.id)) },
    });
}

/** 返事の最後に足す決まった文（並べた物が無ければ空） */
export function agendaNote(sides: ("child" | "mother")[], childName?: string): string {
  if (!sides.length) return "";
  return sides.every((x) => x === "child") ? `${childName ?? "赤ちゃん"}の次の健診で聞く事にも並べました` : "次の健診の『先生に聞く事』にも並べました";
}

function withAgendaNote(reply: string, note: string): string {
  if (!note) return reply;
  const r = reply.trim();
  return `${r}${r && !/[。！？!?」）)]$/.test(r) ? "。" : ""}${note}。`;
}

// ── 手帳の候補の下ごしらえ ──

type TechoItemOut = z.infer<typeof TechoItem>;

/** 全角の数字を半角にして、数字の並びだけを取り出す */
function digitsOf(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)).replace(/[^0-9]/g, "");
}

/**
 * 数が、話した・書いた言葉の中にあるか（近似の歯止め）。
 * 「3キロ120」→ 3.12kg のような言い換えも通すよう、数字の並び（小数点・先頭のゼロを除く）が言葉の数字の並びに含まれるかで見る。
 * 漢数字（三千百二十）で話した時は見分けられないので通す。
 */
export function numberWasSaid(n: number, said: string): boolean {
  if (/[二三四五六七八九十百千万]/.test(said)) return true;
  const want = digitsOf(String(n)).replace(/^0+/, "");
  if (!want) return digitsOf(said).includes("0");
  return digitsOf(said).includes(want);
}

/** 子どもの体重を、ページの欄の単位に直すページ（大人の体重は書いてあるまま） */
const CHILD_WEIGHT_PAGE: Partial<Record<TechoPageId, "weightKg" | "weightG">> = {
  growth: "weightKg",
  "child-checkup": "weightKg",
  birth: "weightG",
  newborn: "weightG",
};
const WEIGHT_KEYS = new Set(["weightKg", "weightG", "weight", "体重"]);

/**
 * 子どもの体重の書き方（「4,120 g」「4120g」「4.12kg」「3キロ120」）をグラムにする。読めなければ null（作らない）。
 * 単位が無い時は、100 以上ならグラム、100 未満ならキロ（子どもの体重で 100kg も 100g も無いので取り違えない）。
 */
export function gramsOf(v: string): number | null {
  const s = v.normalize("NFKC").replace(/\s/g, "").replace(/,/g, "");
  const mixed = s.match(/(\d+)(?:kg|キロ)(\d{1,3})(?:g|グラム)?/i);
  if (mixed) return Number(mixed[1]) * 1000 + Number(mixed[2]);
  const n = toNumber(s);
  if (n == null || n <= 0) return null;
  if (/kg|キロ/i.test(s)) return Math.round(n * 1000);
  if (/g|グラム/i.test(s)) return Math.round(n);
  return n >= 100 ? Math.round(n) : Math.round(n * 1000);
}

/** メモ・結果の文に書いてある「体重 4,120g」を拾う（Claude が体重を文に入れた時） */
function weightInText(s: string): string | null {
  const m = s.normalize("NFKC").match(/体重[^\d]{0,4}(\d[\d,.]*\s*(?:kg|キロ|g|グラム)?(?:\d{1,3}\s*(?:g|グラム)?)?)/i);
  return m ? m[1] : null;
}

type TechoItemIn = Omit<TechoItemOut, "dateWritten"> & { dateWritten?: boolean };

/** Claude の候補 → TechoEntry の形（整えるのは addTecho）。said があれば、そこに無い数字を捨てる */
export function techoFromItem(t: TechoItemIn, said: string | null): { page: TechoPageId; date: string; title: string; who?: string; values: Record<string, string> } {
  const values: Record<string, string> = {};
  const weightKey = CHILD_WEIGHT_PAGE[t.page];
  let weightRaw: string | null = null;
  for (const { key, value } of t.values) {
    const v = value.trim();
    if (!v) continue;
    // 子どもの体重は、欄の名前や単位が違っても、ページの欄に直して入れる
    if (weightKey && WEIGHT_KEYS.has(key)) {
      weightRaw ??= v;
      continue;
    }
    if (said != null && NUMBER_FIELDS.has(key)) {
      const n = toNumber(v);
      if (n == null || !numberWasSaid(n, said)) continue;
    }
    values[key] = v;
  }
  if (weightKey) {
    weightRaw ??= [values.memo, values.result].map((x) => (x ? weightInText(x) : null)).find((x) => x != null) ?? null;
    const g = weightRaw != null ? gramsOf(weightRaw) : null;
    const n = weightRaw != null ? toNumber(weightRaw.normalize("NFKC")) : null;
    if (g != null && (said == null || (n != null && numberWasSaid(n, said)))) {
      values[weightKey] = weightKey === "weightKg" ? String(Number((g / 1000).toFixed(3))) : String(g);
    }
  }
  return { page: t.page, date: t.date, title: t.title, ...(t.who ? { who: t.who } : {}), values };
}

// ── 日付が写っていない時、ページの題と子の生まれた日から推す ──

/** 「1か月児健診」「3〜4か月」「1歳6か月」「1歳半」「3歳」「2週間」→ 生まれた日からの {月, 日}。読めなければ null */
function ageFromText(text: string): { months: number; days: number } | null {
  const s = text.normalize("NFKC");
  let m = s.match(/(\d+)歳(\d+)\s*[かヶケカヵ]?月/);
  if (m) return { months: Number(m[1]) * 12 + Number(m[2]), days: 0 };
  m = s.match(/(\d+)歳半/);
  if (m) return { months: Number(m[1]) * 12 + 6, days: 0 };
  m = s.match(/(\d+)\s*[〜~ー\-・]\s*\d+\s*[かヶケカヵ]?月/);
  if (m) return { months: Number(m[1]), days: 0 };
  m = s.match(/(\d+)\s*[かヶケカヵ]月/);
  if (m) return { months: Number(m[1]), days: 0 };
  m = s.match(/(\d+)歳/);
  if (m) return { months: Number(m[1]) * 12, days: 0 };
  m = s.match(/(\d+)週間?(?:健診|目)/);
  if (m) return { months: 0, days: Number(m[1]) * 7 };
  return null;
}

/**
 * 紙に日付が無い記録の日を推す（推せなければ null。今日にはしない）。
 * 子のページは題（健診の名前・時期）と生まれた日、出産は生まれた日、新生児・産後は日数、妊婦健診は週数と予定日から。
 */
export function guessTechoDate(e: { page: TechoPageId; title: string; values: Record<string, string> }, family: { dueDate: string; birthDate?: string }, today: string): string | null {
  const b = family.birthDate;
  const num = (k: string) => (e.values[k] != null ? toNumber(e.values[k]) : null);
  let d: string | null = null;
  if (e.page === "pregnancy-checkup") {
    const w = (e.values.week ?? e.title).normalize("NFKC").match(/(\d+)\s*週?(?:\s*(\d)\s*日)?/);
    if (w && family.dueDate) d = addDays(lmpFromDue(family.dueDate), Number(w[1]) * 7 + Number(w[2] ?? 0));
  } else if (b && e.page === "birth") {
    d = b;
  } else if (b && e.page === "newborn") {
    const n = num("dayAge");
    if (n != null) d = addDays(b, Math.round(n));
  } else if (b && e.page === "postpartum") {
    const n = num("days");
    if (n != null) d = addDays(b, Math.round(n));
  } else if (b && (e.page === "growth" || e.page === "child-checkup" || e.page === "stool" || e.page === "development" || e.page === "vaccine")) {
    const age = ageFromText([e.title, e.values.checkup, e.values.ageText, e.values.memo].filter(Boolean).join(" "));
    if (age) d = addDays(addMonths(b, age.months), age.days);
  }
  if (!d || !isDate(d) || d > today) return null;
  return d;
}

/** 撮った紙の候補に、日付の確かさの印を付ける（推した日は "guess"、推せない時は "none"＝家族に入れてもらう） */
function withDateCheck<T extends { page: TechoPageId; date: string; title: string; values: Record<string, string> }>(item: T, t: TechoItemIn, family: Family, today: string): T & { dateUnsure?: "guess" | "none" } {
  if (t.dateWritten !== false && isDate(item.date)) return item;
  const guess = guessTechoDate(item, family, today);
  return guess ? { ...item, date: guess, dateUnsure: "guess" } : { ...item, date: today, dateUnsure: "none" };
}

// ── 聞き返しを残す（画面を開き直しても答えられるように） ──
// 記録の一覧（record）や一冊に混ざらないよう、type "ask" の行に1件ずつ置く（family_id は世帯の id のまま）。
// 前は family_id を「<家族>:ask」にして type "record" に置いていた（family_id に世帯でない値が入り、世帯ごと消す時に残った）。
// 前の行も読み、消す（id の形は同じ ask:<家族>:<束>）。

export interface CaptureAsk {
  captureId: string;
  question: string;
  basis: string;
  source: RecordSource;
}

/** 前の形の置き場（読むだけ） */
const legacyAskPlace = (familyId: string) => `${familyId}:ask`;
const askId = (familyId: string, captureId: string) => `ask:${familyId}:${captureId}`;

function saveAsk(familyId: string, ask: CaptureAsk, today: string) {
  put<CaptureAsk>(familyId, "ask", ask, { id: askId(familyId, ask.captureId), date: today });
}

/** 家族の聞き返し（新しい順。前の形の行も混ぜる） */
function listAsks(familyId: string, limit: number): Doc<CaptureAsk>[] {
  const now = list<CaptureAsk>(familyId, "ask", { limit });
  const old = list<CaptureAsk>(legacyAskPlace(familyId), "record", { limit });
  if (!old.length) return now;
  const key = (d: Doc<CaptureAsk>) => d.date ?? d.createdAt;
  return [...now, ...old].sort((a, b) => key(b).localeCompare(key(a)) || b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}

/** まだ答えていない、いちばん新しい聞き返し（今日から14日より前の物と、今日より後の物は出さない） */
export function latestAsk(familyId: string, today: string): (CaptureAsk & { date: string }) | null {
  const from = addDays(today, -14);
  const hit = listAsks(familyId, 20).find((d) => d.date && d.date <= today && d.date >= from && d.data?.question);
  return hit ? { ...hit.data, date: hit.date! } : null;
}

/** その聞き返しが、この家族の物として残っているか */
export function hasAsk(familyId: string, captureId: string): boolean {
  return listAsks(familyId, 200).some((d) => d.id === askId(familyId, captureId));
}

/** 答えた・やめた聞き返しを消す */
export function clearAsk(familyId: string, captureId: string): void {
  remove(askId(familyId, captureId));
}

const NUMBER_FIELDS = new Set(["heightCm", "weightKg", "bpHigh", "bpLow", "fundusCm", "weightG", "headCm", "chestCm", "days", "dayAge", "colorNo"]);

// ── 紙の母子手帳のページを撮る ──

const PageSchema = z.object({
  page: z.enum([...TECHO_PAGE_IDS, "unknown"] as unknown as [string, ...string[]]).describe("写っている府令様式のページ。母子手帳のページでない・分からなければ unknown"),
  entries: z.array(TechoItem).describe("ページに書いてある行（1行＝1件。健診なら1回の健診、接種なら1回の接種）。空欄の行は入れない"),
  unreadable: z.boolean().describe("かすれ・ぼけ・影で読めない所があった時 true"),
  reply: z.string().describe("家族への短い返事（話し言葉・2文まで）。例: 「妊婦健診のページから3回分を写しました。OK を押すと手帳に入ります」"),
});
export type TechoPhotoOutput = z.infer<typeof PageSchema>;

const PAGE_SYSTEM = `あなたの役割は、紙の母子健康手帳（国の様式＝府令様式）のページの写真を読み、手帳の記録の行を写す書記です。紙の手帳が正本です。
やる事:
- 写っているのが府令様式のどのページかを page に入れる。母子手帳でない紙なら unknown にして entries は空。
- 書いてある行を entries に写す。1行＝1件（健診1回・接種1回・計測1回）。日付は書いてある日（和暦なら西暦に直す）。日付が書いていない・読めない行も入れ、date は空文字、dateWritten は false にする（今日の日付にしない。日付は機械がページの題と生まれた日から推して、家族に確かめる）。
- 書いてある文字・数字だけを写す。読めない・空欄の欄は入れない（空のまま）。かすれた数字を推測しない。計算もしない。
- 医師・助産師の書いた所見・結果も、書いてあるとおりに写すだけ。良い・悪い・正常・異常は言わない。
- 個人番号・住所の番地・電話番号は写さない。
- reply は短い話し言葉。数字の良い悪いには触れない。

${TECHO_RULES}`;

export interface TechoPhotoResult {
  captureId: string;
  page: TechoPageId | "unknown";
  unreadable: boolean;
  reply: string;
  techo: TechoDoc[];
}

/** 紙の母子手帳のページの写真 → 行を候補（pending）として保存。画像そのものは保存しない */
export async function captureTechoPage(input: { family: Family; today: string; image: Anthropic.Beta.BetaImageBlockParam; note?: string }): Promise<TechoPhotoResult> {
  const { family, today } = input;
  const parts: Anthropic.Beta.BetaContentBlockParam[] = [
    input.image,
    { type: "text", text: `${context(family, today)}\n\n紙の母子健康手帳のページの写真です。${input.note?.trim() ? `添え書き: ${input.note.trim()}` : ""}` },
  ];
  const out = await structured(PageSchema, PAGE_SYSTEM, parts, { model: EVERYDAY_MODEL, maxTokens: 8000, task: "capture-page" });
  const captureId = randomUUID();
  const src: TechoSource = "photo";
  const techo =
    out.page === "unknown"
      ? []
      : addTecho(
          family.id,
          out.entries.map((t) => withDateCheck(techoFromItem(t, null), t, family, today)),
          { today, source: src, pending: true, captureId },
        );
  return { captureId, page: out.page as TechoPageId | "unknown", unreadable: out.unreadable, reply: out.reply, techo };
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
    { at: birth, kind: "できごと", title: "ひなたが生まれた", detail: "予定日より2週間早く。翔太が最初に名前を呼んだら、少しだけ泣き止んだ。", who: "翔太", source: "voice" },
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
export function seedDemo(familyId: string = DEMO_FAMILY.id): CaptureRecord[] {
  return seedItems().map((s, i) =>
    put<RecordData>(
      familyId,
      "record",
      { kind: s.kind, title: s.title, detail: s.detail, who: s.who, source: s.source, seed: true },
      { id: `record:${familyId}:seed:${String(i + 1).padStart(2, "0")}`, date: s.at },
    ),
  );
}

/** 答えの形（試験と、鍵の無い時の見本の答え lib/samples.ts の確かめに使う） */
export { Schema as CaptureSchema, PageSchema };

/** 打って入れた記録（VISION ①「押し付けない」）。家族が自分で書いた物なので、Claude を通さずそのまま入れる */
export function addManualRecord(familyId: string, input: ManualInput, today: string): CaptureRecord {
  const r = cleanManual(input, today);
  if (!r.ok) throw new HttpError(400, r.error);
  const { date, ...data } = r.value;
  return put<RecordData>(familyId, "record", { ...data, source: "text" }, { date });
}

/** 体温を打って入れる */
export function addTemperature(familyId: string, raw: string, date: string, today: string, who?: string): CaptureRecord {
  const r = temperatureRecord(raw, date || today, today, who);
  if (!r.ok) throw new HttpError(400, r.error);
  const { date: day, ...data } = r.value;
  return put<RecordData>(familyId, "record", { ...data, source: "text" }, { date: day });
}
