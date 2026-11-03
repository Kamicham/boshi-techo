// アカウントの画面の API の共通（サーバ側）。関所は lib/access.ts の withHousehold・requireAccount を必ず通す。
import "server-only";
import { randomUUID } from "node:crypto";
import { authReady } from "@/lib/auth";
import { ensureAccountSchema } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { getSubject, listSubjects, type Subject } from "@/lib/households";
import type { HouseholdCtx } from "@/lib/access";
import type { Relation, ShareItem } from "@/components/settings/consent-texts";

/** アカウントの仕組みが、この置き場で動くか（わが家の置き場では BOSHI_ACCOUNTS=1 まで 503） */
export async function accountsEnabled(): Promise<boolean> {
  try {
    ensureAccountSchema();
    await authReady();
    return true;
  } catch (e) {
    if (e instanceof HttpError && e.status === 503) return false;
    throw e;
  }
}

/** Better Auth の API の失敗（APIError）を、日本語の HttpError に直す */
export function authError(e: unknown, fallback: string): never {
  if (e instanceof HttpError) throw e;
  const status = typeof (e as { statusCode?: unknown })?.statusCode === "number" ? (e as { statusCode: number }).statusCode : 400;
  const code = String((e as { body?: { code?: string } })?.body?.code ?? "");
  const known: Record<string, string> = {
    YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "この招待は、別のメールの人あてです。招待されたメールで入り直してください",
    INVITATION_NOT_FOUND: "招待が見つかりません。期限（48時間）が切れたか、取り消されました",
    USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "もうこの世帯に入っています",
    USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: "このメールには、もう招待を送っています",
    YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: "招待は、世帯の持ち主と共同の管理の人だけができます",
    YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: "作れる世帯の数の上限です",
    EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: "メールのコードで入ってから受けてください",
  };
  console.error(fallback, code || e);
  throw new HttpError(status >= 400 && status < 600 ? status : 400, known[code] ?? fallback);
}

// ───────── 世帯の仲間と招待（Better Auth の表を読むだけ） ─────────

export type MemberView = { id: string; accountId: string; email: string; name: string; role: string; createdAt: string };
export type InvitationView = { id: string; email: string; role: string; status: string; expiresAt: string; relation: string | null };

export function listMembers(householdId: string): MemberView[] {
  const rows = ensureAccountSchema()
    .prepare(
      `SELECT m.id AS id, m.userId AS accountId, u.email AS email, u.name AS name, m.role AS role, m.createdAt AS createdAt
         FROM member m JOIN "user" u ON u.id = m.userId WHERE m.organizationId = ? ORDER BY m.createdAt`,
    )
    .all(householdId) as { id: string; accountId: string; email: string; name: string; role: string; createdAt: unknown }[];
  return rows.map((r) => ({ ...r, createdAt: toIso(r.createdAt) }));
}

export function listPendingInvitations(householdId: string): InvitationView[] {
  const rows = ensureAccountSchema()
    .prepare(`SELECT id, email, role, status, expiresAt FROM invitation WHERE organizationId = ? AND status = 'pending' ORDER BY expiresAt DESC`)
    .all(householdId) as { id: string; email: string; role: string; status: string; expiresAt: unknown }[];
  const now = Date.now();
  return rows
    .map((r) => ({ ...r, expiresAt: toIso(r.expiresAt), relation: inviteScope(r.id)?.relation ?? null }))
    .filter((r) => Date.parse(r.expiresAt) > now);
}

export function householdName(householdId: string): string | null {
  const r = ensureAccountSchema().prepare(`SELECT name FROM organization WHERE id = ?`).get(householdId) as { name: string } | undefined;
  return r?.name ?? null;
}

/** Better Auth は日付を数（ミリ秒）か文字で入れるので、どちらも ISO に直す */
export function toIso(v: unknown): string {
  if (typeof v === "number") return new Date(v).toISOString();
  if (v instanceof Date) return v.toISOString();
  const s = String(v ?? "");
  const n = Number(s);
  if (s && Number.isFinite(n)) return new Date(n).toISOString();
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : s;
}

// ───────── 招待の範囲（役・続柄・母が見せる項目） ─────────
// Better Auth の招待の行には範囲の欄が無いので、招待した時に操作の記録（audit の invite.create）へ残し、受けた時に読む。

export type InviteScope = { relation: Relation; showMother: ShareItem[] };

export function inviteScope(invitationId: string): InviteScope | null {
  const r = ensureAccountSchema()
    .prepare(`SELECT detail FROM audit WHERE action = 'invite.create' AND target = ? ORDER BY id DESC LIMIT 1`)
    .get(invitationId) as { detail: string | null } | undefined;
  if (!r?.detail) return null;
  try {
    const d = JSON.parse(r.detail) as Partial<InviteScope>;
    return { relation: (d.relation ?? "そのほかの家族") as Relation, showMother: Array.isArray(d.showMother) ? (d.showMother as ShareItem[]) : [] };
  } catch {
    return null;
  }
}

// ───────── 同意してよい人 ─────────

/**
 * その本人の同意を、この人が押してよいか。
 * - 本人（アカウントが結びついた本人）は自分の分
 * - 子の分は、世帯の持ち主・共同の管理の人が、法定代理人として
 * - まだアカウントの無い大人の本人は、世帯の持ち主・共同の管理の人が、本人に画面を見せて代わりに押す（押した人は履歴に残る）
 * 公開の世帯（作った家族）はログインなしで押せる（作った家族なので守る物が無い）
 */
export function canConsentFor(ctx: HouseholdCtx, s: Subject): boolean {
  if (ctx.role === "guest") return true;
  const me = ctx.account?.id ?? null;
  if (me && s.accountId === me) return true;
  if (!ctx.can("household:admin")) return false;
  return s.kind === "child" || s.accountId === null;
}

/** 見てよい本人（visible）の中から引く。member が見えない本人を指すと 404 */
export function requireSubject(ctx: HouseholdCtx, visible: Subject[], subjectId: unknown): Subject {
  if (typeof subjectId !== "string" || !subjectId) throw new HttpError(404, "見つかりません");
  const s = visible.find((x) => x.id === subjectId) ?? null;
  if (!s || !getSubject(ctx.household.id, subjectId)) throw new HttpError(404, "見つかりません");
  return s;
}

/** 公開の世帯（作った家族）に本人の行がまだ無ければ、家族の設定から作る（同意の画面を作った家族でも見せられるように） */
export function ensureMadeSubjects(ctx: HouseholdCtx): Subject[] {
  if (ctx.role !== "guest") return ctx.subjects;
  const have = listSubjects(ctx.household.id);
  if (have.length) return have;
  const d = ensureAccountSchema();
  const now = new Date().toISOString();
  const f = ctx.family;
  const rows: { kind: string; name: string }[] = [];
  for (const m of f?.members ?? []) rows.push({ kind: m.role === "母" ? "mother" : "partner", name: m.name });
  if (!rows.some((r) => r.kind === "mother")) rows.unshift({ kind: "mother", name: "母" });
  rows.push({ kind: "child", name: f?.childName || "子" });
  const ins = d.prepare(`INSERT INTO subjects (id, household_id, kind, name, account_id, created_at) VALUES (?, ?, ?, ?, NULL, ?)`);
  d.transaction(() => rows.forEach((r) => ins.run(randomUUID(), ctx.household.id, r.kind, r.name, now)))();
  return listSubjects(ctx.household.id);
}

/** 世帯を作る時の slug（Better Auth の organization に要る。画面には出さない） */
export const newSlug = () => `hh-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
