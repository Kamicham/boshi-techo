"use client";

// 一冊の「映画で見る」の行。数と長さは、映画と同じ台本（lib/film-plan.ts）から出す
// （一冊の台本の秒をそのまま足すと、声の長さに合わせた秒・みんなの章・開いた声の手紙が入らず、映画の入口の長さと食い違う）。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { useMedia } from "./useMedia";
import type { Book } from "@/lib/book";
import { filmShots, type FilmLetter } from "@/lib/film-plan";
import { t } from "@/lib/i18n";
import { dot } from "@/lib/memory-words";

export function FilmLink({ book }: { book: Book }) {
  const { family, today } = useFamily();
  const { media: photos } = useMedia();
  const { media: voices } = useMedia({ kind: "audio" });
  const [letters, setLetters] = useState<FilmLetter[]>([]);
  useEffect(() => {
    api<{ letters: FilmLetter[] }>(`/api/letters?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => setLetters(r.letters.filter((l) => l.opened && l.voiceSec !== undefined)))
      .catch(() => setLetters([]));
  }, [family.id, today]);
  const shots = useMemo(() => filmShots(book.film, [...photos, ...voices], letters), [book, photos, voices, letters]);
  const ph = shots.filter((s) => s.kind === "photo");
  const nPhotos = ph.length || book.film.length;
  const nVoices = ph.filter((s) => s.kind === "photo" && s.voice).length;
  const nLetters = shots.filter((s) => s.kind === "letter").length;
  // 映画の入口と同じ数え方（場面の秒の合計を分に丸める）
  const sec = shots.length ? shots.reduce((n, s) => n + s.sec, 0) : book.film.reduce((n, x) => n + x.sec, 0);
  return (
    <Link href="/book/film" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-ink px-5 text-paper">
      <span className="flex flex-col">
        <span className="font-display text-lg font-bold">{t("▶ 映画で見る")}</span>
        <span className="text-xs opacity-80">
          {[
            t("写真 {n} 枚", { n: nPhotos }),
            nVoices ? t("家族の声 {n} 本", { n: nVoices }) : null,
            nLetters ? t("声の手紙 {n} 通", { n: nLetters }) : null,
            t("約{n}分", { n: Math.max(1, Math.round(sec / 60)) }),
          ]
            .filter(Boolean)
            .join(dot())}
        </span>
      </span>
      <span aria-hidden>›</span>
    </Link>
  );
}
