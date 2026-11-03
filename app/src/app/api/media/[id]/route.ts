// 写真1枚: 中身を出す（GET ?v=thumb|view|orig）・直す（PATCH）・ゴミ箱へ／ゴミ箱から消す（DELETE）。
// 中身は世帯の鍵で復号して出す。端末にも途中にも残さない（Cache-Control: private, no-store）。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { audit } from "@/lib/households";
import { existingTechoIds, purgePhoto, readVariant, relinkForDate, starKey, toClient, type MediaData, type PhotoVariant } from "@/lib/media";

type Params = { params: Promise<{ id: string }> };

const VARIANTS: PhotoVariant[] = ["thumb", "view", "orig"];
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const GET = route(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  const v = (VARIANTS as string[]).includes(q.get("v") ?? "") ? (q.get("v") as PhotoVariant) : "view";
  // ゴミ箱の写真も、ゴミ箱の画面で見られるように出す
  const row = ctx.db.media.get<MediaData>(id, { includeTrashed: true });
  if (!row) throw new HttpError(404, "見つかりません");
  const got = await readVariant(ctx, row, v);
  if (!got) throw new HttpError(404, "写真のファイルが見つかりません");
  if (v === "orig") audit(ctx.household.id, ctx.account?.id ?? null, "media.view", { target: id, detail: { v } });
  return new Response(new Uint8Array(got.buf), {
    headers: {
      "content-type": got.mime,
      "content-length": String(got.buf.length),
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      ...(q.get("download") === "1" ? { "content-disposition": `attachment; filename="photo-${row.takenAt?.slice(0, 10) ?? "day"}.jpg"` } : {}),
    },
  });
});

type Patch = {
  familyId?: string;
  today?: string;
  by?: string;
  caption?: string | null;
  /** 自分の★を付ける（true）・外す（false） */
  star?: boolean;
  hidden?: boolean;
  techoIds?: string[];
  /** 撮った日を直す（YYYY-MM-DD） */
  date?: string;
  /** ゴミ箱から戻す */
  restore?: boolean;
  /** Claude に見せてよい印（家族が1枚ずつ）。画像を渡すのは lib/media.ts の mediaForClaude だけ */
  shareWithClaude?: boolean;
};

export const PATCH = route(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const b = await body<Patch>(req);
  const ctx = await withHousehold(req, b.familyId, "media:write");
  const row = ctx.db.media.get<MediaData>(id, { includeTrashed: true });
  if (!row) throw new HttpError(404, "見つかりません");
  const me = starKey(ctx.account?.id, b.by);
  const data: Partial<MediaData> = {};
  let takenAt: string | undefined;

  if (b.caption !== undefined) {
    const c = typeof b.caption === "string" ? b.caption.trim().slice(0, 400) : "";
    data.caption = c || undefined;
    data.captionBy = c ? "family" : undefined;
  }
  if (typeof b.star === "boolean") {
    if (!me) throw new HttpError(400, "★を付ける人が分かりません（設定で自分を選ぶ）");
    const cur = new Set(row.data.star ?? []);
    if (b.star) cur.add(me);
    else cur.delete(me);
    data.star = [...cur];
  }
  if (typeof b.hidden === "boolean") data.hidden = b.hidden || undefined;
  if (Array.isArray(b.techoIds)) {
    const ids = [...new Set(b.techoIds.filter((x): x is string => typeof x === "string"))].slice(0, 20);
    data.links = { ...row.data.links, techoIds: existingTechoIds(ctx.household.id, ctx.family, ids, b.today) };
  }
  if (typeof b.date === "string") {
    if (!DAY.test(b.date)) throw new HttpError(400, "日付が読めません");
    // 時刻は元のまま（無ければ正午）。どの日を使ったかは「家族が直した」にする
    takenAt = `${b.date}T${row.takenAt?.slice(11, 19) || "12:00:00"}`;
    const re = relinkForDate(ctx.family, { ...row.data, ...data }, b.date);
    Object.assign(data, re, { links: { ...(data.links ?? row.data.links), ...re.links } });
  }
  if (typeof b.shareWithClaude === "boolean") {
    data.shareWithClaude = b.shareWithClaude ? { at: new Date().toISOString(), by: me ?? "family" } : false;
    audit(ctx.household.id, ctx.account?.id ?? null, b.shareWithClaude ? "media.share-claude" : "media.unshare-claude", { target: id });
  }
  const next = ctx.db.media.patch<MediaData>(id, {
    data,
    ...(takenAt ? { takenAt, takenAtFrom: "manual" as const } : {}),
    ...(b.restore ? { trashedAt: null } : {}),
  });
  if (!next) throw new HttpError(404, "見つかりません");
  return { media: toClient(ctx.household.id, next, me) };
});

/** まずゴミ箱へ（30日で消える）。?purge=1 はゴミ箱から今すぐ消す（ファイルも行も） */
export const DELETE = route(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:write");
  const row = ctx.db.media.get<MediaData>(id, { includeTrashed: true });
  if (!row) throw new HttpError(404, "見つかりません");
  if (q.get("purge") === "1") {
    if (!row.trashedAt) throw new HttpError(400, "先にゴミ箱へ入れてください");
    await purgePhoto(ctx, row);
    return { purged: id };
  }
  ctx.db.media.patch(id, { trashedAt: new Date().toISOString() });
  audit(ctx.household.id, ctx.account?.id ?? null, "media.trash", { target: id });
  return { trashed: id };
});
