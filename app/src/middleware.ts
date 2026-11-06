// 合言葉を入れていない人は、合言葉の画面へ回す（API は 401）。
// BOSHI_LOGIN_GATE=1 の時は、ログインの札を持つ人も通し、ログインの画面と API は門の前でも開ける（lib/gate.ts）。
// 合言葉（BOSHI_PASSCODE）が空なら、今までどおり門は開いたまま。
import { NextResponse, type NextRequest } from "next/server";
import { BIG_BODY, bodyTooBig } from "@/lib/body-limit";
import { GATE_COOKIE, gateToken, hasSessionCookie, isLoginPath, loginGateOn } from "@/lib/gate";
import { newTrialId, publicOn, TRIAL_COOKIE, TRIAL_DAYS, trialIdFromCookie } from "@/lib/trial-cookie";

// ───────── 公開版（BOSHI_PUBLIC=1・2026-11-04） ─────────
// だれでも体験できる版。開いた人に体験の札（boshi_try）を配り、サーバはその人の写しだけを読み書きする（lib/trial.ts）。
// 本物の家族の登録はまだ開けないので、アカウント・招待・書き出し・シミュレーションの口は閉じる。
// 健診（visit）は、公開版では読むだけ（共有の見本の家族に録音を書かせない）。
const CLOSED_API = [/^\/api\/auth\/(?!get-session)/, /^\/api\/account\//, /^\/api\/household(\/|$)/, /^\/api\/export(\/|$)/, /^\/api\/sim\//, /^\/api\/unlock$/];
const CLOSED_PAGE = [/^\/login(\/|$)/, /^\/account(\/|$)/, /^\/invite(\/|$)/, /^\/unlock$/];

/** 見張りの口（fly.toml の checks・15秒ごと）。札を配らずに通す（配ると、見張りのたびに札が増える） */
const HEALTH = "/api/health";

function publicGate(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;
  if (pathname === HEALTH) return NextResponse.next();
  if (CLOSED_API.some((r) => r.test(pathname))) return NextResponse.json({ error: "公開版（体験）では使えません" }, { status: 404 });
  if (pathname.startsWith("/api/visit") && req.method !== "GET")
    return NextResponse.json({ error: "体験版の健診の録音は準備中です。健診の日の流れは、録音の無い形で見られます" }, { status: 403 });
  if (CLOSED_PAGE.some((r) => r.test(pathname))) return NextResponse.redirect(new URL("/", req.url));
  // 送る中身の大きさ（写真と声は 32MB、ほかは 1MB）。超えたら中身を読まずに 413（lib/body-limit.ts）
  const tooBig = bodyTooBig(req.method, pathname, req.headers.get("content-length"));
  if (tooBig) return NextResponse.json({ error: tooBig }, { status: 413 });
  if (trialIdFromCookie(req.headers.get("cookie"))) return NextResponse.next();
  // 札が無ければ配る。この1回の頼みにも札を付けて通す（サーバが同じ頼みの中で写しを作れるように）
  const id = newTrialId();
  const headers = new Headers(req.headers);
  headers.set("cookie", [req.headers.get("cookie"), `${TRIAL_COOKIE}=${id}`].filter(Boolean).join("; "));
  const res = NextResponse.next({ request: { headers } });
  res.cookies.set(TRIAL_COOKIE, id, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/", maxAge: TRIAL_DAYS * 86_400 });
  return res;
}

export async function middleware(req: NextRequest) {
  if (publicOn()) return publicGate(req);
  // 公開版の外（わが家の本番・シミュレーション・手元の試し）でも、名乗った長さが写真と声の上限（32MB）を超える頼みは、中身を読まずに 413。
  // Next.js 15.5.29 は門のために写す中身を 32MB で黙って切るので、切れた写真や声が口に届いて残る前に断る（lib/body-limit.ts・lib/read-body.ts）
  const tooBig = bodyTooBig(req.method, req.nextUrl.pathname, req.headers.get("content-length"), BIG_BODY);
  if (tooBig) return NextResponse.json({ error: tooBig }, { status: 413 });
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
