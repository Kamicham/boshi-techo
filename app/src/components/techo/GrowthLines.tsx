"use client";

// 発育曲線の描く所（props だけ。手帳の成長のページ GrowthChart と、健診で見せる1枚で使う。プランの B の7）。
// 帯は国の調査（令和5年乳幼児身体発育調査）の 3〜97 パーセンタイル。帯の男女がまだ決まっていない時は、帯なしで点と線だけを描く（選ばせない）。
// 横軸は記録の範囲に合わせる（最短3か月・最長24か月＝この手帳の1000日の終わり）。双子などは子ごとに線を分ける（線の形で見分ける。色で良し悪しを言わない）。
// 点の位置で良し悪しを言わない。注意書き（GROWTH_NOTE）は使う側が出す。
import { useMemo } from "react";
import { bandAt, GROWTH_LABELS, GROWTH_UNITS, type GrowthMeasure, type GrowthPoint, type GrowthSex } from "@/lib/growth";
import { useT } from "@/components/LocaleProvider";

/** 1人ぶんの線（label は子の呼び名か「1人目」。1人の時は使わない） */
export type GrowthLine = { label: string; points: GrowthPoint[] };

const W = 340;
const H = 240;
const PAD = { l: 36, r: 10, t: 10, b: 28 };
const X_LIMIT = 24;

/** 横軸の端（記録の範囲に合わせる。最短3か月・最長24か月） */
export function growthXMax(lines: readonly GrowthLine[]): number {
  const last = Math.max(0, ...lines.flatMap((l) => l.points.map((p) => p.month)));
  for (const m of [3, 6, 12, 18]) if (last <= m) return m;
  return X_LIMIT;
}

/** 横の目盛り（3か月・6か月は1か月ごと、それより長い時は3か月ごと） */
function xTicks(xMax: number): number[] {
  const step = xMax <= 6 ? 1 : 3;
  return Array.from({ length: Math.floor(xMax / step) + 1 }, (_, i) => i * step);
}

export function GrowthLines({
  measure,
  sex,
  lines,
  corrected,
  showMid,
}: {
  measure: GrowthMeasure;
  /** 帯の男女（null = まだ決まっていない＝帯を描かない） */
  sex: GrowthSex | null;
  lines: readonly GrowthLine[];
  corrected: boolean;
  showMid: boolean;
}) {
  // 言葉は useT()（健診で見せる1枚は LocaleScope で日本語に囲む。手帳の画面では画面の言葉）
  const tt = useT();
  const xMax = growthXMax(lines);
  const shown = useMemo(() => lines.map((l) => ({ ...l, points: l.points.filter((p) => p.month >= 0 && p.month <= xMax) })), [lines, xMax]);
  const count = shown.reduce((n, l) => n + l.points.length, 0);
  const { band, mid, yMin, yMax } = useMemo(() => {
    const steps: { m: number; p: number[] }[] = [];
    if (sex)
      for (let m = 0; m <= xMax + 1e-9; m += 0.25) {
        const p = bandAt(measure, sex, m);
        if (p) steps.push({ m, p });
      }
    const values = shown.flatMap((l) => l.points.map((p) => p.value));
    let lo = Math.min(...steps.map((s) => s.p[0]), ...values);
    let hi = Math.max(...steps.map((s) => s.p[6]), ...values);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      lo = 0;
      hi = 1;
    }
    const pad = Math.max((hi - lo) * 0.05, measure === "weight" ? 0.5 : 1);
    return { band: steps, mid: steps.map((s) => ({ m: s.m, v: s.p[3] })), yMin: Math.floor(lo - pad), yMax: Math.ceil(hi + pad) };
  }, [measure, sex, shown, xMax]);

  const x = (m: number) => PAD.l + (Math.min(m, xMax) / xMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const upper = band.map((s) => `${x(s.m)},${y(s.p[6])}`);
  const lower = [...band].reverse().map((s) => `${x(s.m)},${y(s.p[0])}`);
  const yStep = measure === "weight" ? (yMax - yMin <= 6 ? 1 : 2) : 5;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) yTicks.push(v);
  const label = tt(GROWTH_LABELS[measure]);
  const aria = !sex
    ? tt("{label}の発育曲線（帯なし）。点は記録（{n}件）", { label, n: count })
    : showMid
      ? tt("{label}の発育曲線。帯は国の調査の3から97パーセンタイル、線は50パーセンタイル。点は記録（{n}件）", { label, n: count })
      : tt("{label}の発育曲線。帯は国の調査の3から97パーセンタイル。点は記録（{n}件）", { label, n: count });

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={aria}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeWidth={0.5} />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
              {v}
            </text>
          </g>
        ))}
        {xTicks(xMax).map((m) => (
          <text key={m} x={x(m)} y={H - PAD.b + 12} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted">
            {m}
          </text>
        ))}
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
          {corrected ? tt("修正月齢（か月）") : tt("生後（か月）")}
        </text>
        <text x={4} y={PAD.t + 2} fontSize={9} fill="currentColor" className="text-muted">
          {GROWTH_UNITS[measure]}
        </text>
        {band.length > 0 && <polygon points={[...upper, ...lower].join(" ")} fill="currentColor" className="text-sky" fillOpacity={0.18} />}
        {sex && showMid && <polyline points={mid.map((s) => `${x(s.m)},${y(s.v)}`).join(" ")} fill="none" stroke="currentColor" className="text-sky" strokeWidth={1.2} />}
        {shown.map((l, i) => (
          <g key={l.label || i} className={i === 0 ? "text-rose" : "text-ink"}>
            {l.points.length > 1 && (
              <polyline
                points={l.points.map((p) => `${x(p.month)},${y(p.value)}`).join(" ")}
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                strokeDasharray={i === 0 ? undefined : "4 3"}
              />
            )}
            {l.points.map((p) =>
              i === 0 ? (
                <circle key={`${p.date}-${p.value}`} cx={x(p.month)} cy={y(p.value)} r={3.5} fill="currentColor" />
              ) : (
                <rect key={`${p.date}-${p.value}`} x={x(p.month) - 3} y={y(p.value) - 3} width={6} height={6} fill="currentColor" />
              ),
            )}
          </g>
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 text-sm text-muted">
        {sex ? <span>{tt("帯: 同じ月齢の子の94%が入る幅（3〜97）")}</span> : null}
        {sex && showMid ? <span>{tt("線: 50")}</span> : null}
        {shown.length > 1 ? (
          shown.map((l, i) => <span key={l.label || i}>{i === 0 ? `● ${l.label}` : tt("■ {name}（点線）", { name: l.label })}</span>)
        ) : (
          <span>
            {tt("点: わが家の記録")}
            {count === 0 ? tt("（まだありません）") : ""}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
