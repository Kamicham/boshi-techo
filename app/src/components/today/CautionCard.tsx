"use client";

// 気をつける事の札（1枚）。中身と時期は lib/cautions.ts（cautionFor。試験は cautions.test.ts）。
// 今日の画面の「今やる1つ」より下に置く（components/Techo.tsx が置き場と busy を決める）。期限は無く、済みにしない。
// 「読んだ」はこの端末にだけ覚える（boshi.caution.<家族の id>）。押した日は、次の札を出さない。押しても何も送らない。
// 電話の道（#8000 と県のふつうの番号・0120-189-783・中毒110番）は、この部品の中に置く（Techo.tsx の /emergency の数の試験のため）。
// 手帳の「できた日」（寝返り・はいはい・つかまり立ち・ひとり歩き）は、月齢の事故の札が来る頃（生後3か月〜1歳2か月）だけ読む。
// 色: ふだんは白い札。赤は命の橋の1行（揺さぶらない）だけ（今の手帳の約束）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import { CAUTION_LABEL, POISON_LINES, POISON_NOTE, cautionFor, cautionShareText, devDatesOf, nestQuote, type CautionCtx, type CautionSeen } from "@/lib/cautions";
import { addMonths } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { line8000, telLink } from "@/lib/emergency-lines";
import { mapUrl } from "@/lib/handoff";
import { Btn, ShareButton, useDevice, Why } from "../ui";

const keyOf = (fid: string) => `boshi.caution.${fid}`;

function readSeen(fid: string): CautionSeen {
  try {
    const v = JSON.parse(localStorage.getItem(keyOf(fid)) ?? "{}") as { ids?: unknown; day?: unknown };
    return {
      ids: Array.isArray(v.ids) ? v.ids.filter((x): x is string => typeof x === "string") : [],
      day: typeof v.day === "string" ? v.day : undefined,
    };
  } catch {
    return { ids: [] };
  }
}
function writeSeen(fid: string, s: CautionSeen) {
  try {
    localStorage.setItem(keyOf(fid), JSON.stringify(s));
  } catch {}
}

