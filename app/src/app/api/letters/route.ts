// 未来の手紙: 一覧（GET・中身なし）・書いて封をする（POST）・消す（DELETE）。中身を読むのは ./[id]（開く日を過ぎた手紙だけ）。
// 声を添える時は multipart（body・open… の欄と voice のファイル）で送る。文字だけの時は今までどおり JSON。
// 関所は土台の withHousehold。書くのは家族の記録を書ける人と、みんなの章に足せる人（祖父母など）。Claude には何も送らない。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { listLetters, removeLetter, writeLetter, writeVoiceLetter } from "@/lib/letters";

export const maxDuration = 60;

export const dynamic = "force-dynamic";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  return { letters: listLetters(ctx, q.get("today"), q.get("by")), canWrite: ctx.can("media:contribute") && (ctx.can("media:write") || !!ctx.account) };
});

export const POST = route(async (req: Request) => {
  if ((req.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
    const fd = await req.formData().catch(() => {
      throw new HttpError(400, "送り方が分かりません");
    });
    const s = (k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : undefined);
    const ctx = await withHousehold(req, s("familyId"), "media:contribute");
    const f = fd.get("voice");
    if (!(f instanceof Blob)) throw new HttpError(400, "声がありません");
    const audio = Buffer.from(await f.arrayBuffer());
    const letter = await writeVoiceLetter(
      ctx,
      { body: s("body") ?? "", to: s("to"), open: s("open"), date: s("date"), from: s("from"), relation: s("relation"), today: s("today") },
      { audio, sec: Number(s("sec")) },
    );
    return { letter };
  }
  const b = await body<{ familyId?: string; body?: string; to?: string; open?: string; date?: string; from?: string; relation?: string; today?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "media:contribute");
  return { letter: writeLetter(ctx, { body: String(b.body ?? ""), to: b.to, open: b.open, date: b.date, from: b.from, relation: b.relation, today: b.today }) };
});

export const DELETE = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:contribute");
  await removeLetter(ctx, q.get("id") ?? "", q.get("by"));
  return { removed: q.get("id") };
});
