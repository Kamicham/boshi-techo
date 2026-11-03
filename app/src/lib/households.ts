// 世帯・本人・代理・同意・操作の記録（サーバ側）。
// 世帯の id は Better Auth の organization の id と同じ。デモ（demo-sato）とシミュレーション（sim-・pop-）は
// organization を持たず、この表に kind = demo / sim の行だけを持つ（写真の鍵と台帳のため）。
// ここの関数は「誰が見てよいか」を確かめない。API からは必ず lib/access.ts の withHousehold を通ってから呼ぶ。
import "server-only";
import { randomUUID } from "node:crypto";
import { ensureAccountSchema } from "./db";
import { destroyHouseholdKey, ensureHouseholdKey } from "./crypto";
import { householdPrefix, storage, subjectPrefix } from "./storage";
import { HttpError } from "./http-error";

export type HouseholdKind = "real" | "demo" | "sim";
export type Household = { id: string; kind: HouseholdKind; createdAt: string };

export type SubjectKind = "mother" | "child" | "partner";
export type Subject = { id: string; householdId: string; kind: SubjectKind; name: string; accountId: string | null; createdAt: string };

export type ConsentKind = "record" | "claude_us" | "share";
export type Consent = {
  id: string;
  householdId: string;
  subjectId: string;
  kind: ConsentKind;
  version: string;
  grantedAt: string;
  revokedAt: string | null;
  byAccount: string | null;
};

export type ProxyBasis = "legal" | "voluntary";
export type Proxy = { id: string; householdId: string; accountId: string; subjectId: string; basis: ProxyBasis; scope: string[]; createdAt: string };

const now = () => new Date().toISOString();

// ───────── 世帯 ─────────

/** 世帯の行を作る（もうあれば、そのまま。kind は書き換えない＝本物の世帯が公開の側に落ちない）。世帯の鍵も作る */
export function ensureHousehold(id: string, kind: HouseholdKind): Household {
  const d = ensureAccountSchema();
  d.prepare(`INSERT OR IGNORE INTO households (id, kind, created_at) VALUES (?, ?, ?)`).run(id, kind, now());
  ensureHouseholdKey(id);
  return getHousehold(id)!;
}

export function getHousehold(id: string): Household | null {
  const r = ensureAccountSchema().prepare(`SELECT id, kind, created_at FROM households WHERE id = ?`).get(id) as
    | { id: string; kind: HouseholdKind; created_at: string }
    | undefined;
  return r ? { id: r.id, kind: r.kind, createdAt: r.created_at } : null;
}

// ───────── 本人 ─────────

type SubjectRow = { id: string; household_id: string; kind: SubjectKind; name: string; account_id: string | null; created_at: string };
const toSubject = (r: SubjectRow): Subject => ({ id: r.id, householdId: r.household_id, kind: r.kind, name: r.name, accountId: r.account_id, createdAt: r.created_at });

export function listSubjects(householdId: string): Subject[] {
  const rows = ensureAccountSchema().prepare(`SELECT * FROM subjects WHERE household_id = ? ORDER BY created_at, id`).all(householdId) as SubjectRow[];
  return rows.map(toSubject);
}

/** この世帯の本人だけを id で引く（ほかの世帯の本人なら null） */
export function getSubject(householdId: string, subjectId: string): Subject | null {
  const r = ensureAccountSchema().prepare(`SELECT * FROM subjects WHERE household_id = ? AND id = ?`).get(householdId, subjectId) as SubjectRow | undefined;
  return r ? toSubject(r) : null;
}

