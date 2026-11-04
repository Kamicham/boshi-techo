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
