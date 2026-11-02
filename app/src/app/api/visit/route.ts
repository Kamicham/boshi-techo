// 健診の一覧と、新しい健診を始める。
import { body, route } from "@/lib/api";
import { requireFamily } from "@/lib/family";
import { nextAgenda, type VisitData } from "@/lib/visit";
import { createVisit, getPlan, visitsOf } from "./_lib/server";

export const GET = route(async (req: Request) => {
  const fam = requireFamily(new URL(req.url).searchParams.get("familyId"));
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
  );
  // 予約が入っていなければ、一番新しい健診の結果から取れた日を使う
  if (!plan.next) {
    const last = docs.find((d) => d.data.status === "done" && d.data.nextDate);
    if (last) plan.next = { date: last.data.nextDate!, time: last.data.result?.nextAppointment?.time ?? null, source: "visit", visitId: last.id, said: last.data.result?.nextAppointment?.said };
  }
  return { visits, plan, agenda: items };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; date?: string; demo?: boolean; agenda?: string[] }>(req);
  const fam = requireFamily(b.familyId);
  const demo = !!b.demo && fam.id.startsWith("demo");
  const doc = createVisit(fam.id, b.date ?? "", { demo, demoAgenda: demo && Array.isArray(b.agenda) ? b.agenda.map(String).slice(0, 10) : undefined });
  return { visit: { id: doc.id, ...(doc.data as VisitData) } };
});
