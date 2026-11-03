// 紙の母子手帳のページの写真（data URL）→ Claude がどのページかと行を読む → 候補（pending:true）として保存
// 画像そのものは保存しない（api/capture/photo と同じ）。読めない値は空のまま。
import { body, route } from "@/lib/api";
import { captureTechoPage } from "@/lib/capture";
import { imageBlock } from "@/lib/claude";
import { sendingAs } from "@/lib/claude";
import { HttpError } from "@/lib/family";
import { familyFor, WRITE_AND_SEND } from "../../_lib/household";
import { todayOf } from "../../capture/shared";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; image?: string; note?: string }>(req);
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const family = h.family;
  if (typeof b.image !== "string") throw new HttpError(400, "写真が届いていません");
  if (b.image.length > 12 * 1024 * 1024) throw new HttpError(400, "写真が大きすぎます");
  let image;
  try {
    image = imageBlock(b.image);
  } catch (e) {
    throw new HttpError(400, (e as Error).message);
  }
  const today = todayOf(b.today);
  return sendingAs(h.who, () => captureTechoPage({ family, today, image, note: b.note?.slice(0, 1000) }));
});
