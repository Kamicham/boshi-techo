// 「手帳に聞く」の決まりの答え: 予定表と画面の地図だけで答えられる問いは、Claude を使わずに答える。
// 使う時: 見本の家族で鍵が無い・上限を超えた日、まだ「米国の Claude に送る同意」をしていない家族（UX 2026-11-04:
// 見本では何を聞いても同じ「鍵を入れると…」が返り、何ができるかが体験できなかった。同意の前は問いが答えなしで積まれた）。
// 答えは予定表の値の写しだけ（作り話を足さない）。体・心の言葉がある問いは使わない（呼ぶ側が bridge を先に見る）。
// 画面からもサーバからも読まない純粋な決まり（試験は rule-answer.test.ts）。
import { SCREENS } from "../app-guide";
import { currentLang, listOf, t } from "../i18n";
import { msWords } from "../i18n/milestone-words";
import type { AskAction } from "./types";

/** 予定表の1行（tools.ts の planSnapshot の行のうち、ここで使う所） */
export interface PlanRow {
  id: string;
  やさしい題: string;
  正式な名前: string;
  担当: string;
  状態: string;
  始まり: string;
  目安の日?: string;
  期限?: string;
}

export interface PlanView {
  今やる事: PlanRow[];
  まだ先の事: PlanRow[];
  /** 手帳を始める前に目安が過ぎた事など（「いま」の画面で、済んでいるかを聞いている） */
  過ぎた事?: string[];
  /** 次の妊婦健診の予約（国の目安が7日以内で、予約が入っていない時。「いま」の画面と同じ決まり） */
  健診の予約?: { when: string } | null;
}

export type RuleKind = "next" | "checkups" | "screen" | "topic";

export const RULE_MARK = "（手帳の予定表から。Claude は使っていません）";

/** 題から引く言葉（問いにこの言葉があれば、その言葉を含む予定を並べる） */
const TOPIC_WORDS = ["産休", "育休", "出生届", "児童手当", "出産", "保育園", "保育所", "職場", "保険", "医療費", "里帰り", "届け", "手当", "給付", "退職", "復帰"];

// 中文・English で聞かれた時（画面の言葉を切り替えた家族。最初の問いの例＝components/ask/AskSheet.tsx の starters の訳も、ここで拾う。試験は rule-answer.test.ts）。
// 予定表の題は日本語のままなので、問いの言葉を、題を引く日本語の言葉に写す
const TOPIC_INTL: readonly (readonly [RegExp, readonly string[]])[] = [
  [/产假|产前产后休假|产前休假|产后休假|maternity leave/i, ["産休"]],
  [/育儿假|育儿休假|陪产假|childcare leave|parental leave|paternity leave/i, ["育休"]],
  [/出生登记|出生申报|报出生|birth registration|register (the |my |our )?(baby|birth)/i, ["出生届"]],
  [/儿童补贴|儿童津贴|child allowance|child benefit/i, ["児童手当"]],
  [/分娩|生孩子|childbirth|giving birth|\bdelivery\b|\bbirth\b/i, ["出産"]],
  [/保育园|托儿所|保育所|day ?care|nursery/i, ["保育園", "保育所"]],
  [/工作单位|公司|职场|上司|workplace|employer|\bboss\b|my job/i, ["職場"]],
  [/保险|insurance/i, ["保険"]],
  [/医疗费|医药费|medical (costs?|expenses?|bills?|fees?)/i, ["医療費"]],
  [/回老家|回乡|回娘家|home ?town/i, ["里帰り"]],
  [/申报|手续|登记|paperwork|notification|registration|\bregister\b/i, ["届け"]],
  [/补贴|津贴|allowance/i, ["手当"]],
  [/给付|补助|benefit|subsidy/i, ["給付"]],
  [/辞职|离职|\bquit\b|resign/i, ["退職"]],
  [/复职|回去上班|return(ing)? to work|back to work/i, ["復帰"]],
];
/** 体・心・量の問い（中文・English）。決まりで答えず、橋と Claude に任せる（日本語の BODY と同じ役） */
const BODY_INTL =
  /痛|疼|发烧|发热|出血|流血|吐|呕|咳|大便|小便|便秘|拉肚子|腹泻|尿|胀|肿|体重|身高|奶粉|母乳|喂奶|吃奶|奶量|辅食|断奶|睡不着|失眠|哭|不安|难受|焦虑|烦躁|抑郁|不动|胎动|药|生病|病了|症状|\b(pains?|painful|hurts?|aches?|fever|temperature|bleed(ing)?|blood|vomit(ing)?|throw(ing)? up|spit(ting)? up|cough(ing)?|poop|stool|diarrh\w*|constipat\w*|pee|urine|swell(ing)?|swollen|weight|height|milk|formula|breastfeed\w*|nursing|feeding|solids|weaning|sleep\w*|cry(ing)?|cries|anxious|anxiety|worried|worry|depress\w*|irritab\w*|not moving|kicks?|medicine|medication|sick|ill|symptoms?|rash)\b/i;
