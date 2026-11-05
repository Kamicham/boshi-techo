// Claude への頼みに、画面の言葉を伝える（作り手 11/5 夕の決め事。AskUserQuestion）。
// ① 話す・撮る・書く: 返事（reply・oneQuestion）は画面の言葉、記録（records・deadlines）は家族が話した・書いた言葉のまま
// ② 健診のまとめ: 日本語のまとめに加えて、家族の言葉のまとめも書く（引用＝録音から聞こえた先生の言葉は日本語のまま）
// 統括の決まり（11/5 17:4x）:
// - 日本語の画面の頼みと受け取る形（schema）は1字も変えない（本番のわが家は日本語の画面で Claude を使っている）。試験で守る（話す・撮る・書くは lib/capture-lang.test.ts、健診のまとめは lib/visit-family-words.test.ts）。
// - zh・en の頼みは、API で3つの言葉を確かめるまで off（FOLLOW_BROWSER と同じやり方）。確かめの API は作り手の OK の後に回す。
//   ブラウザの言葉に従う形（①）が入ったので、本番でも、一覧に日本語の無い端末の家族は zh・en の道を通る。
import type { Lang } from ".";

/** 切り替えの印（API で3つの言葉を確かめたら true）。capture＝話す・撮る・書く、visit＝健診のまとめ */
export const CLAUDE_LANG: Readonly<{ capture: boolean; visit: boolean }> = { capture: false, visit: false };

/**
 * 印が on か。確かめの時だけ、その場の環境変数でも on にできる（BOSHI_CLAUDE_LANG=capture,visit。scripts/lang-check.mts が自分の中だけで入れる）。
 * 本番・体験版の置き場（Dockerfile・fly.toml・本番の台本）には入れない（試験が見る）。呼ぶたびに読む
 */
export function claudeLangOn(k: keyof typeof CLAUDE_LANG): boolean {
  if (CLAUDE_LANG[k]) return true;
  return (process.env.BOSHI_CLAUDE_LANG ?? "")
    .split(",")
    .map((s) => s.trim())
    .includes(k);
}

type Other = Exclude<Lang, "ja">;

/** Claude に伝える言葉の名前 */
export const LANG_FOR_CLAUDE: Readonly<Record<Other, string>> = { zh: "简体中文", en: "English" };

/** 119 の一文（安全の文は言い換えない。訳は dict/answers.ts の「急ぎの橋」と同じ字＝試験が見る） */
export const CALL_119: Readonly<Record<Other, string>> = {
  zh: "如果觉得有生命危险，请毫不犹豫地拨打119。",
  en: "If you think a life is in danger, call 119 without hesitation.",
};

/** 頼みに言葉を足すか（日本語の画面・印が off の時は足さない） */
export function claudeLangOf(lang: Lang | null | undefined, on: boolean): Other | null {
  return on && lang && lang !== "ja" ? lang : null;
}

/**
 * ① 話す・撮る・書くの頼み（lib/capture.ts）の最後に足す段。日本語の画面・印が off の時は空（頼みは前と1字も同じ）。
 * 母子手帳のページに入る候補（techo）は、紙の母子手帳の欄に合わせるので前のまま（日本語）。
 */
export function captureLangNote(lang: Lang | null | undefined, on: boolean = claudeLangOn("capture")): string {
  const l = claudeLangOf(lang, on);
  if (!l) return "";
  const name = LANG_FOR_CLAUDE[l];
  return [
    "",
    "",
    `画面の言葉: ${name}`,
    `- reply と oneQuestion は${name}で書く。119 を書く時は「${CALL_119[l]}」をこの字のまま書く（言い換えない）。#8000 はそのまま書く。`,
    "- records と deadlines の title・detail は、家族が話した・書いた言葉のまま書く（日本語に訳さない）。撮った紙の字は、紙の言葉のまま書く。",
    "- detail の最後に添える決まりの文（「次の健診で聞く」「その日のうちに産院へ電話」「その日のうちにかかりつけへ電話。迷ったら #8000」）は、日本語のこの字のまま書く（画面が家族の言葉で出す）。",
    "- techo は前のとおり（紙の母子手帳の欄に合わせて書く）。",
  ].join("\n");
}

/**
 * ② 健診の整理の頼み（app/api/visit/_lib/server.ts）の最後に足す段。日本語の画面・印が off の時は空（頼みは前と1字も同じ）。
 * 足した時だけ、受け取る形に family（lib/visit.ts の FamilyWordsSchema）を足す。
 */
export function organizeLangNote(lang: Lang | null | undefined, on: boolean = claudeLangOn("visit")): string {
  const l = claudeLangOf(lang, on);
  if (!l) return "";
  const name = LANG_FOR_CLAUDE[l];
  return [
    "",
    "",
    `家族の言葉: ${name}`,
    `- 日本語の欄（summary・said・todo・numbers・terms・questions・answered）は、今までどおり日本語で書く。`,
    `- それに加えて family を書く。family は、summary の各行・said の point・todo の what と when・numbers の name と value・terms の plain・questions の question・answered の answer を、家族が読む${name}にした物。日本語の欄と同じ順・同じ数にし、null は null のまま。`,
    "- 引用（quote）は family に入れない（文字起こしのまま、日本語で画面に残る）。",
    "- 訳でも、評価（順調・問題なし など）は先生がそう言った時だけ。数値と単位は変えない。専門の言葉は日本語の欄と同じく言い換え、元の言葉は terms の term（日本語）に任せる。",
  ].join("\n");
}
