// 健診1回分: 見る・少し直す（聞けた印・道案内の済み・次の健診の日の確かめ）・消す。
// 関所: visitFor（健診の世帯で「セッション → 世帯 → 権限」。よその世帯の健診は 404）
import { body, route } from "@/lib/api";
import { patch } from "@/lib/db";
import type { VisitData } from "@/lib/visit";
import { answerNext, canWriteVisit, deleteVisit, isRunning, keptGuideFor, visitFor } from "../_lib/server";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: P) => {
  const { v, h } = await visitFor(req, (await params).id, "record:read");
  return { visit: { id: v.id, familyId: v.familyId, ...v.data, running: isRunning(v.id), canWrite: canWriteVisit(h) } };
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const { v, h } = await visitFor(req, (await params).id, "record:write");
  const b = await body<{ consent?: boolean; asked?: { id: string; asked: boolean }; guideDone?: number[]; useKeptGuide?: boolean; nextCheck?: unknown }>(req);
  // 結果の画面の1問（大丈夫・直す・言われていない）。口は増やさず、ここで受ける（lib/visit-next.ts）
  const partial: Partial<VisitData> = b.nextCheck !== undefined ? answerNext(v, b.nextCheck, h.account?.id ?? null) : {};
  // 撮らずに「いつもの順番」を使う時は、覚えている順番をこの健診に写してから済みの印を付ける
  const guide = b.useKeptGuide && !v.data.guide ? keptGuideFor(v) : v.data.guide;
  if (b.useKeptGuide && guide && !v.data.guide) partial.guide = guide;
  if (b.consent !== undefined) partial.consent = !!b.consent;
  if (b.asked && v.data.agenda) partial.agenda = v.data.agenda.map((a) => (a.id === b.asked!.id ? { ...a, asked: b.asked!.asked } : a));
  if (b.guideDone && guide) partial.guide = { ...guide, done: b.guideDone.filter((n) => Number.isInteger(n)) };
  const d = patch<VisitData>(v.id, partial)!;
  return { visit: { id: d.id, familyId: d.familyId, ...d.data, running: isRunning(d.id), canWrite: canWriteVisit(h) } };
});

export const DELETE = route(async (req: Request, { params }: P) => {
  const { v } = await visitFor(req, (await params).id, "record:write");
  deleteVisit(v);
  return { ok: true };
});
