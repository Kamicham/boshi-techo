// 紙の母子手帳のページの写真（data URL）→ Claude がどのページかと行を読む → 候補（pending:true）として保存
// 画像そのものは保存しない（api/capture/photo と同じ）。読めない値は空のまま。
import { body, route } from "@/lib/api";
import { captureTechoPage } from "@/lib/capture";
import { imageBlock } from "@/lib/claude";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "../../capture/shared";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; image?: string; note?: string }>(req);
  const family = requireFamily(b.familyId);
  if (typeof b.image !== "string") throw new HttpError(400, "写真が届いていません");
  if (b.image.length > 12 * 1024 * 1024) throw new HttpError(400, "写真が大きすぎます");
  let image;
  try {
    image = imageBlock(b.image);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  return captureTechoPage({ family, today: todayOf(b.today), image, note: b.note?.slice(0, 1000) });
});
