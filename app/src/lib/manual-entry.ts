// 打って入れる（VISION ①「入力ゼロ、でも押し付けない」2026-11-04）。
// 話す・撮るだけで済む形は保ったまま、打つ方が早い物（数字・日付・時刻・短い一言）は、その場で打てる。
// 打った物は家族が自分で書いた物なので、Claude を通さず、そのまま記録に入れる（候補にしない）。
// ここは決まりだけ（画面とサーバの両方で使う）。保存は lib/capture.ts の addManualRecord。

/** 打って入れられる記録の種類（書類は撮る物なので置かない） */
export const MANUAL_KINDS = ["できごと", "気がかり", "予定", "メモ"] as const;
export type ManualKind = (typeof MANUAL_KINDS)[number];

export interface ManualInput {
  kind?: unknown;
  title?: unknown;
  date?: unknown;
  /** 予定の時刻（HH:MM） */
  time?: unknown;
  /** 予定を期限にする（今日の「やる事」に並ぶ） */
  deadline?: unknown;
  who?: unknown;
}

export interface ManualRecord {
  kind: ManualKind;
  title: string;
  detail: string;
  date: string;
  who?: string;
  isDeadline?: boolean;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export const MANUAL_TITLE_MAX = 80;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

/** 打った物を記録の形に整える。だめな時は家族に見せる言葉を返す */
export function cleanManual(x: ManualInput, today: string): { ok: true; value: ManualRecord } | { ok: false; error: string } {
  const kind = MANUAL_KINDS.find((k) => k === x.kind);
  if (!kind) return { ok: false, error: "何の記録かを選んでください" };
  const title = str(x.title).replace(/\s+/g, " ");
  if (!title) return { ok: false, error: kind === "予定" ? "何の予定かを入れてください" : "ひとことを入れてください" };
  if (title.length > MANUAL_TITLE_MAX) return { ok: false, error: `${MANUAL_TITLE_MAX}字までにしてください` };
  const date = str(x.date) || today;
  if (!DAY.test(date)) return { ok: false, error: "日付が読めません" };
  // 予定だけは先の日を入れられる。ほかは起きた日なので今日まで
  if (kind !== "予定" && date > today) return { ok: false, error: "起きた日は今日までにしてください（先の事は「予定」で）" };
  const time = str(x.time);
  if (time && !TIME.test(time)) return { ok: false, error: "時刻が読めません（例 10:30）" };
  const who = str(x.who).slice(0, 20);
  const value: ManualRecord = {
    kind,
    title: kind === "予定" && time ? `${time} ${title}` : title,
    detail: kind === "予定" && time ? `${time}から` : "",
    date,
    ...(who ? { who } : {}),
    ...(kind === "予定" && x.deadline === true ? { isDeadline: true } : {}),
  };
  return { ok: true, value };
}

/** 体温を記録の形にする（値の良し悪しは言わない。打ち間違いだけを止める） */
export function temperatureRecord(raw: string, date: string, today: string, who?: string): { ok: true; value: ManualRecord } | { ok: false; error: string } {
  const n = Number(raw.trim().replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0)));
  if (!Number.isFinite(n) || n < 30 || n > 45) return { ok: false, error: "体温は 36.5 のように数字で入れてください" };
  return cleanManual({ kind: "メモ", title: `体温 ${n.toFixed(1)}℃`, date, who }, today);
}
