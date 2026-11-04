// 初めて書く・話す・撮る時の「米国の Claude に送る同意」の順番（2026-11-04 UX の直し）。
// - 送る前に同意の状態（GET /api/account/consent）を読めたら、まだの時は送らずに青い案内だけを出す
// - 読めない時は今まで通り送り、403（ConsentRequiredError）を受けたら赤い失敗の知らせを出さず、同じ青い案内を出す
// - 同意の画面へ移る前に「待っている」印を控え、戻ってきて同意が済んでいれば、控えの文を1回だけ送る
// 画面（components/capture/CaptureScreen.tsx）が使う決まりだけをここに置く（vitest は .tsx を読めないため）。

/** サーバの ConsentRequiredError の文（lib/claude.ts）に入っている言葉 */
export const CLAUDE_CONSENT_MARK = "米国の Claude に送る同意";

/** 同意の状態。ok＝送ってよい（見本の家族・移る前のわが家も ok）／needed＝まだの本人がいる／null＝読めなかった */
export type ClaudeConsentState = "ok" | "needed" | null;

/** 失敗の文が「同意がまだ」の知らせか（ClaudeConsentLink と同じ見分け方） */
export function isClaudeConsentError(message: string | null | undefined): boolean {
  return !!message && message.includes(CLAUDE_CONSENT_MARK);
}

/** GET /api/account/consent の答えから状態を取り出す（形が違えば読めなかった扱い） */
export function readConsentState(j: unknown): ClaudeConsentState {
  const v = (j as { claude?: unknown } | null)?.claude;
  return v === "ok" || v === "needed" ? v : null;
}

/** 送る前の判断: 同意がまだと分かっている時だけ送らない（読めない時は送ってみる） */
export function mayTrySend(state: ClaudeConsentState): boolean {
  return state !== "needed";
}

/** 同意の画面から戻った時の判断（控えの文・待っている印・同意の状態から） */
export function afterConsentReturn(p: { draft: string | null; waiting: boolean; state: ClaudeConsentState }): "send" | "ask" | "none" {
  if (!p.waiting || !p.draft?.trim()) return "none";
  if (p.state === "ok") return "send";
  return "ask";
}

/** 同意を待っている印の置き場（sessionStorage。この端末のこのタブだけ） */
export const consentWaitKey = (familyId: string) => `boshi.captureConsentWait:${familyId}`;

/** 手帳に聞く: 同意の画面へ移る前に、答えの付かなかった問いを控える置き場（戻ったら窓を開き直して聞き直す） */
export const askConsentWaitKey = (familyId: string) => `boshi.askConsentWait:${familyId}`;
