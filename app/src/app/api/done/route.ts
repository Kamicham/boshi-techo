// 済んだ事（milestone id）: 家族の一覧（GET）・済みにする（POST）・戻す（DELETE）・済ませた人へありがとう（PATCH）。
// 形は { milestoneId, at, by?, thanks? }。family-plan もこの形で読む（by・thanks の無い 11/5 より前の記録もそのまま読める）。
// 下書きに「送った」などの印を付けると、その事も済みになる（auto: "draft"。印を外すと済みも外れる）。
// 手帳の記録（予防接種・乳幼児健診）からも済みを合成して足す（fromTecho。DB には書かないので、DELETE では外れない。手帳の記録を消すと外れる）。
import { body, route } from "@/lib/api";
import { list } from "@/lib/db";
import { HttpError } from "@/lib/family";
import { familyFor } from "../_lib/household";
import type { Family } from "@/lib/demo-family";
import { doneFromTechoFor, markDone, markStartedLateOpen, removeDone, thankDone, vaxRetimeFor, type DoneData } from "./_lib/done";

function milestoneOf(v: unknown): string {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new HttpError(400, "済んだ事の id が読めません");
  return v;
}

/** 家族の一人の id か（済んだにした人・ありがとうを送った人）。違えば undefined */
function memberOf(family: Family, v: unknown): string | undefined {
  return typeof v === "string" && family.members.some((m) => m.id === v) ? v : undefined;
}

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family } = await familyFor(req, q.get("familyId"), "record:read");
  // 画面の「今日」（時計を進めた家族はその日）。無ければ doneFromTechoFor が決める
  const t = q.get("today");
  const today = t && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : undefined;
  const docs = list<DoneData>(family.id, "done").filter((d) => typeof d.data.milestoneId === "string");
  const own = docs.map((d) => d.data.milestoneId);
  const fromTecho = doneFromTechoFor(family, today);
  return {
    done: [...new Set([...own, ...fromTecho])],
    /** 手帳の記録から済みになった事（画面が「手帳で済み」と出す。DELETE では外れない） */
    fromTecho,
    /** 済んだにした日（押した時の「今日」。お金の手続きの届く見込みを数える。lib/money.ts） */
    doneOn: Object.fromEntries(docs.map((d) => [d.data.milestoneId, d.data.today ?? d.data.at.slice(0, 10)])),
    /** 下書きの印から済みになった事（自分で押した物と見分けたい画面のため） */
    fromDraft: docs.filter((d) => d.data.auto === "draft").map((d) => d.data.milestoneId),
    /** 始める前に期限が過ぎて済みにした事（open: まだと答えた） */
    startedLate: docs.filter((d) => d.data.auto === "started-late" || d.data.auto === "started-late-open").map((d) => ({ id: d.data.milestoneId, open: d.data.auto === "started-late-open" })),
    /** 予防接種の次の回の打てる最短日（手帳の接種の日付から数え直した物。表の日より遅い時だけ） */
    retime: vaxRetimeFor(family, today),
    /** 済んだにした家族の一人（分かる物だけ。11/5 より前の記録には無い） */
    doneBy: Object.fromEntries(docs.filter((d) => d.data.by && !d.data.auto).map((d) => [d.data.milestoneId, d.data.by!])),
    /** 済ませた人へ届いたありがとう */
    thanks: Object.fromEntries(docs.filter((d) => d.data.thanks && d.data.by && !d.data.auto).map((d) => [d.data.milestoneId, d.data.thanks!])),
  };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string; open?: boolean; by?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const milestoneId = milestoneOf(b.milestoneId);
  const today = typeof b.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : undefined;
  // 始める前の事に「まだ」: 予定の並びには戻さず、「始める前の事」に出し続ける
  if (b.open) markStartedLateOpen(family.id, milestoneId, today);
  else markDone(family.id, milestoneId, today, memberOf(family, b.by));
  return { ok: true, milestoneId };
});

/** 済ませた家族の一人へ、ありがとうを送る（{ familyId, milestoneId, by: 送る人, today }） */
export const PATCH = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; by?: string; today?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const milestoneId = milestoneOf(b.milestoneId);
  const by = memberOf(family, b.by);
  if (!by) throw new HttpError(400, "ありがとうを送る人が、家族の中に見つかりません");
  const today = typeof b.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : undefined;
  return { ok: true, milestoneId, thanks: thankDone(family.id, milestoneId, by, today) };
});

export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const milestoneId = milestoneOf(b.milestoneId);
  removeDone(family.id, milestoneId);
  return { ok: true, milestoneId };
});
