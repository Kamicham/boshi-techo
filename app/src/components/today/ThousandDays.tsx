"use client";

// 1000日の札（総点検 1-6・2026-11-04）: 2歳の誕生日から2週間、誕生日の札（BirthdayCard）の中に出す。
// 「1000日、一緒に歩きました」と、妊娠のはじまりから2歳の誕生日までの日数、家族が手帳に残した物の数（記録・写真・声・手紙・ありがとう）、
// そして「渡す準備」（20歳の手紙・一冊の印刷・書き出し）。手帳の物語の終わりを、事務の札ではなく、家族の手で閉じられるようにする。
// 数は家族が残した物だけを数える（体や発達の事は数えない）。0の物は出さない。作った家族（見本）の書き出しは、本物の手帳でだけ受け取れる。
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { useMedia } from "@/components/album/useMedia";
import { useThanksLog } from "@/components/album/ThanksChapter";
import { conceptionDate, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { ClientLetter } from "@/lib/letters-shared";
import { jpDate } from "./dates";

export function ThousandDays({ family, today, letters }: { family: Family; today: string; letters: ClientLetter[] }) {
  const { timeTravel, accountsEnabled } = useFamily();
  const photos = useMedia();
  const voices = useMedia({ kind: "audio" });
  const thanks = useThanksLog();
  const [records, setRecords] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ count: number | null }>(`/api/book?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => alive && setRecords(j.count ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id, today]);
  const child = family.childName ?? "赤ちゃん";
  const days = totalDays(family);
  const counts = [
    { icon: "📝", label: "記録", n: records ?? 0, unit: "件" },
    { icon: "📷", label: "写真", n: photos.media.filter((m) => !m.hidden).length, unit: "枚" },
    { icon: "🎙", label: "声", n: voices.media.filter((m) => !m.hidden).length, unit: "本" },
    { icon: "💌", label: "手紙", n: letters.length, unit: "通" },
    { icon: "🌷", label: "ありがとう", n: thanks.length, unit: "" },
  ].filter((c) => c.n > 0);
  const link = "flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 text-base font-semibold";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <p className="font-display text-xl font-bold">1000日、一緒に歩きました</p>
        <p className="text-sm text-muted">
          妊娠のはじまり（{jpDate(conceptionDate(family), today)}ごろ）から2歳の誕生日まで、{child}の{days}日。
        </p>
      </div>
      {counts.length > 0 && (
        <ul aria-label="家族が手帳に残した物" className="grid grid-cols-2 gap-2">
          {counts.map((c) => (
            <li key={c.label} className="flex items-baseline justify-between gap-2 rounded-xl bg-card px-3 py-2">
              <span className="text-sm text-muted">
                {c.icon} {c.label}
              </span>
              <span className="tabular text-lg font-bold">
                {c.n}
                <span className="text-sm font-normal">{c.unit}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <h3 className="mt-1 text-sm font-semibold text-rose">渡す準備</h3>
      <div className="flex flex-col gap-2">
        <Link href="/book#letters" className={link}>
          <span>💌 20歳の{child}へ、手紙を書く</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
        <Link href="/book/print" className={link}>
          <span>🖨 一冊を印刷する（A5・PDF）</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
        {timeTravel ? (
          <p className="px-1 text-sm text-muted">📦 本物の手帳では、写真・声・記録の原本を1つの zip で書き出して、手元に残せます。</p>
        ) : (
          accountsEnabled && <a href={`/api/export?familyId=${encodeURIComponent(family.id)}`} download className={link}>
            <span>📦 写真・声・記録を書き出す（zip）</span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </a>
        )}
      </div>
    </div>
  );
}
