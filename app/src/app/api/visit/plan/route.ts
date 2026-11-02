// 次の予約日と、家族が足す気がかり。
import { body, route } from "@/lib/api";
import { HttpError, requireFamily } from "@/lib/family";
import { patch } from "@/lib/db";
import type { VisitData } from "@/lib/visit";
import { getPlan, newId, ongoingVisit, savePlan } from "../_lib/server";

export const POST = route(async (req: Request) => {
  const b = await body<{
    familyId?: string;
    next?: { date: string; time?: string | null } | null;
    concern?: string;
    today?: string;
    removeConcern?: string;
  }>(req);
  const fam = requireFamily(b.familyId);
  const plan = getPlan(fam.id);
  if (b.next !== undefined) {
    if (b.next && !/^\d{4}-\d{2}-\d{2}$/.test(b.next.date)) throw new HttpError(400, "予約の日付が読めません");
    if (b.next?.time && !/^\d{2}:\d{2}$/.test(b.next.time)) throw new HttpError(400, "予約の時刻が読めません");
    plan.next = b.next ? { date: b.next.date, time: b.next.time || null, source: "manual" } : null;
  }
  if (b.concern !== undefined) {
    const text = b.concern.trim().slice(0, 300);
    if (!text) throw new HttpError(400, "気がかりを書いてください");
    const date = b.today && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : new Date().toISOString().slice(0, 10);
    const c = { id: newId(), text, date };
    const v = ongoingVisit(fam.id, b.today);
    if (v) {
      // 今日の健診がもう始まっていれば、その「今日聞く事」に入れる（消した時に元へ戻せるよう carried にも残す）
      patch<VisitData>(v.id, {
        agenda: [...(v.data.agenda ?? []), { id: c.id, text, from: "気がかり" }],
        carried: { prevCarriedFrom: v.data.carried?.prevCarriedFrom, concerns: [...(v.data.carried?.concerns ?? []), c] },
      });
    } else {
      plan.concerns = [...plan.concerns, c];
    }
  }
  if (b.removeConcern) {
    plan.concerns = plan.concerns.filter((c) => c.id !== b.removeConcern);
    const v = ongoingVisit(fam.id, b.today);
    if (v) {
      patch<VisitData>(v.id, {
        agenda: (v.data.agenda ?? []).filter((a) => a.id !== b.removeConcern),
        carried: v.data.carried && { ...v.data.carried, concerns: v.data.carried.concerns.filter((c) => c.id !== b.removeConcern) },
      });
    }
  }
  return { plan: savePlan(fam.id, plan) };
});
