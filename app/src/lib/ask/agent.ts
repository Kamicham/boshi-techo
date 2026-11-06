// 「手帳に聞く」の頭: 家族の問いに、道具でこの家族の今を見てから答え、動きを添える。
// 答える事（手続き・期限・お金・仕事・町・アプリの操作）は全部その場で。体・心・栄養は判断せず橋をかける（大会の避ける題材・ビジョン⑤）。
// 歯止めは3つ: ①機械の床（bridge.ts。急ぎ・心の危機の言葉に必ず連絡先）②会話の決まり（ASK_RULES＋CHARTER）
// ③見張り（軽いモデルが返事を読み、判断の言葉があれば書き直させる）。
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { guideText } from "../app-guide";
import { situationFacts } from "../advisor";
import { CHARTER, claude, ConsentRequiredError, currentSender, EVERYDAY_MODEL, guardSend, LIGHT_MODEL, sampleMode, spendWho, structured } from "../claude";
import { sampleAskReply } from "../samples";
import { clockAt } from "../clock";
import { get, put } from "../db";
import type { Family } from "../demo-family";
import { getKeep } from "../keep";
import { worksByMember } from "../whose";
import { checkBudget, recordSpend } from "../spend";
import { STOOL_NOTE, DEVELOPMENT_NOTE, GROWTH_NOTE } from "../techo";
import { t, withLang, type Lang } from "../i18n";
import { dictFor, tFor } from "../i18n/dicts";
import { bridgeFor, stripLeadRepeats } from "./bridge";
import { ruleAnswer, ruleKind, type PlanView } from "./rule-answer";
import { prenatalState } from "../prenatal";
import { listTecho } from "../techo-store";
import { getPlan } from "@/app/api/visit/_lib/server";
import { planSnapshot, runTool, TOOLS, type ToolCtx } from "./tools";
import type { AskAction, ChatTurn } from "./types";

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
- 家族への返事の文は、道具を使い終えた最後の一手にまとめて書く。道具を呼ぶ手では返事を書かない（その手の文は、家族にそのままは届かない）。
- 返事の文で「押すと〜」「記録できます」「健診で聞けます」「どこへ行くか見る」と触れた動きは、必ず同じ返事で道具を呼んでボタンにする（文で言うだけにしない）。
- 添える動きは、問いに関係する物だけ。聞かれていない別の手続きのボタンを足さない（関係する期限が迫っている時は、文で一言だけ触れる）。家族が言っていない事（日付・様子）を書き足さない。
- 答えるだけで終わらず、次の一手を道具で返事の下に添える（画面へ連れて行く・どこへ行くか見る／下書き・済みにする・健診で聞く・記録する・渡す文）。動きは1つの返事に3つまで。要らなければ添えない。
- アプリの操作は、下の「画面の地図」だけを根拠に、押す場所まで言う。地図に無い機能は作らず「この手帳にはまだありません」と言い、代わりにできる事を言う。行き先のボタンは open_screen。
- ボタンを出しただけでは、何も入っていない・何も変わっていない（「入れておきました」「記録しました」と言わない）。
- 「安心してください」「大丈夫」と、家族の状況を請け合わない。
- ボタンの数や「上の」「下の」といった位置は書かない（画面の並びは変わる）。「〜を押すと…します」と、押した時に起きる事だけ言う。
- 予定で「済み」や「過ぎた」になっている事を聞かれても、期限・窓口・持ち物は答える（済んでいなければ、済みにするボタンや窓口のボタンを出す）。
- 家族が「〜を出した・済ませた」と言った事がもう済みの時や、聞かれた事が済みの時は、文で「次はこれ」と挙げた期限の近い手続き1つに offer_paperwork を出す（文で「今日の画面のカードから」と案内するだけにしない）。
- 日付と「あと◯日」は、get_plan の値をそのまま写す。自分で足し引きしない。年が書いてある日は年も書く。
- 予定の「担当」を見る。聞いた人の番でない事を、聞いた人の期限として書かない（「職場に伝えるのは◯日まで、パートナー（翔太さん）の産後パパ育休の申し出は◯日まで、ふつうの育休の申し出は◯日まで」と分ける）。産後パパ育休（出生時育児休業）の申し出は始める日の2週間前まで、ふつうの育休は1か月前まで（育児・介護休業法第9条の3第3項・第6条第3項）。2つを1つの「育休」にまとめない。
- 窓口・受ける所を文で言う時は、look_up_town の結果に合わせる。調べていない時は、窓口の名前を推し量って書かない。
- 受付の始まりの日を締切として書かない。町のページと予定の期限が違う時は、両方を書いて「窓口に確かめる」と書く。
- ボタンの名前を「」で書かない（名前は画面が決める）。「押すと〜が出ます」と、起きる事だけ書く。「もう一つは」「もう一方を」とボタンを数で指さない。「済んだ事」を見たい時は、今日の画面の一番下の「済んだ事」と文で案内する（ボタンは出さない）。
- 記録の文（add_record）・健診で聞く事は、家族が言った事だけで作る。「電話した」「受診した」など、家族がしていない事を足さない。
- 外へは何も送らない。文を作っても、送るのは家族（「送りました」と言わない）。ボタンを出しただけの時は「押すと〜します」と言う。
体・心・栄養の問い（橋をかける）:
- 体・病気・症状・薬・発達・成長・体重などの数値・便の色の良し悪しは判断しない。「大丈夫」「心配ない」「正常」「異常」「よくある」「様子を見てよい」「〜の可能性」を言わない。病気や症状の一般的な説明もしない。
- 代わりに、受け止める1文 → 日付つきで記録する（add_record）か次の健診で先生に聞く（add_checkup_question）を、必ず道具で出す → 連絡先（妊娠中・産後の体はかかりつけの産院・夜間も、子どもはかかりつけか #8000。119 は「命が危ないと思ったら、迷わず119。救急車を呼ぶか迷う時は、子どもは #8000、ママの体は産院」と書く。「迷ったら119」とは書かない。119 を「息をしていない時だけ」などに狭めない）。
- 急ぎでない問い（発達・数値・様子の気がかり）には、119 を添えない。連絡先は、かかりつけ・#8000（子ども）・産院（ママの体）まで。
- 発達・ことばの気がかりで、次の健診（get_notebook の予約、無ければ get_plan のまだ先の健診）が2か月より先なら、町の保健センター（こども家庭センター）の子育て・発達の相談も文で案内する（判断はしない。相談できる所があると伝えるだけ）。
- 母子手帳そのものの注意書きは、そのまま伝えてよい（言い換えない）: 便色「${STOOL_NOTE}」 発達「${DEVELOPMENT_NOTE}」 発育曲線「${GROWTH_NOTE}」。便色を引く時、「」の中は手帳の文だけにし、#8000 やかかりつけへの案内は「」の外に書く（手帳が言った事にしない）。
- 心のつらさ（イライラ・涙・不安・孤独・夫婦の事も）は、相談やカウンセリングをしない。気持ちの言い換え・原因の見立て・対処のこつ・相手への文（頼まれていない時）も出さない。受け止める1文と、町のこども家庭センター・電話の相談先（こころの健康相談統一ダイヤル 0570-064-556・よりそいホットライン 0120-279-338）を必ず文で案内する。気持ちを手帳の「気持ちの記録」に残す事はできる（add_record）。
- 授乳・ミルクの量・離乳食・食事の指導はしない。健診と町の保健センターの栄養相談へつなぐ。
- 子育ての一般知識の講義をしない。この家族の今と、次の一手に絞る。
- 前の記録にある気がかり（便の色など）は、今の問いと関係する時だけ触れる。この会話ですでに伝えた急ぎの案内は、繰り返さない。
- 体の問いの返事の本文には、どこへ連絡するか（妊娠中・産後のママはかかりつけの産院、まだ決まっていなければ婦人科。子どもはかかりつけの小児科か #8000）を必ず書く。ボタンの説明だけの返事にしない。
- 生まれた産院を子どもの連絡先にするのは、生後1か月ごろまで。それより後の子の事は、かかりつけの小児科（夜は #8000）。
書き方:
- 話し言葉で短く。3〜6文。並べる時は「・」で3つまで。見出し・表・太字の記号（**や#）は使わない。
- 日付は「11月20日（あと12日）」の形。根拠は（戸籍法第49条）のように括弧で短く。
- 家族を名前で呼んでよい。押し付けない（「〜しましょう」より「〜できます」）。
よく聞かれる国の決まり（予定の根拠に無い時に使う。町の中身は look_up_town で）:
- 児童手当を受け取るのは、父母のうち家計を主に支える人（ふつうは所得の高い方）。共働きでもどちらか1人が申し込む（児童手当法第4条・こども家庭庁「児童手当制度のご案内」）。生まれた日の翌日から15日以内に申し込めば、生まれた月の翌月分から受け取れる（同法第8条。遅れるとその月の分は受け取れない）。
- 出生届は、父か母が出す（戸籍法第52条）。生まれた日を含めて14日以内（同法第49条）。出す所は、住む所・生まれた所・本籍地のどの役所でもよい（同法第25条・第51条）。
- 役所への届けの期限（出生届・児童手当・転入届など）の最後の日が役所の休み（土日・祝日・12/29〜1/3）に当たる時は、次の開庁日まで（地方自治法第4条の2第4項）。予定の期限は、もう開庁日にそろえてある。職場・産院・健康保険への期限は動かない。`;

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
    // 職場は人ごと（見直し C09）。会社名の無い人は書かない
    ...worksByMember(keep, family)
      .filter(({ work }) => work.company)
      .map(({ member, work }) => `${keep.names?.[member.id] || member.name}の職場: ${work.company}${work.boss ? `（上司 ${work.boss}）` : ""}`),
  ].filter(Boolean);
  return `この家族（作った家族のこともある）:\n${lines.join("\n")}`;
}

// ── 会話の記憶（家族ごとに1つ） ──

interface ChatDoc {
  turns: ChatTurn[];
  /** 答えを作っている間の問い（窓を閉じても、開き直した時に「答えを作っています」と出すため） */
  pending?: ChatTurn | null;
}
const chatId = (familyId: string) => `chat:${familyId}`;

export function getChat(familyId: string): ChatTurn[] {
  return get<ChatDoc>(chatId(familyId))?.data.turns ?? [];
}
/** 答えを作っている間の問い（無ければ null。10分より古い物は、落ちた後の残りとみなして出さない） */
export function getPending(familyId: string): ChatTurn | null {
  const p = get<ChatDoc>(chatId(familyId))?.data.pending ?? null;
  return p && Date.now() - Date.parse(p.at) < 10 * 60_000 ? p : null;
}
export function setPending(familyId: string, turn: ChatTurn): void {
  put<ChatDoc>(familyId, "chat", { turns: getChat(familyId), pending: turn }, { id: chatId(familyId) });
}
export function saveChat(familyId: string, turns: ChatTurn[]): void {
  put<ChatDoc>(familyId, "chat", { turns: turns.slice(-KEEP_TURNS) }, { id: chatId(familyId) });
}
/**
 * 押した動きに印を付ける・外す（窓を開き直しても、同じ記録を2回入れないように）。
 * 印は押した時点で付ける（記録し終わるのを待たない。第30回で、記録の途中で閉じると二度押しできた）。失敗したら外す。
 * 答えを作っている間（pending）に呼ばれても、pending を消さない。
 */
export function markActionUsed(familyId: string, at: string, index: number, on = true): boolean {
  const doc = get<ChatDoc>(chatId(familyId))?.data;
  const turns = doc?.turns ?? [];
  const t = turns.find((x) => x.role === "assistant" && x.at === at);
  if (!t?.actions?.[index]) return false;
  const used = new Set(t.used ?? []);
  if (on) used.add(index);
  else used.delete(index);
  t.used = [...used];
  put<ChatDoc>(familyId, "chat", { turns, ...(doc?.pending ? { pending: doc.pending } : {}) }, { id: chatId(familyId) });
  return true;
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
- 母子手帳の注意書きを、手帳の言葉として「」でそのまま引くのは問題ない（便色カードの「${STOOL_NOTE}」など。手帳の文の中の「病気の可能性」は返事の判断ではない）
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
    model: EVERYDAY_MODEL,
    max_tokens: 3000,
    system: [{ type: "text", text: `${CHARTER}\n\n${ASK_RULES}` }],
    messages: [
      {
        role: "user",
        content: `次の返事に、見張りから指摘がありました。指摘の箇所を直し（判断の言葉は消し、記録・健診で聞く・連絡先への橋に変える）、ほかの内容と長さはなるべくそのままにして、返事と同じ言葉で書き直してください。書き直した返事の文だけを出してください。\n\n返事:\n${reply}\n\n指摘:\n${problems.map((p) => `- ${p}`).join("\n")}`,
      },
    ],
    output_config: { effort: "low" },
  });
  recordSpend("ask-rewrite", res.model ?? EVERYDAY_MODEL, res.usage, spendWho(currentSender()));
  return textOf(res) || reply;
}

const textOf = (res: Anthropic.Beta.BetaMessage) =>
  res.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .replace(/\*\*/g, "")
    .trim();

/** 道具を呼ぶ手に書いた文を、進み具合の thinking 塊（中身つき）で受け取る beta（無いと display: "updates" は 400） */
const THINKING_UPDATES_BETA = "thinking-display-updates-2026-08-18";
/** 応答が途中で止まった時に、最後の thinking 塊に入る決まった文（本文の候補にしない） */
const INTERRUPTED_NOTE = "This part of the response was interrupted before it finished.";

/**
 * 1つの手で書かれた文（本文の候補）。text の塊と、中身の空でない thinking 塊を、塊の並びのまま（塊は種類で読み、位置で読まない）。
 * Sonnet 5.5 は、道具を呼ぶ手に書いた1〜2文より長い文を、進み具合の thinking 塊で返す（display: "updates" で中身が入る。
 * 推論そのものは空のまま）。text の塊だけを拾うと、動きの道具と同じ手に書いた本文（連絡先を含む）が消える（監査 llm-5）。
 * 中断の決まった文は入れない。続く text の塊は、今までどおり間を空けずにつなぐ。
 */
export function saidOf(res: Pick<Anthropic.Beta.BetaMessage, "content">): string {
  const parts: string[] = [];
  let joinText = false;
  for (const b of res.content) {
    if (b.type === "text") {
      if (joinText) parts[parts.length - 1] += b.text;
      else parts.push(b.text);
      joinText = true;
      continue;
    }
    joinText = false;
    if (b.type === "thinking" && b.thinking.trim() && b.thinking.trim() !== INTERRUPTED_NOTE) parts.push(b.thinking);
  }
  return parts
    .map((s) => s.replace(/\*\*/g, "").trim())
    .filter(Boolean)
    .join("\n");
}

/** 手ごとの文を重ねて1つの返事に（同じ文と、ほかの文にまるごと含まれる文は1回だけ。頼み直しで前の一言を言い直した時に二重にしない） */
function overlay(said: string[]): string {
  const uniq = [...new Set(said)];
  return uniq.filter((s, i) => !uniq.some((o, j) => j !== i && o.includes(s))).join("\n\n");
}

/** 返事の文が80字未満の時に1回だけ頼み直す文（前の手の本文が thinking 塊に入って、届いていないかもしれない時） */
const ASK_FOR_BODY = "（ここまでをまとめて、家族への返事の本文を書いてください。伝える事は、すべてこの返事に入れてください）";
/** 文が無いまま終わった時に1回だけ頼み直す文 */
const ASK_FOR_TEXT = "（家族への返事の文がまだありません。ここまでに見た事を使って、返事の文だけを書いてください）";

/** 次の妊婦健診の予約（「いま」の画面と同じ: 予約が無く、国の目安が7日以内の時だけ） */
function prenatalBooking(family: Family, today: string): { when: string } | null {
  if (getPlan(family.id).next) return null;
  const checkups = listTecho(family.id, { family, today })
    .filter((d) => d.data.page === "pregnancy-checkup" && !d.data.pending)
    .map((d) => d.data.date);
  const next = prenatalState(family, today, checkups)?.next;
  if (!next) return null;
  const days = Math.round((Date.parse(next) - Date.parse(today)) / 86_400_000);
  if (days < 0 || days > 7) return null;
  // 決まりの答えの中で、頼みの言葉の withLang の中から呼ぶ
  return { when: days === 0 ? t("今日ごろ") : t("あと{n}日ごろ", { n: days }) };
}

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
  /** 頼みの言葉（画面の言葉。無ければ日本語）。機械が書く字はこの言葉で組み、Claude にもこの言葉で答えてもらう */
  lang?: Lang;
}

/** 答えの言葉（画面の言葉を切り替えた家族）。窓口で使う言葉は日本語を並べる（窓口でそのまま見せられるように） */
const LANG_FOR_CLAUDE: Readonly<Record<Exclude<Lang, "ja">, string>> = {
  zh: "简体中文で書く（呼びかけは「你」）。役所・病院の窓口で使う言葉（出生届・児童手当・母子健康手帳など）は、初めて出す時に日本語を括弧で並べる（例: 出生登记（出生届））",
  en: "English で書く（短く、やさしく）。役所・病院の窓口で使う言葉（出生届・児童手当・母子健康手帳など）は、初めて出す時に日本語を括弧で並べる（例: birth registration (出生届)）",
};

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
  const lang = input.lang ?? "ja";
  /** 機械が書く字（急ぎの橋・決まりの答え・見本の答え）を、頼みの言葉で組む。同期の間だけ（頼みをまたいで混ざらない） */
  const inLang = <T>(fn: () => T): T => withLang(lang, fn, dictFor(lang));
  const c = clockAt(family, today);
  const bridge = inLang(() => bridgeFor(text, c.phase === "pregnant" ? "pregnant" : c.phase === "child" ? "child" : "other"));
  // 予定表と画面の地図だけで答えられる問いは、Claude を使えない時（見本で鍵が無い・同意の前）に決まりで答える（rule-answer.ts）。
  // 体・心の言葉がある問い（bridge が拾う）には使わない
  // 「過ぎた事」は予定表の言い方が「いま」の画面の「始める前の事」と合わないので、ここでは渡さない
  const kind = bridge.lead ? null : ruleKind(text);
  const byRule = (): AskResult | null => {
    if (!kind) return null;
    // 予定表の写しは日本語のまま作り（日数の字を読む）、答えの字だけを頼みの言葉で組む
    const plan = { ...(planSnapshot(family, today) as unknown as PlanView), 過ぎた事: [] };
    const r = inLang(() => ruleAnswer(kind, text, { ...plan, 健診の予約: prenatalBooking(family, today) }, input.path));
    if (!r) return null;
    const turn: ChatTurn = { role: "assistant", text: r.text, today, at: new Date().toISOString(), ...(r.actions.length ? { actions: r.actions } : {}) };
    return { turn, rewritten: false, tools: ["rule"] };
  };
  // claude() を直に使うので、送る前の関所をここで1回通す（route が sendingAs で包む。同意が無ければ ConsentRequiredError）
  try {
    guardSend("ask");
  } catch (e) {
    const r = e instanceof ConsentRequiredError ? byRule() : null;
    if (r) return r;
    throw e;
  }

  // 鍵が無い見本の家族: 機械の床（急ぎ・心の危機の連絡先）はそのまま効かせ、決まりで答えられない問いは見本の言葉にする
  if (sampleMode()) {
    const r = byRule();
    if (r) return r;
    const reply = inLang(() => (bridge.lead ? `${bridge.lead}\n\n${sampleAskReply()}` : sampleAskReply()));
    const actions = dedupe([...bridge.actions]);
    const turn: ChatTurn = { role: "assistant", text: reply, today, at: new Date().toISOString(), ...(actions.length ? { actions } : {}) };
    return { turn, rewritten: false, tools: [] };
  }

  // 30日より前の話は渡さない（妊娠中の話が、生まれた後の答えに混ざらないように）
  const history = (input.history ?? getChat(family.id)).filter((t) => !t.today || Math.abs(Date.parse(today) - Date.parse(t.today)) <= 30 * 86_400_000).slice(-HISTORY_TURNS);
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
    lang === "ja" ? "" : `答えの言葉: ${LANG_FOR_CLAUDE[lang]}`,
    bridge.note ? `機械の床からの指示: ${bridge.note}（電話のボタンはもう出してある。返事の頭には機械が「${bridge.lead}」を置くので、同じ事を繰り返さず、その続きから書く）` : "",
  ].filter(Boolean);
  const userContent = `（${head.join(" ・ ")}）\n${text}`;
  if (messages[messages.length - 1]?.role === "user") messages[messages.length - 1].content = `${messages[messages.length - 1].content as string}\n${userContent}`;
  else messages.push({ role: "user", content: userContent });

  const ctx: ToolCtx = { family, today, actions: [], sources: [], onStatus, lang };
  const used: string[] = [];
  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    { type: "text", text: STATIC_SYSTEM, cache_control: { type: "ephemeral" } },
    { type: "text", text: familySystem(family) },
  ];

  onStatus("考えています");
  let reply = "";
  // 道具を呼ぶ前に書いた文も取っておく（道具の後の最後の返事が空の時、これで答える）。thinking 塊で返った文も入る（saidOf）
  const said: string[] = [];
  let nudged = false;
  // 道具を呼んだ手に thinking 塊があったか（そこに本文が入って、text では届いていないかもしれない）
  let thoughtBefore = false;
  for (let step = 0; step < MAX_STEPS; step++) {
    checkBudget();
    const last = step === MAX_STEPS - 1;
    const res = await claude().beta.messages.create({
      model: EVERYDAY_MODEL,
      max_tokens: 6000,
      system,
      messages,
      tools: TOOLS,
      ...(last ? { tool_choice: { type: "none" as const } } : {}),
      // 道具を呼ぶ手に書いた文を、空でない thinking 塊で受け取る（既定の omitted では中身が空。推論は隠れたまま）。
      // thinking 塊は手を加えずに会話へ返す（下の messages.push(res.content)）
      thinking: { type: "adaptive", display: "updates" },
      betas: [THINKING_UPDATES_BETA],
      output_config: { effort: "medium" },
    });
    recordSpend("ask", res.model ?? EVERYDAY_MODEL, res.usage, spendWho(currentSender()));
    if (res.stop_reason === "refusal") {
      reply = "ごめんなさい、この問いにはお答えできません。手続きや予定のこと、アプリの使い方なら聞いてください。";
      break;
    }
    const calls = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const t = saidOf(res);
    if (t) said.push(t);
    if (res.stop_reason !== "tool_use" || calls.length === 0) {
      // 最後の一手が道具の返りへの短い一言だけの時は、前の手で書いた本文も残す（第31回: 「ボタンはまだ押されていないので…」だけになり、連絡先が消えた）
      reply = t && (t.length >= 80 || said.length <= 1) ? t : overlay(said);
      // 1回だけ頼み直す（最後の手ではしない＝MAX_STEPS を越えない）:
      // ① 考えただけで文が無いまま終わった ② 最後の手の文が80字未満で、道具を呼んだ手に thinking 塊があった（本文がそこに入ったかもしれない）
      const again = !reply ? ASK_FOR_TEXT : t.length < 80 && thoughtBefore ? ASK_FOR_BODY : null;
      if (again && !nudged && !last) {
        nudged = true;
        messages.push({ role: "assistant", content: res.content.length ? res.content : [{ type: "text", text: "（考えています）" }] });
        // 途中で止まった手（max_tokens など）に道具の呼び出しが残っていれば、動かしていない事を返してから頼む（返さないと 400）
        const open: Anthropic.Beta.BetaToolResultBlockParam[] = calls.map((c) => ({
          type: "tool_result",
          tool_use_id: c.id,
          content: "途中で止まったので、この道具は動かしていません",
          is_error: true,
        }));
        messages.push({ role: "user", content: open.length ? [...open, { type: "text", text: again }] : again });
        continue;
      }
      break;
    }
    if (res.content.some((b) => b.type === "thinking")) thoughtBefore = true;
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
  if (!reply) reply = tFor(lang, "うまくまとめられませんでした。もう一度、聞き方を変えて聞いてください。");

  onStatus("答えを確かめています");
  const g = await guard(text, reply);
  let rewritten = false;
  if (!g.ok && g.problems.length) {
    reply = await rewrite(reply, g.problems);
    rewritten = true;
  }

  // 急ぎ・心の危機・便色カードの1〜3番は、返事の頭に機械で決めた1文を置く（Claude の書き方に任せない）
  if (bridge.lead) {
    // Claude が同じ文を繰り返していたら除く（手帳の注意書きの引用など。試験は bridge.test.ts）
    reply = `${bridge.lead}\n\n${stripLeadRepeats(reply, bridge.lead).replace(/\n{3,}/g, "\n\n").trim()}`;
  }
  // 妊娠中・産後の急ぎは、通う産院の電話が分かればそれを一番上に（「産院へ電話」と言うのにボタンが無い、を無くす）
  const hospital = getKeep(family.id).hospital;
  const hospitalCall: AskAction[] =
    bridge.urgent && c.phase !== "child" && hospital?.phone
      ? [{ type: "call", label: tFor(lang, "{name}に電話（夜間も）", { name: hospital.name ?? tFor(lang, "通う産院") }), tel: hospital.phone }]
      : [];
  reply = fixButtonNames(reply, [...bridge.actions, ...ctx.actions]);
  const actions = dedupe([...hospitalCall, ...bridge.actions, ...ctx.actions]);
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

/**
 * 文の中の「◯◯」を押す、のボタンの名前が、実際に出したボタンに無ければ「下のボタン」に言い換える
 * （第29回で「記入メモを作る」「下書きを作る」と書いて、そのボタンが無い・名前が違うが3家族であった）
 */
export function fixButtonNames(text: string, actions: AskAction[]): string {
  const labels = actions.flatMap((a) => ("label" in a && a.label ? [a.label] : []));
  let out = text.replace(/「([^「」]{1,24})」(ボタン)?を押(す|して|せば|すと)/g, (all, name: string, _b, tail: string) => {
    if (labels.some((l) => l.includes(name) || name.includes(l))) return all;
    return `ボタンを押${tail}`;
  });
  // 「もう一つは、押すと…」のように2つ目のボタンを指す文は、電話以外のボタンが2つ以上ある時だけ残す（第30回で、1つしか無いのに書いた）
  const buttons = actions.filter((a) => a.type !== "call").length;
  if (buttons < 2) out = out.replace(/[^。\n]*(もう一つ|もう一方|もう1つ|もうひとつ)[^。\n]*。?/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return out;
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
