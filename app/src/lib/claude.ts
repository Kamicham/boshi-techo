// Claude を呼ぶ共通の部品。サーバ側（API ルート）だけで使う。
//
// 送る前の関所（家族ごとのアカウントの設計 ⑥）:
// - だれの記録を送るか（世帯・本人・送った人）を、呼ぶ口の opts.who か、route が sendingAs() で包んだ範囲から受け取る
// - 本物の世帯（kind = real）は、送る本人の全員に「米国の Claude に送る同意（claude_us）」が有効な時だけ送る。
//   1人でも無ければ送らず、分かる言葉の誤り（ConsentRequiredError・403）を返す
// - 作った家族（demo・sim）は守る本人がいないので、同意は見ない
// - 送った日時・本人・何の仕事かを audit に残す。使った額の行（spend.jsonl）にも世帯と送った人を書く
// - アカウントの仕組みを動かす前（わが家の置き場・BOSHI_ACCOUNTS なし）は、今までどおり送る（同意の表がまだ無い）
// - だれの記録か分からないまま呼ばれた時（関所をまだ通していない道）は、警告を出して今までどおり送る
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";
import { HttpError } from "./http-error";
import { activeConsent, audit } from "./households";
import { checkBudget, checkHouseholdBudget, checkSimHouseholdBudget, recordSpend } from "./spend";

export const MODEL = "claude-opus-5-5";
/** 言い換え・整形など軽い仕事 */
export const LIGHT_MODEL = "claude-haiku-5-5";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claude(): Anthropic {
  // 鍵が無い時は、英語の SDK の誤りでなく、何をすればよいかを日本語で返す（配布した人が最初に当たる所）
  if (!process.env.ANTHROPIC_API_KEY) throw new HttpError(503, "Claude の鍵がありません。app/.env.local に ANTHROPIC_API_KEY を入れて、サーバを起動し直してください（鍵は Claude Console で作れます）");
  client ??= new Anthropic();
  return client;
}

/** この手帳の全員に共通の約束（体の判断をしない＝ビジョン⑤「橋」） */
export const CHARTER = `あなたは家族の「母子手帳」に住むエージェントです。子どもを考えた日から2歳まで（1000日）、家族の全体を持って先回りして動きます。
守ること:
- 体や病気の判断・診断・治療の助言・薬の判断はしない。良い・悪い・正常・異常を言わない。気になる事は日付つきで記録し、主治医への質問に変えて渡す。急ぎに見える時は連絡を勧める: 妊娠中・産後の体はかかりつけの産院（夜間も）・119、子どもは #8000（子ども医療電話相談。子ども専用）。
- 心の相談・栄養の指導はしない。必要なら専門の窓口を案内する。
- 制度や期限は、根拠（法律・自治体のページ）が分かる時だけ言い切る。分からない時は「確かめる」と書く。
- 家族の言葉で、短く、やさしく。専門用語は元の言葉を残して横に言い換えを添える。`;

type Content = Anthropic.Beta.BetaContentBlockParam[] | string;

// ───────── だれの記録を送るか（送る前の関所） ─────────

/** だれの記録を送るか。route が関所（withHousehold）を通った後に組む */
export interface SendWho {
  householdId: string;
  kind: "real" | "demo" | "sim";
  /** 送る操作をした人（公開の世帯をログインなしで開いた時・移る前は null） */
  accountId: string | null;
  /** 送る記録の本人（subjects.id）。本物の世帯では、この全員の claude_us の同意が要る */
  subjectIds: readonly string[];
  /** アカウントの仕組みを動かす前（わが家の置き場・BOSHI_ACCOUNTS なし）。同意と記録の表がまだ無いので、今までどおり送る */
  legacy?: boolean;
  /** 送る中身に家族の記録が入らない（町の名前と手続きの名前だけで調べる時など）。同意は見ず、記録だけ残す */
  noPersonal?: boolean;
}

/** 同意がまだなので送らなかった（画面は「同意すると文字にまとめられます」を出す） */
export class ConsentRequiredError extends HttpError {
  readonly code = "consent_required";
  constructor(public readonly missing: readonly string[]) {
    super(403, "米国の Claude に送る同意が、まだの人がいます。わが家の設定 →「アカウントの画面へ」→「本人ごとの同意」で同意すると、文字にまとめられます");
  }
}

const sending = new AsyncLocalStorage<SendWho>();

/** fn の中で呼ばれた Claude は、すべて who の記録として送る（関所と記録が効く）。route で Claude を呼ぶ所を包む */
export function sendingAs<T>(who: SendWho, fn: () => Promise<T>): Promise<T> {
  return sending.run(who, fn);
}

/** 今の範囲で送る人（無ければ null） */
export function currentSender(): SendWho | null {
  return sending.getStore() ?? null;
}

/**
 * 同意だけを確かめる（記録は残さない）。送る前に時間のかかる仕事（文字起こしなど）をする route が、先に呼ぶ。
 * 本物の世帯で、送る本人の全員に claude_us の同意が無ければ ConsentRequiredError
 */
