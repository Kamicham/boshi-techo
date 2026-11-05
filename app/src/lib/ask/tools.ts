// 「手帳に聞く」の道具: 手帳がこの家族の今を見る・町の制度を取りに行く・返事の下に動きを添える。
// 読む道具は既存の部品を包むだけ。動きの道具は何も書き込まず、画面に出すボタンを積むだけ（押すのは家族）。
import { isDemoLike } from "../trial-cookie";
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import { isKnownHref } from "../app-guide";
import { research } from "../claude";
import { clockAt } from "../clock";
import { listRecords } from "../capture";
import type { Family } from "../demo-family";
import { fetchLocal, getLocal, isOfficial } from "../local";
import { deadlineKindOf, MILESTONES, scheduleFor, statusOf, type Milestone } from "../milestones";
import { TECHO_PAGES } from "../techo";
import { listTecho } from "../techo-store";
import { doneSetFor, vaxRetimeFor } from "@/app/api/done/_lib/done";
import { applyRetime } from "../vax-next";
import { getPlan, visitsOf } from "@/app/api/visit/_lib/server";
import { shownNext } from "../visit-next";
import type { Lang } from "../i18n";
import { tFor } from "../i18n/dicts";
import type { AskAction } from "./types";

export interface ToolCtx {
  family: Family;
  today: string;
  /** 返事に添える動き（道具が積む） */
  actions: AskAction[];
  /** 調べたページ */
  sources: { title: string; url: string }[];
  /** 画面に「いま何をしているか」を出す */
  onStatus: (text: string) => void;
  /** search_official をもう使ったか（重いので1回の問いで1回まで） */
  searched?: boolean;
  /** 頼みの言葉（状態の行のうち、町の名前が入る物をこの言葉で書く。ほかは画面が t() で引く） */
  lang?: Lang;
}

const jp = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;
/** 今日と年が違う日は年も付ける（Claude が年を推し量って1年ずらさないように。第29回で日本脳炎を1年ずらした） */
const jpY = (d: string, today: string) => `${d.slice(0, 4) !== today.slice(0, 4) ? `${Number(d.slice(0, 4))}年` : ""}${jp(d)}`;
const daysTo = (d: string, today: string) => Math.round((Date.parse(d) - Date.parse(today)) / 86_400_000);

/** 担当（母・パートナー・家族）を、この家族の呼び名つきで */
function whoName(family: Family, who: string): string {
  const m = family.members.find((x) => x.role === who);
  return m ? `${who}（${m.name}）` : who;
}

/** 今日の画面と同じ「済み」（デモの家族は通り過ぎた期限も済み） */
function doneOf(family: Family, today: string, schedule: Milestone[]): Set<string> {
  const done = doneSetFor(family, today);
  if (isDemoLike(family.id)) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) done.add(m.id);
  return done;
}

/** 予定の1行（Claude に渡す形） */
function row(family: Family, m: Milestone, today: string, done: Set<string>) {
  const status = statusOf(m, today, done);
  const left = m.deadlineDate ? Math.round((Date.parse(m.deadlineDate) - Date.parse(today)) / 86_400_000) : null;
  return {
    id: m.id,
    やさしい題: m.plain,
    正式な名前: m.title,
    一言: m.hint,
    ...(m.retimeNote ? { 打てる最短日の理由: `${m.retimeNote}（手帳の接種の日付から数え直した）` } : {}),
    担当: whoName(family, m.who),
    状態: status,
    始まり: m.awaitingPregnancy
      ? "授かったら"
      : m.awaitingBirth
        ? "生まれたら"
        : `${jpY(m.startDate, today)}${daysTo(m.startDate, today) > 0 ? `（あと${daysTo(m.startDate, today)}日）` : ""}`,
    ...(m.deadlineDate && !m.awaitingBirth && !m.awaitingPregnancy
      ? { [deadlineKindOf(m) === "目安" ? "目安の日" : "期限"]: `${jpY(m.deadlineDate, today)}${left != null && left >= 0 ? `（あと${left}日）` : left != null ? `（${-left}日過ぎた）` : ""}` }
      : {}),
    根拠: m.basis,
    町ごとに違う: m.needsLocal,
  };
}

