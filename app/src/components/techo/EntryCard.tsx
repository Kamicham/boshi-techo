"use client";

// 手帳の記録1件。値は書いてあるまま並べるだけ（良し悪しの言葉は付けない）。
// OK した後の記録も消せる（押し間違い・読み違いを戻す）。消す前に1段だけ確かめる（confirm() は使わない）。
// 「消す」と元の言葉は、記録を押して開いた中に出す（UX 2026-11-04: 1件ごとの札とボタンが中身より目立っていた）。
// 見本の家族の記録（seed）には「見本」の札も「作った記録」の元の言葉も付けない（上の帯が見本の家族と言っている）。
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Notice, Pill, plainError } from "@/components/ui";
import { t } from "@/lib/i18n";
import { isMadeId } from "@/lib/i18n/names";
import { isPhotoPage } from "@/lib/media-shared";
import { jpDay, SOURCE_LABEL, techoWords, valueLines, whoIn } from "./labels";
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
  const { family } = useFamily();
  const seed = item.source === "seed";
  // 作った家族の記録は値と本文も訳す（作った言葉）。本物の家族の値は決まった言い方の物だけ（labels.ts）
  const lines = valueLines(item.values, [], seed);
  const raw = typeof item.values.text === "string" ? item.values.text : "";
  // 本文: 作った家族の言葉と、相談の問いの答え（「いるけど頼みにくい」などの決まった答え）は訳す。家族が書いた・話した本文は書いてあるまま
  const text = seed || item.page === "consult" ? t(raw) : raw;
  // できた日・出産・気持ち・成長のページは、記録の右に小さな写真の枠（紙の手帳の見開き）
  const photo = !item.pending && isPhotoPage(item.page);
  const [open, setOpen] = useState(false);
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
          {item.who && <span>{whoIn(item.who, isMadeId(family.id))}</span>}
          {item.pending ? (
            <Pill tone="sky">{t("候補（OK で手帳に入ります）")}</Pill>
          ) : (
            !seed && <Pill>{t(SOURCE_LABEL[item.source])}</Pill>
          )}
          {canOpen && (
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="-my-2 ml-auto min-h-11 px-2 text-sm text-muted"
            >
              {open ? t("閉じる") : "…"}
              <span className="sr-only">
                {open ? "" : t("（元の言葉・消す）")}
              </span>
            </button>
          )}
        </div>
        {item.title && <p className="text-base font-semibold">{techoWords(item.title)}</p>}
        {text && <p className="whitespace-pre-wrap text-base">{text}</p>}
        {lines.length > 0 && (
          <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-base">
            {lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        {item.pending && item.note && (
          <p className="text-sm text-muted">{t("元の言葉: {note}", { note: item.note })}</p>
        )}
        {children}
        {open && note && <p className="text-sm text-muted">{t("元の言葉: {note}", { note })}</p>}
        {open && onRemove && (
          <RemoveRow id={item.id} onRemove={onRemove} what={techoWords(item.title)} />
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
          aria-label={what ? t("「{what}」の記録を消す", { what }) : t("この記録を消す")}
          className="min-h-11 px-2 text-sm text-muted underline"
        >
          {t("消す")}
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2 pt-1">
      <p className="text-sm">
        {t("この記録を手帳から消しますか？（紙の手帳はそのままです）")}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void go()}
          disabled={busy}
          className="min-h-11 rounded-full border border-ink/40 px-4 text-sm font-semibold disabled:opacity-50"
        >
          {busy ? t("消しています…") : t("本当に消す")}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          disabled={busy}
          className="min-h-11 rounded-full border border-line bg-card px-4 text-sm font-semibold"
        >
          {t("やめる")}
        </button>
      </div>
      {error && (
        <Notice
          title={t("消せませんでした")}
          safe={t("記録はそのまま残っています。")}
          detail={error}
        />
      )}
    </div>
  );
}
