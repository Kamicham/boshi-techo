// 送られる中身の大きさの上限（2026-11-05 技術監査 (5)①・公開版の器を審査の2日間もたせる）。
// 門（middleware.ts の publicGate）が、/api/ への POST・PUT・PATCH の content-length を見て、上限を超えたら中身を読まずに 413 を返す。
// 写真と声の口は 32MB、ほかは 1MB。middleware（edge）からも読むので、DB やサーバの部品を読まない。
// 公開版の外（わが家の本番・シミュレーション・手元の試し）でも、名乗った長さが 32MB を超える頼みは、門が中身を読まずに 413 にする。
// 長さの無い送り方（chunked）は門では測れない。Next.js 15.5.29 は、middleware のために写す中身を
// next.config.mjs の middlewareClientMaxBodySize（同じ 32MB）で切り、超えた所から先を黙って捨てる（口には切れた中身が届く）。
// この名前は 15.5.29 から効く。15.5.4 は知らない名前として無視し、上限なしで写す。
// どちらでも切れた中身や大きすぎる中身を残さないように、生の中身を読む口は lib/read-body.ts の readBytes で読む（読んだ後にも見る）。

export const BIG_BODY = 32 * 1024 * 1024;
export const SMALL_BODY = 1024 * 1024;

/** 写真と声を受ける口（ここだけ 32MB）。写真の読み取り（capture/photo・techo/photo）は JSON の中の base64 */
const BIG = /^\/api\/(media|media\/voice|letters|capture\/(photo|voice)|ask\/voice|techo\/photo|visit\/[^/]+\/chunk)$/;

/** その道の上限（バイト） */
export function bodyLimit(pathname: string): number {
  return BIG.test(pathname) ? BIG_BODY : SMALL_BODY;
}

/** 大きすぎる時の文 */
export function tooBigText(max: number): string {
  return max === BIG_BODY ? `送る物が大きすぎます（写真と声は1回 ${max / 1024 / 1024}MB まで）` : `送る物が大きすぎます（1回 ${max / 1024 / 1024}MB まで）`;
}

/**
 * 上限を超える頼みなら、返す文（超えなければ null）。上限は道ごと（公開版の門）か、max で決めた値（公開版の外の門は 32MB）。
 * content-length が無い・読めない時は、門では止めない（読んだ後に lib/read-body.ts が見る）
 */
export function bodyTooBig(method: string, pathname: string, contentLength: string | null, max: number = bodyLimit(pathname)): string | null {
  if (!["POST", "PUT", "PATCH"].includes(method) || !pathname.startsWith("/api/") || !contentLength) return null;
  const n = Number(contentLength);
  if (!Number.isFinite(n) || n <= max) return null;
  return tooBigText(max);
}
