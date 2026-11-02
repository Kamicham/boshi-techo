"use client";

// 記録の時系列: これからの予定と、これまでの記録（どちらも畳んでおく）
import { clockAt } from "@/lib/clock";
import type { CaptureRecord, RecordKind, RecordSource } from "@/lib/capture";
import type { Family } from "@/lib/demo-family";
import { jpDate } from "@/components/Techo";
import { Countdown, daysUntil, Fold, HandoffRow, Pill } from "@/components/ui";

const KIND_TONE: Record<RecordKind, "warn" | "rose" | "sky" | "muted"> = {
  気がかり: "warn",
  できごと: "rose",
  予定: "sky",
  書類: "muted",
  メモ: "muted",
};

/** 急ぎに見えた記録に添える固定の文（Claude の言葉ではなく、いつも同じ文） */
export const URGENT_NOTE = "急ぎの時はかかりつけの産院へ電話（夜間も）。迷ったら119";

const SOURCE_LABEL: Record<RecordSource, string> = { voice: "話した", photo: "撮った", text: "書いた" };

const dateOf = (r: CaptureRecord) => r.date ?? r.createdAt.slice(0, 10);

export function RecordItem({ r, family, today }: { r: CaptureRecord; family: Family; today: string }) {
  const date = dateOf(r);
  const ahead = date > today && (r.data.kind === "予定" || r.data.isDeadline);
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={r.data.isDeadline ? "alert" : KIND_TONE[r.data.kind] ?? "muted"}>{r.data.isDeadline ? "期限" : r.data.kind}</Pill>
        {ahead ? <Countdown days={daysUntil(today, date)} dateLabel={jpDate(date)} size="sm" /> : <span className="tabular text-sm text-muted">{jpDate(date)}</span>}
      </div>
      <p className="text-base leading-snug font-semibold">{r.data.title}</p>
      {r.data.detail && <p className="line-clamp-2 text-sm leading-relaxed text-ink/90">{r.data.detail}</p>}
      {r.data.urgent && (
        <p role="note" className="rounded-lg bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
          {URGENT_NOTE}
        </p>
      )}
      {ahead && <HandoffRow calendar={{ title: r.data.title, date, details: r.data.detail }} />}
      <p className="text-xs text-muted">
        {clockAt(family, date).label}・{SOURCE_LABEL[r.data.source] ?? "記録"}
        {r.data.who ? `・${r.data.who}` : ""}
        {r.data.seed ? "・デモ用" : ""}
      </p>
    </li>
  );
}

export function Timeline({ records, family, today, isDemo }: { records: CaptureRecord[]; family: Family; today: string; isDemo: boolean }) {
  const upcoming = records.filter((r) => dateOf(r) > today && r.data.kind === "予定").sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  // デモは早送りした「今日」より先のできごとを見せない（まだ起きていない）
  const past = records.filter((r) => dateOf(r) <= today || (!isDemo && r.data.kind !== "予定"));

  return (
    <>
      {upcoming.length > 0 && (
        <Fold title="これからの予定" count={upcoming.length}>
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 6).map((r) => (
              <RecordItem key={r.id} r={r} family={family} today={today} />
            ))}
          </ul>
        </Fold>
      )}
      {past.length > 0 ? (
        <Fold title="これまでの記録" count={past.length}>
          <ul className="flex flex-col gap-2">
            {past.slice(0, 40).map((r) => (
              <RecordItem key={r.id} r={r} family={family} today={today} />
            ))}
          </ul>
        </Fold>
      ) : (
        <p className="text-sm text-muted">話すか撮ると、ここに日付つきで並びます</p>
      )}
    </>
  );
}
