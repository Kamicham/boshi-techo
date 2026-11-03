// 気づいた事: 今のきっかけを機械で見つけ（lib/advisor.ts）、気づき1つを返す。
// GET ?familyId=&today=  … 出す1つ（閉じていないきっかけのうち一番先の物）。無ければ advice: null
// GET ?familyId=&today=&peek=1 … 気づきが今いくつあるかだけ（Claude は呼ばない。今日の画面が場所を取っておくため）
// POST { familyId, key }  … 「わかった」で閉じる
// 書いた気づきは家族ごと・きっかけの鍵ごとに DB（type 'advice'）へ置き、同じ状況では Claude を呼び直さない。
import { body, route } from "@/lib/api";
import { detectTriggers, type Advice } from "@/lib/advisor";
import { listRecords } from "@/lib/capture";
import { get, patch, put } from "@/lib/db";
import { doneSetFor } from "@/app/api/done/_lib/done";
import { fillFamilyBlanks } from "@/lib/blanks";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { fillBlanks } from "@/lib/keep";
import { HttpError } from "@/lib/family";
import { getKeep } from "@/lib/keep";
import { sendingAs } from "@/lib/claude";
import { familyFor } from "../_lib/household";
import { writeAdvice } from "./_lib/write";

const adviceId = (familyId: string, key: string) => `advice:${familyId}:${key}`;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 同じ気づきを同時に2回書かせない（画面の二重読み込みなど） */
const inflight = new Map<string, Promise<Advice>>();

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const h = await familyFor(req, q.get("familyId"), "record:read");
  const family = h.family;
  const today = q.get("today");
  if (!isDay(today)) throw new HttpError(400, "今日の日付が読めません");

  // 手帳の記録（接種・健診）で済んだ物も足す（今日の画面と同じ集合）
  const done = doneSetFor(family, today);
  const records = listRecords(family.id, { limit: 40 })
    .filter((r) => !r.date || r.date.slice(0, 10) <= today)
    .slice(0, 5)
    .map((r) => ({ date: r.date, kind: r.data.kind, title: r.data.title, who: r.data.who }));
  const input = { family, today, done, isDemo: family.id === DEMO_FAMILY.id, records };

  const open = detectTriggers(input).filter((x) => !get<Advice>(adviceId(family.id, x.key))?.data.dismissedAt);
  if (q.get("peek") === "1") return { open: open.length };
  const t = open[0];
  if (!t) return { advice: null, waiting: 0 };

  const id = adviceId(family.id, t.key);
  let advice = get<Advice>(id)?.data;
  let cached = !!advice;
  if (!advice) {
    // まだ書いていない気づきは Claude に書かせる。書けない人（読むだけの祖父母など）には、書いてある物だけを出す
    if (!h.can("record:write") || !h.can("claude:send")) return { advice: null, waiting: open.length };
    let p = inflight.get(id);
    if (!p) {
      p = sendingAs(h.who, () => writeAdvice(t, input, getKeep(family.id))).then((a) => put<Advice>(family.id, "advice", a, { id, date: today }).data);
      inflight.set(id, p);
      p.finally(() => inflight.delete(id)).catch(() => {});
    } else cached = true;
    advice = await p;
  }
  // 職場あてのメールは、覚えている上司のメールを宛先に入れる（DB の気づきには持たせない）
  const keep = getKeep(family.id);
  const work = keep.work;
  const mailTo = advice.message?.via === "mail" && /職場|上司|人事/.test(advice.message.to) ? (work?.email ?? work?.hrEmail) : undefined;
  // 送る人の名前・町名・会社名など、分かる【 】は埋めて返す（DB の気づきは書いたまま）
  const sender = t.from ? keep.names?.[t.from.memberId] || t.from.name : null;
  const fill = (x: string) => fillFamilyBlanks(fillBlanks(x, keep, { writer: sender }), family, { writer: sender, names: keep.names });
  const shown: Advice = advice.message ? { ...advice, message: { ...advice.message, body: fill(advice.message.body), subject: advice.message.subject && fill(advice.message.subject) } } : advice;
  return { advice: shown, mailTo, from: sender ?? undefined, cached, waiting: open.length - 1 };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; key?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  if (typeof b.key !== "string" || !b.key || b.key.length > 300) throw new HttpError(400, "気づきの鍵が読めません");
  const id = adviceId(family.id, b.key);
  if (!get<Advice>(id)) throw new HttpError(404, "その気づきが見つかりません");
  patch<Advice>(id, { dismissedAt: new Date().toISOString() });
  return { ok: true };
});
