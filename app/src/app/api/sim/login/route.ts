// シミュレーションのサーバ（BOSHI_SIM=1・scripts/sim-server.sh）だけの入口: 作った家族（sim-・pop-）の仮のアカウント sim:<家族id> で
// ログインし、その世帯の owner の札（セッションのクッキー）を出す。中身は src/sim/login.ts。
//   GET /api/sim/login?familyId=sim-04   （POST { familyId } でもよい）
// 本番（BOSHI_SIM が無い）では、中身を読み込まずに 404 を返す。わが家の置き場（app/data）でも 404。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(req: Request): Promise<Response> {
  if (process.env.BOSHI_SIM !== "1") return new Response("Not Found", { status: 404 });
  const [{ simLoginResponse }, { madeFamilyKind }] = await Promise.all([import("@/sim/login"), import("@/lib/family")]);
  return simLoginResponse(req, (id) => madeFamilyKind(id) === "sim");
}

export { handle as GET, handle as POST };
