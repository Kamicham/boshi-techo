"use client";

// 妊娠中の思い出の誘い（総点検 1-4・2026-11-04）: おなかにいた日々は、後から撮り直せない。
// 12週（エコーの写真）・16週（妊娠5か月・戌の日）・20週（おなかに話しかける声）・28週（名前の候補や由来・任意）・30週（1歳の誕生日に開く手紙）。
// 月に1回まで（閉じた・押した月は、次を出さない）。静かにする間・生まれた後は出さない（lib/media-shared.ts の bumpMomentFor）。
// 言うのは残す事だけで、体の事・赤ちゃんの様子には触れない。
// 出したか・閉じたかは、この端末だけに覚える（家族の記録ではない）。写真の仕組みが使えない手帳・残せない役では出さない。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { bumpMomentFor, type BumpSeen } from "@/lib/media-shared";
import { useMedia } from "../album/useMedia";
import { Btn } from "../ui";

const keyOf = (fid: string) => `boshi.bumpNudge.${fid}`;

function readSeen(fid: string): BumpSeen {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(fid)) ?? "{}") as { ids?: unknown; month?: unknown };
    return {
      ids: Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === "string") : [],
      month: typeof v.month === "string" ? v.month : undefined,
    };
  } catch {
    return { ids: [] };
  }
}
function writeSeen(fid: string, s: BumpSeen) {
  try {
    localStorage.setItem(keyOf(fid), JSON.stringify(s));
  } catch {}
}

/** reportedOn は手帳で妊娠の届出を済ませた日（エコーの写真の誘いを、その日から出す） */
export function BumpMoment({ family, today, reportedOn }: { family: Family; today: string; reportedOn?: string }) {
  const { unavailable, loading, canWrite, canContribute } = useMedia();
  const [seen, setSeen] = useState<BumpSeen | null>(null);
  useEffect(() => setSeen(readSeen(family.id)), [family.id]);
  const m = seen ? bumpMomentFor(family, today, seen, reportedOn) : null;
  if (!m || !seen || loading || unavailable || !(canWrite || canContribute)) return null;
  const mark = () => {
    const next = { ids: [...seen.ids, m.id], month: today.slice(0, 7) };
    writeSeen(family.id, next);
    setSeen(next);
  };
  const href = m.to === "letter" ? "/book#letters" : "/capture?keep=1";
  return (
    <section aria-label={m.label} className="flex flex-col gap-2 rounded-2xl border border-ok/40 bg-ok/5 p-4">
      <p className="text-sm font-semibold text-ok">{m.label}</p>
      <p className="font-display text-lg font-bold [text-wrap:balance]">{m.say}</p>
      {m.note && <p className="text-sm text-muted">{m.note}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} onClick={mark} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-rose px-5 text-base font-semibold text-white">
          {m.action}
        </Link>
        <Btn kind="quiet" onClick={mark}>
          閉じる
        </Btn>
      </div>
    </section>
  );
}
