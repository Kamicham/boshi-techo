"use client";

// からだの記録: 妊娠中の経過（妊婦健診）のページ（家族の声②「体重などを入れたら、目で見て分かる形でいつも把握できるように」・プランの B の2・3）。
// まず紙と同じ表（府令様式「妊娠中の経過」の列の順: 診察月日・週数・子宮底長・腹囲・体重・血圧・むくみ／尿蛋白／尿糖）。
// 体重にだけ線を添える（GrowthChart と同じ手書きの SVG。部品は足さない）。妊娠前の体重は週0に白抜きの点。家で測った体重は小さな点。
// 約束: 体の判断はしない。血圧・子宮底長・尿は数字と記号だけ（線・色・140/90 の線を付けない）。色で良し悪しを塗らない。
// 矢印・前回との差・評価の言葉を出さない。図の下には、いつも同じ一言。
// 目安の幅（日本産科婦人科学会 2021年3月8日）は 40週の所に括弧を1本だけ。内か外かで点の色・形・文を変えない。区分の名前は出さない。
// 読むだけの家族（member）とつらい別れの家族には出さない（作り手が決めた・lib/body-series.ts）。
// 図の下に、家で測った体重・血圧を1行で入れる口（HomeEntry・プランの B の6）。妊娠中だけ。空の時は1行で案内する（入力を促す言葉は使わない）。
import { useMemo, type ReactNode } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Why } from "@/components/ui";
import { bodySeries, GAIN_GUIDE_SOURCE, gainGuide, type GainGuide, type MotherBody } from "@/lib/body-series";
import { clockAt, clockShort } from "@/lib/clock";
import { t } from "@/lib/i18n";
import { HomeEntry } from "./HomeEntry";
import type { TechoItem } from "./useTecho";
import type { TechoEntry } from "@/lib/techo";

/** 家族のデータの数を、そのまま出す（小数は書いてあるまで。0 を足さない） */
const n = (v: number | undefined) => (v === undefined ? "" : String(Math.round(v * 10) / 10));
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;

/** 読むだけの家族か（ママの体の図は出さない） */
export function useReadOnly(): boolean {
  const { family, households } = useFamily();
  return households.find((h) => h.id === family.id)?.role === "member";
}

/**
 * 妊婦健診のページの上に置く、表と体重の線。children は1件ずつの記録（消す・直す）で、表を出す時は畳む。
 * 数が1つも無い時・読むだけの家族・つらい別れの家族は、表と線を出さず children をそのまま
 */
export function PregnancyBody({
  items,
  children,
  add,
  remove,
}: {
  items: TechoItem[];
  children?: ReactNode;
  add?: (entry: Omit<TechoEntry, "source">) => Promise<void>;
  remove?: (ids: string[]) => Promise<void>;
}) {
  const { family, today, isDemo } = useFamily();
  const readOnly = useReadOnly();
  const s = useMemo(() => bodySeries(items, family, today), [items, family, today]);
  const m = s && !readOnly ? s.mother : null;
  const born = !!family.birthDate && family.birthDate <= today;
  // 家で測った物の口は、妊娠中・書ける家族・つらい別れでない家族だけ
  const mama = family.members.find((x) => x.role === "母");
  const homeRows = items.filter((it) => it.page === "home" && !it.pending);
  const entry =
    m && !born && add && remove ? <HomeEntry today={today} rows={homeRows} add={add} remove={remove} who={mama?.name} /> : null;
  if (!m || (!m.checkups.length && !m.home.some((h) => h.weightKg !== undefined))) {
    if (!entry) return <>{children}</>;
    return (
      <div className="flex flex-col gap-3">
        <p className="text-base text-muted">{t("健診の数字が入ると、ここに紙の手帳と同じ表と体重の線が出ます。")}</p>
        {isDemo && <p className="text-sm text-muted">{t("見本の家族は、上の「{other}」で「{stage}」にすると、表と線が見られます。", { other: t("ほかの時期"), stage: t("妊娠37週") })}</p>}
        {entry}
        {children}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <CheckupTable mother={m} dueDate={family.dueDate} />
      <WeightLine mother={m} />
      {entry}
      {children && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm text-muted [&::-webkit-details-marker]:hidden">
            <span className="underline underline-offset-2">{t("1件ずつ見る・消す")}</span>
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="mt-1">{children}</div>
        </details>
      )}
    </div>
  );
}

