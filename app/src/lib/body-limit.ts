// 送られる中身の大きさの上限（2026-11-05 技術監査 (5)①・公開版の器を審査の2日間もたせる）。
// 門（middleware.ts の publicGate）が、/api/ への POST・PUT・PATCH の content-length を見て、上限を超えたら中身を読まずに 413 を返す。
// 写真と声の口は 32MB、ほかは 1MB。middleware（edge）からも読むので、DB やサーバの部品を読まない。
// 長さの無い送り方（chunked）は門では測れないが、Next.js が middleware のために写す中身の上限
// （next.config.mjs の middlewareClientMaxBodySize＝同じ 32MB）で切れるので、口に届くのは 32MB まで。

export const BIG_BODY = 32 * 1024 * 1024;
export const SMALL_BODY = 1024 * 1024;

/** 写真と声を受ける口（ここだけ 32MB）。写真の読み取り（capture/photo・techo/photo）は JSON の中の base64 */
const BIG = /^\/api\/(media|media\/voice|letters|capture\/(photo|voice)|ask\/voice|techo\/photo|visit\/[^/]+\/chunk)$/;

/** その道の上限（バイト） */
export function bodyLimit(pathname: string): number {
  return BIG.test(pathname) ? BIG_BODY : SMALL_BODY;
}

/** 上限を超える頼みなら、返す文（超えなければ null）。content-length が無い・読めない時は、門では止めない（上の Next.js の上限で切れる） */
export function bodyTooBig(method: string, pathname: string, contentLength: string | null): string | null {
  if (!["POST", "PUT", "PATCH"].includes(method) || !pathname.startsWith("/api/") || !contentLength) return null;
  const n = Number(contentLength);
  const max = bodyLimit(pathname);
  if (!Number.isFinite(n) || n <= max) return null;
  return max === BIG_BODY ? `送る物が大きすぎます（写真と声は1回 ${max / 1024 / 1024}MB まで）` : `送る物が大きすぎます（1回 ${max / 1024 / 1024}MB まで）`;
}
