"use client";

// 記録の時系列: これからの予定と、これまでの記録（どちらも畳んでおく）
import { clockAt } from "@/lib/clock";
import type { CaptureRecord, RecordKind, RecordSource } from "@/lib/capture";
import { isLegalDeadline, urgentNoteFor } from "./urgent-note";
import { recordDetailShown, recordTitleShown } from "./record-text";
import type { Family } from "@/lib/demo-family";
import { jpDate } from "@/components/Techo";
import { Countdown, daysUntil, Fold, HandoffRow, Pill } from "@/components/ui";
import { t } from "@/lib/i18n";
import { isMadeId, labelIn } from "@/lib/i18n/names";
import { dot } from "@/lib/memory-words";

const KIND_TONE: Record<RecordKind, "warn" | "rose" | "sky" | "muted"> = {
  気がかり: "warn",
  できごと: "rose",
  予定: "sky",
  書類: "muted",
  メモ: "muted",
};

// 急ぎの記録の電話先・法の期限の見分けは urgent-note.ts（純粋な関数・試験つき）
export { URGENT_NOTE, URGENT_NOTE_BOTH, URGENT_NOTE_CHILD, urgentNoteFor, isLegalDeadline } from "./urgent-note";

/** 入れ方の札（辞書の鍵。描く所で t() で訳す） */
const SOURCE_LABEL: Record<RecordSource, string> = { voice: "話した", photo: "撮った", text: "書いた" };

const dateOf = (r: CaptureRecord) => r.date ?? r.createdAt.slice(0, 10);

export function RecordItem({ r, family, today }: { r: CaptureRecord; family: Family; today: string }) {
  const date = dateOf(r);
  const ahead = date > today && (r.data.kind === "予定" || r.data.isDeadline);
  const days = daysUntil(today, date);
  const legal = isLegalDeadline(r.data);
  // 赤い「期限」は、法の期限で7日以内の時だけ。ほかの期限・予定は落ち着いた色
  const tone = r.data.isDeadline ? (legal && days >= 0 && days <= 7 ? "alert" : "muted") : (KIND_TONE[r.data.kind] ?? "muted");
  return (
    <li className="flex flex-col gap-1.5 rounded-xl border border-line bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone={tone}>{r.data.isDeadline ? t("期限") : t(r.data.kind)}</Pill>
        {!ahead ? (
          <span className="tabular text-sm text-muted">{jpDate(date)}</span>
        ) : legal ? (
          <Countdown days={days} dateLabel={jpDate(date)} size="sm" />
        ) : r.data.isDeadline ? (
          // 法の期限ではない締め切り（支払いなど）: 数えるが、色は付けない
          <span className="tabular text-sm">
            {days === 1 ? t("{date}まで・あした", { date: jpDate(date) }) : t("{date}まで・あと{n}日", { date: jpDate(date), n: days })}
          </span>
        ) : (
          // 予定は始まりの日（「◯日後から」）
          <Countdown days={days} dateLabel={jpDate(date)} size="sm" kind="start" />
        )}
      </div>
      {/* 題と中身は、Claude が読み取った記録・家族が書いた文なので、そのまま出す（アプリが決まった形で書いた所だけ訳す＝record-text.ts） */}
      <p className="text-base leading-snug font-semibold">{recordTitleShown(r.data.title)}</p>
      {r.data.detail && <p className="line-clamp-2 text-sm leading-relaxed text-ink/90">{recordDetailShown(r.data.detail)}</p>}
      {r.data.urgent && (
        <p role="note" className="rounded-lg bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
          {t(urgentNoteFor(r, family))}
        </p>
      )}
      {ahead && <HandoffRow calendar={{ title: recordTitleShown(r.data.title), date, details: r.data.detail && recordDetailShown(r.data.detail) }} />}
      <p className="text-xs text-muted">
        {[clockAt(family, date).label, t(SOURCE_LABEL[r.data.source] ?? "記録"), r.data.who ? labelIn(r.data.who, { made: isMadeId(family.id) }) : "", r.data.seed ? t("デモ用") : ""]
          .filter(Boolean)
          .join(dot())}
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
        <Fold title={t("これからの予定")} count={upcoming.length}>
          <ul className="flex flex-col gap-2">
            {upcoming.slice(0, 6).map((r) => (
              <RecordItem key={r.id} r={r} family={family} today={today} />
            ))}
          </ul>
        </Fold>
      )}
      {past.length > 0 ? (
        <Fold title={t("これまでの記録")} count={past.length}>
          <ul className="flex flex-col gap-2">
            {past.slice(0, 40).map((r) => (
              <RecordItem key={r.id} r={r} family={family} today={today} />
            ))}
          </ul>
        </Fold>
      ) : (
        <p className="text-sm text-muted">{t(upcoming.length === 0 ? "まだありません。話すか撮ると、ここに日付つきで並びます" : "話すか撮ると、ここに日付つきで並びます")}</p>
      )}
    </>
  );
}
