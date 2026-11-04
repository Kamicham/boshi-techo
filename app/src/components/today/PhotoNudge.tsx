"use client";

// 節目の日だけ、今日の画面に1回出す一言（撮り忘れを減らす）。月に1回まで。言うのは「今日は生後100日です」だけで、体の事には触れない。
// 節目: お七夜・お宮参り（約1か月）・お食い初め（100日）・ハーフバースデー・1歳・1歳6か月・2歳（lib/media-shared.ts の PHOTO_MILESTONES）。
// 根拠: 10の場面で、それぞれ5割を超える母親が撮っていない（ママ写ん！2023・運営会社の調査）。
// 家族が「静かにする」を選んでいる間は出さない（lib/media-shared.ts の memoryNudgeFor）。
// 出したか・閉じたかは、この端末だけに覚える（家族の記録ではない）。写真の仕組みが使えない手帳では出さない。
import Link from "next/link";
import { useEffect, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { memoryNudgeFor } from "@/lib/media-shared";
import { useMedia } from "../album/useMedia";
import { Btn } from "../ui";

type Seen = { ids: string[]; month?: string };
const keyOf = (fid: string) => `boshi.photoNudge.${fid}`;

function readSeen(fid: string): Seen {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(fid)) ?? "{}") as Seen;
    return { ids: Array.isArray(v.ids) ? v.ids : [], month: typeof v.month === "string" ? v.month : undefined };
  } catch {
    return { ids: [] };
  }
}
function writeSeen(fid: string, s: Seen) {
  try {
    localStorage.setItem(keyOf(fid), JSON.stringify(s));
  } catch {}
}

export function PhotoNudge({ family, today }: { family: Family; today: string }) {
  // 静かにする（つらい別れ・入院）を選んでいる間は出さない
  const m = memoryNudgeFor(family, today);
  const { unavailable, loading, canWrite } = useMedia();
  const [seen, setSeen] = useState<Seen | null>(null);
  useEffect(() => setSeen(readSeen(family.id)), [family.id]);
  if (!m || !seen || loading || unavailable || !canWrite) return null;
  if (seen.ids.includes(m.id) || seen.month === today.slice(0, 7)) return null;
  const mark = () => {
    const next = { ids: [...seen.ids, m.id], month: today.slice(0, 7) };
    writeSeen(family.id, next);
    setSeen(next);
  };
  return (
    <section aria-label="節目の写真" className="flex flex-col gap-2 rounded-2xl border border-ok/40 bg-ok/5 p-4">
      <p className="font-display text-lg font-bold">
        {m.say}
        <span className="ml-1 text-base font-normal text-muted">（{m.label}のころ）</span>
      </p>
      <div className="flex flex-wrap gap-2">
        <Link href="/capture?keep=1" onClick={mark} className="inline-flex min-h-11 items-center justify-center gap-1 rounded-full bg-rose px-5 text-base font-semibold text-white">
          📷 写真を残す
        </Link>
        <Btn kind="quiet" onClick={mark}>
          閉じる
        </Btn>
      </div>
    </section>
  );
}
