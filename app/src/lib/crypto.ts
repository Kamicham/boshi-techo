// 世帯ごとの鍵でファイルを暗号化する（AES-256-GCM）。
// - 世帯を作る時にデータ鍵（DEK・32バイト）を作り、親鍵（BOSHI_KEK）で包んで household_keys に置く
// - 写真・録音は、置き場（StorageDriver）に put する前にこの鍵で暗号化する。iv と認証タグは media の行に持つ
// - 世帯を消す時は DEK を消す（destroyHouseholdKey）。残ったファイルも読めなくなる
// 記録の文字（docs.data）の暗号化は大会の後（設計 ④）。
import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { ensureAccountSchema } from "./db";
import { requireSecret } from "./secrets";

const ALG = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;

/** 親鍵（BOSHI_KEK）。16進64文字か base64 の32バイト。それ以外の文字列は sha256 で32バイトにする */
export function kek(): Buffer {
  const raw = requireSecret("BOSHI_KEK");
  if (/^[0-9a-f]{64}$/i.test(raw)) return Buffer.from(raw, "hex");
  const b64 = Buffer.from(raw, "base64");
  if (b64.length === 32 && /^[A-Za-z0-9+/=_-]+$/.test(raw)) return b64;
  return createHash("sha256").update(raw).digest();
}

export type Sealed = { ciphertext: Buffer; iv: string; tag: string };

/** AES-256-GCM で暗号化する。aad（例: media の id）を渡すと、その行以外では解けない */
export function encrypt(key: Buffer, plain: Buffer | Uint8Array, aad?: string): Sealed {
  if (key.length !== 32) throw new Error("鍵は32バイト");
  const iv = randomBytes(IV_BYTES);
  const c = createCipheriv(ALG, key, iv, { authTagLength: TAG_BYTES });
  if (aad) c.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([c.update(plain), c.final()]);
  return { ciphertext, iv: iv.toString("base64"), tag: c.getAuthTag().toString("base64") };
}

/** 復号する。鍵・iv・タグ・aad のどれかが違えば例外（壊れた・すり替えられたファイルを読まない） */
export function decrypt(key: Buffer, s: Sealed, aad?: string): Buffer {
  if (key.length !== 32) throw new Error("鍵は32バイト");
  const d = createDecipheriv(ALG, key, Buffer.from(s.iv, "base64"), { authTagLength: TAG_BYTES });
  if (aad) d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(Buffer.from(s.tag, "base64"));
  return Buffer.concat([d.update(s.ciphertext), d.final()]);
}

/** 新しい世帯のデータ鍵 */
export function createDek(): Buffer {
  return randomBytes(32);
}

/** DEK を親鍵で包む。世帯の id を aad にして、ほかの世帯の行へ写しても解けないようにする */
export function wrapDek(dek: Buffer, householdId: string, key: Buffer = kek()): string {
  const s = encrypt(key, dek, `dek:${householdId}`);
  return `v1:${s.iv}:${s.tag}:${s.ciphertext.toString("base64")}`;
}

export function unwrapDek(wrapped: string, householdId: string, key: Buffer = kek()): Buffer {
  const [v, iv, tag, ct] = wrapped.split(":");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("包んだ鍵の形が違います");
  return decrypt(key, { iv, tag, ciphertext: Buffer.from(ct, "base64") }, `dek:${householdId}`);
}

// 解いた DEK は、同じ処理の中で何度も DB を引かないよう、少しだけ覚える
const cache = new Map<string, Buffer>();

/** 世帯の DEK を作って置く（もうあれば、それを返す） */
export function ensureHouseholdKey(householdId: string): Buffer {
  const d = ensureAccountSchema();
  const got = householdKey(householdId);
  if (got) return got;
  const dek = createDek();
  d.prepare(`INSERT OR IGNORE INTO household_keys (household_id, wrapped_dek, created_at) VALUES (?, ?, ?)`).run(
    householdId,
    wrapDek(dek, householdId),
    new Date().toISOString(),
  );
  cache.delete(householdId);
  return householdKey(householdId)!; // 同時に作られた時は先に入った方を使う
}

/** 世帯の DEK（無ければ null） */
export function householdKey(householdId: string): Buffer | null {
  const hit = cache.get(householdId);
  if (hit) return hit;
  const r = ensureAccountSchema().prepare(`SELECT wrapped_dek FROM household_keys WHERE household_id = ?`).get(householdId) as
    | { wrapped_dek: string }
    | undefined;
  if (!r) return null;
  const dek = unwrapDek(r.wrapped_dek, householdId);
  if (cache.size > 200) cache.clear();
  cache.set(householdId, dek);
  return dek;
}

/** 世帯の DEK を消す（世帯を消す時）。消すと、その世帯のファイルは誰にも読めなくなる */
export function destroyHouseholdKey(householdId: string): void {
  const k = cache.get(householdId);
  if (k) k.fill(0);
  cache.delete(householdId);
  ensureAccountSchema().prepare(`DELETE FROM household_keys WHERE household_id = ?`).run(householdId);
}

/** 世帯の鍵で暗号化する（鍵が無ければ作る）。aad には media の id などを渡す */
export function sealForHousehold(householdId: string, plain: Buffer | Uint8Array, aad?: string): Sealed {
  return encrypt(ensureHouseholdKey(householdId), plain, aad);
}

/** 世帯の鍵で復号する。鍵が消された世帯は例外（もう読めない） */
export function openForHousehold(householdId: string, s: Sealed, aad?: string): Buffer {
  const key = householdKey(householdId);
  if (!key) throw new Error("この世帯の鍵はもうありません（消された世帯のファイルは読めません）");
  return decrypt(key, s, aad);
}

/** 中身の sha256（16進）。二重に入れない・バックアップの照合に使う */
export function sha256Hex(b: Buffer | Uint8Array): string {
  return createHash("sha256").update(b).digest("hex");
}
