// API の route が使う関所の包み。画面から来る familyId は「見たい世帯の指定」として受け、
// サーバが「セッション → 世帯 → 権限」で確かめる（lib/access.ts の withHousehold）。
//
//   const h = await familyFor(req, q.get("familyId"), "record:read");
//   h.family   … 家族の設定（町・予定日・家族の形）
//   h.id       … 世帯の id（＝docs.family_id。今までの家族の id と同じ所に入る）
//   sendingAs(h.who, () => …)  … Claude を呼ぶ所を包む（本物の世帯は claude_us の同意を確かめ、送った記録を残す）
//
// アカウントの仕組みを動かす前（わが家の置き場 app/data で BOSHI_ACCOUNTS が無い時）は、今までどおりに通す:
// わが家（mine）と作った家族を id で引き、合言葉の門と Tailscale の内側だけで守る。開発サーバ（3000番）と本番（3210番）が
// 同じ app/data/boshi.db を開いていて、試しに叩いただけでアカウントの表を作らないため（lib/db.ts の ensureAccountSchema）。
// 主担当が写しで移してから BOSHI_ACCOUNTS=1 を入れると、すべての route が withHousehold に切り替わる。
import "server-only";
import { withHousehold, type Account, type HouseholdCtx, type Perm, type Role } from "@/lib/access";
import type { SendWho } from "@/lib/claude";
import { isHomeDataDir } from "@/lib/db";
import type { Family } from "@/lib/demo-family";
import { getFamily, madeFamilyKind, MINE_ID } from "@/lib/family";
import type { HouseholdKind } from "@/lib/households";
import { HttpError } from "@/lib/http-error";

/** アカウントの仕組みが動いているか（BOSHI_DATA_DIR を分けた所か、BOSHI_ACCOUNTS=1） */
export function accountsOn(): boolean {
  return !isHomeDataDir() || process.env.BOSHI_ACCOUNTS === "1";
}

export interface HouseholdAccess {
  /** 世帯の id（docs.family_id） */
  id: string;
  kind: HouseholdKind;
  /** 家族の設定。まだ設定していない世帯は null */
  family: Family | null;
  account: Account | null;
  role: Role;
  can(p: Perm): boolean;
  /** Claude に送る時の印（lib/claude.ts の sendingAs に渡す） */
  who: SendWho;
  /** アカウントの仕組みが動いている時の関所の中身（写真の台帳・置き場など）。移る前は null */
  ctx: HouseholdCtx | null;
  /** 移る前の通し方で通った */
  legacy: boolean;
}

export type FamilyAccess = HouseholdAccess & { family: Family };

/** 移る前の通し方: わが家と作った家族（シミュレーションのサーバでは sim-・pop-）を id で引く。権限は今までどおり全部 */
function legacyAccess(familyId: string): HouseholdAccess {
  const family = getFamily(familyId);
  if (!family) throw new HttpError(404, "家族が見つかりません");
  const kind: HouseholdKind = madeFamilyKind(familyId) ?? "real";
  return {
    id: familyId,
    kind,
    family,
    account: null,
    role: kind === "real" ? "owner" : "guest",
    can: () => true,
    who: { householdId: familyId, kind, accountId: null, subjectIds: [], legacy: true },
    ctx: null,
    legacy: true,
  };
}

function fromCtx(ctx: HouseholdCtx): HouseholdAccess {
  return {
    id: ctx.household.id,
    kind: ctx.household.kind,
    family: ctx.family,
    account: ctx.account,
    role: ctx.role,
    can: ctx.can,
    who: { householdId: ctx.household.id, kind: ctx.household.kind, accountId: ctx.account?.id ?? null, subjectIds: ctx.subjects.map((s) => s.id) },
    ctx,
    legacy: false,
  };
}

/** 世帯の関所（家族の設定がまだ無くても通す。家族の設定の保存などに） */
export async function householdFor(req: Request, familyId: unknown, perm: Perm | readonly Perm[]): Promise<HouseholdAccess> {
  if (!accountsOn()) {
    if (typeof familyId !== "string" || !familyId) throw new HttpError(404, "家族が見つかりません");
    return legacyAccess(familyId);
  }
  return fromCtx(await withHousehold(req, familyId, perm));
}

/** 世帯の関所＋家族の設定が要る（ほとんどの route）。設定がまだなら 404 */
export async function familyFor(req: Request, familyId: unknown, perm: Perm | readonly Perm[]): Promise<FamilyAccess> {
  const h = await householdFor(req, familyId, perm);
  if (!h.family) throw new HttpError(404, "家族が見つかりません（家族の設定がまだです）");
  return h as FamilyAccess;
}

/** 移る前のわが家の id（家族の設定の保存で、世帯を指定しない時に使う） */
export const LEGACY_MINE_ID = MINE_ID;

/** 記録を書いて Claude に送る route の権限 */
export const WRITE_AND_SEND: readonly Perm[] = ["record:write", "claude:send"];
