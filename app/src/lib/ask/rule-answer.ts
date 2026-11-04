// 「手帳に聞く」の決まりの答え: 予定表と画面の地図だけで答えられる問いは、Claude を使わずに答える。
// 使う時: 見本の家族で鍵が無い・上限を超えた日、まだ「米国の Claude に送る同意」をしていない家族（UX 2026-11-04:
// 見本では何を聞いても同じ「鍵を入れると…」が返り、何ができるかが体験できなかった。同意の前は問いが答えなしで積まれた）。
// 答えは予定表の値の写しだけ（作り話を足さない）。体・心の言葉がある問いは使わない（呼ぶ側が bridge を先に見る）。
// 画面からもサーバからも読まない純粋な決まり（試験は rule-answer.test.ts）。
import { SCREENS } from "../app-guide";
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

const VAX_OR_CHECKUP = /vacc|bcg|booster|checkup/;

/** 体・心・量の問いは決まりで答えない（呼ぶ側の bridge と Claude に任せる） */
const BODY = /痛|熱|血|吐|咳|せき|便|うんち|おしっこ|張り|むくみ|体重|身長|ミルク|母乳|授乳|離乳|眠れ|泣|不安|つらい|しんどい|イライラ|動かない|胎動|薬|病気|症状/;

export function ruleKind(text: string): RuleKind | null {
  const t = text.trim();
  if (!t || BODY.test(t)) return null;
  if (/この画面|何ができる|どう使う|使い方/.test(t)) return "screen";
  if (/(予防接種|ワクチン|接種)/.test(t) || (/健診/.test(t) && /いつ|次の/.test(t) && !/何を聞|聞けば|聞く事/.test(t))) return "checkups";
  if (/次にやる|やる事は|やることは|今やる|何をすれば|何からやれば/.test(t)) return "next";
  if (TOPIC_WORDS.some((w) => t.includes(w))) return "topic";
  return null;
}

const when = (r: PlanRow) => {
  const due = r.期限 ? `期限 ${r.期限}` : r.目安の日 ? `目安 ${r.目安の日}` : "";
  const start = r.状態 === "まだ先" ? `${r.始まり}から` : "";
  return [start, due].filter(Boolean).join("・");
};
const who = (r: PlanRow) => (/^(母|家族)/.test(r.担当) ? "" : `（${r.担当}の番）`);
const line = (r: PlanRow) => `・${r.やさしい題}${who(r)}${when(r) ? ` — ${when(r)}` : ""}`;
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
    return { text: `${RULE_MARK}\nこの画面（${s.name}）でできる事:\n${s.can.slice(0, 4).map((c) => `・${c}`).join("\n")}`, actions: [] };
  }
  if (kind === "next") {
    const visit = plan.健診の予約;
    const late = (plan.過ぎた事 ?? []).slice(0, 2);
    const lateLine = late.length ? `\n始める前に目安が過ぎた事: ${late.join("・")}（済んでいなければ、今からでもできます。「いま」の画面で、済んでいるかを聞いています）` : "";
    const visitLine = visit ? `・次の妊婦健診を予約する — ${visit.when}（国の目安。病院で日を言われていたら、そちらに合わせてください）` : "";
    const visitAct: AskAction[] = visit ? [{ type: "open", href: "/visit", label: "予約した日を入れる" }] : [];
    const count = plan.今やる事.length + (visit ? 1 : 0);
    if (count) {
      const top = byDue(plan.今やる事).slice(0, visit ? 2 : 3);
      const more = plan.今やる事.length - top.length;
      return {
        text: `${RULE_MARK}\nいまやる事は${count}つです。\n${[...top.map(line), visitLine].filter(Boolean).join("\n")}${more > 0 ? `\nほかに${more}つ（「いま」の画面にあります）` : ""}${lateLine}${top.length ? "\n押すと、その事の窓口調べ・書く事のメモが開きます。" : ""}`,
        actions: [...top.map(act), ...visitAct],
      };
    }
    const next = plan.まだ先の事[0];
    if (!next && !late.length) return null;
    return {
      text: `${RULE_MARK}${late.length ? lateLine : ""}${next ? `\n${late.length ? "ほかに" : ""}今すぐやる事はありません。次は「${next.やさしい題}」で、${next.始まり}からです。近づいたら、「いま」の画面に出します。` : ""}`,
      actions: next ? [act(next)] : [],
    };
  }
  if (kind === "checkups") {
    const rows = all.filter((r) => VAX_OR_CHECKUP.test(r.id)).slice(0, 3);
    if (!rows.length) return null;
    return { text: `${RULE_MARK}\n予定表の、次の健診と予防接種です。\n${rows.map(line).join("\n")}\n日付は国の目安です。病院で日を言われていたら、そちらに合わせてください。`, actions: rows.map(act) };
  }
  const words = TOPIC_WORDS.filter((w) => text.includes(w));
  const rows = all.filter((r) => words.some((w) => r.やさしい題.includes(w) || r.正式な名前.includes(w))).slice(0, 3);
  if (!rows.length) return null;
  return { text: `${RULE_MARK}\n予定表にある、関係する事です。\n${rows.map(line).join("\n")}\n押すと、窓口・持ち物・書く事のメモが開きます。町ごとに違う所は、窓口に確かめてください。`, actions: rows.map(act) };
}
