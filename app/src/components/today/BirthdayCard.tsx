"use client";

// 1歳・2歳の誕生日から2週間、今日の画面の一番上に出す1枚。「ひなた、1歳おめでとう」と、
// その日に開いた手紙・一冊・映画への入口（思い出は、これまで下の小さな枠と、3回押した先にあった。2026-11-04 初見の目 L3）。
// 祝う言葉だけで、体や発達の事には触れない。静かにする間は今日の画面ごと別の形になるので、ここには来ない。
import Link from "next/link";
import { useEffect, useState } from "react";
import { addMonths, diffDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { recentlyOpened, type ClientLetter } from "@/lib/letters-shared";

/** 今日が1歳・2歳の誕生日から2週間の内なら、その歳（無ければ null） */
export function birthdayAge(f: { birthDate?: string }, today: string): 1 | 2 | null {
  if (!f.birthDate) return null;
  for (const age of [1, 2] as const) {
    const d = diffDays(today, addMonths(f.birthDate, age * 12));
    if (d >= 0 && d <= 14) return age;
  }
  return null;
}

export function BirthdayCard({ family, today, by, age }: { family: Family; today: string; by?: string; age: 1 | 2 }) {
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
  const opened = letters.filter((l) => recentlyOpened(l, today));
  const name = family.childName ?? "赤ちゃん";
  const link = "flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 text-base font-semibold";
  return (
    <section aria-label={`${age}歳の誕生日`} className="flex flex-col gap-3 rounded-2xl border border-rose/40 bg-rose-soft p-4">
      <p className="text-sm font-semibold text-rose">{age}歳の誕生日</p>
      <h2 className="font-display text-2xl font-bold [text-wrap:balance]">
        🎂 {name}、{age}歳おめでとう
      </h2>
      <div className="flex flex-col gap-2">
        {opened.length > 0 && (
          <Link href="/book#letters" className={link}>
            <span className="min-w-0">
              💌 {opened[0].from}からの手紙が開きました
              {opened[0].voiceSec !== undefined ? <span className="font-normal text-muted">・🎙 声つき</span> : null}
              {opened.length > 1 ? <span className="font-normal text-muted">（ほか{opened.length - 1}通）</span> : null}
            </span>
            <span className="text-muted" aria-hidden>›</span>
          </Link>
        )}
        <Link href="/book" className={link}>
          <span>📖 {age === 1 ? "この1年" : "この2年"}を一冊で読む</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
        <Link href="/book/film" className={link}>
          <span>🎞 映画で見る</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
      </div>
    </section>
  );
}
