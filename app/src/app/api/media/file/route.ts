// 期限つきの URL で写真を出す（置き場が local の時の signedUrl の受け側。lib/storage.ts の signPath・keyFromSignedUrl）。
// 署名が鍵（どの世帯のどの写真か）と期限を守るので、ここではログインを見ない。中身は世帯の鍵で復号して出す。
// 鍵の形: households/<hid>/<subject|shared>/photo/<yyyy>/<id>/<orig|view|thumb>
import { route } from "@/lib/api";
import { forHousehold } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import { readVariant, type MediaData, type PhotoVariant } from "@/lib/media";
import { getHousehold } from "@/lib/households";
import { keyFromSignedUrl, storage, verifySignedPath } from "@/lib/storage";

const KEY = /^households\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_-]+\/photo\/\d{4}\/([A-Za-z0-9_-]+)\/(orig|view|thumb)$/;

export const GET = route(async (req: Request) => {
  const url = new URL(req.url);
  if (!verifySignedPath(url)) throw new HttpError(403, "期限が切れたか、形の違う URL です");
  const key = keyFromSignedUrl(url);
  const m = key ? KEY.exec(key) : null;
  if (!key || !m) throw new HttpError(404, "見つかりません");
  const [, hid, id, v] = m;
  const household = getHousehold(hid);
  if (!household) throw new HttpError(404, "見つかりません");
  const row = forHousehold(hid).media.get<MediaData>(id);
  if (!row || `${row.storageKey}/${v}` !== key) throw new HttpError(404, "見つかりません");
  const got = await readVariant({ household, storage: storage() }, row, v as PhotoVariant);
  if (!got) throw new HttpError(404, "見つかりません");
  return new Response(new Uint8Array(got.buf), {
    headers: { "content-type": got.mime, "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
});
