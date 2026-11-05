// すべての API の関所: 「セッション → 世帯 → 権限」の順に確かめ、その世帯の中だけに触れる道具を渡す。
//
//   export const POST = route(async (req: Request) => {
//     const ctx = await withHousehold(req, q.get("familyId"), "record:write");
//     ctx.db.put("record", data, { subjectId });   // family_id は ctx の世帯に決まる
//   });
//
// 1) セッション: 無ければ 401（公開の世帯は別の決まりで通す）
// 2) 世帯: その人が仲間（Better Auth の member）でなければ 404（有る・無いを漏らさない）
// 3) 権限: 役（owner / admin / member）に無ければ 403
// 公開の世帯: 見本の家族（demo-sato）と、シミュレーションのサーバ（BOSHI_SIM=1）の作った家族（sim-・pop-）。
// id の形では決めず、コードに固定の一覧（lib/family.ts の madeFamilyKind）で決める。households に kind = real の行が
// ある id は、一覧に有っても公開にしない。
// 今の requireFamily（lib/family.ts）は健診の録音が使うので残す。新しいコードでは使わない。
import "server-only";
import { ensureAccountSchema, forHousehold, type HouseholdDb } from "./db";
import { getFamily, madeFamilyKind } from "./family";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { HttpError } from "./http-error";
import { getSession } from "./auth";
import { ensureHousehold, getHousehold, listProxies, listSubjects, seedMadeSubjects, type Household, type Subject } from "./households";
import { storage, type StorageDriver } from "./storage";
import { ownsTrial, resolveFamilyId } from "./trial";
import { isTrialId, publicOn } from "./trial-cookie";
import { TRIAL_READ_ONLY } from "./trial-words";

export { forHousehold, type HouseholdDb } from "./db";

// ───────── 権限の表（最小） ─────────

export type Perm =
  | "record:read" // 記録・予定・手帳を読む
  | "record:write" // 記録を足す・直す・消す
  | "media:read" // 写真・録音を見る
  | "media:write" // 写真・録音を足す・直す・ゴミ箱へ
  | "media:contribute" // みんなの章: 自分の写真・声・手紙を足し、自分が足した物だけ直す・消す（祖父母など）
  | "claude:send" // 記録を Claude に送る処理を動かす（本人ごとの同意は別に確かめる）
  | "household:admin" // 家族の設定・本人・代理・招待
  | "household:delete"; // 世帯を消す・書き出す

export type Role = "owner" | "admin" | "member" | "guest";

const ALL: Perm[] = ["record:read", "record:write", "media:read", "media:write", "media:contribute", "claude:send", "household:admin", "household:delete"];

export const ROLE_PERMS: Record<Role, readonly Perm[]> = {
  owner: ALL, // 持ち主
  admin: ALL.filter((p) => p !== "household:delete"), // 共同の管理（パートナーなど）
  member: ["record:read", "media:read", "media:contribute"], // 読む・みんなの章に足す（祖父母など）。見える本人は代理の印と子だけ
  guest: ["record:read", "record:write", "media:read", "media:write", "media:contribute", "claude:send"], // 公開の世帯（作った家族）を、ログインなしで
};

/** 公開版で写しを作れなかった人が、共有の見本の家族を見る時の権限（読むだけ。lib/trial.ts の ensureTrial） */
const READ_ONLY: readonly Perm[] = ["record:read", "media:read"];

export type Account = { id: string; email: string; name: string };

export interface HouseholdCtx {
  household: Household;
  /** 家族の設定（町・予定日・家族の形）。まだ設定していない世帯は null */
  family: Family | null;
  /** ログインした人。公開の世帯をログインなしで開いた時は null */
  account: Account | null;
  role: Role;
  perms: ReadonlySet<Perm>;
  can(p: Perm): boolean;
  /** この世帯の中だけに触れる DB（見てよい本人の記録だけ） */
  db: HouseholdDb;
  storage: StorageDriver;
  /** 見てよい本人だけ */
  subjects: Subject[];
}

// ───────── 公開の世帯 ─────────

/** ログインなしで通す世帯なら、その種類（demo / sim）。本物の世帯は null */
export function publicHouseholdKind(id: string): "demo" | "sim" | null {
  if (isTrialId(id)) return null; // 体験の写しは札の持ち主だけ（withHousehold）
  const kind = madeFamilyKind(id);
  if (!kind) return null;
  if (kind === "sim" && process.env.BOSHI_SIM_LOGIN === "1") return null; // シミュレーションでもログインを求める（世帯をまたいだ 404 を試す時）
  const row = getHousehold(id);
  if (row && row.kind === "real") return null;
  return kind;
}

// ───────── 世帯の仲間（Better Auth の member の表） ─────────

