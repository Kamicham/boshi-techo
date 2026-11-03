// 「手帳に聞く」の頭: 家族の問いに、道具でこの家族の今を見てから答え、動きを添える。
// 答える事（手続き・期限・お金・仕事・町・アプリの操作）は全部その場で。体・心・栄養は判断せず橋をかける（大会の避ける題材・ビジョン⑤）。
// 歯止めは3つ: ①機械の床（bridge.ts。急ぎ・心の危機の言葉に必ず連絡先）②会話の決まり（ASK_RULES＋CHARTER）
// ③見張り（軽いモデルが返事を読み、判断の言葉があれば書き直させる）。
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { guideText } from "../app-guide";
import { situationFacts } from "../advisor";
import { CHARTER, claude, LIGHT_MODEL, MODEL, structured } from "../claude";
import { clockAt } from "../clock";
import { get, put } from "../db";
import type { Family } from "../demo-family";
import { getKeep } from "../keep";
import { checkBudget, recordSpend } from "../spend";
import { STOOL_NOTE, DEVELOPMENT_NOTE, GROWTH_NOTE } from "../techo";
import { bridgeFor } from "./bridge";
import { runTool, TOOLS, type ToolCtx } from "./tools";
import type { AskAction, ChatTurn } from "./types";

const FALLBACK_BETA = "server-side-fallback-2026-07-01";
/** 道具を使う手の上限（無限に回らないように） */
const MAX_STEPS = 8;
/** Claude に渡す前の会話の数 */
const HISTORY_TURNS = 20;
/** DB に残す会話の数 */
const KEEP_TURNS = 80;

export const ASK_RULES = `あなたは今、家族からの問いに答えています（「手帳に聞く」の窓）。
答え方:
- 手続き・期限・持ち物・窓口・お金（手当・給付・助成）・仕事（産休・育休・職場への連絡）・保育園・里帰り・引っ越し・この家族の予定と記録・アプリの操作は、全部その場で自然に答える。はぐらかさない。
- 答える前に道具でこの家族の今を見る（予定は get_plan、記録は get_notebook）。推測で語らない。町ごとに違う中身は look_up_town（予定にある手続き）か search_official（予定に無い事）で公式のページから取る。言い切れない所は「窓口に確かめる」と書く。
- 返事の文で「押すと〜」「記録できます」「健診で聞けます」「どこへ行くか見る」と触れた動きは、必ず同じ返事で道具を呼んでボタンにする（文で言うだけにしない）。
- 添える動きは、問いに関係する物だけ。聞かれていない別の手続きのボタンを足さない（関係する期限が迫っている時は、文で一言だけ触れる）。家族が言っていない事（日付・様子）を書き足さない。
- 答えるだけで終わらず、次の一手を道具で返事の下に添える（画面へ連れて行く・どこへ行くか見る／下書き・済みにする・健診で聞く・記録する・渡す文）。動きは1つの返事に3つまで。要らなければ添えない。
- アプリの操作は、下の「画面の地図」だけを根拠に、押す場所まで言う。地図に無い機能は作らず「この手帳にはまだありません」と言い、代わりにできる事を言う。行き先のボタンは open_screen。
- ボタンを出しただけでは、何も入っていない・何も変わっていない（「入れておきました」「記録しました」と言わない）。
- 「安心してください」「大丈夫」と、家族の状況を請け合わない。
- ボタンの数や「上の」「下の」といった位置は書かない（画面の並びは変わる）。「〜を押すと…します」と、押した時に起きる事だけ言う。
- 予定で「済み」や「過ぎた」になっている事を聞かれても、期限・窓口・持ち物は答える（済んでいなければ、済みにするボタンや窓口のボタンを出す）。
- 外へは何も送らない。文を作っても、送るのは家族（「送りました」と言わない）。ボタンを出しただけの時は「押すと〜します」と言う。
体・心・栄養の問い（橋をかける）:
- 体・病気・症状・薬・発達・成長・体重などの数値・便の色の良し悪しは判断しない。「大丈夫」「心配ない」「正常」「異常」「よくある」「様子を見てよい」「〜の可能性」を言わない。病気や症状の一般的な説明もしない。
- 代わりに、受け止める1文 → 日付つきで記録する（add_record）か次の健診で先生に聞く（add_checkup_question）を、必ず道具で出す → 連絡先（妊娠中・産後の体はかかりつけの産院・夜間も、子どもはかかりつけか #8000、迷ったら119）。
- 急ぎでない問い（発達・数値・様子の気がかり）には、119 を添えない。連絡先は、かかりつけ・#8000（子ども）・産院（ママの体）まで。
- 母子手帳そのものの注意書きは、そのまま伝えてよい（言い換えない）: 便色「${STOOL_NOTE}」 発達「${DEVELOPMENT_NOTE}」 発育曲線「${GROWTH_NOTE}」
- 心のつらさ（イライラ・涙・不安・孤独・夫婦の事も）は、相談やカウンセリングをしない。気持ちの言い換え・原因の見立て・対処のこつ・相手への文（頼まれていない時）も出さない。受け止める1文と、町のこども家庭センター・電話の相談先（こころの健康相談統一ダイヤル 0570-064-556・よりそいホットライン 0120-279-338）を必ず文で案内する。気持ちを手帳の「気持ちの記録」に残す事はできる（add_record）。
- 授乳・ミルクの量・離乳食・食事の指導はしない。健診と町の保健センターの栄養相談へつなぐ。
- 子育ての一般知識の講義をしない。この家族の今と、次の一手に絞る。
書き方:
- 話し言葉で短く。3〜6文。並べる時は「・」で3つまで。見出し・表・太字の記号（**や#）は使わない。
- 日付は「11月20日（あと12日）」の形。根拠は（戸籍法第49条）のように括弧で短く。
- 家族を名前で呼んでよい。押し付けない（「〜しましょう」より「〜できます」）。`;

