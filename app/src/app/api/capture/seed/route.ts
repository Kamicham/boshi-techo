// デモの家族だけ: 作った家族の1000日の記録を入れる（何度呼んでも重複しない）
import { body, route } from "@/lib/api";
import { seedDemo } from "@/lib/capture";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { HttpError } from "@/lib/family";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string }>(req);
  if (b.familyId !== DEMO_FAMILY.id) throw new HttpError(403, "作った記録を入れられるのはデモの家族だけです");
  return { records: seedDemo() };
});
