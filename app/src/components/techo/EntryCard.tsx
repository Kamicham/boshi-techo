"use client";

// 手帳の記録1件。値は書いてあるまま並べるだけ（良し悪しの言葉は付けない）。
// OK した後の記録も消せる（押し間違い・読み違いを戻す）。消す前に1段だけ確かめる（confirm() は使わない）。
// 「消す」と元の言葉は、記録を押して開いた中に出す（UX 2026-11-04: 1件ごとの札とボタンが中身より目立っていた）。
// 見本の家族の記録（seed）には「見本」の札も「作った記録」の元の言葉も付けない（上の帯が見本の家族と言っている）。
import { useState } from "react";
import { Notice, Pill, plainError } from "@/components/ui";
import { isPhotoPage } from "@/lib/media-shared";
import { jpDay, SOURCE_LABEL, valueLines } from "./labels";
import { PhotoSlot } from "./TechoPhotos";
import type { TechoItem } from "./useTecho";

export function EntryCard({
  item,
  children,
  onRemove,
}: {
  item: TechoItem;
  children?: React.ReactNode;
  onRemove?: (ids: string[]) => Promise<void>;
}) {
  const lines = valueLines(item.values);
  const text = typeof item.values.text === "string" ? item.values.text : "";
  // できた日・出産・気持ち・成長のページは、記録の右に小さな写真の枠（紙の手帳の見開き）
  const photo = !item.pending && isPhotoPage(item.page);
  const [open, setOpen] = useState(false);
  const seed = item.source === "seed";
  const note = item.note && !seed ? item.note : "";
  // 開いて出す物（元の言葉・消す）がある時だけ、押して開ける
  const canOpen = !item.pending && (!!note || !!onRemove);
  return (
    <article
      className={`flex gap-2 rounded-xl border px-3 py-2 ${item.pending ? "border-sky/30 bg-sky-soft/60" : "border-line bg-paper"}`}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{jpDay(item.date)}</span>
          {item.who && <span>{item.who}</span>}
          {item.pending ? (
            <Pill tone="sky">候補（OK で手帳に入ります）</Pill>
          ) : (
            !seed && <Pill>{SOURCE_LABEL[item.source]}</Pill>
          )}
          {canOpen && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="-my-2 ml-auto min-h-11 px-2 text-sm text-muted"
            >
              {open ? "閉じる" : "…"}
              <span className="sr-only">
                {open ? "" : "（元の言葉・消す）"}
              </span>
            </button>
          )}
        </div>
        {item.title && <p className="text-base font-semibold">{item.title}</p>}
        {text && <p className="whitespace-pre-wrap text-base">{text}</p>}
        {lines.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-base">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {item.pending && item.note && (
          <p className="text-sm text-muted">元の言葉: {item.note}</p>
        )}
        {children}
        {open && note && <p className="text-sm text-muted">元の言葉: {note}</p>}
        {open && onRemove && (
          <RemoveRow id={item.id} onRemove={onRemove} what={item.title} />
        )}
      </div>
      {photo && <PhotoSlot techoIds={[item.id]} />}
    </article>
  );
}

/** 小さな「消す」→「本当に消す／やめる」 */
export function RemoveRow({
  id,
  onRemove,
  what,
}: {
  id: string;
  onRemove: (ids: string[]) => Promise<void>;
  what?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const go = async () => {
    setBusy(true);
    setError("");
    try {
      await onRemove([id]);
    } catch (e) {
      setError(plainError(e));
      setBusy(false);
    }
  };
  if (!asking) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setAsking(true)}
          aria-label={what ? `「${what}」の記録を消す` : "この記録を消す"}
          className="min-h-11 px-2 text-sm text-muted underline"
        >
          消す
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-sm">
        この記録を手帳から消しますか？（紙の手帳はそのままです）
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy}
          className="min-h-11 rounded-full border border-ink/40 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? "消しています…" : "本当に消す"}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
        >
          やめる
        </button>
      </div>
      {error && (
        <Notice
          title="消せませんでした"
          safe="記録はそのまま残っています。"
          detail={error}
        />
      )}
    </div>
  );
}