const SCREEN_INTL = /(这个页面|这个画面|这一页|本页|这里).{0,6}(能|可以|怎么|如何)|使用方法|怎么用这个|\b(this|the) (screen|page)\b|\bhow (do|can) i use (this|the app|it)\b|\bhow to use (this|the app)\b|\bwhat can (i|you) do here\b/i;
const VAX_INTL = /预防接种|疫苗|打针|接种|vaccin|immuni[sz]|\bshots?\b|\bjabs?\b/i;
const CHECKUP_INTL = /健康检查|健检|体检|检查|健诊|check-?ups?|well-?baby|health check/i;
const WHEN_INTL = /什么时候|下次|下一次|几时|何时|哪天|\bwhen\b|\bnext\b/i;
const ASK_AT_INTL = /问什么|该问|要问|问医生|\bwhat (should|do|can) i ask\b|\bquestions? (to|for) (the )?(doctor|checkup)\b/i;
const NEXT_INTL = /下一步|接下来|要做什么|该做什么|做什么好|现在做|先做什么|从哪里开始|从哪开始|\bwhat'?s next\b|\bwhat (should|do) i (do|need to do)\b|\bto do (next|now)\b|\bwhere (do|should) i (start|begin)\b|\bwhat to do\b/i;

/** 問いから、予定表の題を引く日本語の言葉（日本語の言葉と、中文・English の言葉を写した物） */
function topicWords(q: string): string[] {
  const out = TOPIC_WORDS.filter((w) => q.includes(w));
  for (const [re, words] of TOPIC_INTL) if (re.test(q)) out.push(...words);
  return [...new Set(out)];
}

const VAX_OR_CHECKUP = /vacc|bcg|booster|checkup/;

/** 体・心・量の問いは決まりで答えない（呼ぶ側の bridge と Claude に任せる） */
const BODY = /痛|熱|血|吐|咳|せき|便|うんち|おしっこ|張り|むくみ|体重|身長|ミルク|母乳|授乳|離乳|眠れ|泣|不安|つらい|しんどい|イライラ|動かない|胎動|薬|病気|症状/;

export function ruleKind(text: string): RuleKind | null {
  const q = text.trim();
  if (!q || BODY.test(q) || BODY_INTL.test(q)) return null;
  if (/この画面|何ができる|どう使う|使い方/.test(q) || SCREEN_INTL.test(q)) return "screen";
  if (/(予防接種|ワクチン|接種)/.test(q) || (/健診/.test(q) && /いつ|次の/.test(q) && !/何を聞|聞けば|聞く事/.test(q))) return "checkups";
  if (VAX_INTL.test(q) || (CHECKUP_INTL.test(q) && WHEN_INTL.test(q) && !ASK_AT_INTL.test(q))) return "checkups";
  if (/次にやる|やる事は|やることは|今やる|何をすれば|何からやれば/.test(q) || NEXT_INTL.test(q)) return "next";
  if (topicWords(q).length) return "topic";
  return null;
}

