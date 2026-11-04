// 公開版の体験用の家族（2026-11-04）: 札の名前と形だけ。middleware（edge）からも読むので、DB やサーバの部品を読まない。
// 公開版（BOSHI_PUBLIC=1）では、開いた人ごとに見本の家族の写し（try-＋32桁の乱数）を作り、その id を札（クッキー）で持たせる。
// 札そのものが合言葉なので、ほかの人に id は渡さない（画面は今までどおり見本の家族の id で頼み、サーバが札の写しに置き換える）。

export const TRIAL_COOKIE = "boshi_try";
/** 体験の写しが残る日数（札の期限も同じ） */
export const TRIAL_DAYS = 7;

const TRIAL = /^try-[0-9a-f]{32}$/;

/** 体験用の家族の id か */
export function isTrialId(id: unknown): boolean {
  return typeof id === "string" && TRIAL.test(id);
}

/** 見本の家族か、その体験の写しか（見本と同じ扱い: 時計の早送り・作った記録・見本の答え） */
export function isDemoLike(id: unknown): boolean {
  return id === "demo-sato" || isTrialId(id);
}

/** 公開版で動いているか */
export function publicOn(): boolean {
  return process.env.BOSHI_PUBLIC === "1";
}

/** 新しい体験の id（推し量れない乱数） */
export function newTrialId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return `try-${Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("")}`;
}

/** Cookie の見出しから体験の id（無い・形が違えば null） */
export function trialIdFromCookie(header: string | null | undefined): string | null {
  for (const part of (header ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === TRIAL_COOKIE) {
      const id = decodeURIComponent(v.join("="));
      return isTrialId(id) ? id : null;
    }
  }
  return null;
}
