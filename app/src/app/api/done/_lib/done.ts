// 済んだ事の記録（done:<家族>:<milestoneId>）。/api/done と、下書きの「送った」の印の両方から使う。
// 下書きの印から付けた済みには auto: "draft" を付け、家族が自分で押した済みと分ける
// （印を外した時に消すのは auto の物だけ。自分で押した済みは残す）。
import "server-only";
import { get, list, put, remove } from "@/lib/db";
import { HttpError } from "@/lib/http-error";
import type { Family } from "@/lib/demo-family";
import { listTecho } from "@/lib/techo-store";
import { doneFromTecho, vaxHistory } from "@/lib/techo-done";
import { vaxRetime, type Retime } from "@/lib/vax-next";
import { scheduleFor } from "@/lib/milestones";
import { isMadeFamily } from "@/lib/techo-seed";

export interface DoneData {
  milestoneId: string;
  /** 押した時の「今日」（デモの時計を含む） */
  today?: string;
  at: string;
  /**
   * 自分で押した済みには無い。下書きの印から付けた時は "draft"。
   * 途中から使い始めた家族で、始める前に期限が過ぎた事は "started-late"（済んでいるかを「いま」で聞く）、
   * そこで「まだ」と答えた事は "started-late-open"（予定の並びには戻さず、「始める前の事」の1枚に出し続ける）
   */
  auto?: "draft" | "started-late" | "started-late-open";
  /**
   * 済んだにした家族の一人（家族の設定の members の id）。11/5 より前の記録・下書きや始める前の事から付いた済みには無い
   * （誰か分からない済みには、ありがとうを出さない）
   */
  by?: string;
  /** 済ませた人へ届いたありがとう（1つ。送った人・押した時の「今日」・時刻）。11/5 より前の記録には無い */
  thanks?: { by: string; today?: string; at: string };
}

export const doneId = (familyId: string, milestoneId: string) => `done:${familyId}:${milestoneId}`;

/** 家族が自分で済みにする（下書きから付いた済みも、自分で押した物に置き換える）。by は押した家族の一人（分かる時） */
export function markDone(familyId: string, milestoneId: string, today?: string, by?: string): void {
  const prev = get<DoneData>(doneId(familyId, milestoneId))?.data;
  // 同じ人が押し直しても、届いたありがとうは消さない
  const kept = prev && !prev.auto && prev.by === by && prev.thanks ? { thanks: prev.thanks } : {};
  put<DoneData>(familyId, "done", { milestoneId, today, at: new Date().toISOString(), ...(by ? { by } : {}), ...kept }, { id: doneId(familyId, milestoneId), date: today ?? null });
}

/**
 * 済ませた人へ、ありがとうを送る（済ませた人とは別の家族の一人から。1つだけで、送り直すと新しい方）。
 * 誰が済ませたか分からない記録（11/5 より前の記録・下書きや始める前の事から付いた済み）には送れない
 */
export function thankDone(familyId: string, milestoneId: string, by: string, today?: string): NonNullable<DoneData["thanks"]> {
  const d = get<DoneData>(doneId(familyId, milestoneId));
  if (!d) throw new HttpError(404, "済んだ記録が見つかりません");
  if (!d.data.by || d.data.auto) throw new HttpError(400, "誰が済ませたか分からない記録には、ありがとうを送れません");
  if (d.data.by === by) throw new HttpError(400, "自分が済ませた事には送れません");
  const thanks = { by, ...(today ? { today } : {}), at: new Date().toISOString() };
  put<DoneData>(familyId, "done", { ...d.data, thanks }, { id: d.id, date: d.date });
  return thanks;
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

/** 始める前の事に「まだ」と答えた */
export function markStartedLateOpen(familyId: string, milestoneId: string, today?: string): void {
  const d = get<DoneData>(doneId(familyId, milestoneId));
  if (d?.data.auto !== "started-late") return;
  put<DoneData>(familyId, "done", { ...d.data, auto: "started-late-open", today: today ?? d.data.today }, { id: d.id, date: today ?? null });
}

export function removeDone(familyId: string, milestoneId: string): void {
  remove(doneId(familyId, milestoneId));
}

// ───────── 手帳の記録から合成する済み（lib/techo-done.ts） ─────────

/** 日本時間の今日 */
const jstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/**
 * 時計を進められる家族（作った家族＝デモ・30家族・1000組）。画面の「今日」はその端末の時計なので、サーバは知らない。
 * id の頭の文字ではなく、作った家族の固定の形（techo-seed の isMadeFamily）で決める（本物の世帯が時計を進める側に落ちない）
 */
const timeTravel = (id: string) => isMadeFamily(id);

/**
 * 手帳の記録（予防接種・乳幼児健診）から済みになる予定の id。DB の done には書かない（毎回合成する。手帳の記録を消せば済みも外れる）。
 * today: 画面の「今日」（クエリの today）。
 * - 渡された時: その日までの記録（作った家族は、その日の時点の作った記録も混ぜる）
 * - 渡されない時: わが家は日本時間の今日。時計を進められる家族は、作った記録は混ぜず、家族が自分で足した記録だけを日付で切らずに読む
 *   （端末の時計がわからないまま作った記録を混ぜると、早送りの前の日に、まだ受けていない接種が済みに見えるため）
 */
export function doneFromTechoFor(family: Family, today?: string): string[] {
  let docs;
  let cut: string;
  if (today) {
    docs = listTecho(family.id, { family, today });
    cut = today;
  } else if (timeTravel(family.id)) {
    docs = listTecho(family.id);
    cut = "9999-12-31";
  } else {
    cut = jstToday();
    docs = listTecho(family.id, { family, today: cut });
  }
  return [...doneFromTecho(docs.map((d) => d.data), cut)];
}

/** 予防接種の次の回を、手帳の接種の日付から数え直す（予定の id → 打てる最短日。第1波⑥） */
export function vaxRetimeFor(family: Family, today?: string): Record<string, Retime> {
  const cut = today ?? (timeTravel(family.id) ? "9999-12-31" : jstToday());
  const docs = today || !timeTravel(family.id) ? listTecho(family.id, { family, today: cut }) : listTecho(family.id);
  return vaxRetime(vaxHistory(docs.map((d) => d.data), cut), scheduleFor(family, today));
}

/** DB の済み＋手帳から合成した済み（今日の画面・参謀・健診のタブが同じ「済み」を見るため） */
export function doneSetFor(family: Family, today?: string): Set<string> {
  const db = list<DoneData>(family.id, "done").map((d) => d.data.milestoneId).filter((x): x is string => typeof x === "string");
  return new Set([...db, ...doneFromTechoFor(family, today)]);
}