export function CautionCard({ family, today, role, busy, birthFiled }: { family: Family; today: string; role: CautionCtx["role"]; busy: boolean; birthFiled: boolean }) {
  const [seen, setSeen] = useState<CautionSeen | null>(null);
  const [dev, setDev] = useState<CautionCtx["dev"] | null>(null);
  const { apple } = useDevice();
  const b = family.birthDate;
  const wantDev = !!b && today >= addMonths(b, 3) && today < addMonths(b, 14) && !family.situation?.quiet;
  useEffect(() => setSeen(readSeen(family.id)), [family.id]);
  useEffect(() => {
    if (!wantDev) return;
    let live = true;
    api<{ techo?: unknown[] }>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => live && setDev(devDatesOf(r.techo ?? [])))
      .catch(() => live && setDev({}));
    return () => {
      live = false;
    };
  }, [family.id, today, wantDev]);
  // できた日を読む頃は、読み終わるまで出さない（出た後に札が入れ替わらないように）
  if (!seen || (wantDev && dev === null)) return null;
  const c = cautionFor(family, today, seen, { role, busy, birthFiled, dev: dev ?? undefined });
  if (!c) return null;
  const read = () => {
    const next = { ids: [...seen.ids, c.id], day: today };
    writeSeen(family.id, next);
    setSeen(next);
  };
  const alt = c.calls.includes("8000") ? line8000(family.prefecture) : null;
  const label = CAUTION_LABEL[c.kind];

  return (
    <section aria-label={`${label}: ${c.title}`} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-sm font-semibold text-muted">{label}</p>
        <h2 className="font-display text-lg font-bold [text-wrap:balance]">{c.title}</h2>
      </div>
      {c.lead && <p className="text-base">{c.lead}</p>}
      <ul className="flex flex-col gap-2 text-base leading-relaxed">
        {c.quotes.map((q) => (
          <li key={q.text} className={q.tone === "alert" ? "font-semibold text-alert" : q.tone === "bold" ? "font-semibold" : undefined}>
            「{nestQuote(q.text)}」<span className="text-xs font-normal text-muted">（{q.from}）</span>
          </li>
        ))}
      </ul>
      {c.after && <p className="text-base">{c.after}</p>}

      {(c.calls.length > 0 || c.emergency || c.center) && (
        <div className="flex flex-col gap-2">
          {c.calls.includes("8000") && (
            <div className="flex flex-col overflow-hidden rounded-2xl border border-sky/50">
              <a href="tel:%238000" className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
                <span className="min-w-0">
                  <span className="block text-base font-semibold text-sky">#8000</span>
                  <span className="block text-sm text-muted">子どもの事で、受診するか迷う時（夜や休みの日）</span>
                </span>
                <span className="shrink-0 text-sm font-semibold">電話する</span>
              </a>
              {alt && (
                <a
                  href={telLink(alt.tel)}
                  aria-label={`#8000 につながらない時は、${alt.tel}（${alt.prefecture}の窓口）にかける`}
                  className="flex min-h-11 items-center justify-center border-t border-sky/30 px-3 py-1 text-center text-sm text-muted"
                >
                  <span>
                    つながらない時は <span className="tabular font-semibold text-sky underline underline-offset-2">{alt.tel}</span>（{alt.prefecture}）
                  </span>
                </a>
              )}
            </div>
          )}
          {c.calls.includes("189") && (
            <a href="tel:0120189783" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-ink/20 px-4 py-2">
              <span className="min-w-0">
                <span className="tabular block text-base font-semibold">0120-189-783</span>
                <span className="block text-sm text-muted">「出産や子育てに悩んだ時は、こちらにお電話ください。」（こども家庭庁・無料）</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">電話する</span>
            </a>
          )}
          {c.calls.includes("poison") && (
            <div className="flex flex-col gap-1 rounded-2xl border border-ink/20 px-4 py-2">
              <p className="text-sm text-muted">中毒110番（日本中毒情報センター・24時間対応）「{POISON_NOTE}」</p>
              {POISON_LINES.map((p) => (
                <a key={p.tel} href={telLink(p.tel)} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="text-base">
                    {p.name} <span className="tabular font-semibold">{p.tel}</span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold">電話する</span>
                </a>
              ))}
            </div>
          )}
          {c.emergency && (
            <Link href={c.emergency.href} className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 py-2 text-ink">
              <span className="min-w-0 text-base">{c.emergency.label}</span>
              <span aria-hidden className="ml-auto shrink-0 text-muted">
                ›
              </span>
            </Link>
          )}
          {c.center && (
            <a href={mapUrl(`${family.city ?? ""} 保健センター`, apple)} target="_blank" rel="noreferrer" className="flex min-h-11 items-center gap-2 rounded-xl border border-line px-4 py-2 text-ink">
              <span className="min-w-0 text-base">町の保健センター（地図で探す）</span>
              <span aria-hidden className="ml-auto shrink-0 text-muted">
                ›
              </span>
            </a>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="secondary" onClick={read}>
          読んだ
        </Btn>
        <ShareButton title={c.title} text={cautionShareText(c)} label="家族に送る" />
      </div>
      <Why label="なぜ今？">
        {c.why.map((w) => (
          <p key={w}>{w}</p>
        ))}
        <p>
          出典:{" "}
          {c.sources.map((s, i) => (
            <span key={s.href}>
              {i > 0 && "・"}
              <a href={s.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {s.label}
              </a>
            </span>
          ))}
        </p>
        <p>「読んだ」は、この端末にだけ覚えます（家族のほかの人の画面からは消えません）。押した日は、次の札を出しません。</p>
      </Why>
    </section>
  );
}