// 答えの字は今の言葉で組む（サーバは頼みの言葉の withLang の中で呼ぶ＝lib/ask/agent.ts。日本語は前と同じ字）
const EN_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** 箇条の頭（日本語は「・」、中文・English は「• 」） */
const dot = () => (currentLang() === "ja" ? "・" : "• ");
/** 文をつなぐ（English は空きを入れる） */
const cat = (...parts: string[]) => parts.filter(Boolean).join(currentLang() === "en" ? " " : "");
/** 「授かったら」「生まれたら」（日付の代わりに予定表に入る言葉） */
const AWAIT = /^(授かったら|生まれたら)$/;
/** 予定表の写しの日付の字（「2027年1月5日（あと3日）」「11月23日（2日過ぎた）」）を今の言葉に。日本語はそのまま */
function dayText(s: string): string {
  const lang = currentLang();
  if (lang === "ja") return s;
  if (AWAIT.test(s)) return t(s);
  return s
    .replace(/(?:(\d{4})年)?(\d{1,2})月(\d{1,2})日/g, (_w, y: string | undefined, m: string, d: string) =>
      lang === "en" ? `${EN_MONTHS[Number(m) - 1]} ${Number(d)}${y ? `, ${y}` : ""}` : `${y ? `${y}年` : ""}${Number(m)}月${Number(d)}日`,
    )
    .replace(/（あと(\d+)日）/g, (_w, n: string) => t("（あと{n}日）", { n: Number(n) }))
    .replace(/（(\d+)日過ぎた）/g, (_w, n: string) => t("（{n}日過ぎた）", { n: Number(n) }));
}

const when = (r: PlanRow) => {
  const due = r.期限 ? t("期限 {date}", { date: dayText(r.期限) }) : r.目安の日 ? t("目安 {date}", { date: dayText(r.目安の日) }) : "";
  // 「授かったら」「生まれたら」には「から」を付けない（前は「授かったらから」になっていた）
  const start = r.状態 === "まだ先" ? (AWAIT.test(r.始まり) ? t(r.始まり) : t("{date}から", { date: dayText(r.始まり) })) : "";
  return [start, due].filter(Boolean).join(({ ja: "・", zh: "，", en: ", " } as const)[currentLang()]);
};
/** 担当（「パートナー（健太）」の形）。中文・English は名前があれば名前だけ */
const who = (r: PlanRow) => {
  if (/^(母|家族)/.test(r.担当)) return "";
  const named = r.担当.match(/（(.+)）$/)?.[1];
  return t("（{who}の番）", { who: currentLang() === "ja" ? r.担当 : (named ?? t(r.担当)) });
};
const line = (r: PlanRow) => `${dot()}${msWords(r.やさしい題)}${who(r)}${when(r) ? ` — ${when(r)}` : ""}`;
/** 期限・目安までの日数（「あと◯日」「◯日過ぎた」から。無ければ後ろ）。「いま」の画面と同じく近い順に並べる */
const left = (r: PlanRow) => {
  const d = r.期限 ?? r.目安の日 ?? "";
  const a = d.match(/あと(\d+)日/);
  if (a) return Number(a[1]);
  const b = d.match(/(\d+)日過ぎた/);
  return b ? -Number(b[1]) : Number.POSITIVE_INFINITY;
};
const byDue = (rows: PlanRow[]) => [...rows].sort((x, y) => left(x) - left(y));
const act = (r: PlanRow): AskAction => ({ type: "milestone", milestoneId: r.id, label: r.やさしい題 });

