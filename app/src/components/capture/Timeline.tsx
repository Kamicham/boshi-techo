"use client";

// 記録の時系列: これからの予定と、これまでの記録
import { clockAt } from "@/lib/clock";
import type { CaptureRecord, RecordKind, RecordSource } from "@/lib/capture";
import type { Family } from "@/lib/demo-family";
import { jpDate } from "@/components/Techo";

export const KIND_STYLE: Record<RecordKind, string> = {
  気がかり: "bg-warn/15 text-warn",
  できごと: "bg-rose-soft text-rose",
  予定: "bg-sky-soft text-sky",
  書類: "bg-line text-ink",
  メモ: "bg-paper text-muted border border-line",
};

/** 急ぎに見えた記録に添える固定の文（Claude の言葉ではなく、いつも同じ文） */
export const URGENT_NOTE = "急ぎの時はかかりつけの産院へ電話（夜間も）。迷ったら119";

const SOURCE_LABEL: Record<RecordSource, string> = { voice: "話した", photo: "撮った", text: "書いた" };

export function RecordItem({ r, family }: { r: CaptureRecord; family: Family }) {
  const date = r.date ?? r.createdAt.slice(0, 10);
  return (
    <li className="flex flex-col gap-1 rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${KIND_STYLE[r.data.kind] ?? KIND_STYLE.メモ}`}>
          {r.data.isDeadline ? "期限" : r.data.kind}
        </span>
        <span className="tabular text-sky">{jpDate(date)}</span>
        <span className="text-muted">{clockAt(family, date).label}</span>
      </div>
      <p className="font-semibold leading-snug">{r.data.title}</p>
      {r.data.detail && <p className="text-sm leading-relaxed text-ink/90">{r.data.detail}</p>}
      {r.data.urgent && (
        <p role="note" className="rounded-lg bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
          {URGENT_NOTE}
        </p>
      )}
      <p className="text-xs text-muted">
        {SOURCE_LABEL[r.data.source] ?? "記録"}
        {r.data.who ? `・${r.data.who}` : ""}
        {r.data.seed ? "・デモ用の作った記録" : ""}
      </p>
    </li>
  );
}

export function Timeline({ records, family, today, isDemo }: { records: CaptureRecord[]; family: Family; today: string; isDemo: boolean }) {
  const dateOf = (r: CaptureRecord) => r.date ?? r.createdAt.slice(0, 10);
  const upcoming = records.filter((r) => dateOf(r) > today && r.data.kind === "予定").sort((a, b) => dateOf(a).localeCompare(dateOf(b)));
  // デモは早送りした「今日」より先のできごとを見せない（まだ起きていない）
  const past = records.filter((r) => dateOf(r) <= today || (!isDemo && r.data.kind !== "予定"));

  return (
    <>
      {upcoming.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-lg font-bold">
            これからの予定 <span className="tabular text-sm font-normal text-muted">{upcoming.length}件</span>
          </h2>
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 6).map((r) => (
              <RecordItem key={r.id} r={r} family={family} />
            ))}
          </ul>
        </section>
      )}
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-lg font-bold">
          これまでの記録 <span className="tabular text-sm font-normal text-muted">{past.length}件</span>
        </h2>
        {past.length === 0 && <p className="text-sm text-muted">まだ記録はありません。話すか撮ると、ここに日付つきで並びます。</p>}
        <ul className="flex flex-col gap-2">
          {past.slice(0, 40).map((r) => (
            <RecordItem key={r.id} r={r} family={family} />
          ))}
        </ul>
      </section>
    </>
  );
}
