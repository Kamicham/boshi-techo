// 合言葉の門: 公開の住所から開いた人は、合言葉を入れるまで手帳を見られない。
// 合言葉は .env.local の BOSHI_PASSCODE（無ければ門は開いたまま＝手元の開発用）。
//
// ログインの入口（BOSHI_LOGIN_GATE=1 の時だけ）: 合言葉の代わりに、ログインの札（クッキー）を持つ人も門を通す。
// - middleware は Edge で動き DB を読めないので、札が「あるか」だけを見る。本物かどうかは API の関所（lib/access.ts の withHousehold）が確かめる
// - だから、すべての API が withHousehold を通るようになるまでは BOSHI_LOGIN_GATE を入れない（偽の札で合言葉を飛ばせてしまう）
// - ログイン・招待・ログインの API（/login・/invite/・/api/auth/・/api/account）は、門の前でも開ける
export const GATE_COOKIE = "boshi_key";

/** 合言葉から cookie に入れる値を作る（合言葉そのものは cookie に置かない） */
export async function gateToken(passcode: string): Promise<string> {
  const data = new TextEncoder().encode(`boshi-techo:${passcode}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** ログインの札の名前（lib/auth.ts の cookiePrefix "boshi"。https では __Secure- が付く） */
export const SESSION_COOKIES = ["boshi.session_token", "__Secure-boshi.session_token"] as const;

/** 合言葉の代わりにログインでも通すか */
export function loginGateOn(): boolean {
  return process.env.BOSHI_LOGIN_GATE === "1";
}

/** 合言葉の前でも開ける道（ログインするための画面と API） */
export function isLoginPath(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname.startsWith("/invite/") ||
    pathname === "/api/account" ||
    pathname.startsWith("/api/auth/")
  );
}

/** ログインの札を持っているか（あるかだけ。本物かは API が確かめる） */
export function hasSessionCookie(get: (name: string) => string | undefined): boolean {
  return SESSION_COOKIES.some((n) => !!get(n));
}
