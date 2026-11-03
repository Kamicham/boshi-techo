"use client";

// 手帳の記録1件。値は書いてあるまま並べるだけ（良し悪しの言葉は付けない）。
import { Pill } from "@/components/ui";
import { isPhotoPage } from "@/lib/media-shared";
import { jpDay, SOURCE_LABEL, valueLines } from "./labels";
import { PhotoSlot } from "./TechoPhotos";
import type { TechoItem } from "./useTecho";

export function EntryCard({ item, children }: { item: TechoItem; children?: React.ReactNode }) {
  const lines = valueLines(item.values);
  const text = typeof item.values.text === "string" ? item.values.text : "";
  // できた日・出産・気持ち・成長のページは、記録の右に小さな写真の枠（紙の手帳の見開き）
  const photo = !item.pending && isPhotoPage(item.page);
  return (
    <article className={`flex gap-2 rounded-xl border px-3 py-2 ${item.pending ? "border-warn/40 bg-warn/5" : "border-line bg-paper"}`}>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
          <span>{jpDay(item.date)}</span>
          {item.who && <span>{item.who}</span>}
          <Pill tone={item.pending ? "warn" : "muted"}>{item.pending ? "まだ OK していません" : SOURCE_LABEL[item.source]}</Pill>
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
        {item.note && <p className="text-sm text-muted">元の言葉: {item.note}</p>}
        {children}
      </div>
      {photo && <PhotoSlot techoIds={[item.id]} />}
    </article>
  );
}
