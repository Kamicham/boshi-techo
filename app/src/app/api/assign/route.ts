// 担当の決め直し: 家族の一覧（GET ?familyId=）・1件を変える（POST { familyId, milestoneId, assign | null }）。
// 変えた担当は、今日の画面・家族の画面（分担を考える時）・下書きの書き手に効く。
import { body, route } from "@/lib/api";
import { isAssign } from "@/lib/assign";
import { HttpError, requireFamily } from "@/lib/family";
import { getAssignments, setAssignment } from "./_lib/store";

export const GET = route(async (req: Request) => {
  const family = requireFamily(new URL(req.url).searchParams.get("familyId"));
  return { assign: getAssignments(family.id) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; assign?: unknown }>(req);
  const family = requireFamily(b.familyId);
  if (typeof b.milestoneId !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(b.milestoneId)) throw new HttpError(400, "やる事の id が読めません");
  if (b.assign !== null && !isAssign(b.assign, family.members)) throw new HttpError(400, "担当が読めません");
  return { assign: setAssignment(family.id, b.milestoneId, b.assign) };
});
