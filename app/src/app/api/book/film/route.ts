// 一冊の映画を動画（mp4）に書き出す: GET で今の一冊の動画があるか、POST で作る（同じ一冊・同じ写真と声なら作り直さない）。
// 組むのはこのサーバの中だけ（lib/film-render.ts）。Claude にも外のサービスにも送らない。できた動画は家族の鍵で暗号にして置く。
// 見る・保存するのは読める人（祖父母も）、作るのは家族の記録を書ける人。公開版（体験）では書き出しを閉じる（小さな機械で重い組み立てをしない・2026-11-05）。
import { body, route } from "@/lib/api";
import { withHousehold, type HouseholdCtx } from "@/lib/access";
import { latestBook } from "@/lib/book";
import { HttpError } from "@/lib/http-error";
import { existingFilm, filmFor, filmKey, renderFilm, saveFilmVideo } from "@/lib/film-render";
import type { MediaRow } from "@/lib/db";
import { publicOn } from "@/lib/trial-cookie";
import { TRIAL_FILM_CLOSED } from "@/lib/trial-words";

export const maxDuration = 600;
export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const busy = new Set<string>();

function view(ctx: HouseholdCtx, row: MediaRow<{ durationSec?: number }>) {
  const q = (extra: string) => `/api/media/${encodeURIComponent(row.id)}?familyId=${encodeURIComponent(ctx.household.id)}&v=orig${extra}`;
  return { id: row.id, url: q(""), download: q("&download=1"), bytes: row.bytes, durationSec: row.data.durationSec ?? null, createdAt: row.createdAt };
}

function bookOf(ctx: HouseholdCtx, today: string | null) {
  const book = latestBook(ctx.household.id, today && DAY.test(today) ? today : undefined);
  if (!book) throw new HttpError(404, "まだ一冊がありません");
  const { shots, rows } = filmFor(ctx, book, today);
  return { book, shots, rows, today, key: filmKey(book, shots) };
}

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  if (publicOn()) return { video: null, canMake: false, making: false, closed: true };
  const { key, shots } = bookOf(ctx, q.get("today"));
  const row = existingFilm(ctx, key);
  return { video: row ? view(ctx, row) : null, canMake: ctx.can("media:write") && shots.length > 0, making: busy.has(ctx.household.id) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "media:write");
  if (publicOn()) throw new HttpError(403, TRIAL_FILM_CLOSED);
  const { book, shots, rows, key, today } = bookOf(ctx, b.today ?? null);
  const have = existingFilm(ctx, key);
  if (have) return { video: view(ctx, have) };
  const hid = ctx.household.id;
  if (busy.has(hid)) throw new HttpError(409, "いま動画を作っています。少し待ってから開き直してください");
  busy.add(hid);
  try {
    const { mp4, durationSec } = await renderFilm(ctx, book, shots, rows, today);
    const row = await saveFilmVideo(ctx, mp4, { key, title: book.title, durationSec, date: book.asOf });
    return { video: view(ctx, row) };
  } finally {
    busy.delete(hid);
  }
});
