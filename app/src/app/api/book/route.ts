// ⑦ 一冊: POST で今日までの記録から一冊を作り、GET で最新の一冊と記録の数を返す。
// 見本の家族の同梱の一冊（bundled）は、頼みの言葉（langOf）に差し替えて返す（lib/sample-book-i18n.ts。家族が作った一冊は訳さない）
import { body, route } from "@/lib/api";
import { gather, latestBook, makeBook } from "@/lib/book";
import { sendingAs } from "@/lib/claude";
import { HttpError } from "@/lib/family";
import { langOf } from "@/lib/i18n/dicts";
import { localizeSampleBook } from "@/lib/sample-book-i18n";
import { familyFor, WRITE_AND_SEND } from "../_lib/household";

export const maxDuration = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family: f } = await familyFor(req, q.get("familyId"), "record:read");
  const today = q.get("today");
  const asOf = today && DAY.test(today) ? today : undefined;
  return { book: localizeSampleBook(latestBook(f.id, asOf), langOf(req)), count: asOf ? gather(f.id, asOf).length : null };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string }>(req);
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const today = b.today;
  if (!today || !DAY.test(today)) throw new HttpError(400, "今日の日付が読めません");
  // 鍵の無い時（体験版）は、見本の家族に同梱の一冊が返る。その時も頼みの言葉で
  return { book: localizeSampleBook(await sendingAs(h.who, () => makeBook(h.family, today)), langOf(req)) };
});