/** 紙と同じ表。腹囲は今の記録の形に無いので、列だけ置いて空のまま */
function CheckupTable({ mother, dueDate }: { mother: MotherBody; dueDate: string }) {
  if (!mother.checkups.length) return null;
  const week = (date: string) => clockShort(clockAt({ dueDate }, date), true);
  const head = [
    [t("診察月日"), ""],
    [t("週数"), ""],
    [t("子宮底長"), "cm"],
    [t("腹囲"), "cm"],
    [t("体重"), "kg"],
    [t("血圧"), "mmHg"],
    [t("むくみ"), ""],
    [t("尿蛋白"), ""],
    [t("尿糖"), ""],
  ];
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="min-w-max border-collapse text-base">
        <caption className="pb-1 text-left text-sm text-muted">{t("紙の手帳と同じ並び（妊娠中の経過）")}</caption>
        <thead>
          <tr>
            {head.map(([label, unit]) => (
              <th key={label} scope="col" className="border-b border-line px-2 py-1 text-left text-sm font-semibold text-muted">
                {label}
                {unit && <span className="block text-xs font-normal">{unit}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {mother.checkups.map((r) => (
            <tr key={r.date} className="border-b border-line">
              <th scope="row" className="px-2 py-1.5 text-left font-normal tabular-nums">
                {md(r.date)}
              </th>
              <td className="px-2 py-1.5 tabular-nums">{week(r.date)}</td>
              <td className="px-2 py-1.5 tabular-nums">{n(r.fundusCm)}</td>
              <td className="px-2 py-1.5" />
              <td className="px-2 py-1.5 tabular-nums">{n(r.weightKg)}</td>
              <td className="px-2 py-1.5 tabular-nums">{r.bpHigh !== undefined || r.bpLow !== undefined ? `${n(r.bpHigh)}/${n(r.bpLow)}` : ""}</td>
              <td className="px-2 py-1.5">{r.edema ?? ""}</td>
              <td className="px-2 py-1.5">{r.urineProtein ?? ""}</td>
              <td className="px-2 py-1.5">{r.urineSugar ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const W = 340;
const H = 220;
const PAD = { l: 34, r: 14, t: 26, b: 26 };

/** 目盛りの間（6本くらいに収まる幅） */
function stepOf(span: number): number {
  for (const s of [1, 2, 5, 10]) if (span / s <= 6) return s;
  return 20;
}

/** 体重の線（週を横に）。健診の日は大きな点、家で測った日は小さな点、妊娠前は週0の白抜き */
export function WeightLine({ mother }: { mother: MotherBody }) {
  const guide: GainGuide | null = gainGuide(mother.bmi, mother.multiple);
  const pre = mother.preWeightKg;
  const weekOf = (r: { week?: number; day?: number }) => (r.week ?? 0) + (r.day ?? 0) / 7;
  const checkups = mother.checkups.filter((r) => r.weightKg !== undefined).map((r) => ({ w: weekOf(r), kg: r.weightKg!, home: false, key: `c${r.date}` }));
  const home = mother.home.filter((r) => r.weightKg !== undefined && r.week !== undefined).map((r, i) => ({ w: weekOf(r), kg: r.weightKg!, home: true, key: `h${r.date}-${i}` }));
  const all = [...checkups, ...home].sort((a, b) => a.w - b.w);
  if (!all.length) return null;
  // 括弧は妊娠前の体重に、出産までの増え方の幅を足した所（妊娠前の体重が無ければ置けない）
  const range = guide?.kind === "range" && pre !== undefined ? { lo: pre + guide.lowKg, hi: pre + guide.highKg, low: guide.lowKg, high: guide.highKg } : null;

  const xMax = Math.max(40, Math.ceil(all[all.length - 1].w) + 1);
  const values = [...all.map((p) => p.kg), ...(pre !== undefined ? [pre] : []), ...(range ? [range.lo, range.hi] : [])];
  const yMin = Math.floor(Math.min(...values) - 1);
  const yMax = Math.ceil(Math.max(...values) + 1);
  const x = (w: number) => PAD.l + (w / xMax) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const step = stepOf(yMax - yMin);
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) yTicks.push(v);
  const bx = x(40);

  return (
    <figure className="flex flex-col gap-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label={t("体重の線。横は妊娠週、点は入れた体重（{n}件）", { n: all.length })}
      >
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeWidth={0.5} />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
              {v}
            </text>
          </g>
        ))}
        {[0, 10, 20, 30, 40].map((w) => (
          <text key={w} x={x(w)} y={H - PAD.b + 12} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted">
            {w}
          </text>
        ))}
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
          {t("妊娠週")}
        </text>
        <text x={4} y={PAD.t - 14} fontSize={9} fill="currentColor" className="text-muted">
          kg
        </text>
        {range && (
          <g className="text-muted">
            <polyline points={`${bx - 6},${y(range.hi)} ${bx},${y(range.hi)} ${bx},${y(range.lo)} ${bx - 6},${y(range.lo)}`} fill="none" stroke="currentColor" strokeWidth={1.5} />
            <text x={bx} y={y(range.hi) - 6} textAnchor="end" fontSize={9} fill="currentColor">
              {t("出産の頃の目安 +{lo}〜{hi}kg", { lo: range.low, hi: range.high })}
            </text>
          </g>
        )}
        {all.length > 1 && <polyline points={all.map((p) => `${x(p.w)},${y(p.kg)}`).join(" ")} fill="none" stroke="currentColor" className="text-rose" strokeWidth={1.5} />}
        {pre !== undefined && <circle cx={x(0)} cy={y(pre)} r={4} stroke="currentColor" strokeWidth={1.5} className="fill-card text-rose" />}
        {all.map((p) => (
          <circle key={p.key} cx={x(p.w)} cy={y(p.kg)} r={p.home ? 2.2 : 3.8} fill="currentColor" className={p.home ? "text-muted" : "text-rose"} />
        ))}
      </svg>
      <figcaption className="flex flex-wrap gap-x-3 text-sm text-muted">
        {checkups.length > 0 && <span>{t("● 健診の日の体重")}</span>}
        {home.length > 0 && <span>{t("・ 家で測った体重")}</span>}
        {pre !== undefined && <span>{t("○ 妊娠前の体重")}</span>}
        {range && <span>{t("］ 出産の頃の目安")}</span>}
        {guide?.kind === "individual" && <span>{t("出産の頃の目安: 個別対応（上限5kgまでが目安）")}</span>}
      </figcaption>
      <p className="rounded-xl bg-sky-soft px-3 py-2 text-base">{t("線は入れた数字をつないだだけです。気になる事は健診で聞いてください。")}</p>
      {guide && <GuideSource />}
    </figure>
  );
}

/** 目安の幅の出どころ（注の原文と出典。畳んでおく） */
function GuideSource() {
  return (
    <Why label={t("目安の出どころ")}>
      <p>
        {t("{title}（{year}年3月8日）。妊娠前の体重と身長から出した BMI ごとの、出産までに増える量の目安です。赤ちゃんが1人の時の値なので、双子などの時は出していません。週ごとの目安は公に無いので、40週の所に1本だけ置いています。", {
          title: t(GAIN_GUIDE_SOURCE.title),
          year: GAIN_GUIDE_SOURCE.year,
        })}
      </p>
      {/* 訳さない: 注の原文の引用（句読点も原文のまま）。中文・English の意味は下の行の訳に書く */}
      <p lang="ja">「増加量を厳格に指導する根拠は必ずしも十分ではないと認識し，個人差を考慮したゆるやかな指導を心がける．」</p>
      <p>{t("上の文は、表に付いた注の原文です（産婦人科診療ガイドライン産科編 2020 CQ 010。厚生労働省 子母発0331第5号〈2021年3月31日〉の表8）。")}</p>
    </Why>
  );
}
