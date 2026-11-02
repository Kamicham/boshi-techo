// 済んだ事の記録（done:<家族>:<milestoneId>）。/api/done と、下書きの「送った」の印の両方から使う。
// 下書きの印から付けた済みには auto: "draft" を付け、家族が自分で押した済みと分ける
// （印を外した時に消すのは auto の物だけ。自分で押した済みは残す）。
import "server-only";
import { get, put, remove } from "@/lib/db";

export interface DoneData {
  milestoneId: string;
  /** 押した時の「今日」（デモの時計を含む） */
  today?: string;
  at: string;
  /** 自分で押した済みには無い。下書きの印から付けた時は "draft" */
  auto?: "draft";
}

export const doneId = (familyId: string, milestoneId: string) => `done:${familyId}:${milestoneId}`;

/** 家族が自分で済みにする（下書きから付いた済みも、自分で押した物に置き換える） */
export function markDone(familyId: string, milestoneId: string, today?: string): void {
  put<DoneData>(familyId, "done", { milestoneId, today, at: new Date().toISOString() }, { id: doneId(familyId, milestoneId), date: today ?? null });
}

/** 下書きに「送った」などの印を付けた時: まだ済みでなければ済みにする */
export function markDoneFromDraft(familyId: string, milestoneId: string, today?: string): void {
  if (get<DoneData>(doneId(familyId, milestoneId))) return;
  put<DoneData>(familyId, "done", { milestoneId, today, at: new Date().toISOString(), auto: "draft" }, { id: doneId(familyId, milestoneId), date: today ?? null });
}

/** 下書きの印を外した時: 印から付いた済みだけを外す */
export function clearDoneFromDraft(familyId: string, milestoneId: string): void {
  const d = get<DoneData>(doneId(familyId, milestoneId));
  if (d?.data.auto === "draft") remove(d.id);
}

export function removeDone(familyId: string, milestoneId: string): void {
  remove(doneId(familyId, milestoneId));
}