/** 予定の全体（今やる・もうすぐ・まだ先の数件・済んだ事の名前） */
export function planSnapshot(family: Family, today: string) {
  // 予防接種は、手帳の接種の日付から数え直した日（打てる最短日）にする（第1波⑥）
  const schedule = applyRetime(scheduleFor(family, today), vaxRetimeFor(family, today));
  const done = doneOf(family, today, schedule);
  const rows = schedule.map((m) => row(family, m, today, done));
  const c = clockAt(family, today);
  const now = rows.filter((r) => r.状態 === "今やる" || r.状態 === "期限が近い" || r.状態 === "期限切れ");
  const later = rows.filter((r) => r.状態 === "まだ先");
  return {
    今日: `${today.slice(0, 4)}年${jp(today)}（${c.label}・1000日の${c.dayOf1000}日目）`,
    読み方: "日付と「あと◯日」はこの値をそのまま写す（自分で足し引きしない）。担当が聞いた人でない事は、その人の番として書く",
    今やる事: now,
    まだ先の事: later.slice(0, 10),
    まだ先の残り: Math.max(0, later.length - 10),
    済んだ事: rows.filter((r) => r.状態 === "済み").map((r) => r.やさしい題),
    過ぎた事: rows.filter((r) => r.状態 === "過ぎた").map((r) => r.やさしい題),
  };
}

/** 手帳と話した記録・健診の予約と聞く事 */
export function notebookSnapshot(family: Family, today: string) {
  const techo = listTecho(family.id, { family, today });
  const pending = techo.filter((d) => d.data.pending);
  const byPage = TECHO_PAGES.map((p) => {
    const list = techo.filter((d) => d.data.page === p.id && !d.data.pending);
    if (!list.length) return null;
    return {
      ページ: p.title,
      件数: list.length,
      新しい物: list
        .slice(-3)
        .map((d) => `${d.data.date} ${d.data.title}${Object.keys(d.data.values ?? {}).length ? ` ${JSON.stringify(d.data.values)}` : ""}`),
    };
  }).filter(Boolean);
  const records = listRecords(family.id, { limit: 40 })
    .filter((r) => !r.date || r.date.slice(0, 10) <= today)
    .slice(0, 12)
    .map((r) => `${r.date ?? ""} [${r.data.kind}] ${r.data.title}: ${r.data.detail.slice(0, 80)}`);
  const plan = getPlan(family.id);
  // 次の健診は、画面（GET /api/visit）と同じ決め方で読む。録音から聞こえただけで、まだ家族が確かめていない日はそう添える
  // （Claude と見渡すが、確かめた日として言わないように。2026-11-05 作り手の決め事）
  const next = shownNext(plan.next ?? null, visitsOf(family.id));
  return {
    OKを待っている候補: pending.map((d) => `${d.data.date} ${d.data.title}`),
    手帳のページ: byPage,
    話した撮った記録: records,
    次の健診の予約: next
      ? `${next.date}${next.time ? ` ${next.time}` : ""}${next.heard ? "（録音から聞こえた日。まだ家族が確かめていない）" : ""}`
      : "まだ入っていない",
    次の健診で聞く事: plan.concerns.map((c) => c.text),
  };
}

const str = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** 調べたページを、この町の物と国の物に絞る（ほかの町のページを並べない。第29回で名古屋・福山などが混ざった） */
export function pickSources(family: Family, sources: { title: string; url: string }[]): { title: string; url: string }[] {
  const host = (u: string) => {
    try {
      return new URL(u).hostname;
    } catch {
      return "";
    }
  };
  const national = (u: string) => /\.go\.jp$/.test(host(u));
  const local = (s: { title: string; url: string }) => !!family.city && s.title.includes(family.city);
  const good = sources.filter((s) => isOfficial(s.url) && (local(s) || national(s.url)));
  const list = good.length ? good : sources.filter((s) => isOfficial(s.url) && !/(市|町|村|区)(役所|役場|ホームページ|公式)/.test(s.title));
  return list.map((s) => ({ url: s.url, title: s.title?.trim() || host(s.url) }));
}

function findInSchedule(family: Family, today: string, id: unknown): Milestone | null {
  if (typeof id !== "string") return null;
  return scheduleFor(family, today).find((m) => m.id === id) ?? null;
}

const SEARCH_SYSTEM = `あなたの役割: 子育ての制度・手続き・お金・仕事の決まりを、公式のページ（国の省庁・こども家庭庁・厚生労働省・法務省・日本年金機構・都道府県・市区町村）で調べる係。
- まとめサイトや個人のブログは根拠にしない。言い切れない所は「確かめる」と書く。
- 体・病気・薬・心・栄養の中身は調べない（窓口の名前と連絡の仕方だけ）。
- 募集の日程（保育園など毎年変わる物）は、出典の年度を必ず書く。今年度（次の4月）の物でなければ日付を言い切らず「今年度の日程は窓口・町のお知らせで確かめる」と書く。受付の始まりを締切と書かない。
- 日本語で、短く要点だけ（10行まで）。`;

