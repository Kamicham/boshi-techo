// ⑦ 一冊: POST で今日までの記録から一冊を作り、GET で最新の一冊と記録の数を返す。
import { body, route } from "@/lib/api";
import { gather, latestBook, makeBook } from "@/lib/book";
import { HttpError, requireFamily } from "@/lib/family";

export const maxDuration = 300;

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const f = requireFamily(q.get("familyId"));
  const today = q.get("today");
  const asOf = today && DAY.test(today) ? today : undefined;
  return { book: latestBook(f.id, asOf), count: asOf ? gather(f.id, asOf).length : null };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string }>(req);
  const f = requireFamily(b.familyId);
  if (!b.today || !DAY.test(b.today)) throw new HttpError(400, "今日の日付が読めません");
  return { book: await makeBook(f, b.today) };
});
