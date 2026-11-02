// ① 入力ゼロ: 記録の一覧（GET）と、書いた文から記録を作る（POST）
import { body, route } from "@/lib/api";
import { capture, listRecords } from "@/lib/capture";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "./shared";

export const GET = route(async (req: Request) => {
  const family = requireFamily(new URL(req.url).searchParams.get("familyId"));
  return { records: listRecords(family.id) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; text?: string }>(req);
  const family = requireFamily(b.familyId);
  const text = (b.text ?? "").trim();
  if (!text) throw new HttpError(400, "書いた事が空です");
  if (text.length > 4000) throw new HttpError(400, "長すぎます（4000字まで）");
  return capture({ family, today: todayOf(b.today), source: "text", text });
});
