// 見本の答え（lib/samples.ts の capture・capture-page）の返事を、出す時に画面の言葉にする（11/5 UX）。
// 見本の返事はサーバが日本語で組む（サーバの t() はいつも日本語。Claude を呼ぶ道＝lib/claude.ts は頼みの言葉を持たない）。
// 札「（見本の答え）」で始まる返事だけを、文（「。」まで）ごとに辞書で引く。1文でも辞書に無ければ、元の日本語のまま出す（半分だけ訳さない）。
// Claude が書いた返事（札が無い）は、そのまま出す。日本語の画面は1字も変わらない。試験は reply-text.test.ts
import { currentLang, t } from "@/lib/i18n";

/** lib/samples.ts の SAMPLE_MARK と同じ字（samples.ts は server-only なので画面から読めない。同じかは試験が見る） */
export const SAMPLE_MARK_SHOWN = "（見本の答え）";

/** 話す・撮るの返事（見本の答えだけ訳す） */
export function sampleReplyShown(reply: string): string {
  const lang = currentLang();
  if (lang === "ja" || !reply.startsWith(SAMPLE_MARK_SHOWN)) return reply;
  const rest = reply.slice(SAMPLE_MARK_SHOWN.length);
  const sentences = rest.match(/[^。]+。/g) ?? [];
  if (!sentences.length || sentences.join("") !== rest) return reply;
  const shown = sentences.map((s) => t(s));
  if (shown.some((s, i) => s === sentences[i])) return reply;
  // English は文の間に空きを入れる（手帳に聞くの見本の返事＝lib/samples.ts の sampleAskReply と同じ）
  return [t(SAMPLE_MARK_SHOWN), ...shown].join(lang === "en" ? " " : "");
}
