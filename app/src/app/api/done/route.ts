// 済んだ事（milestone id）: 家族の一覧（GET）・済みにする（POST）・戻す（DELETE）。
// 形は { milestoneId, at }。family-plan もこの形で読む。
import { body, route } from "@/lib/api";
import { list, put, remove } from "@/lib/db";
import { HttpError, requireFamily } from "@/lib/family";

interface DoneData {
  milestoneId: string;
  /** 押した時の「今日」（デモの時計を含む） */
  today?: string;
  at: string;
}

const doneId = (familyId: string, milestoneId: string) => `done:${familyId}:${milestoneId}`;

function milestoneOf(v: unknown): string {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new HttpError(400, "済んだ事の id が読めません");
  return v;
}

export const GET = route(async (req: Request) => {
  const family = requireFamily(new URL(req.url).searchParams.get("familyId"));
  const done = list<DoneData>(family.id, "done")
    .map((d) => d.data.milestoneId)
    .filter((x): x is string => typeof x === "string");
  return { done };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string }>(req);
  const family = requireFamily(b.familyId);
  const milestoneId = milestoneOf(b.milestoneId);
  const today = typeof b.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : undefined;
  put<DoneData>(family.id, "done", { milestoneId, today, at: new Date().toISOString() }, { id: doneId(family.id, milestoneId), date: today ?? null });
  return { ok: true, milestoneId };
});

export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string }>(req);
  const family = requireFamily(b.familyId);
  const milestoneId = milestoneOf(b.milestoneId);
  remove(doneId(family.id, milestoneId));
  return { ok: true, milestoneId };
});