/** Claude に見せる道具の一覧 */
export const TOOLS: Anthropic.Beta.BetaToolUnion[] = [
  {
    name: "get_plan",
    description: "この家族の予定（今やる事・期限・まだ先の事・済んだ事）を見る。手続き・期限・次にやる事を聞かれたら、答える前に必ず使う。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_notebook",
    description: "この家族の手帳の記録（府令様式のページ）・OK を待っている候補・話した撮った記録・次の健診の予約と聞く事を見る。",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "look_up_town",
    description:
      "住んでいる町で、予定にある手続き（milestoneId）をする時の窓口・持ち物・オンライン申請・期限・町独自の助成を、町の公式ページから取ってくる（初めての時は30秒〜1分かかる。調べ済みならすぐ）。",
    input_schema: { type: "object", properties: { milestoneId: { type: "string", description: "get_plan の id" } }, required: ["milestoneId"] },
  },
  {
    name: "search_official",
    description:
      "予定に無い制度・手続き・お金・仕事の決まりを、公式のページで調べる（20〜40秒かかり、費用も重い。1回の問いで1回まで）。予定（get_plan）の根拠や画面の地図で答えられる時、体・病気・心・栄養の問い、アプリの操作には使わない。町の事なら町の名前を入れる。",
    input_schema: { type: "object", properties: { question: { type: "string" } }, required: ["question"] },
  },
  {
    name: "open_screen",
    description: "返事の下に「その画面へ行く」ボタンを出す。行き先は画面の地図にある物だけ。",
    input_schema: {
      type: "object",
      properties: { href: { type: "string", description: "例: /visit ・ /techo#page-stool" }, label: { type: "string", description: "ボタンの言葉。15字まで" } },
      required: ["href", "label"],
    },
  },
  {
    name: "offer_paperwork",
    description: "予定にある手続き（milestoneId）について、返事の下に今日の画面と同じ「どこへ行くか見る」「下書き・記入メモを作る」のボタンを出す。",
    input_schema: { type: "object", properties: { milestoneId: { type: "string" } }, required: ["milestoneId"] },
  },
  {
    name: "propose_done",
    description: "家族が「〜を出した・済ませた」と言った時、そのやる事を済みにするボタンを出す（押すのは家族）。",
    input_schema: { type: "object", properties: { milestoneId: { type: "string" } }, required: ["milestoneId"] },
  },
  {
    name: "add_checkup_question",
    description: "体や様子で気になる事を、次の健診で先生に聞く事に足すボタンを出す（押すのは家族）。家族の言葉を残した1文の質問にする。子の事は for=child（子の健診へ）、妊娠中・産後のママの体は for=mother（ママの健診へ）。",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "先生への質問（例: 便の色が白っぽく見えた日がある。見てほしい）" },
        for: { type: "string", enum: ["child", "mother"], description: "だれの事か" },
      },
      required: ["text", "for"],
    },
  },
  {
    name: "add_record",
    description:
      "家族が話した出来事・気になる事・予定を、日付つきで記録に残すボタンを出す（押すのは家族）。入るのは話す・撮るの「これまでの記録」（一冊には入らない）。手帳のページ（成長・できた日など）に入る物は候補になり、手帳のタブで OK を待つ。文では「記録に残す」と言い、「手帳に記録」と言わない。",
    input_schema: { type: "object", properties: { text: { type: "string", description: "記録する事を家族の言葉のまま" } }, required: ["text"] },
  },
  {
    name: "write_message",
    description: "家族が誰かに伝えたい時、そのまま渡せる文を作って返事の下に出す（コピー・メール・LINE で開ける。送るのは家族）。分からない名前・日付は【 】の空欄にする。",
    input_schema: {
      type: "object",
      properties: {
        to: { type: "string", description: "相手（例: 翔太さん・職場の上司・保育園）" },
        via: { type: "string", enum: ["mail", "line"], description: "職場・役所は mail、家族は line" },
        subject: { type: "string", description: "mail の時だけ" },
        body: { type: "string" },
      },
      required: ["to", "via", "body"],
    },
  },
];