/** 決まりで答える。答えられない時は null（呼ぶ側が今までの答え方に戻す） */
export function ruleAnswer(kind: RuleKind, text: string, plan: PlanView, path = "/"): { text: string; actions: AskAction[] } | null {
  const all = [...plan.今やる事, ...plan.まだ先の事];
  if (kind === "screen") {
    const s = [...SCREENS].sort((a, b) => b.href.length - a.href.length).find((x) => (x.href === "/" ? path === "/" : path.startsWith(x.href)));
    if (!s) return null;
    return {
      text: `${t(RULE_MARK)}\n${t("この画面（{name}）でできる事:", { name: t(s.name) })}\n${s.can
        .slice(0, 4)
        .map((c) => `${dot()}${t(c)}`)
        .join("\n")}`,
      actions: [],
    };
  }
  if (kind === "next") {
    const visit = plan.健診の予約;
    const late = (plan.過ぎた事 ?? []).slice(0, 2);
    const lateLine = late.length
      ? `\n${t("始める前に目安が過ぎた事: {list}（済んでいなければ、今からでもできます。「いま」の画面で、済んでいるかを聞いています）", { list: listOf(late.map(msWords)) })}`
      : "";
    const visitLine = visit ? `${dot()}${t("次の妊婦健診を予約する")} — ${visit.when}${t("（国の目安。病院で日を言われていたら、そちらに合わせてください）")}` : "";
    const visitAct: AskAction[] = visit ? [{ type: "open", href: "/visit", label: "予約した日を入れる" }] : [];
    const count = plan.今やる事.length + (visit ? 1 : 0);
    if (count) {
      const top = byDue(plan.今やる事).slice(0, visit ? 2 : 3);
      const more = plan.今やる事.length - top.length;
      return {
        text: `${t(RULE_MARK)}\n${t("いまやる事は{n}つです。", { n: count })}\n${[...top.map(line), visitLine].filter(Boolean).join("\n")}${more > 0 ? `\n${t("ほかに{n}つ（「いま」の画面にあります）", { n: more })}` : ""}${lateLine}${top.length ? `\n${t("押すと、その事の窓口調べ・書く事のメモが開きます。")}` : ""}`,
        actions: [...top.map(act), ...visitAct],
      };
    }
    const next = plan.まだ先の事[0];
    if (!next && !late.length) return null;
    return {
      text: `${t(RULE_MARK)}${late.length ? lateLine : ""}${next ? `\n${cat(late.length ? t("ほかに今すぐやる事はありません。") : t("今すぐやる事はありません。"), nextWords(next))}` : ""}`,
      actions: next ? [act(next)] : [],
    };
  }
  if (kind === "checkups") {
    const rows = all.filter((r) => VAX_OR_CHECKUP.test(r.id)).slice(0, 3);
    if (!rows.length) return null;
    return {
      text: `${t(RULE_MARK)}\n${t("予定表の、次の健診と予防接種です。")}\n${rows.map(line).join("\n")}\n${t("日付は国の目安です。病院で日を言われていたら、そちらに合わせてください。")}`,
      actions: rows.map(act),
    };
  }
  const words = topicWords(text);
  const rows = all.filter((r) => words.some((w) => r.やさしい題.includes(w) || r.正式な名前.includes(w))).slice(0, 3);
  if (!rows.length) return null;
  return {
    text: `${t(RULE_MARK)}\n${t("予定表にある、関係する事です。")}\n${rows.map(line).join("\n")}\n${t("押すと、窓口・持ち物・書く事のメモが開きます。町ごとに違う所は、窓口に確かめてください。")}`,
    actions: rows.map(act),
  };
}

/** 次の事の1文（「授かったら」「生まれたら」の時は、日付の形にしない） */
function nextWords(next: PlanRow): string {
  const title = msWords(next.やさしい題);
  if (next.始まり === "授かったら") return t("次は、授かったら「{title}」です。近づいたら、「いま」の画面に出します。", { title });
  if (next.始まり === "生まれたら") return t("次は、生まれたら「{title}」です。近づいたら、「いま」の画面に出します。", { title });
  return t("次は「{title}」で、{date}からです。近づいたら、「いま」の画面に出します。", { title, date: dayText(next.始まり) });
}
