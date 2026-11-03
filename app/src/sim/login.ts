// シミュレーションのログイン: 作った家族（sim-・pop-）ごとに、仮のアカウントを1つ作り、その世帯の owner として札（セッションのクッキー）を出す。
// 道は /api/sim/login（BOSHI_SIM=1 の時だけ。本番では 404）。なりきりの道具（drive.mjs）と、世帯をまたぐ確かめ（cross.mjs）が呼ぶ。
//
// - 仮のアカウント: メールは <家族id>@sim.boshi.invalid（.invalid は届かない名前）、名前は sim:<家族id>。作った家族だけ
// - 入り方は本物と同じメールのコード（emailOTP）。コードはサーバの中で作ってすぐ使う（メールにも記録にも出さない）
// - 世帯: Better Auth の organization を、id ＝ 家族の id で作り、仮のアカウントを owner にする。
//   organization の API で作ると afterCreateOrganization が kind = real の行を作ってしまうので、表へ直接入れ、households は kind = sim にする
// - わが家の置き場（app/data。BOSHI_DATA_DIR を指定しない）では動かさない
import { authReady } from "../lib/auth";
import { isHomeDataDir } from "../lib/db";
import { getFamily } from "../lib/family";
import { ensureHousehold, getHousehold, listSubjects, seedMadeSubjects, updateSubject } from "../lib/households";
import { HttpError } from "../lib/http-error";

export const simEmail = (familyId: string) => `${familyId}@sim.boshi.invalid`;
export const simAccountName = (familyId: string) => `sim:${familyId}`;

export type SimLogin = { familyId: string; accountId: string; email: string; setCookies: string[] };

/**
 * 作った家族の仮のアカウントでログインし、その世帯の owner にする（何度呼んでもよい。2回目からは札を出し直すだけ）。
 * isSimFamily: 作った家族（kind = sim）かを決める関数（route は lib/family の madeFamilyKind を渡す。試験は一覧を渡す）
 */
export async function simLogin(familyId: unknown, isSimFamily: (id: string) => boolean, meId?: string | null): Promise<SimLogin> {
  if (isHomeDataDir()) throw new HttpError(404, "見つかりません");
  if (typeof familyId !== "string" || !familyId || !isSimFamily(familyId)) throw new HttpError(404, "作った家族ではありません");
  // 同じ id の本物の世帯（kind = real）があれば、作った家族として扱わない
  if (getHousehold(familyId)?.kind === "real") throw new HttpError(404, "作った家族ではありません");

  const auth = await authReady();
  const email = simEmail(familyId);
  const otp = await auth.api.createVerificationOTP({ body: { email, type: "sign-in" } });
  const { headers, response } = await auth.api.signInEmailOTP({
    body: { email, otp, name: simAccountName(familyId) },
    returnHeaders: true,
  });
  const accountId = response.user.id;

  const ctx = await auth.$context;
  const org = await ctx.adapter.findOne({ model: "organization", where: [{ field: "id", value: familyId }] });
  if (!org) {
    await ctx.adapter.create({
      model: "organization",
      data: { id: familyId, name: `作った家族 ${familyId}`, slug: familyId, createdAt: new Date() },
      forceAllowId: true,
    });
  }
  const member = await ctx.adapter.findOne({
    model: "member",
    where: [
      { field: "organizationId", value: familyId },
      { field: "userId", value: accountId },
    ],
  });
  if (!member) {
    await ctx.adapter.create({ model: "member", data: { organizationId: familyId, userId: accountId, role: "owner", createdAt: new Date() } });
  }
  const household = ensureHousehold(familyId, "sim");
  // 本人を置き、なりきる人（meId＝家族の設定の人の id）に仮のアカウントを結ぶ（画面の「わたし」がその人になる）
  const family = getFamily(familyId);
  seedMadeSubjects(household, family);
  if (meId && family) {
    const role = family.members.find((m) => m.id === meId)?.role;
    const kind = role === "母" ? "mother" : role === "パートナー" ? "partner" : null;
    if (kind) {
      for (const s of listSubjects(familyId)) {
        const want = s.kind === kind ? accountId : s.accountId === accountId ? null : s.accountId;
        if (want !== s.accountId) updateSubject(familyId, s.id, { name: s.name, accountId: want });
      }
    }
  }

  return { familyId, accountId, email, setCookies: headers.getSetCookie() };
}

/** /api/sim/login の返事: JSON と、札のクッキー */
export async function simLoginResponse(req: Request, isSimFamily: (id: string) => boolean): Promise<Response> {
  try {
    const url = new URL(req.url);
    let familyId: unknown = url.searchParams.get("familyId");
    if (!familyId && req.method === "POST") {
      const b = (await req.json().catch(() => ({}))) as { familyId?: unknown };
      familyId = b.familyId;
    }
    const me = url.searchParams.get("me");
    const r = await simLogin(familyId, isSimFamily, me);
    const res = Response.json({ ok: true, familyId: r.familyId, accountId: r.accountId, role: "owner" });
    for (const c of r.setCookies) res.headers.append("set-cookie", c);
    return res;
  } catch (e) {
    if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json({ error: "シミュレーションのログインができませんでした" }, { status: 500 });
  }
}
