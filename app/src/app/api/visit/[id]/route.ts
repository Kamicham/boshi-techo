// 健診1回分: 見る・少し直す（聞けた印・道案内の済み）・消す。
import { body, route } from "@/lib/api";
import { patch } from "@/lib/db";
import type { VisitData } from "@/lib/visit";
import { deleteVisit, isRunning, requireVisit } from "../_lib/server";

type P = { params: Promise<{ id: string }> };

export const GET = route(async (_req: Request, { params }: P) => {
  const v = requireVisit((await params).id);
  return { visit: { id: v.id, familyId: v.familyId, ...v.data, running: isRunning(v.id) } };
});

export const PATCH = route(async (req: Request, { params }: P) => {
  const v = requireVisit((await params).id);
  const b = await body<{ consent?: boolean; asked?: { id: string; asked: boolean }; guideDone?: number[] }>(req);
  const partial: Partial<VisitData> = {};
  if (b.consent !== undefined) partial.consent = !!b.consent;
  if (b.asked && v.data.agenda) partial.agenda = v.data.agenda.map((a) => (a.id === b.asked!.id ? { ...a, asked: b.asked!.asked } : a));
  if (b.guideDone && v.data.guide) partial.guide = { ...v.data.guide, done: b.guideDone.filter((n) => Number.isInteger(n)) };
  const d = patch<VisitData>(v.id, partial)!;
  return { visit: { id: d.id, familyId: d.familyId, ...d.data, running: isRunning(d.id) } };
});

export const DELETE = route(async (_req: Request, { params }: P) => {
  const v = requireVisit((await params).id);
  deleteVisit(v);
  return { ok: true };
});
