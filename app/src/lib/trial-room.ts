// 体験の写しに置ける写真と声（2026-11-05 体験版を API なしで開ける前に）。
// 公開版の写しはだれでも作れて7日残るので、1つの写しに置ける物（写真・声・声の手紙）を20件・50MB までにする。
// 作った記録（見本の写真・声・手紙＝made）は数えない。消した写真もファイルは残るので数える。写しでない世帯には効かない
import type { HouseholdCtx } from "./access";
import { HttpError } from "./http-error";
import { isTrialId, publicOn } from "./trial-cookie";

export const TRIAL_MAX_ITEMS = 20;
export const TRIAL_MAX_BYTES = 50 * 1024 * 1024;

type Made = { made?: boolean; voice?: { bytes?: number } };

/** 体験の写しに、あと1つ（addBytes）置けるか。置けなければ 413 */
export function checkTrialRoom(ctx: Pick<HouseholdCtx, "household" | "db">, addBytes: number, made?: boolean): void {
  if (made || !publicOn() || !isTrialId(ctx.household.id)) return;
  const media = ctx.db.media.list<Made>({ includeTrashed: true }).filter((r) => !r.data.made && r.kind !== "video");
  const letters = ctx.db.list<Made>("letter", { limit: 2000 }).filter((d) => !d.data.made && d.data.voice);
  const count = media.length + letters.length;
  const bytes = media.reduce((n, r) => n + r.bytes, 0) + letters.reduce((n, d) => n + (d.data.voice?.bytes ?? 0), 0);
  if (count >= TRIAL_MAX_ITEMS || bytes + addBytes > TRIAL_MAX_BYTES)
    throw new HttpError(413, `体験版で残せるのは、写真と声を合わせて${TRIAL_MAX_ITEMS}件・${TRIAL_MAX_BYTES / 1024 / 1024}MB までです（写しは7日で消えます）`);
}