/** その人の、その世帯での役（仲間でなければ null）。複数の役（"admin,member"）は強い方 */
export function memberRole(accountId: string, householdId: string): Exclude<Role, "guest"> | null {
  const r = ensureAccountSchema().prepare(`SELECT role FROM member WHERE organizationId = ? AND userId = ? LIMIT 1`).get(householdId, accountId) as
    | { role: string }
    | undefined;
  if (!r) return null;
  const roles = r.role.split(",").map((s) => s.trim());
  if (roles.includes("owner")) return "owner";
  if (roles.includes("admin")) return "admin";
  if (roles.includes("member")) return "member";
  return null;
}

export type MyHousehold = { id: string; name: string; role: Exclude<Role, "guest"> };

/** その人が入っている世帯の一覧（家族の一覧の画面・/api/family の GET に） */
export function myHouseholds(accountId: string): MyHousehold[] {
  const rows = ensureAccountSchema()
    .prepare(`SELECT o.id AS id, o.name AS name, m.role AS role FROM member m JOIN organization o ON o.id = m.organizationId WHERE m.userId = ? ORDER BY m.createdAt`)
    .all(accountId) as { id: string; name: string; role: string }[];
  return rows.flatMap((r) => {
    const role = memberRole(accountId, r.id);
    return role ? [{ id: r.id, name: r.name, role }] : [];
  });
}

/** ログインした人（無ければ null） */
export async function currentAccount(req: Request): Promise<Account | null> {
  const s = await getSession(req.headers);
  return s ? { id: s.user.id, email: s.user.email, name: s.user.name } : null;
}

/** ログインした人（無ければ 401） */
export async function requireAccount(req: Request): Promise<Account> {
  const a = await currentAccount(req);
  if (!a) throw new HttpError(401, "ログインしてください");
  return a;
}

/** 見てよい本人: owner・admin・公開の世帯は全員。member は自分・代理の印のある本人・子 */
function visibleSubjects(all: Subject[], role: Role, accountId: string | null, householdId: string): Subject[] {
  if (role !== "member" || !accountId) return all;
  const proxied = new Set(listProxies(householdId, accountId).map((p) => p.subjectId));
  return all.filter((s) => s.accountId === accountId || proxied.has(s.id) || s.kind === "child");
}

function makeCtx(household: Household, account: Account | null, role: Role, only?: readonly Perm[]): HouseholdCtx {
  const perms = new Set(only ?? ROLE_PERMS[role]);
  const family = getFamily(household.id);
  // 作った家族にも本人を置く（同意の画面・写真の本人が空にならない）
  seedMadeSubjects(household, family);
  const all = listSubjects(household.id);
  const subjects = visibleSubjects(all, role, account?.id ?? null, household.id);
  const limited = subjects.length !== all.length;
  return {
    household,
    family,
    account,
    role,
    perms,
    can: (p) => perms.has(p),
    db: forHousehold(household.id, limited ? { visibleSubjects: subjects.map((s) => s.id) } : {}),
    storage: storage(),
    subjects,
  };
}

/**
 * 関所。見たい世帯（familyId）と、要る権限を渡す。通れば、その世帯の中だけに触れる道具を返す。
 * 他人の世帯・無い世帯は 404、ログインしていなければ 401、権限が無ければ 403（HttpError。lib/api.ts の route が JSON にする）。
 */
export async function withHousehold(req: Request, asked: unknown, perm: Perm | readonly Perm[]): Promise<HouseholdCtx> {
  const need = typeof perm === "string" ? [perm] : perm;
  // 公開版: 見本の家族を頼まれたら、その人の体験の写しに置き換える（lib/trial.ts）
  const familyId = await resolveFamilyId(req, asked);
  if (typeof familyId !== "string" || !familyId) throw new HttpError(404, "見つかりません");

  const pub = publicHouseholdKind(familyId);
  const account = await currentAccount(req);
  // 公開版で見本の家族の id のまま来た＝写しを作れなかった人（総数・空き・住所の数）。共有の見本の家族を読むだけにする（書く人は居ない）
  const readOnly = publicOn() && familyId === DEMO_FAMILY.id;

  let ctx: HouseholdCtx;
  const role = account ? memberRole(account.id, familyId) : null;
  if (role) {
    ctx = makeCtx(getHousehold(familyId) ?? ensureHousehold(familyId, madeFamilyKind(familyId) ?? "real"), account, role);
  } else if (isTrialId(familyId) && ownsTrial(req, familyId)) {
    ctx = makeCtx(ensureHousehold(familyId, "demo"), account, "guest");
  } else if (pub) {
    ctx = makeCtx(ensureHousehold(familyId, pub), account, "guest", readOnly ? READ_ONLY : undefined);
  } else {
    // 体験の写しは、札の持ち主でなければだれにでも 404（ある・無いを漏らさない）
    if (!account && !isTrialId(familyId)) throw new HttpError(401, "ログインしてください");
    throw new HttpError(404, "見つかりません");
  }
  for (const p of need) if (!ctx.can(p)) throw new HttpError(403, readOnly ? TRIAL_READ_ONLY : "この操作はできません");
  return ctx;
}
