"use client";

// 1歳・2歳の誕生日から2週間、今日の画面の一番上に出す1枚。「ひなた、1歳おめでとう」と、
// その日に開いた手紙・一冊・映画への入口（思い出は、これまで下の小さな枠と、3回押した先にあった。2026-11-04 初見の目 L3）。
// 祝う言葉だけで、体や発達の事には触れない。出す日は lib/media-shared.ts の birthdayFor（静かにする間は、いつもの画面を開いても出さない）。
// 2歳の誕生日は1000日の終わり。札の下に「1000日、一緒に歩きました」と渡す準備を足す（ThousandDays。総点検 1-6・2026-11-04）。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { recentlyOpened, type ClientLetter } from "@/lib/letters-shared";
import { ThousandDays } from "./ThousandDays";
import { childView } from "@/lib/call-name";

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
  const name = nameIn(family.childName) ?? t("赤ちゃん");
  // 名前がまだ無い時の呼びかけは、文ごとに引く（English で the baby と呼びかけないよう）
  const cheer = family.childName != null ? t("🎂 {name}、{age}歳おめでとう", { name: nameIn(family.childName), age }) : t("🎂 赤ちゃん、{age}歳おめでとう", { age });
  const link = "flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 text-base font-semibold";
  return (
    <section aria-label={t("{age}歳の誕生日", { age })} className="flex flex-col gap-3 rounded-2xl border border-rose/40 bg-rose-soft p-4">
      <p className="text-sm font-semibold text-rose">{t("{age}歳の誕生日", { age })}</p>
      <h2 className="font-display text-2xl font-bold [text-wrap:balance]">{cheer}</h2>
      <div className="flex flex-col gap-2">
        {opened.length > 0 && (
          <Link href="/book#letters" className={link}>
            <span className="min-w-0">
              {t("💌 {from}からの手紙が開きました", { from: childView(family, opened[0].from) })}
              {opened[0].voiceSec !== undefined ? <span className="font-normal text-muted">{t("・🎙 声つき")}</span> : null}
              {opened.length > 1 ? <span className="font-normal text-muted">{t("（ほか{n}通）", { n: opened.length - 1 })}</span> : null}
            </span>
            <span className="text-muted" aria-hidden>›</span>
          </Link>
        )}
        <Link href="/book" className={link}>
          <span>{age === 1 ? t("📖 この1年を一冊で読む") : t("📖 この2年を一冊で読む")}</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
        <Link href="/book/film" className={link}>
          <span>{t("🎞 映画で見る")}</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
        {/* 紙の母子手帳の「誕生日のメッセージ」と同じ欄（手帳の気持ちの記録。府令様式の保護者の記録） */}
        <Link href="/techo#page-feeling" className={link}>
          <span>{t("✍ {name}へ、誕生日の一言を書く", { name })}</span>
          <span className="text-muted" aria-hidden>›</span>
        </Link>
      </div>
      {age === 2 && (
        <div className="border-t border-rose/30 pt-3">
          <ThousandDays family={family} today={today} letters={letters} />
        </div>
      )}
    </section>
  );
}
