// 写真を残す: 一覧（GET）と受け取り（POST・multipart）。Claude には何も送らない。
// 関所は土台の withHousehold（ログイン → 世帯 → 権限）。公開の世帯（作った家族）はログインなしで通る。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { existingTechoIds, purgeExpired, saveUpload, starKey, toClient, type MediaData } from "@/lib/media";
import { listTecho } from "@/lib/techo-store";

export const maxDuration = 120;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const todayOf = (v: unknown) => (typeof v === "string" && DAY.test(v) ? v : undefined);

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  const trash = q.get("trash") === "1";
  // ゴミ箱に30日を過ぎた写真は、一覧を開いた時に消す（書ける人が開いた時だけ）
  if (ctx.can("media:write")) await purgeExpired(ctx);
  const rows = ctx.db.media.list<MediaData>({ kind: "photo", includeTrashed: trash }).filter((r) => (trash ? !!r.trashedAt : !r.trashedAt));
  const today = todayOf(q.get("today"));
  // 消えた手帳の記録への結びは出さない（写真は残す）
  const live = new Set(listTecho(ctx.household.id, { family: ctx.family ?? undefined, today }).map((d) => d.id));
  const me = starKey(ctx.account?.id, q.get("by"));
  const media = rows.map((r) => toClient(ctx.household.id, r, me, live));
  return {
    media,
    usage: { count: media.length, bytes: media.reduce((n, m) => n + m.bytes, 0) },
    canWrite: ctx.can("media:write"),
  };
});

export const POST = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, "送られた写真が読めません");
  }
  const familyId = form.get("familyId") ?? q.get("familyId");
  const ctx = await withHousehold(req, familyId, "media:write");
  const file = form.get("file");
  if (!(file instanceof Blob) || file.size === 0) throw new HttpError(400, "写真がありません");
  const blob = async (k: string) => {
    const v = form.get(k);
    return v instanceof Blob && v.size > 0 ? Buffer.from(await v.arrayBuffer()) : null;
  };
  const text = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" && v.trim() ? v.trim() : null;
  };
  const today = todayOf(text("today"));
  const lastModified = Number(text("lastModified"));
  const techoId = text("techoId");
  const r = await saveUpload(ctx, {
    orig: Buffer.from(await file.arrayBuffer()),
    view: await blob("view"),
    thumb: await blob("thumb"),
    lastModified: Number.isFinite(lastModified) ? lastModified : null,
    techoId,
    caption: text("caption"),
    who: text("who"),
    starBy: text("star") === "1" ? starKey(ctx.account?.id, text("by")) : null,
    subjectId: text("subjectId"),
    today,
  });
  // 手帳から足した時、同じ写真がもう有れば、その記録にも結ぶ
  let row = r.media;
  if (r.duplicate && techoId) {
    const ok = existingTechoIds(ctx.household.id, ctx.family, [techoId], today);
    const cur = row.data.links?.techoIds ?? [];
    if (ok.length && !cur.includes(techoId)) row = ctx.db.media.patch<MediaData>(row.id, { data: { links: { ...row.data.links, techoIds: [...cur, techoId] } } }) ?? row;
  }
  return {
    media: toClient(ctx.household.id, row, starKey(ctx.account?.id, text("by"))),
    duplicate: r.duplicate,
    candidates: r.candidates,
  };
});
