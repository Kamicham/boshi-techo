// 気づいた事: 今のきっかけを機械で見つけ（lib/advisor.ts）、気づき1つを返す。
// GET ?familyId=&today=  … 出す1つ（閉じていないきっかけのうち一番先の物）。無ければ advice: null
// GET ?familyId=&today=&peek=1 … 気づきが今いくつあるかだけ（Claude は呼ばない。今日の画面が場所を取っておくため）
// GET ?familyId=&closed=1 … 「わかった」で閉じた気づき（新しく閉じた順に10まで・文面の空欄を埋めた形。Claude は呼ばない）
// POST { familyId, key }  … 「わかった」で閉じる
// 書いた気づきは家族ごと・きっかけの鍵ごとに DB（type 'advice'）へ置き、同じ状況では Claude を呼び直さない。
// きっかけが無い時は、時期ごとに1回、Claude が家族の今を見渡す（look:<時期>）。peek の時に裏で見渡し始め、見つかった物だけを次から数える
// （今日の画面を待たせない・見つからなかった時に場所取りの箱が出て消えない）。
import { body, route } from "@/lib/api";
import { adviceSender, detectTriggers, lookBucket, type Advice, type AdvisorInput, type Trigger } from "@/lib/advisor";
import { listRecords } from "@/lib/capture";
import { get, list, patch, put } from "@/lib/db";
import type { Family } from "@/lib/demo-family";
import { doneSetFor } from "@/app/api/done/_lib/done";
import { fillFamilyBlanks } from "@/lib/blanks";
import { isDemoLike } from "@/lib/trial-cookie";
import { fillBlanks } from "@/lib/keep";
import { HttpError } from "@/lib/family";
import { getKeep } from "@/lib/keep";
import { workOf } from "@/lib/whose";
import { sendingAs } from "@/lib/claude";
import { familyFor } from "../_lib/household";
import { lookAround, writeAdvice } from "./_lib/write";
import { adviceIn } from "./_lib/in-lang";
import { langOf } from "@/lib/i18n/dicts";

const adviceId = (familyId: string, key: string) => `advice:${familyId}:${key}`;
const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 同じ気づきを同時に2回書かせない（画面の二重読み込みなど） */
const inflight = new Map<string, Promise<Advice>>();

/** 書いた物を DB に置く（同じ鍵は同時に1回だけ書く） */
function writeOnce(id: string, familyId: string, today: string, make: () => Promise<Advice>): Promise<Advice> {
  let p = inflight.get(id);
  if (!p) {
    p = make().then((a) => put<Advice>(familyId, "advice", a, { id, date: today }).data);
    inflight.set(id, p);
    p.finally(() => inflight.delete(id)).catch(() => {});
  }
  return p;
}

