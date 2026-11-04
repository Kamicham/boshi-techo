// 公開版の体験用の家族（2026-11-04・作り手「誰でも実際に体験できるように」）。
// - 公開版（BOSHI_PUBLIC=1）で画面が見本の家族（demo-sato）を頼むと、サーバはその人の札（boshi_try）の写しに置き換える
//   （lib/access.ts の withHousehold の入口）。共有の見本の家族には、公開版ではだれも書けない
// - 写しは見本の家族と同じ設定・同じ作った記録（id だけ違う）。種類は demo（同意の関所の対象外。上限を超えた日は見本の答え）
// - 写しは札の持ち主だけが開ける（ほかの人には 404）。7日たった写しは、次に写しを作る時と、サーバが立った時・その後1日1回（src/instrumentation.ts）にまとめて消す
// - 1つの住所（IP）から作れる写しは1日10まで（使い過ぎ止め。公開版は fly.toml の BOSHI_TRIALS_PER_IP_DAY＝会場や病院の Wi-Fi は大勢が同じ住所）
// - 1つの写しに置ける写真と声は20件・50MB まで（lib/trial-room.ts）
// - 本物の記録は置かない（画面の上に「作った家族です」と出す）
import "server-only";
import { ensureAccountSchema } from "./db";
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

/** 札の写しがあるか（無ければ作る。作る時は住所ごとの数を見る） */
export async function ensureTrial(id: string, ip: string): Promise<void> {
  const d = table();
  if (d.prepare(`SELECT 1 FROM trials WHERE id = ?`).get(id)) {
    if (!getHousehold(id)) ensureHousehold(id, "demo");
    return;
  }
  await purgeExpiredTrials();
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const n = (d.prepare(`SELECT COUNT(*) AS n FROM trials WHERE ip = ? AND created_at >= ?`).get(ip, since) as { n: number }).n;
  if (n >= TRIALS_PER_IP_DAY) throw new HttpError(429, "この住所から作れる体験の数（1日）を超えました。明日また試してください");
  // 同じ札の最初の頼みが2つ同時に来ても落ちないように（2つ目は何もしない）
  d.prepare(`INSERT OR IGNORE INTO trials (id, ip, created_at) VALUES (?, ?, ?)`).run(id, ip, new Date().toISOString());
  ensureHousehold(id, "demo");
}

/**
 * 公開版で見本の家族を頼まれたら、その人の写しの id に置き換える（ほかはそのまま）。
 * 札が無い時は 400（middleware が札を配るので、ふつうは起きない）
 */
export async function resolveFamilyId(req: Request, familyId: unknown): Promise<unknown> {
  if (!publicOn() || familyId !== DEMO_FAMILY.id) return familyId;
  const id = trialIdFromCookie(req.headers.get("cookie"));
  if (!id) throw new HttpError(400, "体験の札がありません。ページを開き直してください");
  await ensureTrial(id, clientIp(req));
  return id;
}

/** この人の札の写しか */
export function ownsTrial(req: Request, id: string): boolean {
  return isTrialId(id) && trialIdFromCookie(req.headers.get("cookie")) === id && !!table().prepare(`SELECT 1 FROM trials WHERE id = ?`).get(id);
}
