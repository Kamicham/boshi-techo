// 公開版の体験用の家族（2026-11-04・作り手「誰でも実際に体験できるように」）。
// - 公開版（BOSHI_PUBLIC=1）で画面が見本の家族（demo-sato）を頼むと、サーバはその人の札（boshi_try）の写しに置き換える
//   （lib/access.ts の withHousehold の入口）。共有の見本の家族には、公開版ではだれも書けない
// - 写しは見本の家族と同じ設定・同じ作った記録（id だけ違う）。種類は demo（同意の関所の対象外。上限を超えた日は見本の答え）
// - 写しは札の持ち主だけが開ける（ほかの人には 404）。7日たった写しは、次に写しを作る時と、サーバが立った時・その後1日1回（src/instrumentation.ts）にまとめて消す
// - 1つの住所（IP）から作れる写しは1日10まで（使い過ぎ止め。公開版は fly.toml の BOSHI_TRIALS_PER_IP_DAY＝会場や病院の Wi-Fi は大勢が同じ住所）
// - 写しの総数は300まで。記録の置き場の空きが20%を切ったら作らない（技術監査 (5)②・審査の2日間の器を守る）。
//   作れない人（上の3つのどれか）には、共有の見本の家族を読むだけで見せる（lib/access.ts。書く・残すは 403）
// - 1つの写しに置ける写真と声は20件・50MB まで（lib/trial-room.ts）
// - 本物の記録は置かない（画面の上に「作った家族です」と出す）
import "server-only";
import fs from "node:fs";
import { DATA_DIR, ensureAccountSchema } from "./db";
import { DEMO_FAMILY } from "./demo-family";
import { ensureHousehold, getHousehold, purgeHousehold } from "./households";
import { HttpError } from "./http-error";
import { isTrialId, publicOn, TRIAL_DAYS, trialIdFromCookie } from "./trial-cookie";

/** 1つの住所から1日に作れる写しの数 */
export const TRIALS_PER_IP_DAY = Number(process.env.BOSHI_TRIALS_PER_IP_DAY ?? "") || 10;

function table() {
  const d = ensureAccountSchema();
  d.exec(`CREATE TABLE IF NOT EXISTS trials (id TEXT PRIMARY KEY, ip TEXT NOT NULL, created_at TEXT NOT NULL)`);
  return d;
}

/** 届いた人の住所（Fly.io は fly-client-ip。無ければ x-forwarded-for の先頭） */
export function clientIp(req: Request): string {
  return req.headers.get("fly-client-ip") ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
}

/** 7日たった写しを消す（記録・写真・世帯の鍵ごと） */
export async function purgeExpiredTrials(now = Date.now()): Promise<number> {
  const d = table();
  const edge = new Date(now - TRIAL_DAYS * 86_400_000).toISOString();
  const old = d.prepare(`SELECT id FROM trials WHERE created_at < ?`).all(edge) as { id: string }[];
  for (const { id } of old) {
    await purgeHousehold(id, null);
    d.prepare(`DELETE FROM trials WHERE id = ?`).run(id);
  }
  return old.length;
}

/** 写しの総数の上限（BOSHI_TRIALS_MAX で変えられる） */
export function trialsMax(): number {
  return Number(process.env.BOSHI_TRIALS_MAX ?? "") || 300;
}

/** 記録の置き場の空きがこれ（0〜1）より少なければ、写しを作らない（BOSHI_TRIAL_MIN_FREE で変えられる） */
export function trialMinFree(): number {
  const v = Number(process.env.BOSHI_TRIAL_MIN_FREE ?? "");
  return Number.isFinite(v) && v > 0 ? v : 0.2;
}

/** 記録の置き場の空き（0〜1）。測れない時は 1（止めない） */
export function dataFree(dir: string = DATA_DIR): number {
  try {
    const s = fs.statfsSync(dir);
    return s.blocks > 0 ? s.bavail / s.blocks : 1;
  } catch {
    return 1;
  }
}

/** 新しい写しを作れない訳（作れるなら null）: 1つの住所の1日の数・写しの総数・置き場の空き */
export function trialFull(ip: string): "ip" | "total" | "disk" | null {
  const d = table();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  if ((d.prepare(`SELECT COUNT(*) AS n FROM trials WHERE ip = ? AND created_at >= ?`).get(ip, since) as { n: number }).n >= TRIALS_PER_IP_DAY) return "ip";
  if ((d.prepare(`SELECT COUNT(*) AS n FROM trials`).get() as { n: number }).n >= trialsMax()) return "total";
  if (dataFree() < trialMinFree()) return "disk";
  return null;
}

// 作れなかった事は、サーバの記録に10分に1回だけ残す（読むだけの人の頼みのたびには書かない）
let warnedAt = 0;
function warnFull(why: string): void {
  if (Date.now() - warnedAt < 600_000) return;
  warnedAt = Date.now();
  const what = why === "ip" ? "1つの住所の1日の数" : why === "total" ? `写しの総数（${trialsMax()}）` : `置き場の空き（${Math.round(dataFree() * 100)}%）`;
  console.warn(`[体験] 新しい写しを作らず、見本の家族を読むだけで開きました（${what}）`);
}

/**
 * 札の写しがあるか（無ければ作る）。作れない時（1つの住所の1日の数・写しの総数・置き場の空き）は作らずに false を返し、
 * その人には共有の見本の家族を読むだけで見せる（resolveFamilyId → lib/access.ts）。空いたら、次の頼みで写しができる
 */
export async function ensureTrial(id: string, ip: string): Promise<boolean> {
  const d = table();
  if (d.prepare(`SELECT 1 FROM trials WHERE id = ?`).get(id)) {
    if (!getHousehold(id)) ensureHousehold(id, "demo");
    return true;
  }
  await purgeExpiredTrials();
  const full = trialFull(ip);
  if (full) {
    warnFull(full);
    return false;
  }
  // 同じ札の最初の頼みが2つ同時に来ても落ちないように（2つ目は何もしない）
  d.prepare(`INSERT OR IGNORE INTO trials (id, ip, created_at) VALUES (?, ?, ?)`).run(id, ip, new Date().toISOString());
  ensureHousehold(id, "demo");
  return true;
}

/**
 * 公開版で見本の家族を頼まれたら、その人の写しの id に置き換える（ほかはそのまま）。
 * 写しを作れない時は、見本の家族の id のまま返す（lib/access.ts が読むだけにする）。
 * 札が無い時は 400（middleware が札を配るので、ふつうは起きない）
 */
export async function resolveFamilyId(req: Request, familyId: unknown): Promise<unknown> {
  if (!publicOn() || familyId !== DEMO_FAMILY.id) return familyId;
  const id = trialIdFromCookie(req.headers.get("cookie"));
  if (!id) throw new HttpError(400, "体験の札がありません。ページを開き直してください");
  return (await ensureTrial(id, clientIp(req))) ? id : DEMO_FAMILY.id;
}

/** この人の札の写しか */
export function ownsTrial(req: Request, id: string): boolean {
  return isTrialId(id) && trialIdFromCookie(req.headers.get("cookie")) === id && !!table().prepare(`SELECT 1 FROM trials WHERE id = ?`).get(id);
}
