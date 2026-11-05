// ① 入力ゼロ: 記録の一覧（GET）と、書いた文から記録を作る（POST）
// GET は、まだ答えていない聞き返し（ask）も返す（画面を開き直しても答える欄を出すため）。DELETE は聞き返しを「答えない」で消す。
import { body, route } from "@/lib/api";
import { capture, clearAsk, latestAsk, listRecords } from "@/lib/capture";
import { sendingAs } from "@/lib/claude";
import { HttpError } from "@/lib/family";
import { langOf } from "@/lib/i18n/dicts";
import { localizeSeedRecord } from "@/lib/sample-records-i18n";
import { familyFor, WRITE_AND_SEND } from "../_lib/household";
import { todayOf } from "./shared";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family } = await familyFor(req, q.get("familyId"), "record:read");
  // 見本の家族の作った記録（seed）だけ、頼みの言葉にする（lib/sample-records-i18n.ts。家族が書いた記録はそのまま）
  const lang = langOf(req);
  return { records: listRecords(family.id).map((r) => localizeSeedRecord(r, lang)), ask: latestAsk(family.id, todayOf(q.get("today"))) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; text?: string }>(req);
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const text = (b.text ?? "").trim();
  if (!text) throw new HttpError(400, "書いた事が空です");
  if (text.length > 4000) throw new HttpError(400, "長すぎます（4000字まで）");
  const today = todayOf(b.today);
  return sendingAs(h.who, () => capture({ family: h.family, today, source: "text", text }));
});

export const DELETE = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family } = await familyFor(req, q.get("familyId"), "record:write");
  const captureId = q.get("captureId");
  if (!captureId) throw new HttpError(400, "どの聞き返しか分かりません");
  clearAsk(family.id, captureId);
  return { ok: true };
});
