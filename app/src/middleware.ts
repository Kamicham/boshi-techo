// 合言葉を入れていない人は、合言葉の画面へ回す（API は 401）。
// BOSHI_LOGIN_GATE=1 の時は、ログインの札を持つ人も通し、ログインの画面と API は門の前でも開ける（lib/gate.ts）。
// 合言葉（BOSHI_PASSCODE）が空なら、今までどおり門は開いたまま。
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken, hasSessionCookie, isLoginPath, loginGateOn } from "@/lib/gate";

export async function middleware(req: NextRequest) {
  const passcode = process.env.BOSHI_PASSCODE;
  if (!passcode) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/unlock" || pathname === "/api/unlock") return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === (await gateToken(passcode))) return NextResponse.next();
  const login = loginGateOn();
  if (login && (isLoginPath(pathname) || hasSessionCookie((n) => req.cookies.get(n)?.value))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: login ? "ログインしてください" : "合言葉を入れてください" }, { status: 401 });
  // Tailscale を通ると住所が localhost に見えるので、届いた Host から行き先を組む
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const to = login ? `/login?next=${encodeURIComponent(pathname + req.nextUrl.search)}` : "/unlock";
  return NextResponse.redirect(new URL(to, `${proto}://${host}`));
}

export const config = {
  // 画面の部品（_next）・アイコンは門の外
  matcher: ["/((?!_next/|favicon\\.ico|icon|apple-icon|manifest).*)"],
};
