import { body, route } from "@/lib/api";
import { allFamilies, getFamily, HttpError, MINE_ID, saveMine } from "@/lib/family";
import { list, put } from "@/lib/db";
import { scheduleFor } from "@/lib/milestones";
import type { Family } from "@/lib/demo-family";

export const GET = route(async () => ({ families: allFamilies() }));

/** 「わが家」の設定を保存する */
export const POST = route(async (req: Request) => {
  const b = await body<Partial<Family>>(req);
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new HttpError(400, "出産予定日を入れてください");
  if (!b.city) throw new HttpError(400, "住んでいる市区町村を入れてください");
  const prior = getFamily(MINE_ID);
  // 日本時間の今日
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const restart = !prior?.startedOn || prior.dueDate !== b.dueDate;
  // 町を変えた時は前の町と引っ越した日を覚える（参謀の気づき「町が変わった」が、引き継がれない制度の差を調べる）
  const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
  const movedNow = !!prior?.city && (prior.city !== b.city || (prior.prefecture ?? "") !== (b.prefecture ?? ""));
  const move = movedNow
    ? { previousCity: prior!.city, previousPrefecture: prior!.prefecture || undefined, movedOn: today }
    : { previousCity: prior?.previousCity, previousPrefecture: prior?.previousPrefecture, movedOn: prior?.movedOn };
  const fam = saveMine({
    ...move,
    startedOn: restart ? today : prior!.startedOn,
    city: b.city,
    prefecture: b.prefecture ?? "",
    dueDate: b.dueDate,
    birthDate: b.birthDate || undefined,
    childName: b.childName || undefined,
    members: (b.members ?? [])
      .filter((m) => m.name)
      .map((m) => {
        // 祖父母の来る日（来る日が無ければ持たない）
        const visit = m.role === "祖父母" && isDay(m.visit?.from) ? { from: m.visit.from, until: isDay(m.visit.until) ? m.visit.until : undefined } : undefined;
        return { id: m.id, name: m.name, role: m.role, voice: m.voice ?? "", ...(visit ? { visit } : {}) };
      }),
  });
  // 途中から使い始めた家族: 使い始める前に期限が過ぎた事（妊娠の届出など）は、もう済んでいるものとして扱う
  if (restart) {
    const done = new Set(list<{ milestoneId?: string }>(MINE_ID, "done").map((d) => d.data.milestoneId));
    for (const m of scheduleFor(fam)) {
      if (m.deadlineDate && m.deadlineDate < today && !done.has(m.id)) {
        put(MINE_ID, "done", { milestoneId: m.id, today, at: new Date().toISOString(), auto: "started-late" }, { id: `done:${MINE_ID}:${m.id}`, date: today });
      }
    }
  }
  return { family: fam };
});
