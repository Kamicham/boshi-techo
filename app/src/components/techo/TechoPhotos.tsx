"use client";

// 手帳の記録の右に置く小さな写真の枠（できた日・出産・気持ち・成長のページ）。紙の手帳の見開き（左に記録・右に写真）を引き継ぐ。
// 結び先の正本は写真の側（media の links.techoIds）。手帳の記録の型は変えない。
// 「📷 この日の写真」から足した写真は、その記録に結ばれる。Claude には見せない。
// 写真の仕組みが使えない置き場（ログインの前・アカウントの表がまだ無い）では、何も出さない。
import Link from "next/link";
import { useRef, useState } from "react";
import { KeepSheet } from "@/components/album/KeepSheet";
import { useMedia } from "@/components/album/useMedia";

export function PhotoSlot({ techoIds, compact }: { techoIds: string[]; compact?: boolean }) {
  const { media, unavailable, loading, canWrite } = useMedia();
  const input = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[] | null>(null);
  if (unavailable || loading || !techoIds.length) return null;
  const ids = new Set(techoIds);
  const mine = media.filter((m) => m.techoIds.some((t) => ids.has(t)));
  const first = mine[0];
  const size = compact ? "h-11 w-11" : "h-16 w-16";
  return (
    <div className="flex shrink-0 flex-col items-center gap-1">
      {first ? (
        <Link href={`/album?photo=${encodeURIComponent(first.id)}`} className={`relative block ${size} overflow-hidden rounded-lg border border-line`} aria-label="この日の写真を見る">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={first.urls.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
          {mine.length > 1 && <span className="absolute right-0 bottom-0 rounded-tl-md bg-ink/70 px-1 text-xs text-white">+{mine.length - 1}</span>}
        </Link>
      ) : canWrite ? (
        <button
          type="button"
          onClick={() => input.current?.click()}
          className={`flex ${compact ? "min-h-11 px-2 text-xs" : `${size} flex-col text-xs`} items-center justify-center gap-0.5 rounded-lg border border-dashed border-ok/60 text-ok`}
        >
          <span aria-hidden>📷</span>
          <span>{compact ? "写真" : "この日の写真"}</span>
        </button>
      ) : null}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        data-keep="techo"
        onChange={(e) => {
          const xs = [...(e.target.files ?? [])].slice(0, 20);
          e.target.value = "";
          if (xs.length) setFiles(xs);
        }}
      />
      {files && <KeepSheet files={files} techoId={techoIds[0]} onClose={() => setFiles(null)} />}
    </div>
  );
}
