"use client";

// 一冊の印刷用ページ（A5）。iPhone の「共有 → プリント」や、Mac のブラウザの「PDF として保存」で PDF にする。
// 並び: 表紙 → はじめに → 章ごとの見開き（左に言葉と出来事、右に写真）→ おわりに。写真が無い章は文だけのページ。
// 印刷を外の会社に頼むかは家族が決める。アプリは外へ送らない。
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { useMedia } from "@/components/album/useMedia";
import { Btn } from "@/components/ui";
import type { Book } from "@/lib/book";
import type { ClientMedia } from "@/lib/media-shared";
import { t } from "@/lib/i18n";
import { dayLong } from "@/lib/memory-words";

const CSS = `
@page { size: 148mm 210mm; margin: 0; }
.sheet { background: #fff; color: #2b2a33; width: 100%; aspect-ratio: 148 / 210; padding: 9% 8%; box-sizing: border-box; display: flex; flex-direction: column; gap: 1rem; overflow: hidden; border: 1px solid var(--line); border-radius: 4px; }
.sheet p { line-height: 2; }
@media print {
  body * { visibility: hidden; }
  .print-root, .print-root * { visibility: visible; }
  .print-root { position: absolute; left: 0; top: 0; width: 148mm; }
  .no-print { display: none !important; }
  .sheet { width: 148mm; height: auto; min-height: 210mm; aspect-ratio: auto; padding: 14mm 12mm; border: 0; border-radius: 0; overflow: visible; break-after: page; }
  .sheet img { break-inside: avoid; }
}
`;

export default function BookPrintPage() {
  const { family, today } = useFamily();
  const { media } = useMedia();
  const [book, setBook] = useState<Book | null>(null);
  const [state, setState] = useState<"load" | "ok" | "none" | "error">("load");
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    api<{ book: Book | null }>(`/api/book?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => {
        if (!alive) return;
        setBook(r.book);
        setState(r.book ? "ok" : "none");
      })
      .catch((e: Error) => {
        if (!alive) return;
        setError(e.message);
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [family.id, today]);

  const photos = new Map<string, ClientMedia>();
  for (const m of media) if (!m.hidden) photos.set(m.id, m);
  const img = (id: string | undefined, v: "view" | "thumb" = "view") => (id ? photos.get(id)?.urls[v] : undefined);

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <style>{CSS}</style>
      <div className="no-print flex flex-col gap-2">
        <Link href="/book" className="inline-flex min-h-11 items-center self-start text-sm text-muted underline-offset-2 hover:underline">
          {t("‹ 一冊へ")}
        </Link>
        <h1 className="font-display text-xl font-bold">{t("印刷用（A5）")}</h1>
        <p className="text-sm text-muted">{t("「印刷・PDF にする」を押し、iPhone は「プリント」、Mac は「PDF として保存」を選びます。写真の会社に印刷を頼む時は、その会社に写真が渡ります。")}</p>
        {state === "ok" && <Btn onClick={() => window.print()}>{t("印刷・PDF にする")}</Btn>}
        {state === "load" && <p className="text-base text-muted">{t("一冊を開いています…")}</p>}
        {state === "none" && <p className="text-base text-muted">{t("まだ一冊がありません。一冊の画面で作ってから開いてください。")}</p>}
        {state === "error" && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}
      </div>

      {book && (
        <div className="print-root flex flex-col gap-4 pb-8">
          <section className="sheet items-center justify-center text-center">
            {img(book.cover) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img(book.cover)} alt="" style={{ maxHeight: "55%", width: "100%", objectFit: "cover", borderRadius: 6 }} />
            )}
            <p style={{ fontSize: 10, letterSpacing: "0.4em", color: "#a84468" }}>{t("1000 日 の 記 録")}</p>
            <h2 className="font-display" style={{ fontSize: 24, fontWeight: 700, lineHeight: 1.4 }}>
              {book.title}
            </h2>
            <p className="font-display">{t("{name}へ", { name: book.childName })}</p>
            <p style={{ fontSize: 10, color: "#6a6876" }}>
              {dayLong(book.range.start)} — {dayLong(book.range.end)}
            </p>
          </section>

          <section className="sheet justify-center">
            <p style={{ textAlign: "center", fontSize: 10, letterSpacing: "0.3em", color: "#6a6876" }}>{t("はじめに")}</p>
            <p className="font-display" style={{ fontSize: 15 }}>
              {book.dedication}
            </p>
          </section>

          {book.chapters.map((ch, i) => {
            const list = (ch.photos ?? []).filter((p) => photos.has(p.mediaId));
            return (
              <div key={i} className="contents">
                <section className="sheet">
                  <p style={{ fontSize: 10, letterSpacing: "0.3em", color: "#a84468" }}>
                    {t("第{n}章・{period}", { n: i + 1, period: t(ch.period) })}
                  </p>
                  <h2 className="font-display" style={{ fontSize: 19, fontWeight: 700 }}>
                    {ch.title}
                  </h2>
                  {ch.text
                    .split(/\n+/)
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .map((s, j) => (
                      <p key={j} style={{ fontSize: 12, textIndent: "1em" }}>
                        {s}
                      </p>
                    ))}
                  {ch.moments.length > 0 && (
                    <ol style={{ fontSize: 11, borderTop: "1px dashed #e4e1d8", paddingTop: 8 }}>
                      {ch.moments.map((m, j) => (
                        <li key={j}>
                          <span style={{ color: "#336e93" }}>{/^\d{4}-\d{2}-\d{2}$/.test(m.date) ? dayLong(m.date) : m.date}</span>　{m.text}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
                {list.length > 0 && (
                  <section className="sheet">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img(list[0].mediaId)} alt="" style={{ width: "100%", maxHeight: "62%", objectFit: "cover", borderRadius: 6 }} />
                    {list[0].line && <p style={{ textAlign: "center", fontSize: 11, color: "#6a6876" }}>{list[0].line}</p>}
                    {list.length > 1 && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
                        {list.slice(1, 4).map((p) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img key={p.mediaId} src={img(p.mediaId, "thumb")} alt="" style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 4 }} />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </div>
            );
          })}

          <section className="sheet justify-center">
            <p style={{ textAlign: "center", fontSize: 10, letterSpacing: "0.3em", color: "#6a6876" }}>{t("おわりに")}</p>
            {book.closing
              .split(/\n+/)
              .map((s) => s.trim())
              .filter(Boolean)
              .map((s, j) => (
                <p key={j} style={{ fontSize: 12 }}>
                  {s}
                </p>
              ))}
            <p style={{ textAlign: "right", fontSize: 10, color: "#6a6876" }}>{dayLong(book.asOf)}</p>
          </section>
        </div>
      )}
    </main>
  );
}
