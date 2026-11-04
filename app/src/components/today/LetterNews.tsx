"use client";

// 封をした手紙が開いた日から2週間、今日の画面に一言だけ出す（「おなかにいた頃の手紙が開きました」「2年前の手紙が開きました」）。押すと一冊の「未来の手紙」へ。
// 開くのは家族が自分で決めた日なので、静かにする間も出す（促す言葉ではない）。封をしない手紙（いつでも読める）は出さない。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { openedNewsLine, recentlyOpened, type ClientLetter } from "@/lib/letters-shared";
import { childView } from "@/lib/call-name";

export function LetterNews({ family, today, by }: { family: Family; today: string; by?: string }) {
  const [letters, setLetters] = useState<ClientLetter[]>([]);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ familyId: family.id, today, ...(by ? { by } : {}) });
    fetch(`/api/letters?${qs}`)
      .then((r) => (r.ok ? r.json() : { letters: [] }))
      .then((j: { letters?: ClientLetter[] }) => alive && setLetters(j.letters ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id, today, by]);
  const news = letters.filter((l) => recentlyOpened(l, today));
  if (!news.length) return null;
  const l = news[0];
  return (
    <Link href="/book#letters" aria-label="開いた手紙" className="flex items-center gap-3 rounded-2xl border border-rose/40 bg-rose-soft p-4">
      <span aria-hidden className="text-3xl">
        💌
      </span>
      <span className="flex flex-col">
        <span className="font-display text-lg font-bold [text-wrap:balance]">
          {openedNewsLine(l, family)}
          {news.length > 1 ? `（ほか${news.length - 1}通）` : ""}
        </span>
        <span className="text-sm text-muted">
          {childView(family, l.from)}から {l.to}へ{l.voiceSec !== undefined ? "・🎙 声つき" : ""}・一冊で読む ›
        </span>
      </span>
    </Link>
  );
}
