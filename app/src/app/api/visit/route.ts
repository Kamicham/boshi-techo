// 健診の一覧と、新しい健診を始める。関所は familyFor（家族の id で世帯を指し、「セッション → 世帯 → 権限」）。
import { body, route } from "@/lib/api";
import { familyFor } from "../_lib/household";
import { concernSide, nextAgenda, type VisitData } from "@/lib/visit";
import { bornOn, createVisit, getPlan, ongoingVisit, visitsOf } from "./_lib/server";
import { prenatalState } from "@/lib/prenatal";
import { listTecho } from "@/lib/techo-store";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family: fam } = await familyFor(req, q.get("familyId"), "record:read");
  const today = q.get("today") ?? new Date().toISOString().slice(0, 10);
  const docs = visitsOf(fam.id);
  const plan = getPlan(fam.id);
  const visits = docs.map((d) => ({
    id: d.id,
    createdAt: d.createdAt,
    date: d.data.date,
    label: d.data.label,
    status: d.data.status,
    demo: d.data.demo,
    summary: d.data.result?.summary?.[0] ?? null,
  }));
  const { items } = nextAgenda(
    docs.map((d) => ({ id: d.id, createdAt: d.createdAt, date: d.data.date, status: d.data.status, result: d.data.result })),
    plan,
    bornOn(fam, today),
  );
  // 予約が入っていなければ、一番新しい健診の結果から取れた日を使う
  if (!plan.next) {
    const last = docs.find((d) => d.data.status === "done" && d.data.nextDate);
    if (last) plan.next = { date: last.data.nextDate!, time: last.data.result?.nextAppointment?.time ?? null, source: "visit", visitId: last.id, said: last.data.result?.nextAppointment?.said };
  }
  // 妊婦健診の次の目安と受診券の残り（第1波⑧）。受けた日は、妊娠中の健診の記録と手帳の妊婦健診のページから
  const checkups = [
    ...docs.filter((d) => d.data.status === "done" && !d.data.demo).map((d) => d.data.date),
    ...listTecho(fam.id, { family: fam, today })
      .filter((d) => d.data.page === "pregnancy-checkup" && !d.data.pending)
      .map((d) => d.data.date),
  ];
  const prenatal = prenatalState(fam, today, checkups, { tickets: plan.tickets, paid: plan.paid });
  // 今日の健診が始まっていれば、聞く事はその健診の物を見せる
  const ongoing = ongoingVisit(fam.id, q.get("today") ?? undefined);
  if (ongoing) {
    // 作った時に入った、ママの事ではない気がかり（前の回の子の事・妊娠中の事）は外して見せる
    const carried = new Map((ongoing.data.carried?.concerns ?? []).map((c) => [c.id, c]));
    const agenda = (ongoing.data.agenda ?? []).filter((a) => {
      const c = a.from === "気がかり" ? carried.get(a.id) : undefined;
      return !c || concernSide(c, bornOn(fam, today)) === "mother";
    });
    return { visits, plan, agenda, agendaFor: "today" as const, prenatal };
  }
  return { visits, plan, agenda: items, agendaFor: "next" as const, prenatal };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; date?: string; demo?: boolean; agenda?: string[] }>(req);
  const h = await familyFor(req, b.familyId, "record:write");
  const fam = h.family;
  // デモの健診（持ち越しに触らない）は、見本の家族だけ
  const demo = !!b.demo && h.kind === "demo";
  const doc = createVisit(fam.id, b.date ?? "", { demo, demoAgenda: demo && Array.isArray(b.agenda) ? b.agenda.map(String).slice(0, 10) : undefined });
  return { visit: { id: doc.id, ...(doc.data as VisitData) } };
});
