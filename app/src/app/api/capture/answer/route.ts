// 手帳からの1つの質問に答える → 前の内容と合わせて作り直す
import { body, route } from "@/lib/api";
import { capture, listRecords, type RecordSource } from "@/lib/capture";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "../shared";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; captureId?: string; basis?: string; question?: string; answer?: string; source?: RecordSource }>(req);
  const family = requireFamily(b.familyId);
  const answer = (b.answer ?? "").trim();
  if (!answer) throw new HttpError(400, "答えが空です");
  if (!b.captureId || !b.question || typeof b.basis !== "string") throw new HttpError(400, "前の内容が見つかりません");
  // その家族の記録の束だけを作り直す
  const owned = listRecords(family.id).some((r) => r.data.captureId === b.captureId);
  const source: RecordSource = b.source === "voice" || b.source === "photo" ? b.source : "text";
  return capture(
    { family, today: todayOf(b.today), source, followUp: { basis: b.basis.slice(0, 4000), question: b.question.slice(0, 500), answer: answer.slice(0, 1000) } },
    owned ? b.captureId : undefined,
  );
});