/** 変わらない部分（キャッシュする）: 約束・会話の決まり・画面の地図 */
const STATIC_SYSTEM = `${CHARTER}\n\n${ASK_RULES}\n\n画面の地図（このアプリでできる事のすべて）:\n${guideText()}`;

/** 家族の形（変わるのはまれ） */
function familySystem(family: Family): string {
  const keep = getKeep(family.id);
  const lines = [
    `家族: ${family.members.map((m) => `${keep.names?.[m.id] || m.name}（${m.role}）`).join("・") || "（まだ入っていない）"}${family.childName ? `、子: ${family.childName}` : ""}`,
    `住む町: ${family.prefecture}${family.city || "（まだ入っていない）"}${family.previousCity && family.movedOn ? `（${family.movedOn}に${family.previousPrefecture ?? ""}${family.previousCity}から引っ越した）` : ""}`,
    `出産予定日: ${family.dueDate}${family.birthDate ? `、生まれた日: ${family.birthDate}` : "（まだ生まれていない）"}`,
    ...situationFacts(family),
    keep.hospital?.name ? `通う病院: ${keep.hospital.name}${keep.hospital.phone ? `（電話 ${keep.hospital.phone}）` : ""}` : "通う病院: まだ入っていない",
    keep.work?.company ? `職場: ${keep.work.company}${keep.work.boss ? `（上司 ${keep.work.boss}）` : ""}` : "",
  ].filter(Boolean);
  return `この家族（作った家族のこともある）:\n${lines.join("\n")}`;
}

// ── 会話の記憶（家族ごとに1つ） ──

interface ChatDoc {
  turns: ChatTurn[];
}
const chatId = (familyId: string) => `chat:${familyId}`;

export function getChat(familyId: string): ChatTurn[] {
  return get<ChatDoc>(chatId(familyId))?.data.turns ?? [];
}
export function saveChat(familyId: string, turns: ChatTurn[]): void {
  put<ChatDoc>(familyId, "chat", { turns: turns.slice(-KEEP_TURNS) }, { id: chatId(familyId) });
}
export function clearChat(familyId: string): void {
  put<ChatDoc>(familyId, "chat", { turns: [] }, { id: chatId(familyId) });
}

// ── 見張り ──

const GuardSchema = z.object({
  ok: z.boolean().describe("問題が無ければ true"),
  problems: z.array(z.string()).describe("問題の箇所と理由（無ければ空）"),
});

const GUARD_SYSTEM = `あなたは母子手帳アプリの返事を出す前に読む見張りです。次のどれかが返事に入っていたら ok=false にし、problems に箇所を書きます。
- 体・病気・症状・薬・発達・成長・数値・便の色について、良い／悪い／正常／異常／大丈夫／心配ない／よくある／様子を見てよい／〜の可能性 と判断している
- 病気や症状の医学的な説明、治療・薬・受診の要否の判断をしている（「迷ったら連絡を」「健診で聞く」「#8000・119・産院へ」と勧めるのは問題ない）
- 心の相談・カウンセリングをしている（受け止める1文と相談先の案内は問題ない）
- 授乳量・離乳食・栄養の指導をしている
- 「送りました」「予約しました」など、していない事をした事にしている
- 母子手帳の注意書き（便色カードの「1〜3番に近い色の時は…受診」など）をそのまま伝えるのは問題ない
手続き・期限・お金・仕事・アプリの操作の答えは、内容の正しさは見ず、上の点だけを見る。`;

