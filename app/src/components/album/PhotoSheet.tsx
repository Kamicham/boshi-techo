"use client";

// 写真1枚の画面: 大きく見る・一言・★・結ぶ先・日付を直す・一冊に入れない・ゴミ箱へ。Claude は使わない。
import { useEffect, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import type { TechoItem } from "@/components/techo/useTecho";
import { t } from "@/lib/i18n";
import { isPhotoPage, keptLine, type ClientMedia } from "@/lib/media-shared";
import { dot } from "@/lib/memory-words";
import { patchMedia, trashMedia } from "./useMedia";

// 日本語のまま持ち、出す時に t() を通す（辞書は lib/i18n/dict/album.ts）
const FROM: Record<NonNullable<ClientMedia["takenAtFrom"]>, string> = {
  exif: "写真に入っていた撮った日",
  file: "ファイルの日付",
  upload: "残した日（撮った日が分からなかった）",
  manual: "家族が直した日",
};

export function PhotoSheet({ photo, techo, canWrite, onClose }: { photo: ClientMedia; techo: TechoItem[]; canWrite: boolean; onClose: () => void }) {
  const { family, today, me } = useFamily();
  const [m, setM] = useState(photo);
  const [caption, setCaption] = useState(photo.caption ?? "");
  const [date, setDate] = useState(photo.date);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setM(photo);
    setCaption(photo.caption ?? "");
    setDate(photo.date);
  }, [photo]);

  const save = async (p: Record<string, unknown>) => {
    setError("");
    setBusy(true);
    try {
      setM(await patchMedia(family.id, m.id, { by: me?.name, today, ...p }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const choices = techo.filter((t) => !t.pending && isPhotoPage(t.page) && t.date === m.date);
  const linked = techo.filter((t) => m.techoIds.includes(t.id));

  return (
    <div role="dialog" aria-modal="true" aria-label={t("写真")} className="fixed inset-0 z-30 flex flex-col bg-ink/90">
      <div className="flex justify-end px-4 pt-3">
        <button type="button" onClick={onClose} className="min-h-11 rounded-full bg-card px-5 text-base font-semibold">
          {t("閉じる")}
        </button>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-2 py-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.urls.view} alt={m.caption ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
      </div>
      <div className="max-h-[55dvh] overflow-y-auto rounded-t-3xl bg-paper px-4 pt-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-md flex-col gap-3">
          {/* 「11月3日・生後3か月・お食い初めのころ」（残した時の一行と同じ。lib/media-shared の keptLine） */}
          <p className="text-base font-semibold">{keptLine(family, m)}</p>
          {m.made && <p className="text-sm text-muted">{t("AI で作った家族と写真です")}</p>}
          {linked.length > 0 && <p className="text-sm text-muted">{t("手帳: {titles}", { titles: linked.map((x) => x.title).join(dot()) })}</p>}
          {canWrite ? (
            <>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={m.starredByMe}
                  disabled={busy}
                  onClick={() => void save({ star: !m.starredByMe })}
                  className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${m.starredByMe ? "border-warn bg-warn/10 text-warn" : "border-line bg-card"}`}
                >
                  {m.starredByMe ? t("★ この1枚") : t("☆ この1枚")}
                  {m.star > (m.starredByMe ? 1 : 0) && <span className="ml-1 font-normal">{t("（ほかに{n}人）", { n: m.star - (m.starredByMe ? 1 : 0) })}</span>}
                </button>
                <button
                  type="button"
                  aria-pressed={m.hidden}
                  disabled={busy}
                  onClick={() => void save({ hidden: !m.hidden })}
                  className={`min-h-11 rounded-full border px-4 text-sm ${m.hidden ? "border-ink bg-ink/10 font-semibold" : "border-line bg-card"}`}
                >
                  {m.hidden ? t("一冊・動画に入れない") : t("一冊・動画に入れる")}
                </button>
              </div>
              <label className="flex flex-col gap-1 text-sm text-muted">
                {t("一言")}
                <input
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onBlur={() => caption !== (m.caption ?? "") && void save({ caption })}
                  placeholder={t("例: はじめてのお散歩")}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-base text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm text-muted">
                {t("撮った日（{from}）", { from: m.takenAtFrom ? t(FROM[m.takenAtFrom]) : t("分からない") })}
                <span className="flex gap-2">
                  <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="min-h-11 flex-1 rounded-lg border border-line bg-card px-3 text-base text-ink" />
                  {date !== m.date && (
                    <Btn kind="secondary" onClick={() => void save({ date })} disabled={busy}>
                      {t("直す")}
                    </Btn>
                  )}
                </span>
              </label>
              {choices.length > 0 && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-muted">{t("この日の手帳の記録に結ぶ")}</p>
                  <div className="flex flex-wrap gap-2">
                    {choices.map((c) => {
                      const on = m.techoIds.includes(c.id);
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={on}
                          disabled={busy}
                          onClick={() => void save({ techoIds: on ? m.techoIds.filter((x) => x !== c.id) : [...m.techoIds, c.id] })}
                          className={`min-h-11 rounded-full border px-3 text-sm ${on ? "border-rose bg-rose-soft font-semibold text-rose" : "border-line bg-card"}`}
                        >
                          {on ? "✓ " : ""}
                          {c.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                <a href={`${m.urls.orig}&download=1`} className="min-h-11 content-center text-sm text-muted underline">
                  {t("元の写真を保存")}
                </a>
                <Btn
                  kind="secondary"
                  disabled={busy}
                  onClick={async () => {
                    if (!window.confirm(t("この写真をゴミ箱に入れますか？（30日たつと消えます。それまではゴミ箱から戻せます）"))) return;
                    try {
                      await trashMedia(family.id, m.id);
                      onClose();
                    } catch (e) {
                      setError((e as Error).message);
                    }
                  }}
                >
                  {t("ゴミ箱へ")}
                </Btn>
              </div>
            </>
          ) : (
            m.caption && <p className="text-base">{m.caption}</p>
          )}
          {error && <p className="text-sm text-alert">{error}</p>}
          <p className="pb-2 text-sm text-muted">{t("Claude には見せていません")}</p>
        </div>
      </div>
    </div>
  );
}
