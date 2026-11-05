// 「子育てについて気軽に相談できる人はいますか。」（CONSULT_QUESTION）の答えを、答えた人ごとに読む（画面を持たない純粋な関数。試験は consult-answer.test.ts）。
//
// 答えは4つ: いる／いるけど頼みにくい／いない／今は答えない。
// 保存の形は今の手帳の記録（page "consult"、values は has・whom・text だけ。lib/techo-store.ts の VALUE_KEYS）に合わせ、
// 鍵を増やさずに text の決まった文で見分ける:
//   いる           → { has: true }
//   いない         → { has: false }
//   頼みにくい     → { has: false, text: "いるけど頼みにくい" }（紙の手帳の「はい／いいえ」では、頼れない＝いいえの側）
//   今は答えない   → { text: "今は答えない" }（その時期は二度と聞かない印）
// 話して残した「保健師さんに相談した」などの記録（whom・text だけ）は、相談できる人がいる側に数える。
import { addDays, addMonths, clockAt, lmpFromDue } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { TechoEntry } from "@/lib/techo";

export type ConsultAnswer = "yes" | "hard" | "no" | "skip";

export const CONSULT_HARD_TEXT = "いるけど頼みにくい";
export const CONSULT_SKIP_TEXT = "今は答えない";

/** 答えを、手帳の記録の values にする */
export function consultValues(a: ConsultAnswer): TechoEntry["values"] {
  switch (a) {
    case "yes":
      return { has: true };
    case "no":
      return { has: false };
    case "hard":
      return { has: false, text: CONSULT_HARD_TEXT };
    case "skip":
      return { text: CONSULT_SKIP_TEXT };
  }
}

/** 記録の values から答えを読む（読めない時は null） */
export function answerOf(values: TechoEntry["values"] | undefined): ConsultAnswer | null {
  if (!values) return null;
  const text = typeof values.text === "string" ? values.text.trim() : "";
  if (text === CONSULT_SKIP_TEXT) return "skip";
  if (text === CONSULT_HARD_TEXT) return "hard";
  if (values.has === true) return "yes";
  if (values.has === false) return "no";
  // 「◯◯さんに相談した」の記録
  if (values.whom || text) return "yes";
  return null;
}

/**
 * その時期（from〜to）に、この人（meName）が答えた最後の答え。まだなら null（＝聞く）。
 * - 記録の who が今の人と同じ物だけを見る（母が答えても、パートナーには別に聞く）
 * - who の無い古い記録は、誰の答えか分からないので、全員の答えとして扱う（同じ問いを二度聞かない側に倒す）
 * - 今の人が分からない時（meName が空）は、誰の答えでも数える（今までどおり）
 * - OK 待ち（pending）の候補は、まだ答えではない
 */
export function consultAnswerFor(entries: TechoEntry[], period: { from: string; to: string }, meName?: string | null): ConsultAnswer | null {
  let last: { date: string; i: number; a: ConsultAnswer } | null = null;
  entries.forEach((e, i) => {
    if (e.page !== "consult" || e.pending) return;
    if (e.date < period.from || e.date > period.to) return;
    if (meName && e.who && e.who !== meName) return;
    const a = answerOf(e.values);
    if (!a) return;
    // 同じ日なら後ろの方（あとで足した方）
    if (!last || e.date > last.date || (e.date === last.date && i > last.i)) last = { date: e.date, i, a };
  });
  return (last as { a: ConsultAnswer } | null)?.a ?? null;
}

/** 頼れる所を出し続ける答え（いない・頼みにくい） */
export const needsBridge = (a: ConsultAnswer | null) => a === "no" || a === "hard";

/** 聞く区切り（手帳のページの時期）。from〜to の間に答えがあれば、その区切りは聞かない。label は手帳に残す日本語（出す時に t() で訳す） */
export interface ConsultPeriod {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** 産後の最初の問いを始める日（生まれた日から数えて）。府令様式の保護者の記録「2週間頃」（p.18）に合わせる（家族の声①への直し A・2026-11-05） */
export const CONSULT_FIRST_AFTER_BIRTH_DAYS = 14;

/**
 * 今日がどの区切りにいるか（授かる前・2歳を過ぎた後は聞かない）。
 * 生まれてから14日の間（ようこそ・届けの束の日）は聞かない。産後の最初の区切りは生後14日から1か月の前の日まで。
 */
export function consultPeriod(family: Family, today: string): ConsultPeriod | null {
  const c = clockAt(family, today);
  if (c.phase === "pregnant") {
    // 妊娠を届けて手帳をもらうころ（8週ごろ）から聞く
    if ((c.pregnancyWeek ?? 0) < 8) return null;
    const lmp = lmpFromDue(family.dueDate);
    return { key: "pregnancy", label: "妊娠中", from: lmp, to: addDays(family.birthDate ?? addDays(family.dueDate, 14), -1) };
  }
  if (c.phase !== "child" || !family.birthDate) return null;
  const b = family.birthDate;
  const first = addDays(b, CONSULT_FIRST_AFTER_BIRTH_DAYS);
  if (today < first) return null;
  const cuts: [string, string, number, number][] = [
    ["2w", "産後2週ごろ", 0, 1],
    ["1m", "1か月", 1, 3],
    ["3m", "3〜4か月", 3, 6],
    ["6m", "6〜7か月", 6, 12],
    ["12m", "1歳", 12, 18],
    ["18m", "1歳6か月", 18, 24],
  ];
  const m = c.ageMonths ?? 0;
  const hit = cuts.find(([, , a, z]) => m >= a && m < z);
  if (!hit) return null;
  return { key: hit[0], label: hit[1], from: hit[0] === "2w" ? first : addMonths(b, hit[2]), to: addDays(addMonths(b, hit[3]), -1) };
}
