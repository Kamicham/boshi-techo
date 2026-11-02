// Claude を呼ぶ共通の部品。サーバ側（API ルート）だけで使う。
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import type { z } from "zod";

export const MODEL = "claude-opus-5-5";
/** 言い換え・整形など軽い仕事 */
export const LIGHT_MODEL = "claude-haiku-5-5";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";

let client: Anthropic | null = null;
export function claude(): Anthropic {
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

export interface AskOptions {
  model?: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  maxTokens?: number;
}

/** 決まった形（zod）で答えを受け取る */
export async function structured<S extends z.ZodType>(
  schema: S,
  system: string,
  content: Content,
  opts: AskOptions = {},
): Promise<z.infer<S>> {
  const model = opts.model ?? MODEL;
  const useFallback = model === MODEL;
  const res = await claude().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: [{ type: "text", text: `${CHARTER}\n\n${system}` }],
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(schema), effort: opts.effort ?? "medium" },
    ...(useFallback ? { betas: [FALLBACK_BETA], fallbacks: "default" as const } : {}),
  });
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
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: "user", content: question }];
  let res: Anthropic.Beta.BetaMessage | undefined;
  for (let i = 0; i < 4; i++) {
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