async function guard(question: string, reply: string): Promise<z.infer<typeof GuardSchema>> {
  try {
    return await structured(GuardSchema, GUARD_SYSTEM, `家族の問い:\n${question}\n\n手帳の返事:\n${reply}`, { model: LIGHT_MODEL, maxTokens: 1500, effort: "low" });
  } catch {
    // 見張りが動かない時は、通す（床と決まりは効いている）。ログにだけ残す
    console.error("ask: 見張りが動きませんでした");
    return { ok: true, problems: [] };
  }
}

async function rewrite(reply: string, problems: string[]): Promise<string> {
  checkBudget();
  const res = await claude().beta.messages.create({
    model: MODEL,
    max_tokens: 3000,
    system: [{ type: "text", text: `${CHARTER}\n\n${ASK_RULES}` }],
    messages: [
      {
        role: "user",
        content: `次の返事に、見張りから指摘がありました。指摘の箇所を直し（判断の言葉は消し、記録・健診で聞く・連絡先への橋に変える）、ほかの内容と長さはなるべくそのままにして書き直してください。書き直した返事の文だけを出してください。\n\n返事:\n${reply}\n\n指摘:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      },
    ],
    output_config: { effort: "low" },
    betas: [FALLBACK_BETA],
    fallbacks: "default",
  });
  recordSpend("ask-rewrite", res.model ?? MODEL, res.usage);
  return textOf(res) || reply;
}

const textOf = (res: Anthropic.Beta.BetaMessage) =>
  res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/\*\*/g, "")
    .trim();

// ── 1回の問い ──

export interface AskInput {
  family: Family;
  today: string;
  text: string;
  /** 聞いた人（呼び名と役） */
  who?: { name: string; role: string };
  /** いま開いている画面 */
  path?: string;
  onStatus?: (text: string) => void;
  /** 前の会話（無ければ DB から） */
  history?: ChatTurn[];
}

export interface AskResult {
  turn: ChatTurn;
  /** 見張りが書き直したか（検査用） */
  rewritten: boolean;
  /** 使った道具の名前（検査用） */
  tools: string[];
}

export async function ask(input: AskInput): Promise<AskResult> {
  const { family, today } = input;
  const text = input.text.trim().slice(0, 2000);
  const onStatus = input.onStatus ?? (() => {});
  const c = clockAt(family, today);
  const bridge = bridgeFor(text, c.phase === "pregnant" ? "pregnant" : c.phase === "child" ? "child" : "other");

  const history = (input.history ?? getChat(family.id)).slice(-HISTORY_TURNS);
  const messages: Anthropic.Beta.BetaMessageParam[] = [];
  for (const t of history) {
    const content = t.role === "assistant" && t.actions?.length ? `${t.text}\n（添えた動き: ${t.actions.map(actionWord).join("・")}）` : t.text;
    const last = messages[messages.length - 1];
    // 同じ役が続く時（途中で失敗した問いなど）はまとめる
    if (last && last.role === t.role) last.content = `${last.content as string}\n${content}`;
    else messages.push({ role: t.role, content });
  }
  if (messages[0]?.role === "assistant") messages.shift();
  const head = [
    `今日: ${today}（${c.label}）`,
    input.path ? `いま開いている画面: ${input.path}` : "",
    input.who ? `聞いた人: ${input.who.name}（${input.who.role}）` : "",
    bridge.note ? `機械の床からの指示: ${bridge.note}（電話のボタンはもう出してある。返事の頭には機械が「${bridge.lead}」を置くので、同じ事を繰り返さず、その続きから書く）` : "",
  ].filter(Boolean);
  const userContent = `（${head.join(" ・ ")}）\n${text}`;
  if (messages[messages.length - 1]?.role === "user") messages[messages.length - 1].content = `${messages[messages.length - 1].content as string}\n${userContent}`;
  else messages.push({ role: "user", content: userContent });

  const ctx: ToolCtx = { family, today, actions: [], sources: [], onStatus };
  const used: string[] = [];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: familySystem(family) },
  ];

  onStatus("考えています");
  let reply = "";
  // 道具を呼ぶ前に書いた文も取っておく（道具の後の最後の返事が空の時、これで答える）
  const said: string[] = [];
  let nudged = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    checkBudget();
    const last = step === MAX_STEPS - 1;
    const res = await claude().beta.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system,
      messages,
      tools: TOOLS,
      ...(last ? { tool_choice: { type: "none" as const } } : {}),
      output_config: { effort: "medium" },
      betas: [FALLBACK_BETA],
      fallbacks: "default",
    });
    recordSpend("ask", res.model ?? MODEL, res.usage);
    if (res.stop_reason === "refusal") {
      reply = "ごめんなさい、この問いにはお答えできません。手続きや予定のこと、アプリの使い方なら聞いてください。";
      break;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const t = textOf(res);
    if (t) said.push(t);
    if (res.stop_reason !== "tool_use" || calls.length === 0) {
      reply = t || said.join("\n");
      // 考えただけで文が無いまま終わった時は、1回だけ文を頼み直す
      if (!reply && !nudged && !last) {
        nudged = true;
        messages.push({ role: "assistant", content: res.content.length ? res.content : [{ type: "text", text: "（考えています）" }] });
        messages.push({ role: "user", content: "（家族への返事の文がまだありません。ここまでに見た事を使って、返事の文だけを書いてください）" });
        continue;
      }
      break;
    }
    messages.push({ role: "assistant", content: res.content });
    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      used.push(call.name);
      let out: string;
      let isError = false;
      try {
        out = await runTool(call.name, (call.input ?? {}) as Record<string, unknown>, ctx);
      } catch (e) {
        isError = true;
        out = `うまくいきませんでした: ${e instanceof Error ? e.message : String(e)}。家族には、確かめられなかった事をそのまま伝える`;
      }
      results.push({ type: "tool_result", tool_use_id: call.id, content: out, ...(isError ? { is_error: true } : {}) });
    }
    messages.push({ role: "user", content: results });
    onStatus("まとめています");
  }
  if (!reply) reply = said.join("\n");
  if (!reply) reply = "うまくまとめられませんでした。もう一度、聞き方を変えて聞いてください。";

  onStatus("答えを確かめています");
  const g = await guard(text, reply);
  let rewritten = false;
  if (!g.ok && g.problems.length) {
    reply = await rewrite(reply, g.problems);
    rewritten = true;
  }

  // 急ぎ・心の危機・便色カードの1〜3番は、返事の頭に機械で決めた1文を置く（Claude の書き方に任せない）
  if (bridge.lead) {
    // Claude が同じ文を繰り返していたら除く（手帳の注意書きの引用など）
    for (const line of bridge.lead.split("\n")) {
      const core = line.match(/「(.+)」/)?.[1];
      if (core) reply = reply.split(core).join("").replace(/「」(と書いてあります。?)?/g, "").replace(/(母子手帳の)?便色カードには、?(こう)?書いてあります。?/g, "");
    }
    reply = `${bridge.lead}\n\n${reply.replace(/\n{3,}/g, "\n\n").trim()}`;
  }
  const actions = dedupe([...bridge.actions, ...ctx.actions]);
  const sources = [...new Map(ctx.sources.map((s) => [s.url, s])).values()].slice(0, 5);
  const turn: ChatTurn = { role: "assistant", text: reply, today, at: new Date().toISOString(), ...(actions.length ? { actions } : {}), ...(sources.length ? { sources } : {}) };
  return { turn, rewritten, tools: used };
}

function actionWord(a: AskAction): string {
  switch (a.type) {
    case "open":
      return `${a.label}へ行くボタン`;
    case "concern":
      return `健診で聞く事「${a.text}」`;
    case "record":
      return `記録「${a.text.slice(0, 30)}」`;
    case "done":
      return `「${a.label}」を済みにするボタン`;
    case "milestone":
      return `「${a.label}」の窓口・下書きのボタン`;
    case "message":
      return `${a.to}への文`;
    case "call":
      return `${a.label}（${a.tel}）`;
  }
}

function dedupe(actions: AskAction[]): AskAction[] {
  const seen = new Set<string>();
  return actions.filter((a) => {
    // 行き先と電話は、言葉が違っても同じ所なら1つ
    const k = a.type === "open" ? `open:${a.href}` : a.type === "call" ? `call:${a.tel}` : JSON.stringify(a);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
