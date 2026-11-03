import { body, route } from "@/lib/api";
import { sendingAs } from "@/lib/claude";
import { familyFor, WRITE_AND_SEND } from "../_lib/household";
import { fetchLocal, findMilestone, getLocal } from "@/lib/local";

export const maxDuration = 300;

/** 調べてある結果だけを返す（調べには行かない） */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family } = await familyFor(req, q.get("familyId"), "record:read");
  const m = findMilestone(q.get("milestoneId"));
  return { local: getLocal(family, m.id) };
});

/** その町の制度を取りに行く（DB にあればそれを返す。force で調べ直す） */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; force?: boolean }>(req);
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const m = findMilestone(b.milestoneId);
  // 調べに送るのは町の名前と手続きの名前だけ（家族の記録は入らない）。同意は見ず、送った記録だけ残す
  return sendingAs({ ...h.who, noPersonal: true }, () => fetchLocal(h.family, m, b.force === true));
});
