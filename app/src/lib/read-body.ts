// 生の中身（声・健診の録音の一切れ）を読む（2026-11-05 監査・統括と決めた形）。
// Next.js 15.5.29 は、門（middleware）のために写す中身を middlewareClientMaxBodySize（32MB・next.config.mjs）で切り、
// 超えた所から先を黙って捨てる。口には切れた中身がそのまま届く（例外にならない）ので、半端な声や録音を残さないように、読んだ後にも見る:
// - 名乗った長さ（content-length）より短い → 途中で切れた（413）
// - 名乗った長さが無く、上限の 1MB 手前より長い → 写しの上限で切れたとみなす（413。切れた中身は、上限を越える一切れの手前で終わる）
// - 上限より長い → 写しに上限の無い 15.5.4 に、長さの無い送り方で届いた大きな頼み（413）
// 名乗った長さが上限を超える頼みは、門が中身を読む前に止める（middleware.ts・lib/body-limit.ts の bodyTooBig）。ここでも読む前に見る。
// 長さが無いだけでは断らない（HTTP/2 などで長さを付けずに届く頼みもあるため）。
import "server-only";
import { BIG_BODY, tooBigText } from "./body-limit";
import { HttpError } from "./http-error";

/** 名乗った長さが無い中身は、上限のこれだけ手前より長ければ、写しの上限で切れたとみなす（Node が一度に渡す一切れは 64KB ほど） */
export const NEAR_LIMIT = 1024 * 1024;

export const CUT_TEXT = "送った物が途中までしか届きませんでした。もう一度送るか、短く（小さく）してから送ってください";

/** 名乗った長さ（無い・読めない時は null） */
export function declaredLength(req: Request): number | null {
  const v = req.headers.get("content-length");
  if (v === null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** 読んだ長さから、大きすぎないか・切れていないかを確かめる（だめなら 413） */
export function assertWhole(declared: number | null, got: number, max: number = BIG_BODY, tooBig: string = tooBigText(max)): void {
  if ((declared !== null && declared > max) || got > max) throw new HttpError(413, tooBig);
  if (declared !== null ? got < declared : got > max - NEAR_LIMIT) throw new HttpError(413, CUT_TEXT);
}

/** 生の中身を読む。名乗った長さが上限を超えていれば読まずに 413、読んだ後は assertWhole */
export async function readBytes(req: Request, opts: { max?: number; tooBig?: string } = {}): Promise<Buffer> {
  const max = opts.max ?? BIG_BODY;
  const tooBig = opts.tooBig ?? tooBigText(max);
  const declared = declaredLength(req);
  if (declared !== null && declared > max) throw new HttpError(413, tooBig);
  const data = Buffer.from(await req.arrayBuffer());
  assertWhole(declared, data.length, max, tooBig);
  return data;
}
