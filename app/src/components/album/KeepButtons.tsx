"use client";

// 「🌸 残す」の入口: いま撮る（カメラ）／写真から選ぶ（何枚でも）。
// 紙を Claude に読ませる「撮る」とは、名前・色・道（/api/media）を分ける。ここから Claude には何も送らない。
// capture を付けるとカメラロールから選べなくなるので、ボタンを2つに分ける（MDN 2025）。
import { useRef, useState } from "react";
import { KeepSheet } from "./KeepSheet";
import { useMedia } from "./useMedia";

export function KeepButtons({ techoId, compact, highlight }: { techoId?: string; compact?: boolean; highlight?: boolean }) {
  const camera = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  // 写真の仕組みが使えない手帳（ログインの前・アカウントの表がまだ無い置き場）では、押せない事を先に言う
  const { unavailable } = useMedia();
  const take = (list: FileList | null) => {
    const xs = [...(list ?? [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)).slice(0, 50);
    if (xs.length) setFiles(xs);
  };
  if (unavailable) {
    return (
      <section aria-label="残す" className="flex flex-col gap-0.5 rounded-3xl border-2 border-dashed border-ok/30 p-4">
        <p className="font-display text-lg font-bold text-ok/70">🌸 残す（準備中）</p>
        <p className="text-sm text-muted">写真は家族のアカウントで守って残します。この手帳では、まだ使えません</p>
      </section>
    );
  }
  const btn = "flex min-h-12 flex-1 items-center justify-center gap-1 rounded-2xl border-2 border-ok/60 bg-card px-3 text-base font-semibold text-ok";
  return (
    <>
      <section aria-label="残す" className={`flex flex-col gap-2 rounded-3xl border-2 border-ok/40 bg-ok/5 p-4 ${highlight ? "ring-4 ring-ok/30" : ""}`}>
        {!compact && (
          <div className="flex flex-col gap-0.5">
            <p className="font-display text-xl font-bold text-ok">🌸 残す</p>
            <p className="text-sm text-muted">写真を手帳に残します。この家族の置き場（鍵つき）だけに置き、Claude には見せません</p>
          </div>
        )}
        <div className="flex gap-2">
          <button type="button" className={btn} onClick={() => camera.current?.click()}>
            いま撮る
          </button>
          <button type="button" className={btn} onClick={() => pick.current?.click()}>
            写真から選ぶ
          </button>
        </div>
      </section>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        data-keep="camera"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={pick}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-keep="pick"
        onChange={(e) => {
          take(e.target.files);
          e.target.value = "";
        }}
      />
      {files && <KeepSheet files={files} techoId={techoId} onClose={() => setFiles(null)} />}
    </>
  );
}
