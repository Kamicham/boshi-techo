import { body, route } from "@/lib/api";
import { confirmDraft, getDraft, listDrafts, makeDraft, saveDraft, viewDraft } from "@/lib/drafts";
import { HttpError, requireFamily } from "@/lib/family";
import { findMilestone } from "@/lib/local";

export const maxDuration = 300;

/**
 * ?familyId= … 家族が印を付けた（送った・使った）下書きの一覧 { drafts }
 * ?familyId=&milestoneId= … その事の下書き（「いつもの」で空欄を埋めた形） { draft, ask, mailTo }
 */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const mid = q.get("milestoneId");
  if (mid) return viewDraft(family.id, getDraft(family.id, findMilestone(mid).id));
  return { drafts: listDrafts(family.id) };
});

/** 下書きを作る（作り直しも同じ）。外へは何も送らない */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string; meId?: string }>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  if (!b.today || !/^\d{4}-\d{2}-\d{2}$/.test(b.today)) throw new HttpError(400, "今日の日付が読めません");
  return makeDraft(family, m, b.today, typeof b.meId === "string" ? b.meId : null);
});

type EditBody = { familyId?: string; milestoneId?: string; title?: string; to?: string; body?: string; checklist?: string[]; unmark?: boolean };

function readEdits(b: EditBody) {
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 20_000) : undefined);
  return {
    title: str(b.title),
    to: str(b.to),
    body: str(b.body),
    checklist: Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string") : undefined,
  };
}

/** 「送った」「使った」: 家族が印を付けて保存する。送信ではない */
export const PUT = route(async (req: Request) => {
  const b = await body<EditBody>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const draft = confirmDraft(family.id, m.id, readEdits(b));
  if (!draft) throw new HttpError(404, "下書きが見つかりません。先に作ってください");
  return viewDraft(family.id, draft);
});

/** 直した文を残す（「いつもの」を覚えた後の空欄埋めもここ）。unmark で印を外す */
export const PATCH = route(async (req: Request) => {
  const b = await body<EditBody>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const draft = saveDraft(family.id, m.id, readEdits(b), { unmark: b.unmark === true });
  if (!draft) throw new HttpError(404, "下書きが見つかりません。先に作ってください");
  return viewDraft(family.id, draft);
});