export function addSubject(householdId: string, s: { kind: SubjectKind; name?: string; accountId?: string | null; id?: string }): Subject {
  const id = s.id ?? randomUUID();
  ensureAccountSchema()
    .prepare(`INSERT INTO subjects (id, household_id, kind, name, account_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(id, householdId, s.kind, s.name ?? "", s.accountId ?? null, now());
  return getSubject(householdId, id)!;
}

/** 作った家族（demo・sim）の本人の id（世帯ごとに決まった形。何度呼んでも同じ行になる） */
export const madeSubjectId = (householdId: string, kind: SubjectKind) => `${householdId}-${kind}`;

/**
 * 作った家族（demo・sim）に本人がまだ無ければ、家族の設定（母・パートナー・子）から作る。
 * 同意は入れない（画面は「同意していません」と2つのスイッチを出す。送る時は作った家族の同意を見ない＝lib/claude.ts）。
 * 本物の世帯（real）には何もしない（本人は世帯を作る時・招待で作る）
 */
export function seedMadeSubjects(household: Household, family: { members: { name: string; role: string }[]; childName?: string; birthDate?: string; dueDate?: string } | null): void {
  if (household.kind === "real" || !family || listSubjects(household.id).length) return;
  const mother = family.members.find((m) => m.role === "母");
  const partner = family.members.find((m) => m.role === "パートナー");
  const want: { kind: SubjectKind; name: string }[] = [];
  want.push({ kind: "mother", name: mother?.name || "母" });
  if (partner?.name) want.push({ kind: "partner", name: partner.name });
  if (family.birthDate) want.push({ kind: "child", name: family.childName || "子" });
  else if (family.dueDate) want.push({ kind: "child", name: family.childName || "おなかの子" });
  for (const w of want) {
    const id = madeSubjectId(household.id, w.kind);
    if (getSubject(household.id, id)) continue;
    try {
      addSubject(household.id, { id, kind: w.kind, name: w.name });
    } catch {
      // 同じ時に別の読み込みが作った（id が同じなので重ならない）
    }
  }
}

export function updateSubject(householdId: string, subjectId: string, p: { name?: string; accountId?: string | null }): Subject | null {
  const cur = getSubject(householdId, subjectId);
  if (!cur) return null;
  ensureAccountSchema()
    .prepare(`UPDATE subjects SET name = ?, account_id = ? WHERE household_id = ? AND id = ?`)
    .run(p.name ?? cur.name, p.accountId !== undefined ? p.accountId : cur.accountId, householdId, subjectId);
  return getSubject(householdId, subjectId);
}

// ───────── 代理（この人は、この本人の代理として、この範囲を見られる） ─────────

type ProxyRow = { id: string; household_id: string; account_id: string; subject_id: string; basis: ProxyBasis; scope: string; created_at: string };
const toProxy = (r: ProxyRow): Proxy => ({
  id: r.id, householdId: r.household_id, accountId: r.account_id, subjectId: r.subject_id, basis: r.basis, scope: JSON.parse(r.scope) as string[], createdAt: r.created_at,
});

export function setProxy(householdId: string, p: { accountId: string; subjectId: string; basis: ProxyBasis; scope?: string[] }): Proxy {
  if (!getSubject(householdId, p.subjectId)) throw new HttpError(404, "見つかりません");
  const d = ensureAccountSchema();
  d.prepare(
    `INSERT INTO proxies (id, household_id, account_id, subject_id, basis, scope, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(account_id, subject_id) DO UPDATE SET basis = excluded.basis, scope = excluded.scope`,
  ).run(randomUUID(), householdId, p.accountId, p.subjectId, p.basis, JSON.stringify(p.scope ?? ["*"]), now());
  return listProxies(householdId, p.accountId).find((x) => x.subjectId === p.subjectId)!;
}

export function removeProxy(householdId: string, accountId: string, subjectId: string): void {
  ensureAccountSchema().prepare(`DELETE FROM proxies WHERE household_id = ? AND account_id = ? AND subject_id = ?`).run(householdId, accountId, subjectId);
}

/** 世帯の代理の一覧（accountId を渡すと、その人の分だけ） */
export function listProxies(householdId: string, accountId?: string): Proxy[] {
  const d = ensureAccountSchema();
  const rows = (
    accountId
      ? d.prepare(`SELECT * FROM proxies WHERE household_id = ? AND account_id = ?`).all(householdId, accountId)
      : d.prepare(`SELECT * FROM proxies WHERE household_id = ?`).all(householdId)
  ) as ProxyRow[];
  return rows.map(toProxy);
}

// ───────── 同意（本人ごと・日時と撤回つき） ─────────

type ConsentRow = {
  id: string; household_id: string; subject_id: string; kind: ConsentKind; version: string; granted_at: string; revoked_at: string | null; by_account: string | null;
};
const toConsent = (r: ConsentRow): Consent => ({
  id: r.id, householdId: r.household_id, subjectId: r.subject_id, kind: r.kind, version: r.version, grantedAt: r.granted_at, revokedAt: r.revoked_at, byAccount: r.by_account,
});

/** 同意する。同じ種類の有効な同意があれば撤回してから新しい版で入れる（履歴は残る） */
export function grantConsent(householdId: string, subjectId: string, kind: ConsentKind, version: string, byAccount: string | null): Consent {
  if (!getSubject(householdId, subjectId)) throw new HttpError(404, "見つかりません");
  const d = ensureAccountSchema();
  const id = randomUUID();
  const at = now();
  d.transaction(() => {
    d.prepare(`UPDATE consents SET revoked_at = ? WHERE household_id = ? AND subject_id = ? AND kind = ? AND revoked_at IS NULL`).run(at, householdId, subjectId, kind);
    d.prepare(`INSERT INTO consents (id, household_id, subject_id, kind, version, granted_at, revoked_at, by_account) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)`).run(
      id, householdId, subjectId, kind, version, at, byAccount,
    );
  })();
  return toConsent(d.prepare(`SELECT * FROM consents WHERE id = ?`).get(id) as ConsentRow);
}

/** 撤回する（同意した時と同じくらい簡単に）。撤回した件数を返す */
export function revokeConsent(householdId: string, subjectId: string, kind: ConsentKind): number {
  return ensureAccountSchema()
    .prepare(`UPDATE consents SET revoked_at = ? WHERE household_id = ? AND subject_id = ? AND kind = ? AND revoked_at IS NULL`)
    .run(now(), householdId, subjectId, kind).changes;
}

/** 今有効な同意（無ければ null）。minVersion を渡すと、それより古い版は無い扱い（文字列の比べ） */
export function activeConsent(householdId: string, subjectId: string, kind: ConsentKind, minVersion?: string): Consent | null {
  const r = ensureAccountSchema()
    .prepare(`SELECT * FROM consents WHERE household_id = ? AND subject_id = ? AND kind = ? AND revoked_at IS NULL ORDER BY granted_at DESC LIMIT 1`)
    .get(householdId, subjectId, kind) as ConsentRow | undefined;
  if (!r) return null;
  if (minVersion && r.version < minVersion) return null;
  return toConsent(r);
}

/** 渡した本人の全員に、その同意が有効か（1人でも無ければ false。空の一覧は false） */
export function allConsented(householdId: string, subjectIds: readonly string[], kind: ConsentKind, minVersion?: string): boolean {
  return subjectIds.length > 0 && subjectIds.every((s) => activeConsent(householdId, s, kind, minVersion) != null);
}

/** 同意の履歴（設定の画面で見せる） */
export function consentHistory(householdId: string, subjectId?: string): Consent[] {
  const d = ensureAccountSchema();
  const rows = (
    subjectId
      ? d.prepare(`SELECT * FROM consents WHERE household_id = ? AND subject_id = ? ORDER BY granted_at DESC`).all(householdId, subjectId)
      : d.prepare(`SELECT * FROM consents WHERE household_id = ? ORDER BY granted_at DESC`).all(householdId)
  ) as ConsentRow[];
  return rows.map(toConsent);
}

// ───────── 操作の記録（誰が何を見た・送った） ─────────

export type AuditEntry = { id: number; householdId: string; accountId: string | null; action: string; target: string | null; detail: unknown; at: string };

/** 例: audit(hid, account.id, "claude.send", { target: "capture", detail: { subjects: [...], fields: [...] } }) */
export function audit(householdId: string, accountId: string | null, action: string, o: { target?: string; detail?: unknown } = {}): void {
  ensureAccountSchema()
    .prepare(`INSERT INTO audit (household_id, account_id, action, target, detail, at) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(householdId, accountId, action, o.target ?? null, o.detail === undefined ? null : JSON.stringify(o.detail), now());
}

export function listAudit(householdId: string, limit = 200): AuditEntry[] {
  const rows = ensureAccountSchema().prepare(`SELECT * FROM audit WHERE household_id = ? ORDER BY id DESC LIMIT ?`).all(householdId, limit) as {
    id: number; household_id: string; account_id: string | null; action: string; target: string | null; detail: string | null; at: string;
  }[];
  return rows.map((r) => ({ id: r.id, householdId: r.household_id, accountId: r.account_id, action: r.action, target: r.target, detail: r.detail ? JSON.parse(r.detail) : null, at: r.at }));
}

// ───────── 消す ─────────

/**
 * 本人の分を消す: 記録の行・写真の台帳・ファイル（households/<hid>/<subject>/）・同意・代理・本人の行。
 * 本人の付いていない（世帯全体の）記録は残す。
 */
export async function purgeSubject(householdId: string, subjectId: string): Promise<void> {
  if (!getSubject(householdId, subjectId)) throw new HttpError(404, "見つかりません");
  const d = ensureAccountSchema();
  await storage().delete(subjectPrefix(householdId, subjectId));
  d.transaction(() => {
    d.prepare(`DELETE FROM docs WHERE family_id = ? AND subject_id = ?`).run(householdId, subjectId);
    d.prepare(`DELETE FROM media WHERE household_id = ? AND subject_id = ?`).run(householdId, subjectId);
    d.prepare(`UPDATE consents SET revoked_at = COALESCE(revoked_at, ?) WHERE household_id = ? AND subject_id = ?`).run(now(), householdId, subjectId);
    d.prepare(`DELETE FROM proxies WHERE household_id = ? AND subject_id = ?`).run(householdId, subjectId);
    d.prepare(`DELETE FROM subjects WHERE household_id = ? AND id = ?`).run(householdId, subjectId);
  })();
}

/**
 * 世帯の全部を消す: ファイル（households/<hid>/）・世帯の鍵（DEK）・記録・写真の台帳・本人・代理・同意・世帯の行。
 * 操作の記録（audit）は「消した」という1行だけを残す。Better Auth の organization・member の行は、
 * 呼ぶ側が auth.api.deleteOrganization で消す（その後の afterDeleteOrganization からもここが呼ばれる。2回呼んでもよい）。
 */
export async function purgeHousehold(householdId: string, byAccount: string | null): Promise<void> {
  const d = ensureAccountSchema();
  destroyHouseholdKey(householdId); // 先に鍵を消す（ファイルを消し損ねても読めない）
  await storage().delete(householdPrefix(householdId));
  d.transaction(() => {
    d.prepare(`DELETE FROM docs WHERE family_id = ?`).run(householdId);
    d.prepare(`DELETE FROM media WHERE household_id = ?`).run(householdId);
    d.prepare(`DELETE FROM consents WHERE household_id = ?`).run(householdId);
    d.prepare(`DELETE FROM proxies WHERE household_id = ?`).run(householdId);
    d.prepare(`DELETE FROM subjects WHERE household_id = ?`).run(householdId);
    d.prepare(`DELETE FROM audit WHERE household_id = ?`).run(householdId);
    d.prepare(`DELETE FROM households WHERE id = ?`).run(householdId);
  })();
  audit(householdId, byAccount, "household.delete");
}
