// /api/capture の道で共通に使う小さな道具。
import "server-only";
import { isDate } from "@/lib/capture";
import { HttpError } from "@/lib/family";

/** 画面から来た「今日」（デモは早送りした日）。無ければ日本時間の今日 */
export function todayOf(v: unknown): string {
  if (v == null || v === "") return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  if (!isDate(v)) throw new HttpError(400, "今日の日付が読めません");
  return v;
}
