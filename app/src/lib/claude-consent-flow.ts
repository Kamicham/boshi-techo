// 初めて書く・話す・撮る時の「米国の Claude に送る同意」の順番（2026-11-04 UX の直し）。
// - 送る前に同意の状態（GET /api/account/consent）を読めたら、まだの時は送らずに青い案内だけを出す
// - 読めない時は今まで通り送り、403（ConsentRequiredError）を受けたら赤い失敗の知らせを出さず、同じ青い案内を出す
// - 同意の画面へ移る前に「待っている」印を控え、戻ってきて同意が済んでいれば、控えの文を1回だけ送る
// 画面（components/capture/CaptureScreen.tsx）が使う決まりだけをここに置く（vitest は .tsx を読めないため）。

/** サーバの ConsentRequiredError の文（lib/claude.ts）に入っている言葉 */
export const CLAUDE_CONSENT_MARK = "米国の Claude に送る同意";

/**
 * 同意がまだの時の共通の文（lib/claude.ts の ConsentRequiredError と、画面の案内で同じ文。見直し C38 ③・2026-11-05）。
 * 話す・撮るだけでなく、下書き・手帳に聞く・気づき・一冊でも同じ所で止まるので、どの仕事にも合う言い方にする
 */
export const CONSENT_REQUIRED_TEXT = `手帳が書く・答える・分けるのに、${CLAUDE_CONSENT_MARK}が要ります（まだの人がいます）。読んで決めると、そのまま続けられます`;

/** 同意の状態。ok＝送ってよい（見本の家族・移る前のわが家も ok）／needed＝まだの本人がいる／mother＝まだ手帳に入っていないママの分が要る（母の分は母本人だけ）／null＝読めなかった */
export type ClaudeConsentState = "ok" | "needed" | "mother" | null;

/** 失敗の文が「同意がまだ」の知らせか（ClaudeConsentLink と同じ見分け方） */
export function isClaudeConsentError(message: string | null | undefined): boolean {
  return !!message && message.includes(CLAUDE_CONSENT_MARK);
}

/** GET /api/account/consent の答えから状態を取り出す（形が違えば読めなかった扱い） */
export function readConsentState(j: unknown): ClaudeConsentState {
  const v = (j as { claude?: unknown } | null)?.claude;
  return v === "ok" || v === "needed" || v === "mother" ? v : null;
}

/** 送る前の判断: 同意がまだと分かっている時だけ送らない（読めない時は送ってみる） */
export function mayTrySend(state: ClaudeConsentState): boolean {
  return state !== "needed" && state !== "mother";
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

// ── 下書き（見直し C38 ①・2026-11-05）: 「書く事のメモを作る」が同意の前で止まった時 ──
// 同意の画面へ移る前に、どの事の下書きかを控える。戻ってその事の動きが開いたら、同意が済んでいれば1回だけそのまま作る。

/** 下書きを待っている控えの置き場（sessionStorage。この端末のこのタブだけ） */
export const draftConsentWaitKey = (familyId: string) => `boshi.draftConsentWait:${familyId}`;

/** 控えの中身（どの事か・いつ控えたか） */
export function draftWaitValue(milestoneId: string, now: number): string {
  return JSON.stringify({ m: milestoneId, at: now });
}

/** 控えを使える時間（同意の画面を読んで決めるのに十分な長さ。古い控えで、別の日に急に作り始めない） */
export const DRAFT_WAIT_MS = 30 * 60_000;

/**
 * 同意の画面から戻った時、この事の下書きをどうするか。
 * make＝同意が済んだので作る／ask＝待っていたが同意がまだ（読めなかった時も）なので、作らずに同じ案内を出す／none＝この事を待っていない
 */
export function afterDraftConsentReturn(p: { raw: string | null; milestoneId: string; now: number; state: ClaudeConsentState }): "make" | "ask" | "none" {
  if (!waitingDraftFor(p.raw, p.milestoneId, p.now)) return "none";
  return p.state === "ok" ? "make" : "ask";
}

/** 控えが、この事の物で、まだ新しいか */
export function waitingDraftFor(raw: string | null, milestoneId: string, now: number): boolean {
  if (!raw) return false;
  try {
    const v = JSON.parse(raw) as { m?: unknown; at?: unknown };
    return v.m === milestoneId && typeof v.at === "number" && now >= v.at && now - v.at < DRAFT_WAIT_MS;
  } catch {
    return false;
  }
}
