// 合言葉を確かめて、1年間有効の cookie を渡す。何度も外れたら10分止める。
import { NextResponse } from "next/server";
import { GATE_COOKIE, gateToken } from "@/lib/gate";

const g = globalThis as unknown as { __gateFails?: number[] };
const fails = (g.__gateFails ??= []);

export async function POST(req: Request) {
  const passcode = process.env.BOSHI_PASSCODE;
  if (!passcode) return NextResponse.json({ ok: true });
  const now = Date.now();
  while (fails.length && now - fails[0] > 10 * 60_000) fails.shift();
  if (fails.length >= 10) return NextResponse.json({ error: "何度も違ったので、10分ほど待ってからもう一度入れてください" }, { status: 429 });
  const b = (await req.json().catch(() => ({}))) as { passcode?: unknown };
  if (typeof b.passcode !== "string" || b.passcode.trim() !== passcode) {
    fails.push(now);
    return NextResponse.json({ error: "合言葉が違います" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(GATE_COOKIE, await gateToken(passcode), { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 365 * 86400 });
  return res;
}
