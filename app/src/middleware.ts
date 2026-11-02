// 合言葉を入れていない人は、合言葉の画面へ回す（API は 401）。
import { NextResponse, type NextRequest } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

export async function middleware(req: NextRequest) {
  const passcode = process.env.BOSHI_PASSCODE;
  if (!passcode) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (pathname === "/unlock" || pathname === "/api/unlock") return NextResponse.next();
  if (req.cookies.get(GATE_COOKIE)?.value === (await gateToken(passcode))) return NextResponse.next();
  if (pathname.startsWith("/api/")) return NextResponse.json({ error: "合言葉を入れてください" }, { status: 401 });
  // Tailscale を通ると住所が localhost に見えるので、届いた Host から行き先を組む
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
  const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return NextResponse.redirect(new URL("/unlock", `${proto}://${host}`));
}

export const config = {
  // 画面の部品（_next）・アイコンは門の外
  matcher: ["/((?!_next/|favicon\\.ico|icon|apple-icon|manifest).*)"],
};
