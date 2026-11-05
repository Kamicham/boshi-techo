// 消す前の確かめの言葉（アカウントの画面の「消す」・app/account/page.tsx）。
// 画面の言葉で打ってもらい（日本語「消す」・中文「删除」・English「delete」）、サーバ（api/account/household・subject の DELETE）へは、
// いつも日本語の「消す」を送る（サーバは「消す」で比べる。比べ方は変えない）。どの言葉の画面でも「消す」と打てば通す。
// 11/5 UX: 中文・English の人に、日本語の「消す」を打たせていた（訳の時に見つかった・統括が UX に預けた）
import { currentLang, t } from "./i18n";

/** サーバへ送る確かめの言葉（api/account/household・subject が比べる字） */
export const DELETE_WORD = "消す";

/** 画面に出して打ってもらう言葉（日本語は「消す」のまま。English は小文字で見せる） */
export function deleteWordShown(): string {
  const w = t(DELETE_WORD);
  return currentLang() === "en" ? w.toLowerCase() : w;
}

/** 打った言葉が確かめになっているか（前後の空白は見ない。English は大文字・小文字を問わない） */
export function deleteConfirmed(typed: string): boolean {
  const v = typed.trim();
  if (!v) return false;
  return v === DELETE_WORD || v.toLowerCase() === deleteWordShown().toLowerCase();
}
