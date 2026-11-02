import { body, route } from "@/lib/api";
import { confirmDraft, getDraft, listDrafts, makeDraft } from "@/lib/drafts";
import { HttpError, requireFamily } from "@/lib/family";
import { findMilestone } from "@/lib/local";

export const maxDuration = 300;

/**
 * ?familyId= … 家族が確かめた（OK した）下書きの一覧 { drafts }
 * ?familyId=&milestoneId= … その事の下書き（OK 前も含む） { draft }
 */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const mid = q.get("milestoneId");
  if (mid) return { draft: getDraft(family.id, findMilestone(mid).id) };
  return { drafts: listDrafts(family.id) };
});

/** 下書きを作る（作り直しも同じ）。外へは何も送らない */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string }>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  if (!b.today || !/^\d{4}-\d{2}-\d{2}$/.test(b.today)) throw new HttpError(400, "今日の日付が読めません");
  return { draft: await makeDraft(family, m, b.today) };
});

/** 「OK（これで確定）」: 家族が確かめた印を付けて保存する。送信ではない */
export const PUT = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; title?: string; to?: string; body?: string; checklist?: string[] }>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const draft = confirmDraft(family.id, m.id, {
    title: str(b.title),
    to: str(b.to),
    body: str(b.body),
    checklist: Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string") : undefined,
  });
  if (!draft) throw new HttpError(404, "下書きが見つかりません。先に作ってください");
  return { draft };
});
