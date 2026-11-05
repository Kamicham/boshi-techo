"use client";

// 「いま」の一番上の1枚（UI/UX 見直し A案・2026-11-03）。
// 主語を家族から手帳に移す: 開いた時に手帳が窓口を調べ、書く事のメモを作っておき、「手帳が用意しておきました」と報告する。
// できた物は消さずに「✓」の行で残す（UX の見直し C07・2026-11-05: 済むと見出しが戻り、跡が消えていた）。
// 家族がするのは中を見て「済んだ」を押す事だけ。用意する物が無い事（健診のお知らせなど）は、今までどおりの1枚。
// 用意（調べ・下書き）は usePrep。2件目からは、今日の画面が開いた時に裏で用意する（PrepAhead）。
import { useState } from "react";
import { useFamily } from "../FamilyProvider";
import { TopTask, type ShownTask } from "./TaskCard";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { t as tr } from "@/lib/i18n";
import { PrepConsent } from "./PrepConsent";
import { isMine, whoLabel } from "./task";
import { usePrep, type PrepLine } from "./usePrep";

export function NowCard(p: {
  task: ShownTask;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  soon?: boolean;
  onDone: () => void;
  onAssign?: (milestoneId: string, who: string) => void;
}) {
  const { task: t, today } = p;
  const { family, me } = useFamily();
  // 「作る」を押した回数（押すと用意をやり直す）
  const [tries, setTries] = useState(0);
  const prep = usePrep(t, today, family, me, tries);

  // 見出し: 用意している間は「手帳が用意しています」、できたら「手帳が用意しておきました」（ほかの人の番の事なら、誰の番かを添える）。
  // 見本の答えだけの時・つまずいた時は、手帳がしたとは言わない
  const who = whoLabel(t, family, me);
  const others = me && !isMine(t, me) && who ? tr("（{who}の番）", { who }) : "";
  const eyebrow = !prep.preps
    ? undefined
    : prep.busy
      ? tr("手帳が用意しています")
      : prep.made
        ? `${tr("手帳が用意しておきました")}${others}`
        : prep.settled
          ? tr("いま、いちばん先の事")
          : undefined;

  return (
    <TopTask {...p} key={prep.ver} eyebrowOverride={eyebrow}>
      <PrepBox prep={prep} family={family} onRetry={() => setTries((n) => n + 1)} />
    </TopTask>
  );
}

/** 用意の行と、つまずいた時の「作る」（一番上の札と、届けの束の1行目で使う） */
export function PrepBox({ prep, family, onRetry }: { prep: ReturnType<typeof usePrep>; family: Family; onRetry: () => void }) {
  return (
    <>
      {/* 書く事のメモは、下の「◯を作る」が同じ事をするので、ここで重ねて出さない（UX 2026-11-04: 同じ札にメモを作るが2つ並んでいた） */}
      {prep.failed && !prep.canDraft && (
        <div className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl bg-card/70 px-3 py-2">
          <span className="text-base">{tr("{city}の窓口と持ち物を、手帳が作れます", { city: family.city })}</span>
          <button type="button" onClick={onRetry} className="min-h-11 rounded-full bg-rose px-4 text-base font-semibold text-white">
            {tr("作る")}
          </button>
        </div>
      )}
      <PrepLines lines={prep.lines} />
      {/* 下書きが同意の前で断られた時: 行を黙って消さず、同意への1行（見直し C38 の「いま」の分。戻ると今の画面で手帳がそのまま作る） */}
      {prep.consent && <PrepConsent familyId={family.id} noun={prep.consent} />}
    </>
  );
}

/** 手帳が用意している事・用意した事の行（✓ はできた物、… は作っている物） */
export function PrepLines({ lines }: { lines: PrepLine[] }) {
  if (lines.length === 0) return null;
  return (
    <ul className="flex w-full flex-col gap-1 rounded-xl bg-card/70 px-3 py-2" aria-live="polite">
      {lines.map((l) => (
        <li key={l.key} className="flex items-baseline gap-2 text-base">
          <span aria-hidden className={`w-4 shrink-0 text-center ${l.state === "ok" ? "text-ok" : "text-muted"}`}>
            {l.state === "ok" ? "✓" : l.state === "busy" ? "…" : "・"}
          </span>
          <span className={`min-w-0 ${l.state === "ok" ? "" : "text-muted"}`}>{l.text}</span>
        </li>
      ))}
    </ul>
  );
}