/** 道具を動かす。返すのは Claude に渡す文字 */
export async function runTool(name: string, input: Record<string, unknown>, ctx: ToolCtx): Promise<string> {
  const { family, today, actions } = ctx;
  switch (name) {
    case "get_plan":
      ctx.onStatus("予定を見ています");
      return JSON.stringify(planSnapshot(family, today));
    case "get_notebook":
      ctx.onStatus("手帳を見ています");
      return JSON.stringify(notebookSnapshot(family, today));
    case "look_up_town": {
      const m = MILESTONES.find((x) => x.id === input.milestoneId);
      if (!m) return "その id の手続きは予定にありません。get_plan の id を使ってください";
      if (!family.city) return "住んでいる町がまだ入っていません。わが家の設定で町を入れるよう案内してください（/settings）";
      const cached = getLocal(family, m.id);
      ctx.onStatus(tFor(ctx.lang ?? "ja", cached ? "{city}の調べ済みのページを見ています" : "{city}の公式ページを調べています（30秒〜1分）", { city: family.city ?? "" }));
      const { local } = await fetchLocal(family, m);
      ctx.sources.push(...pickSources(family, local.sources).slice(0, 3));
      return JSON.stringify({
        調べた日: local.researchedAt,
        要点: local.summary,
        窓口: local.where,
        役所: local.office,
        持ち物: local.bring,
        オンライン: local.online,
        期限: local.deadline,
        期限の読み方: "「◯日から」は受付の始まりで、締切ではない。予定（get_plan）の期限と違う時は両方を書き、どちらが締切か窓口に確かめる、と書く",
        町独自: local.extras,
        気をつける事: local.caution,
        出典: local.sources.slice(0, 3).map((s) => `${s.title} ${s.url}${isOfficial(s.url) ? "（公式）" : ""}`),
      });
    }
    case "search_official": {
      const q = str(input.question, 300);
      if (!q) return "質問が空です";
      if (ctx.searched) return "公式のページはこの問いでもう1回調べました。ここまでに分かった事で答え、言い切れない所は「窓口に確かめる」と書いてください";
      ctx.searched = true;
      ctx.onStatus("公式のページを調べています（20〜40秒）");
      const r = await research(SEARCH_SYSTEM, `${family.prefecture}${family.city}に住む家族からの質問です。\n${q}`, { maxTokens: 6000, maxUses: 3 });
      ctx.sources.push(...pickSources(family, r.sources).slice(0, 3));
      return JSON.stringify({ 調べた事: r.text, 出典: r.sources.slice(0, 5).map((s) => `${s.title} ${s.url}${isOfficial(s.url) ? "（公式）" : ""}`) });
    }
    case "open_screen": {
      const href = str(input.href, 120);
      if (!isKnownHref(href)) return `「${href}」は画面の地図にありません。地図にある行き先だけを使ってください`;
      actions.push({ type: "open", href, label: str(input.label, 20) || "その画面へ" });
      return "ボタンを出しました";
    }
    case "offer_paperwork": {
      const m = findInSchedule(family, today, input.milestoneId);
      if (!m) return "その id はこの家族の予定にありません";
      actions.push({ type: "milestone", milestoneId: m.id, label: m.plain });
      return "ボタンを出しました（押すまで何も作っていません）。ボタンの名前は画面が決めるので、文では「押すと、窓口と持ち物・下書きが出ます」とだけ書き、ボタンの名前を「」で書かない。窓口を文で言うなら look_up_town の結果と同じ所を書く";
    }
    case "propose_done": {
      const m = findInSchedule(family, today, input.milestoneId);
      if (!m) return "その id はこの家族の予定にありません";
      actions.push({ type: "done", milestoneId: m.id, label: m.plain });
      return "済みにするボタンを出しました（まだ済みにはなっていません）";
    }
    case "add_checkup_question": {
      const text = str(input.text, 300);
      if (!text) return "質問が空です";
      const c = clockAt(family, today);
      const who = input.for === "mother" || c.phase === "pregnant" ? "mother" : "child";
      actions.push({ type: "concern", text, for: who });
      return who === "child"
        ? `${family.childName ?? "子"}の次の健診で聞く事に足すボタンを出しました（まだ足していません。健診のタブの「${family.childName ?? "赤ちゃん"}の健診・予防接種」に並びます）`
        : "ママの次の健診で聞く事に足すボタンを出しました（まだ足していません）";
    }
    case "add_record": {
      const text = str(input.text, 1000);
      if (!text) return "記録する事が空です";
      actions.push({ type: "record", text });
      return "記録するボタンを出しました（まだ記録していません）";
    }
    case "write_message": {
      const body = str(input.body, 3000);
      if (!body) return "本文が空です";
      const via = input.via === "mail" ? "mail" : "line";
      actions.push({ type: "message", to: str(input.to, 60) || "相手", via, ...(via === "mail" && str(input.subject, 120) ? { subject: str(input.subject, 120) } : {}), body });
      return "文を返事の下に出しました（送るのは家族）";
    }
    default:
      return `知らない道具です: ${name}`;
  }
}