export function assertConsent(who: SendWho): void {
  if (who.legacy || who.kind !== "real" || who.noPersonal) return;
  // 同意の表は、関所（withHousehold）を通った後なら必ずある
  const missing = who.subjectIds.filter((s) => !activeConsent(who.householdId, s, "claude_us"));
  if (!who.subjectIds.length || missing.length) throw new ConsentRequiredError(missing);
}

/**
 * 送る前の関所。送ってよい時だけ戻る（だめなら ConsentRequiredError）。送ったという記録も残す。
 * lib/claude.ts を通らずに Claude を呼ぶ所（claude() を直に使う所）は、呼ぶ前にこれを呼ぶ。
 */
export function guardSend(task: string, who: SendWho | null = currentSender()): SendWho | null {
  if (!who) {
    console.warn(`[claude] だれの記録か分からないまま Claude を呼びました（${task}）。route で sendingAs() に包んでください`);
    return null;
  }
  // シミュレーションでは、1つの家族がほかの家族の分まで使い切らないよう、家族ごとにも上限を見る（BOSHI_SIM_HOUSEHOLD_USD）
  checkSimHouseholdBudget(who.householdId);
  if (who.legacy) return who;
  assertConsent(who);
  try {
    audit(who.householdId, who.accountId, "claude.send", { target: task, detail: { subjects: who.subjectIds, kind: who.kind, ...(who.noPersonal ? { noPersonal: true } : {}) } });
  } catch (e) {
    console.error("[claude] 送った記録を残せませんでした", e);
  }
  checkHouseholdBudget(who.householdId);
  return who;
}

export interface AskOptions {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
  /** だれの記録を送るか（無ければ sendingAs の範囲から） */
  who?: SendWho;
  /** 送った記録に書く仕事の名前（例: capture・book） */
  task?: string;
}

const spendWho = (who: SendWho | null) => (who ? { household: who.householdId, account: who.accountId } : undefined);

/** 決まった形（zod）で答えを受け取る */
export async function structured<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Content,
  opts: AskOptions = {},
): Promise<z.infer<S>> {
  const model = opts.model ?? MODEL;
  const useFallback = model === MODEL;
  const who = guardSend(opts.task ?? "structured", opts.who ?? currentSender());
  checkBudget();
  const res = await claude().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [{ type: "text", text: `${CHARTER}\n\n${system}` }],
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(schema), effort: opts.effort ?? "medium" },
    ...(useFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  });
  recordSpend("structured", res.model ?? model, res.usage, spendWho(who));
  if (res.stop_reason === "refusal") throw new Error("Claude がこの依頼を断りました");
  if (res.parsed_output == null) throw new Error("答えの形が読めませんでした");
  return res.parsed_output as z.infer<S>;
}

export interface SearchResult {
  text: string;
  sources: { title: string; url: string }[];
}

/** web 検索を使って調べ、文章と出典を返す（自治体の制度など） */
export async function research(system: string, question: string, opts: AskOptions & { domains?: string[] } = {}): Promise<SearchResult> {
  const tools = [
    {
      type: "web_search_20260209" as const,
      name: "web_search" as const,
      max_uses: 6,
      user_location: { type: "approximate" as const, country: "JP", timezone: "Asia/Tokyo" },
      ...(opts.domains ? { allowed_domains: opts.domains } : {}),
    },
  ];
  const who = guardSend(opts.task ?? "research", opts.who ?? currentSender());
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: question }];
  let res: Anthropic.Beta.BetaMessage | undefined;
  for (let i = 0; i < 4; i++) {
    checkBudget();
    res = await claude().beta.messages.create({
      model: opts.model ?? MODEL,
      max_tokens: opts.maxTokens ?? 16000,
      system: [{ type: "text", text: `${CHARTER}\n\n${system}` }],
      messages,
      tools,
      output_config: { effort: opts.effort ?? "medium" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    recordSpend("research", res.model ?? opts.model ?? MODEL, res.usage, spendWho(who));
    if (res.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: res.content });
  }
  if (!res) throw new Error("検索の答えがありません");
  if (res.stop_reason === "refusal") throw new Error("Claude がこの依頼を断りました");
  const text = res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  // 出典は、答えの中で実際に引用されたページだけ。引用が無い時だけ検索で当たったページを使う
  const cited = new Map<string, string>();
  const searched = new Map<string, string>();
  for (const b of res.content) {
    if (b.type === "text" && b.citations) {
      for (const c of b.citations) {
        if (c.type === "web_search_result_location") cited.set(c.url, c.title ?? c.url);
      }
    }
    if (b.type === "web_search_tool_result" && Array.isArray(b.content)) {
      for (const r of b.content) if (r.type === "web_search_result") searched.set(r.url, r.title);
    }
  }
  const sources = cited.size ? cited : searched;
  return { text, sources: [...sources].map(([url, title]) => ({ url, title })) };
}

/** 画像（base64）を Claude に渡す形にする */
export function imageBlock(dataUrl: string): Anthropic.Beta.BetaImageBlockParam {
  const m = dataUrl.match(/^data:(image\/(?:png|jpeg|gif|webp));base64,(.+)$/);
  if (!m) throw new Error("画像の形式が読めません（png・jpeg・gif・webp）");
  return { type: "image", source: { type: "base64", media_type: m[1] as "image/png", data: m[2] } };
}
