// 世帯: 作る（最初の人）・中身を見る（本人・同意・仲間・招待）・全部を消す。
import { body, route } from "@/lib/api";
import { authReady } from "@/lib/auth";
import { requireAccount, withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { activeConsent, addSubject, audit, consentHistory, ensureHousehold, listProxies, purgeHousehold, type SubjectKind } from "@/lib/households";
import { CONSENT_VERSION } from "@/components/settings/consent-texts";
import { authError, canConsentFor, ensureMadeSubjects, householdName, listMembers, listPendingInvitations, newSlug } from "../_lib/server";

export const dynamic = "force-dynamic";

const name30 = (v: unknown, fallback: string) => (typeof v === "string" && v.trim() ? v.trim().slice(0, 30) : fallback);

/** 世帯の中身（GET ?familyId=） */
export const GET = route(async (req: Request) => {
  const familyId = new URL(req.url).searchParams.get("familyId");
  const ctx = await withHousehold(req, familyId, "record:read");
  const hid = ctx.household.id;
  const subjects = ensureMadeSubjects(ctx);
  // 画面の並び: 母 → パートナー → 子（同じ種類は作った順）
  const ORDER = { mother: 0, partner: 1, child: 2 } as const;
  const visible = [...(ctx.role === "guest" ? subjects : ctx.subjects)].sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.createdAt.localeCompare(b.createdAt));
  const admin = ctx.role !== "guest" && ctx.can("household:admin");
  const seen = new Set(visible.map((s) => s.id));
  return {
    household: { id: hid, kind: ctx.household.kind, name: ctx.role === "guest" ? "作った家族（デモ）" : (householdName(hid) ?? "") },
    role: ctx.role,
    perms: [...ctx.perms],
    account: ctx.account,
    subjects: visible.map((s) => ({
      ...s,
      mine: !!ctx.account && s.accountId === ctx.account.id,
      canConsent: canConsentFor(ctx, s),
      record: activeConsent(hid, s.id, "record", CONSENT_VERSION.record),
      claude: activeConsent(hid, s.id, "claude_us", CONSENT_VERSION.claude_us),
    })),
    history: consentHistory(hid).filter((c) => seen.has(c.subjectId)),
    members: ctx.role === "guest" ? [] : listMembers(hid),
    invitations: admin ? listPendingInvitations(hid) : [],
    proxies: admin ? listProxies(hid) : ctx.account ? listProxies(hid, ctx.account.id) : [],
  };
});

/** 世帯を作る（作った人が owner）。本人の母・子（生まれる前は仮の名前）、パートナーを作る */
export const POST = route(async (req: Request) => {
  const account = await requireAccount(req);
  const b = await body<{ name?: string; me?: "mother" | "partner"; motherName?: string; partnerName?: string; childName?: string }>(req);
  const me: SubjectKind = b.me === "partner" ? "partner" : "mother";
  const auth = await authReady();
  let orgId: string;
  try {
    const org = await auth.api.createOrganization({ body: { name: name30(b.name, "わが家"), slug: newSlug() }, headers: req.headers });
    if (!org?.id) throw new HttpError(500, "世帯を作れませんでした");
    orgId = org.id;
  } catch (e) {
    authError(e, "世帯を作れませんでした");
  }
  ensureHousehold(orgId, "real"); // afterCreateOrganization でも作る（2回呼んでもよい）
  addSubject(orgId, { kind: "mother", name: name30(b.motherName, "母"), accountId: me === "mother" ? account.id : null });
  if (me === "partner" || (typeof b.partnerName === "string" && b.partnerName.trim())) {
    addSubject(orgId, { kind: "partner", name: name30(b.partnerName, "パートナー"), accountId: me === "partner" ? account.id : null });
  }
  addSubject(orgId, { kind: "child", name: name30(b.childName, "おなかの子") });
  audit(orgId, account.id, "household.create");
  return { householdId: orgId };
});

/** 世帯の全部を消す（持ち主だけ）。鍵・ファイル・記録・本人・同意を一度に消す */
export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; confirm?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:delete");
  if (ctx.role === "guest" || ctx.household.kind !== "real" || !ctx.account) throw new HttpError(403, "作った家族（デモ）は消せません");
  if (b.confirm !== "消す") throw new HttpError(400, "確かめの「消す」を入れてください");
  const hid = ctx.household.id;
  const auth = await authReady();
  try {
    await auth.api.deleteOrganization({ body: { organizationId: hid }, headers: req.headers });
  } catch (e) {
    authError(e, "世帯を消せませんでした");
  }
  await purgeHousehold(hid, ctx.account.id); // afterDeleteOrganization でも呼ばれる（2回呼んでもよい）
  return { ok: true };
});
