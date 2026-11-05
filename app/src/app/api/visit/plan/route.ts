// 次の予約日と、家族が足す気がかり。関所は familyFor（家族の id で世帯を指し、「セッション → 世帯 → 権限」）。
import { body, route } from "@/lib/api";
import { HttpError } from "@/lib/family";
import { familyFor } from "../../_lib/household";
import { patch } from "@/lib/db";
import type { VisitData } from "@/lib/visit";
import { getPlan, newId, ongoingVisit, savePlan } from "../_lib/server";

export const POST = route(async (req: Request) => {
  const b = await body<{
    familyId?: string;
    next?: { date: string; time?: string | null } | null;
    concern?: string;
    /** child: 子の健診で聞く事（ママの健診には入れない） */
    concernFor?: "child" | "mother";
    today?: string;
    removeConcern?: string;
    /** 妊婦健診の受診券の数（0 は国の標準に戻す） */
    tickets?: number;
    /** 妊婦健診で払った額を足す・消す */
    paid?: { date: string; yen: number };
    removePaid?: string;
  }>(req);
  const { family: fam } = await familyFor(req, b.familyId, "record:write");
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
    const c = { id: newId(), text, date, for: b.concernFor === "child" ? ("child" as const) : ("mother" as const) };
    const v = b.concernFor === "child" ? null : ongoingVisit(fam.id, b.today);
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
  if (typeof b.tickets === "number") {
    if (b.tickets === 0) delete plan.tickets;
    else if (Number.isInteger(b.tickets) && b.tickets >= 1 && b.tickets <= 40) plan.tickets = b.tickets;
    else throw new HttpError(400, "受診券の数が読めません");
  }
  if (b.paid) {
    const yen = Math.round(Number(b.paid.yen));
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(b.paid.date)) || !Number.isFinite(yen) || yen <= 0 || yen > 1_000_000) throw new HttpError(400, "日付か額が読めません");
    plan.paid = [...(plan.paid ?? []), { id: newId(), date: b.paid.date, yen }].slice(-60);
  }
  if (b.removePaid) plan.paid = (plan.paid ?? []).filter((p) => p.id !== b.removePaid);
  return { plan: savePlan(fam.id, plan) };
});
