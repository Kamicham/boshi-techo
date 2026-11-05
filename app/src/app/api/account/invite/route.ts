// 招待: 作る（持ち主・共同の管理）・中身を見る（招かれた人）・取り消す。受けるのは ./accept。
// 招待のリンクは /invite/<招待の id>。48時間で切れる（lib/auth.ts の invitationExpiresIn）。
// 役と範囲: admin＝共同の管理（パートナー）、member＝読むだけ（祖父母など）。母の記録のどの項目を見せるかは母が選ぶ（既定は子の記録だけ）。
import { body, route } from "@/lib/api";
import { authReady } from "@/lib/auth";
import { currentAccount, withHousehold } from "@/lib/access";
import { ensureAccountSchema } from "@/lib/db";
import { getFamily } from "@/lib/family";
import { listSubjects } from "@/lib/households";
import { inviteHeadline, inviterWord, maskEmail, periodWord } from "@/lib/invite-words";
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
  const relation: Relation = (RELATIONS as readonly string[]).includes(String(b.relation)) ? (b.relation as Relation) : "そのほかの家族";
  // ママとパートナーは共同の管理。ママを招けるのは、母の本人にまだだれも結びついていない時だけ
  const role = relation === "ママ" || b.role === "admin" ? "admin" : "member";
  if (relation === "ママ" && ctx.subjects.some((s) => s.kind === "mother" && s.accountId)) throw new HttpError(400, "ママは、もうこの手帳に入っています");
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

/**
 * 招待のリンクを開いた画面の、ログイン前に見せてよい最小の中身（何の招待か）。
 * リンクは推測できない札で48時間で切れる。それでもメールそのもの・世帯の名前・記録の中身は出さない。
 * 出すのは: 招いた人の呼び名（世帯の本人の名前。無ければ出さない）・時期の言葉（妊娠11週・生後3か月）・役・伏せたメール・期限。
 */
function invitePreview(id: string) {
  const r = ensureAccountSchema()
    .prepare(`SELECT id, email, inviterId, organizationId, role, status, expiresAt FROM invitation WHERE id = ?`)
    .get(id) as { id: string; email: string; inviterId: string | null; organizationId: string; role: string; status: string; expiresAt: unknown } | undefined;
  const expiresAt = r ? toIso(r.expiresAt) : "";
  if (!r || r.status !== "pending" || !(Date.parse(expiresAt) > Date.now())) throw new HttpError(404, "招待が見つかりません。期限（48時間）が切れたか、取り消されました");
  const inviterName = (r.inviterId && listSubjects(r.organizationId).find((s) => s.accountId === r.inviterId)?.name) || null;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const period = periodWord(getFamily(r.organizationId), today);
  const relation = inviteScope(r.id)?.relation ?? null;
  // who・period: 見出しの呼び名と時期の言葉（日本語）を分けても返す。中文・English の画面が、日本語の見出しを読み直さずに組めるように（11/5 UX）
  return { id: r.id, headline: inviteHeadline(inviterName, period), who: inviterWord(inviterName), period, role: r.role, relation, maskedEmail: maskEmail(r.email), expiresAt };
}

/**
 * 招待の中身。ログイン前は invitePreview の最小の中身だけ。
 * ログインした後は、招待先のメールと一致しないと Better Auth が断る。一致すれば、母が見せると選んだ項目も返す。
 */
export const GET = route(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!id) throw new HttpError(404, "招待が見つかりません");
  await authReady();
  const preview = invitePreview(id);
  const account = await currentAccount(req);
  if (!account) return { ...preview, signedIn: false as const };
  const auth = await authReady();
  let inv: { id: string; organizationId: string; organizationName?: string; inviterEmail?: string; role: string; status: string; expiresAt: unknown };
  try {
    inv = (await auth.api.getInvitation({ query: { id }, headers: req.headers })) as typeof inv;
  } catch (e) {
    authError(e, "招待が見つかりません。期限（48時間）が切れたか、取り消されました");
  }
  const scope = inviteScope(id);
  return {
    ...preview,
    signedIn: true as const,
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
