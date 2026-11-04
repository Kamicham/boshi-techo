// 未来の手紙: 一覧（GET・中身なし）・書いて封をする（POST）・消す（DELETE）。中身を読むのは ./[id]（開く日を過ぎた手紙だけ）。
// 関所は土台の withHousehold。書くのは家族の記録を書ける人と、みんなの章に足せる人（祖父母など）。Claude には何も送らない。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { listLetters, removeLetter, writeLetter } from "@/lib/letters";

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  return { letters: listLetters(ctx, q.get("today"), q.get("by")), canWrite: ctx.can("media:contribute") && (ctx.can("media:write") || !!ctx.account) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; body?: string; to?: string; open?: string; date?: string; from?: string; relation?: string; today?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "media:contribute");
  return { letter: writeLetter(ctx, { body: String(b.body ?? ""), to: b.to, open: b.open, date: b.date, from: b.from, relation: b.relation, today: b.today }) };
});

export const DELETE = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:contribute");
  removeLetter(ctx, q.get("id") ?? "", q.get("by"));
  return { removed: q.get("id") };
});
