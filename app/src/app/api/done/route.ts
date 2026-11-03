// 済んだ事（milestone id）: 家族の一覧（GET）・済みにする（POST）・戻す（DELETE）。
// 形は { milestoneId, at }。family-plan もこの形で読む。
// 下書きに「送った」などの印を付けると、その事も済みになる（auto: "draft"。印を外すと済みも外れる）。
// 手帳の記録（予防接種・乳幼児健診）からも済みを合成して足す（fromTecho。DB には書かないので、DELETE では外れない。手帳の記録を消すと外れる）。
import { body, route } from "@/lib/api";
import { list } from "@/lib/db";
import { HttpError } from "@/lib/family";
import { familyFor } from "../_lib/household";
import { doneFromTechoFor, markDone, removeDone, type DoneData } from "./_lib/done";

function milestoneOf(v: unknown): string {
  if (typeof v !== "string" || !/^[a-zA-Z0-9_-]{1,80}$/.test(v)) throw new HttpError(400, "済んだ事の id が読めません");
  return v;
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
    /** 下書きの印から済みになった事（自分で押した物と見分けたい画面のため） */
    fromDraft: docs.filter((d) => d.data.auto === "draft").map((d) => d.data.milestoneId),
  };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string; today?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const milestoneId = milestoneOf(b.milestoneId);
  const today = typeof b.today === "string" && /^\d{4}-\d{2}-\d{2}$/.test(b.today) ? b.today : undefined;
  markDone(family.id, milestoneId, today);
  return { ok: true, milestoneId };
});

export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; milestoneId?: string }>(req);
  const { family } = await familyFor(req, b.familyId, "record:write");
  const milestoneId = milestoneOf(b.milestoneId);
  removeDone(family.id, milestoneId);
  return { ok: true, milestoneId };
});
