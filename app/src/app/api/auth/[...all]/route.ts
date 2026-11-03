// Better Auth の道（/api/auth/*）。メールのコード・パスキー・世帯（organization）・招待。
// 表は初めて叩かれた時に作る（lib/auth.ts の authReady）。
import { authReady } from "@/lib/auth";
import { HttpError } from "@/lib/http-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  try {
    const auth = await authReady();
    return await auth.handler(req);
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "ログインの仕組みが動きませんでした" }, { status: 500 });
  }
}

export { handle as GET, handle as POST, handle as PATCH, handle as PUT, handle as DELETE };
