// ④ 参謀の気づき: 今のきっかけを機械で見つけ（lib/advisor.ts）、気づき1つを返す。
// GET ?familyId=&today=  … 出す1つ（閉じていないきっかけのうち一番先の物）。無ければ advice: null
// POST { familyId, key }  … 「わかった」で閉じる
// 書いた気づきは家族ごと・きっかけの鍵ごとに DB（type 'advice'）へ置き、同じ状況では Claude を呼び直さない。
import { body, route } from "@/lib/api";
import { detectTriggers, type Advice } from "@/lib/advisor";
import { listRecords } from "@/lib/capture";
import { get, list, patch, put } from "@/lib/db";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { HttpError, requireFamily } from "@/lib/family";
import { getKeep } from "@/lib/keep";
import { writeAdvice } from "./_lib/write";

const adviceId = (familyId: string, key: string) => `advice:${familyId}:${key}`;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 同じ気づきを同時に2回書かせない（画面の二重読み込みなど） */
const inflight = new Map<string, Promise<Advice>>();

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const today = q.get("today");
  if (!isDay(today)) throw new HttpError(400, "今日の日付が読めません");

  const done = new Set(
    list<{ milestoneId?: string }>(family.id, "done")
      .map((d) => d.data.milestoneId)
      .filter((x): x is string => typeof x === "string"),
  );
  const records = listRecords(family.id, { limit: 40 })
    .filter((r) => !r.date || r.date.slice(0, 10) <= today)
    .slice(0, 5)
    .map((r) => ({ date: r.date, kind: r.data.kind, title: r.data.title, who: r.data.who }));
  const input = { family, today, done, isDemo: family.id === DEMO_FAMILY.id, records };

  const open = detectTriggers(input).filter((x) => !get<Advice>(adviceId(family.id, x.key))?.data.dismissedAt);
  const t = open[0];
  if (!t) return { advice: null, waiting: 0 };

  const id = adviceId(family.id, t.key);
  let advice = get<Advice>(id)?.data;
  let cached = !!advice;
  if (!advice) {
    let p = inflight.get(id);
    if (!p) {
      p = writeAdvice(t, input, getKeep(family.id)).then((a) => put<Advice>(family.id, "advice", a, { id, date: today }).data);
      inflight.set(id, p);
      p.finally(() => inflight.delete(id)).catch(() => {});
    } else cached = true;
    advice = await p;
  }
  // 職場あてのメールは、覚えている上司のメールを宛先に入れる（DB の気づきには持たせない）
  const work = getKeep(family.id).work;
  const mailTo = advice.message?.via === "mail" && /職場|上司|人事/.test(advice.message.to) ? (work?.email ?? work?.hrEmail) : undefined;
  return { advice, mailTo, cached, waiting: open.length - 1 };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; key?: string }>(req);
  const family = requireFamily(b.familyId);
  if (typeof b.key !== "string" || !b.key || b.key.length > 300) throw new HttpError(400, "気づきの鍵が読めません");
  const id = adviceId(family.id, b.key);
  if (!get<Advice>(id)) throw new HttpError(404, "その気づきが見つかりません");
  patch<Advice>(id, { dismissedAt: new Date().toISOString() });
  return { ok: true };
});
