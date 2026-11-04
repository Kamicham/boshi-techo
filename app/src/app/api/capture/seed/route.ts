// デモの家族だけ: 作った家族の1000日の記録と、作った写真・声を入れる（何度呼んでも重複しない）
import { body, route } from "@/lib/api";
import { seedDemo } from "@/lib/capture";
import { seedDemoMedia } from "@/lib/demo-media";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { HttpError } from "@/lib/family";
import { familyFor } from "../../_lib/household";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string }>(req);
  if (b.familyId !== DEMO_FAMILY.id) throw new HttpError(403, "作った記録を入れられるのはデモの家族だけです");
  // 公開版では、その人の体験の写しに入れる（h.id）
  const h = await familyFor(req, b.familyId, "record:write");
  const records = seedDemo(h.id);
  // 作った写真と声も入れる（アカウントの仕組みが動いている所だけ。写真の置き場はそこにしか無い）
  const media = h.ctx ? await seedDemoMedia(h.ctx) : 0;
  return { records, media };
});
