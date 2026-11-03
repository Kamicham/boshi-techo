// 手帳からの1つの質問に答える → 前の内容と合わせて作り直す
import { body, route } from "@/lib/api";
import { capture, clearAsk, hasAsk, listRecords, type RecordSource } from "@/lib/capture";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "../shared";

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; captureId?: string; basis?: string; question?: string; answer?: string; source?: RecordSource }>(req);
  const family = requireFamily(b.familyId);
  const answer = (b.answer ?? "").trim();
  if (!answer) throw new HttpError(400, "答えが空です");
  if (!b.captureId || !b.question || typeof b.basis !== "string") throw new HttpError(400, "前の内容が見つかりません");
  // その家族の記録の束だけを作り直す
  // （記録が1つも無く、聞き返しだけが残っている束も、その家族の物として作り直す）
  const owned = hasAsk(family.id, b.captureId) || listRecords(family.id).some((r) => r.data.captureId === b.captureId);
  const source: RecordSource = b.source === "voice" || b.source === "photo" ? b.source : "text";
  const result = await capture(
    { family, today: todayOf(b.today), source, followUp: { basis: b.basis.slice(0, 4000), question: b.question.slice(0, 500), answer: answer.slice(0, 1000) } },
    owned ? b.captureId : undefined,
  );
  // 答えたので、残しておいた聞き返しを消す
  clearAsk(family.id, b.captureId);
  return result;
});
