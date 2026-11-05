"use client";

// からだの記録の1枚（手帳のタブの一番上・家族の声②・プランの B の5）。最新の値の1行と小さな線だけ。
// 妊娠中はママの体重（健診の日と家で測った日）、生まれた後は赤ちゃんの体重（双子などは子ごとに1行）。押すと図へ飛ぶ。
// 「いま」の画面には足さない。読むだけの家族（member）には、ママの体の1枚を出さない。つらい別れの家族には出さない（bodySeries が null）。
// 小さな線は、軸も目盛りも色の塗り分けも無い（形を見るだけ。良し悪しを言わない）。
// 1枚の下に「健診で見せる記録 ›」（/techo/share・プランの C）。数がまだ無くても、聞きたい事・次の予約を見せられるので、いつも置く。
import Link from "next/link";
import { useMemo } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { bodySeries } from "@/lib/body-series";
import { t } from "@/lib/i18n";
import { madeOf } from "@/lib/memory-words";
import { whoIn } from "./labels";
import { useReadOnly } from "./PregnancyBody";
import type { TechoItem } from "./useTecho";

type Pt = { date: string; kg: number };
type Row = { key: string; label: string; pts: Pt[] };

const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const kg1 = (v: number) => String(Math.round(v * 100) / 100);
const byDate = (a: Pt, b: Pt) => a.date.localeCompare(b.date);

export function BodyCard({ items }: { items: TechoItem[] }) {
  const { family, today } = useFamily();
  const readOnly = useReadOnly();
  const s = useMemo(() => bodySeries(items, family, today), [items, family, today]);
  const born = !!family.birthDate && family.birthDate <= today;
  const rows: Row[] = useMemo(() => {
    if (!s) return [];
    if (!born) {
      if (readOnly) return [];
      const pts = [
        ...s.mother.checkups.flatMap((r) => (r.weightKg !== undefined ? [{ date: r.date, kg: r.weightKg }] : [])),
        ...s.mother.home.flatMap((r) => (r.weightKg !== undefined && r.week !== undefined ? [{ date: r.date, kg: r.weightKg }] : [])),
      ].sort(byDate);
      return pts.length ? [{ key: "mother", label: t("ママの体重"), pts }] : [];
    }
    return s.babies
      .map((b) => ({
        key: b.who,
        label: t("{name}の体重", { name: whoIn(b.who, madeOf(family).made) }),
        pts: b.points.flatMap((p) => (p.weightKg !== undefined ? [{ date: p.date, kg: p.weightKg }] : [])).sort(byDate),
      }))
      .filter((r) => r.pts.length > 0);
  }, [s, born, readOnly, family]);
  const href = born ? "#page-growth" : "#page-pregnancy-checkup";
  const share = (
    <Link href="/techo/share" className="inline-flex min-h-11 items-center gap-1 self-end text-sm text-muted underline-offset-2 hover:underline">
      {t("健診で見せる記録")}
      <span aria-hidden>›</span>
    </Link>
  );
  if (!rows.length)
    return (
      <div id="body" className="flex scroll-mt-4 flex-col">
        {share}
      </div>
    );
  return (
    <div id="body" className="flex scroll-mt-4 flex-col gap-0.5">
      <a href={href} className="flex flex-col gap-1.5 rounded-2xl border border-line bg-card p-4">
        <span className="flex items-center justify-between gap-2">
          <span className="font-display text-lg font-bold">{t("からだの記録")}</span>
          <span className="text-sm text-muted" aria-hidden>
            ›
          </span>
        </span>
        {rows.map((r) => {
          const last = r.pts[r.pts.length - 1];
          return (
            <span key={r.key} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-base tabular-nums">
                {r.label} <b className="font-semibold">{kg1(last.kg)}kg</b> <span className="text-sm text-muted">{t("（{x}）", { x: md(last.date) })}</span>
              </span>
              <Spark pts={r.pts} />
            </span>
          );
        })}
      </a>
      {share}
    </div>
  );
}

/** 小さな線（日付を横に、体重を縦に。軸・目盛り・色の塗り分けなし） */
function Spark({ pts }: { pts: Pt[] }) {
  if (pts.length < 2) return null;
  const W = 96;
  const H = 28;
  const day = (d: string) => Date.parse(`${d}T00:00:00Z`) / 86400000;
  const x0 = day(pts[0].date);
  const x1 = Math.max(x0 + 1, day(pts[pts.length - 1].date));
  const lo = Math.min(...pts.map((p) => p.kg));
  const hi = Math.max(lo + 0.5, ...pts.map((p) => p.kg));
  const x = (d: string) => 2 + ((day(d) - x0) / (x1 - x0)) * (W - 4);
  const y = (v: number) => H - 3 - ((v - lo) / (hi - lo)) * (H - 6);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} className="shrink-0 text-rose" aria-hidden>
      <polyline points={pts.map((p) => `${x(p.date)},${y(p.kg)}`).join(" ")} fill="none" stroke="currentColor" strokeWidth={1.5} />
      <circle cx={x(last.date)} cy={y(last.kg)} r={2.5} fill="currentColor" />
    </svg>
  );
}
