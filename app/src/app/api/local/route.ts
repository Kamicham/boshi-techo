import { body, route } from "@/lib/api";
import { requireFamily } from "@/lib/family";
import { fetchLocal, findMilestone, getLocal } from "@/lib/local";

export const maxDuration = 300;

/** 調べてある結果だけを返す（調べには行かない） */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const m = findMilestone(q.get("milestoneId"));
  return { local: getLocal(family, m.id) };
});

/** その町の制度を取りに行く（DB にあればそれを返す。force で調べ直す） */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; force?: boolean }>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  return fetchLocal(family, m, b.force === true);
});
