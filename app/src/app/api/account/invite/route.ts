// 招待: 作る（持ち主・共同の管理）・中身を見る（招かれた人）・取り消す。受けるのは ./accept。
// 招待のリンクは /invite/<招待の id>。48時間で切れる（lib/auth.ts の invitationExpiresIn）。
// 役と範囲: admin＝共同の管理（パートナー）、member＝読むだけ（祖父母など）。母の記録のどの項目を見せるかは母が選ぶ（既定は子の記録だけ）。
import { body, route } from "@/lib/api";
import { authReady } from "@/lib/auth";
import { requireAccount, withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { audit } from "@/lib/households";
import { RELATIONS, SHARE_ITEMS, type Relation, type ShareItem } from "@/components/settings/consent-texts";
import { authError, householdName, inviteScope, toIso } from "../_lib/server";

export const dynamic = "force-dynamic";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; email?: string; role?: string; relation?: string; showMother?: string[] }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:admin");
  if (ctx.household.kind !== "real" || !ctx.account) throw new HttpError(403, "作った家族（デモ）には招待できません");
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) throw new HttpError(400, "メールの形が違います");
  const role = b.role === "admin" ? "admin" : "member";
  const relation: Relation = (RELATIONS as readonly string[]).includes(String(b.relation)) ? (b.relation as Relation) : "そのほかの家族";
  const allowed = new Set<string>(SHARE_ITEMS.map((x) => x.id));
  const showMother = (Array.isArray(b.showMother) ? b.showMother : []).filter((x): x is ShareItem => allowed.has(x));
  // 母の項目を見せる範囲は、母（本人）が選ぶ。母本人でない人が招待する時は、母の項目は見せない（子の記録だけ）
  const motherIsMe = ctx.subjects.some((s) => s.kind === "mother" && s.accountId === ctx.account!.id);
  if (showMother.length && !motherIsMe) throw new HttpError(403, "母の記録を見せる範囲は、母本人が選びます");

  const auth = await authReady();
  let inv: { id: string; expiresAt: unknown };
  try {
    inv = (await auth.api.createInvitation({ body: { email, role, organizationId: ctx.household.id, resend: true }, headers: req.headers })) as {
      id: string;
      expiresAt: unknown;
    };
  } catch (e) {
    authError(e, "招待を作れませんでした");
  }
  audit(ctx.household.id, ctx.account.id, "invite.create", { target: inv.id, detail: { role, relation, showMother } });
  return { id: inv.id, link: `/invite/${inv.id}`, expiresAt: toIso(inv.expiresAt) };
});

/** 招かれた人が中身を見る（ログインが要る。招待先のメールと一致しないと Better Auth が断る） */
export const GET = route(async (req: Request) => {
  await requireAccount(req);
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) throw new HttpError(404, "招待が見つかりません");
  const auth = await authReady();
  let inv: { id: string; organizationId: string; organizationName?: string; inviterEmail?: string; role: string; status: string; expiresAt: unknown };
  try {
    inv = (await auth.api.getInvitation({ query: { id }, headers: req.headers })) as typeof inv;
  } catch (e) {
    authError(e, "招待が見つかりません。期限（48時間）が切れたか、取り消されました");
  }
  const scope = inviteScope(id);
  return {
    id: inv.id,
    householdName: inv.organizationName ?? householdName(inv.organizationId) ?? "",
    inviterEmail: inv.inviterEmail ?? "",
    role: inv.role,
    status: inv.status,
    expiresAt: toIso(inv.expiresAt),
    relation: scope?.relation ?? null,
    showMother: scope?.showMother ?? [],
  };
});

/** 招待を取り消す */
export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; invitationId?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:admin");
  if (!b.invitationId) throw new HttpError(404, "招待が見つかりません");
  const auth = await authReady();
  try {
    await auth.api.cancelInvitation({ body: { invitationId: b.invitationId }, headers: req.headers });
  } catch (e) {
    authError(e, "招待を取り消せませんでした");
  }
  audit(ctx.household.id, ctx.account?.id ?? null, "invite.cancel", { target: b.invitationId });
  return { ok: true };
});
