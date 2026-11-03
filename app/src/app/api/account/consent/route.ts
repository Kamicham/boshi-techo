// 同意する・撤回する（本人ごと）。撤回は同意と同じ手軽さで（PHR 指針 3.2(2)④）。
// 押せる人は _lib/server.ts の canConsentFor（本人・子は法定代理人・まだアカウントの無い大人は管理の人が代わりに）。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { audit, grantConsent, revokeConsent } from "@/lib/households";
import { CONSENT_VERSION, type ScreenConsentKind } from "@/components/settings/consent-texts";
import { canConsentFor, ensureMadeSubjects, requireSubject } from "../_lib/server";

export const dynamic = "force-dynamic";

type In = { familyId?: string; subjectIds?: string[]; subjectId?: string; kind?: ScreenConsentKind };

async function prepare(req: Request) {
  const b = await body<In>(req);
  if (b.kind !== "record" && b.kind !== "claude_us") throw new HttpError(400, "同意の種類が違います");
  const ctx = await withHousehold(req, b.familyId, "record:read");
  const visible = ctx.role === "guest" ? ensureMadeSubjects(ctx) : ctx.subjects;
  const ids = Array.isArray(b.subjectIds) ? b.subjectIds : [b.subjectId];
  if (!ids.length) throw new HttpError(400, "本人を選んでください");
  const subjects = ids.map((id) => requireSubject(ctx, visible, id));
  for (const s of subjects) if (!canConsentFor(ctx, s)) throw new HttpError(403, `${s.name || "この本人"}の分は、本人が押してください`);
  return { ctx, kind: b.kind, subjects };
}

/** 同意する（まとめて複数の本人も） */
export const POST = route(async (req: Request) => {
  const { ctx, kind, subjects } = await prepare(req);
  const by = ctx.account?.id ?? null;
  const out = subjects.map((s) => grantConsent(ctx.household.id, s.id, kind, CONSENT_VERSION[kind], by));
  audit(ctx.household.id, by, "consent.grant", { target: kind, detail: { subjects: subjects.map((s) => s.id), version: CONSENT_VERSION[kind] } });
  return { consents: out };
});

/** 撤回する */
export const DELETE = route(async (req: Request) => {
  const { ctx, kind, subjects } = await prepare(req);
  const by = ctx.account?.id ?? null;
  let n = 0;
  for (const s of subjects) n += revokeConsent(ctx.household.id, s.id, kind);
  audit(ctx.household.id, by, "consent.revoke", { target: kind, detail: { subjects: subjects.map((s) => s.id) } });
  return { revoked: n };
});
