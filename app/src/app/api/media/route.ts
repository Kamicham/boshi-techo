// 写真を残す: 一覧（GET）と受け取り（POST・multipart）。Claude には何も送らない。
// 関所は土台の withHousehold（ログイン → 世帯 → 権限）。公開の世帯（作った家族）はログインなしで通る。
import { formAfterGate, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { langOf } from "@/lib/i18n/dicts";
import { contributorFrom, existingTechoIds, photoDate, purgeExpired, saveUpload, starKey, toClient, type MediaData } from "@/lib/media";
import { localizeMadeMedia } from "@/lib/sample-media-i18n";
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
  // 既定は写真。?kind=audio は声（思い出の録り方で残した物）
  const kind = q.get("kind") === "audio" ? "audio" : "photo";
  const today = todayOf(q.get("today"));
  // 作った家族は時計を進めて見るので、画面の「今日」より後の種は出さない
  const made = ctx.household.kind !== "real" && !!today;
  const rows = ctx.db.media
    .list<MediaData>({ kind, includeTrashed: trash })
    .filter((r) => (trash ? !!r.trashedAt : !r.trashedAt))
    .filter((r) => !made || photoDate(r) <= today!);
  // 消えた手帳の記録への結びは出さない（写真は残す）
  const live = new Set(listTecho(ctx.household.id, { family: ctx.family ?? undefined, today }).map((d) => d.id));
  const me = starKey(ctx.account?.id, q.get("by"));
  // 作った写真（見本の家族）の一言と続柄の注は、頼みの言葉で返す（lib/sample-media-i18n.ts。日本語・本物の家族は1字も変わらない）
  const lang = langOf(req);
  const media = rows.map((r) => toClient(ctx.household.id, localizeMadeMedia(r, lang), me, live));
  return {
    media,
    usage: { count: media.length, bytes: media.reduce((n, m) => n + m.bytes, 0) },
    canWrite: ctx.can("media:write"),
    // みんなの章に足せるか（祖父母など。書ける人も足せる）
    canContribute: ctx.can("media:contribute") && (ctx.can("media:write") || !!ctx.account),
  };
});

export const POST = route(async (req: Request) => {
  // 家族の記録を書ける人と、みんなの章に足せる人（祖父母など）が通る。足せるだけの人には名乗りを必ず付ける。
  // 関所（?familyId=）を通ってから写真を読む（lib/api.ts の formAfterGate）
  const { ctx, form } = await formAfterGate(req, (id) => withHousehold(req, id, "media:contribute"), "送られた写真が読めません");
  const from = contributorFrom(ctx, typeof form.get("relation") === "string" ? String(form.get("relation")) : null);
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
  // 手帳の記録に結ぶのは、記録を書ける人だけ
  const techoId = from ? null : text("techoId");
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
    from,
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
