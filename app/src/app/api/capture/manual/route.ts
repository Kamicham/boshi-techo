// 打って入れる（VISION ①「入力ゼロ、でも押し付けない」2026-11-04）: 一言・予定・期限・体温を、Claude を通さずそのまま記録に入れる。
// 数字の手入れ（手帳の欄）は /api/techo の add。ここは手帳の欄に無い記録（できごと・気がかり・予定・メモ・体温）。
import { body, route } from "@/lib/api";
import { addConcernsToAgenda, addManualRecord, addTemperature } from "@/lib/capture";
import { familyFor } from "../../_lib/household";
import { todayOf } from "../shared";

export const POST = route(async (req: Request) => {
  const b = await body<{
    familyId?: string;
    today?: string;
    kind?: string;
    title?: string;
    date?: string;
    time?: string;
    deadline?: boolean;
    who?: string;
    temperature?: string;
    /** 気がかりを、だれの健診で聞くか（生まれた後に家族が選んだ時だけ） */
    concernFor?: string;
  }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const today = todayOf(b.today);
  if (typeof b.temperature === "string") return { record: addTemperature(family.id, b.temperature, typeof b.date === "string" ? b.date : today, today, b.who) };
  const record = addManualRecord(family.id, { kind: b.kind, title: b.title, date: b.date, time: b.time, deadline: b.deadline, who: b.who }, today);
  // 打った気がかりも、次の健診の「先生に聞く事」に並べる（話した時と同じ道・lib/capture.ts）。agenda: 並べた欄（並べなかった時は null）
  const chosen = b.concernFor === "child" || b.concernFor === "mother" ? b.concernFor : undefined;
  return { record, agenda: addConcernsToAgenda(family, [record], today, chosen)[0] ?? null };
});
