// 健診の一覧と、新しい健診を始める。
import { body, route } from "@/lib/api";
import { requireFamily } from "@/lib/family";
import { concernSide, nextAgenda, type VisitData } from "@/lib/visit";
import { bornOn, createVisit, getPlan, ongoingVisit, visitsOf } from "./_lib/server";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const fam = requireFamily(q.get("familyId"));
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
  // 今日の健診が始まっていれば、聞く事はその健診の物を見せる
  const ongoing = ongoingVisit(fam.id, q.get("today") ?? undefined);
  if (ongoing) {
    // 作った時に入った、ママの事ではない気がかり（前の回の子の事・妊娠中の事）は外して見せる
    const carried = new Map((ongoing.data.carried?.concerns ?? []).map((c) => [c.id, c]));
    const agenda = (ongoing.data.agenda ?? []).filter((a) => {
      const c = a.from === "気がかり" ? carried.get(a.id) : undefined;
      return !c || concernSide(c, bornOn(fam, today)) === "mother";
    });
    return { visits, plan, agenda, agendaFor: "today" as const };
  }
  return { visits, plan, agenda: items, agendaFor: "next" as const };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; date?: string; demo?: boolean; agenda?: string[] }>(req);
  const fam = requireFamily(b.familyId);
  const demo = !!b.demo && fam.id.startsWith("demo");
  const doc = createVisit(fam.id, b.date ?? "", { demo, demoAgenda: demo && Array.isArray(b.agenda) ? b.agenda.map(String).slice(0, 10) : undefined });
  return { visit: { id: doc.id, ...(doc.data as VisitData) } };
});
