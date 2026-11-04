"use client";

// 節目の日の1枚（総点検 1-2・0-7・2026-11-04）: お七夜・お宮参り・お食い初め（100日）・ハーフバースデー・1歳6か月の、その日から2日の間、
// 今日の画面の一番上に出す（やる事はすぐ下に残す）。1歳・2歳の誕生日は BirthdayCard。前は画面の下の小さな一言で、月に1回までだった。
// 「今日は」と言うのはその日だけ。お七夜・お食い初めは「生まれた日から数えて◯日目」と添える（上の帯の「生後6日」と食い違って見えないように）。
// 言うのは節目の事だけで、体の事には触れない。静かにする（つらい別れ・入院）間は出さない（lib/media-shared.ts の celebrationFor）。
// 閉じたら、その節目はもう出さない（この端末だけに覚える。家族の記録ではない）。
// 根拠: 10の場面で、それぞれ5割を超える母親が撮っていない（ママ写ん！2023・運営会社の調査）。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { milestoneSay, type PhotoMilestone } from "@/lib/media-shared";
import { useMedia } from "../album/useMedia";
import { Btn } from "../ui";

const keyOf = (fid: string) => `boshi.photoNudge.${fid}`;

function readClosed(fid: string): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(fid)) ?? "{}") as { ids?: unknown };
    return Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeClosed(fid: string, ids: string[]) {
  try {
    localStorage.setItem(keyOf(fid), JSON.stringify({ ids }));
  } catch {}
}

export function MilestoneDay({ family, today, m }: { family: Family; today: string; m: PhotoMilestone }) {
  const { unavailable, loading, canWrite, canContribute } = useMedia();
  const [closed, setClosed] = useState<string[] | null>(null);
  useEffect(() => setClosed(readClosed(family.id)), [family.id]);
  if (!closed || closed.includes(m.id) || !family.birthDate) return null;
  const canKeep = !loading && !unavailable && (canWrite || !!canContribute);
  const child = family.childName ?? "赤ちゃん";
  const close = () => {
    const next = [...closed, m.id];
    writeClosed(family.id, next);
    setClosed(next);
  };
  const link = "flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 text-base font-semibold";
  return (
    <section aria-label={m.label} className="flex flex-col gap-3 rounded-2xl border border-ok/40 bg-ok/5 p-4">
      <p className="text-sm font-semibold text-ok">{m.label}</p>
      <h2 className="font-display text-2xl font-bold [text-wrap:balance]">{milestoneSay(m, family.birthDate, today)}</h2>
      {m.note && <p className="-mt-2 text-sm text-muted">{m.note}</p>}
      {canKeep && (
        <div className="flex flex-col gap-2">
          <Link href="/capture?keep=1" onClick={close} className={link}>
            <span>📷 写真・🎙 声を残す</span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
          <Link href="/book#letters" className={link}>
            <span>💌 {child}へ、手紙を書く</span>
            <span className="text-muted" aria-hidden>
              ›
            </span>
          </Link>
        </div>
      )}
      <div>
        <Btn kind="quiet" onClick={close}>
          閉じる
        </Btn>
      </div>
    </section>
  );
}
