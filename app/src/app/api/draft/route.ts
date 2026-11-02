import { body, route } from "@/lib/api";
import { confirmDraft, getDraft, listDrafts, makeDraft, saveDraft, viewDraft, writerName } from "@/lib/drafts";
import { getKeep } from "@/lib/keep";
import { HttpError, requireFamily } from "@/lib/family";
import { findMilestone } from "@/lib/local";

export const maxDuration = 300;

const meOf = (v: unknown) => (typeof v === "string" && v ? v : null);
const dayOf = (v: unknown) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : undefined);

/**
 * ?familyId= … 家族が印を付けた（送った・使った）下書きの一覧 { drafts }
 * ?familyId=&milestoneId=[&meId=] … その事の下書き（「いつもの」と書き手の名前で空欄を埋めた形）
 *   { draft, blanks, mailTo, toName, cc }
 */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const mid = q.get("milestoneId");
  if (mid) return viewDraft(family, getDraft(family.id, findMilestone(mid).id), meOf(q.get("meId")));
  return { drafts: listDrafts(family.id) };
});

/** 下書きを作る（作り直しも同じ）。外へは何も送らない */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string; meId?: string }>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const today = dayOf(b.today);
  if (!today) throw new HttpError(400, "今日の日付が読めません");
  return makeDraft(family, m, today, meOf(b.meId));
});

type EditBody = {
  familyId?: string;
  milestoneId?: string;
  meId?: string;
  today?: string;
  title?: string;
  to?: string;
  body?: string;
  checklist?: string[];
  unmark?: boolean;
};

function readEdits(b: EditBody) {
  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, 20_000) : undefined);
  return {
    title: str(b.title),
    to: str(b.to),
    body: str(b.body),
    checklist: Array.isArray(b.checklist) ? b.checklist.filter((x): x is string => typeof x === "string") : undefined,
  };
}

/** 「送った」「使った」: 家族が印を付けて保存する。送信ではない。その事も済みになる */
export const PUT = route(async (req: Request) => {
  const b = await body<EditBody>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const draft = confirmDraft(family.id, m.id, readEdits(b), dayOf(b.today));
  if (!draft) throw new HttpError(404, "下書きが見つかりません。先に作ってください");
  return viewDraft(family, draft, meOf(b.meId));
});

/** 直した文を残す（空欄を埋めた後もここ）。unmark で印を外す（印から付いた済みも外れる） */
export const PATCH = route(async (req: Request) => {
  const b = await body<EditBody>(req);
  const family = requireFamily(b.familyId);
  const m = findMilestone(b.milestoneId);
  const meId = meOf(b.meId);
  const draft = saveDraft(family.id, m.id, readEdits(b), { unmark: b.unmark === true, writer: writerName(family, getKeep(family.id), meId) });
  if (!draft) throw new HttpError(404, "下書きが見つかりません。先に作ってください");
  return viewDraft(family, draft, meId);
});