/** 見渡す時期の気づき（見つかって、閉じていない物だけ）。まだ見渡していなければ裏で始めて null */
function lookTrigger(input: AdvisorInput, h: Awaited<ReturnType<typeof familyFor>>): Trigger | null {
  // 静かにする間は見渡さない（Claude も呼ばない。生まれる前提・育つ前提の気づきを書かせない）
  if (input.family.situation?.quiet) return null;
  const bucket = lookBucket(input.family, input.today);
  if (!bucket) return null;
  const key = `look:${bucket}`;
  const id = adviceId(input.family.id, key);
  const have = get<Advice>(id)?.data;
  if (!have) {
    // 見渡すのは書ける人が開いた時だけ（送る同意も sendingAs の中で確かめる）
    if (h.can("record:write") && h.can("claude:send")) {
      const keep = getKeep(input.family.id);
      writeOnce(id, input.family.id, input.today, () => sendingAs(h.who, () => lookAround(input, keep, key))).catch(() => {});
    }
    return null;
  }
  if (have.none || have.dismissedAt) return null;
  return { kind: "look", key, priority: 9, facts: have.facts };
}

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const h = await familyFor(req, q.get("familyId"), "record:read");
  const family = h.family;
  // 「わかった」で閉じた気づき（新しく閉じた順に10まで）。今日の画面の「済んだ事」の下で、文面ごともう一度開く（見直し C10③。Claude は呼ばない）
  if (q.get("closed") === "1") {
    const closed = list<Advice>(family.id, "advice", { limit: 200 })
      .map((d) => d.data)
      .filter((a) => a.dismissedAt && !a.none)
      .sort((a, b) => (b.dismissedAt ?? "").localeCompare(a.dismissedAt ?? ""))
      .slice(0, 10)
      .map((a) => shownAdvice(adviceIn(a, family, langOf(req)), adviceSender(a.kind, family), family));
    return { closed };
  }
  const today = q.get("today");
  if (!isDay(today)) throw new HttpError(400, "今日の日付が読めません");

  // 手帳の記録（接種・健診）で済んだ物も足す（今日の画面と同じ集合）
  const done = doneSetFor(family, today);
  const records = listRecords(family.id, { limit: 40 })
    .filter((r) => !r.date || r.date.slice(0, 10) <= today)
    .slice(0, 5)
    .map((r) => ({ date: r.date, kind: r.data.kind, title: r.data.title, who: r.data.who }));
  const input = { family, today, done, isDemo: isDemoLike(family.id), records };

  const open = detectTriggers(input).filter((x) => !get<Advice>(adviceId(family.id, x.key))?.data.dismissedAt);
  // 決まりのきっかけが無い時だけ、見渡した気づきを足す
  if (!open.length) {
    const look = lookTrigger(input, h);
    if (look) open.push(look);
  }
  if (q.get("peek") === "1") return { open: open.length };
  const t = open[0];
  if (!t) return { advice: null, waiting: 0 };

  const id = adviceId(family.id, t.key);
  let advice = get<Advice>(id)?.data;
  let cached = !!advice;
  if (!advice) {
    // まだ書いていない気づきは Claude に書かせる。書けない人（読むだけの祖父母など）には、書いてある物だけを出す
    if (!h.can("record:write") || !h.can("claude:send")) return { advice: null, waiting: open.length };
    cached = inflight.has(id);
    advice = await writeOnce(id, family.id, today, () => sendingAs(h.who, () => writeAdvice(t, input, getKeep(family.id))));
  }
  // 決まりで書いた気づきは、頼みの言葉で組み直す（DB は日本語のまま）
  return { ...shownAdvice(adviceIn(advice, family, langOf(req)), t.from, family), cached, waiting: open.length - 1 };
});

/**
 * 画面へ返す気づき（DB の気づきは書いたまま）:
 * - 送る人の名前・町名・会社名など、分かる【 】は埋める
 * - 職場あてのメールは、送る人の職場の上司のメールを宛先に入れる（見直し C09: 家族のほかの人の上司のメールを入れない）
 */
function shownAdvice(advice: Advice, from: Trigger["from"] | undefined, family: Family): { advice: Advice; mailTo?: string; from?: string } {
  const keep = getKeep(family.id);
  const work = workOf(keep, family, from?.memberId);
  const mailTo = advice.message?.via === "mail" && /職場|上司|人事/.test(advice.message.to) ? (work?.email ?? work?.hrEmail) : undefined;
  const sender = from ? keep.names?.[from.memberId] || from.name : null;
  const fill = (x: string) => fillFamilyBlanks(fillBlanks(x, keep, { writer: sender, work }), family, { writer: sender, names: keep.names });
  const shown: Advice = advice.message ? { ...advice, message: { ...advice.message, body: fill(advice.message.body), subject: advice.message.subject && fill(advice.message.subject) } } : advice;
  return { advice: shown, mailTo, from: sender ?? undefined };
}

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; key?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  if (typeof b.key !== "string" || !b.key || b.key.length > 300) throw new HttpError(400, "気づきの鍵が読めません");
  const id = adviceId(family.id, b.key);
  if (!get<Advice>(id)) throw new HttpError(404, "その気づきが見つかりません");
  patch<Advice>(id, { dismissedAt: new Date().toISOString() });
  return { ok: true };
});
