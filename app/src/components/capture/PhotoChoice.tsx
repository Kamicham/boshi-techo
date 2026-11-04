"use client";

// 「撮る」で撮った（選んだ）写真の使い道を選ぶ1画面。
// 選ぶまでは、写真はこの電話の中だけにある（どこにも送らない）。
// - 読み取る: 紙の中身を手帳に写す。写真は Claude に送り、残さない（/api/capture/photo・/api/techo/photo）
// - 残す: 思い出の写真として、この家族の置き場に残す。Claude には見せない（KeepSheet → /api/media）
import { useEffect, useState } from "react";
import { Btn } from "@/components/ui";

export type ReadKind = "paper" | "page";

export function PhotoChoice({
  files,
  hint,
  keepUnavailable,
  onRead,
  onKeep,
  onCancel,
}: {
  files: File[];
  /** 来た所から分かる、たぶんの使い道（光らせるだけ。選ぶのは人） */
  hint?: "page" | "keep" | null;
  keepUnavailable: boolean;
  onRead: (kind: ReadKind) => void;
  onKeep: () => void;
  onCancel: () => void;
}) {
  const [preview, setPreview] = useState<string[]>([]);
  useEffect(() => {
    const urls = files.slice(0, 6).map((f) => URL.createObjectURL(f));
    setPreview(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const one = files.length === 1;
  const readBtn = "flex min-h-12 w-full flex-col items-start justify-center rounded-2xl border-2 border-sky/60 bg-card px-4 py-2 text-left disabled:opacity-50";

  return (
    <section aria-label="写真の使い道" className="flex flex-col gap-3 rounded-3xl border-2 border-line bg-card p-4">
      <div className="flex gap-2 overflow-x-auto">
        {preview.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={u} src={u} alt={`撮った写真 ${i + 1}`} className="h-20 w-20 shrink-0 rounded-xl object-cover" />
        ))}
        {files.length > preview.length && <span className="self-center text-sm text-muted">ほか{files.length - preview.length}枚</span>}
      </div>
      <p className="font-display text-lg font-bold">この写真を、どうしますか</p>

      <div className="flex flex-col gap-2 rounded-2xl bg-sky-soft p-3">
        <p className="font-display text-lg font-bold text-sky">読み取る</p>
        <p className="text-sm text-muted">紙の中身を手帳に写します。写真は読み取りのために Claude に送り、残しません</p>
        {one ? (
          <>
            <button type="button" className={readBtn} onClick={() => onRead("paper")}>
              <span className="text-base font-semibold text-sky">届いた紙・健診の紙</span>
            </button>
            <button type="button" className={`${readBtn} ${hint === "page" ? "ring-4 ring-sky/40" : ""}`} onClick={() => onRead("page")}>
              <span className="text-base font-semibold text-sky">紙の母子手帳のページ</span>
            </button>
          </>
        ) : (
          <p className="text-sm">読み取りは1枚ずつです。1枚だけ選び直してください</p>
        )}
      </div>

      <div className={`flex flex-col gap-2 rounded-2xl bg-ok/5 p-3 ${hint === "keep" ? "ring-4 ring-ok/30" : ""}`}>
        <p className="font-display text-lg font-bold text-ok">🌸 残す</p>
        {keepUnavailable ? (
          <p className="text-sm text-muted">写真は家族のアカウントで守って残します。この手帳では、まだ使えません</p>
        ) : (
          <>
            <p className="text-sm text-muted">思い出の写真として手帳に残します。この家族の置き場（鍵つき）だけに置き、Claude には見せません</p>
            <button type="button" onClick={onKeep} className="flex min-h-12 w-full items-center justify-center rounded-2xl border-2 border-ok/60 bg-card px-4 text-base font-semibold text-ok">
              {one ? "残す" : `${files.length}枚を残す`}
            </button>
          </>
        )}
      </div>

      <Btn kind="quiet" onClick={onCancel}>
        やめる（どこにも送りません）
      </Btn>
    </section>
  );
}
