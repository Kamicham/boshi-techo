// ① 入力ゼロ: 記録の一覧（GET）と、書いた文から記録を作る（POST）
// GET は、まだ答えていない聞き返し（ask）も返す（画面を開き直しても答える欄を出すため）。DELETE は聞き返しを「答えない」で消す。
import { body, route } from "@/lib/api";
import { capture, clearAsk, latestAsk, listRecords } from "@/lib/capture";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "./shared";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  return { records: listRecords(family.id), ask: latestAsk(family.id, todayOf(q.get("today"))) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; text?: string }>(req);
  const family = requireFamily(b.familyId);
  const text = (b.text ?? "").trim();
  if (!text) throw new HttpError(400, "書いた事が空です");
  if (text.length > 4000) throw new HttpError(400, "長すぎます（4000字まで）");
  return capture({ family, today: todayOf(b.today), source: "text", text });
});

export const DELETE = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const captureId = q.get("captureId");
  if (!captureId) throw new HttpError(400, "どの聞き返しか分かりません");
  clearAsk(family.id, captureId);
  return { ok: true };
});
