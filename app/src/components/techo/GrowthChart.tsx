"use client";

// 発育曲線: 国の調査（令和5年）の 3〜97 パーセンタイルの帯に、家族の記録の点を打つ。50 の線は「真ん中の線も見る」で出す（既定は描かない＝真ん中と比べさせない）。
// 在胎37週未満で生まれた子は、修正月齢で見るのを既定にする（その子の線の伸びで見る）。
// 点の位置で良し悪しを言わない。手帳と同じ注意書き（GROWTH_NOTE）をそのまま出す。
// 帯の男女は家族ごとに覚える（/api/keep の childSex）。早く生まれた子は、修正月齢で見る切り替えを出す。
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Notice, plainError, Why } from "@/components/ui";
import { diffDays } from "@/lib/clock";
import {
  bandAt,
  CORRECTED_NOTE,
  correctionMonths,
  GROWTH_APPROX_NOTE,
  GROWTH_LABELS,
  GROWTH_SOURCE,
  GROWTH_UNITS,
  monthsFromDays,
  parseGestWeeks,
  PRETERM_WEEKS,
  type GrowthMeasure,
  type GrowthPoint,
  type GrowthSex,
} from "@/lib/growth";
import { GROWTH_NOTE } from "@/lib/techo";
import { jpDay } from "./labels";
import { PhotoSlot } from "./TechoPhotos";
import type { TechoItem } from "./useTecho";

/** 横軸は生後0〜24か月（この手帳の1000日の終わり＝2歳の誕生日まで） */
const X_MAX = 24;
const W = 340;
const H = 240;
const PAD = { l: 36, r: 10, t: 10, b: 28 };

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null);

/** 記録から点を集める（家族が OK した物だけ。値は家族が話したか紙から写した物） */
export function growthPoints(items: TechoItem[], birthDate: string, measure: GrowthMeasure): GrowthPoint[] {
  const out: GrowthPoint[] = [];
  for (const it of items) {
    if (it.pending) continue;
    const v = it.values;
    let value: number | null = null;
    if (measure === "weight") {
      const g = num(v.weightG);
      value = num(v.weightKg) ?? (g != null ? g / 1000 : null);
    } else if (measure === "height") value = num(v.heightCm);
    else value = num(v.headCm);
    if (value == null) continue;
    if (!["growth", "birth", "newborn", "child-checkup"].includes(it.page)) continue;
    const days = diffDays(it.date, birthDate);
    if (days < 0) continue;
    out.push({ month: monthsFromDays(days), value, date: it.date });
  }
  return out.sort((a, b) => a.month - b.month);
}

/** 前にこの端末で覚えていた帯の男女（家族ごとの保存へ移す前の物） */
const OLD_SEX_KEY = (familyId: string) => `boshi.childSex.${familyId}`;

/** 出産の記録の週数（在胎週）。読めなければ null */
export function birthGestWeeks(items: TechoItem[]): number | null {
  for (const it of items) {
    if (it.pending || it.page !== "birth") continue;
    const w = parseGestWeeks(it.values.week);
    if (w != null) return w;
  }
  return null;
}

export function GrowthChart({ items, onAdd }: { items: TechoItem[]; onAdd: (values: Record<string, number>, date: string) => Promise<void> }) {
  const { family, today } = useFamily();
  const [measure, setMeasure] = useState<GrowthMeasure>("weight");
  // undefined = まだ読んでいる。null = まだ選んでいない
  const [sex, setSex] = useState<GrowthSex | null | undefined>(undefined);
  // null = 家族がまだ切り替えていない（早く生まれた子は修正月齢を既定にする）
  const [correctedPick, setCorrectedPick] = useState<boolean | null>(null);
  const [showMid, setShowMid] = useState(false);
  // 帯の男女は家族ごとに覚える（どの端末から開いても、一度選べば次から聞かない）
  useEffect(() => {
    let alive = true;
    setSex(undefined);
    api<{ keep?: { childSex?: GrowthSex } }>(`/api/keep?familyId=${encodeURIComponent(family.id)}`)
      .then((r) => {
        if (!alive) return;
        const kept = r.keep?.childSex;
        if (kept === "boy" || kept === "girl") {
          setSex(kept);
          return;
        }
        // 前にこの端末で選んでいたら、家族の記録へ移す
        let old: string | null = null;
        try {
          old = localStorage.getItem(OLD_SEX_KEY(family.id));
        } catch {}
        if (old === "boy" || old === "girl") {
          setSex(old);
          void api("/api/keep", { body: { familyId: family.id, keep: { childSex: old } } }).catch(() => {});
        } else setSex(null);
      })
      .catch(() => alive && setSex(null));
    return () => {
      alive = false;
    };
  }, [family.id]);
  const chooseSex = (s: GrowthSex) => {
    setSex(s);
    void api("/api/keep", { body: { familyId: family.id, keep: { childSex: s } } }).catch(() => {});
  };

  const gest = useMemo(() => birthGestWeeks(items), [items]);
  const preterm = gest != null && gest < PRETERM_WEEKS;
  const corrected = correctedPick ?? preterm;
  const setCorrected = setCorrectedPick;
  const shift = preterm && corrected ? correctionMonths(gest) : 0;

  const birth = family.birthDate && diffDays(today, family.birthDate) >= 0 ? family.birthDate : null;
  const points = useMemo(() => (birth ? growthPoints(items, birth, measure) : []), [items, birth, measure]);
  // 修正月齢で見る時は、点だけを予定日から数えた月齢に動かす（帯はそのまま）
  const drawn = useMemo(() => (shift ? points.map((p) => ({ ...p, month: p.month - shift })) : points), [points, shift]);
  const beforeZero = drawn.filter((p) => p.month < 0).length;

  if (!birth) {
    return <p className="text-base text-muted">生まれた日が入ると、ここに曲線が出ます（設定の「生まれた日」）。</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="tablist" aria-label="何の曲線を見るか">
        {(["weight", "height", "head"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={measure === m}
            onClick={() => setMeasure(m)}
            className={`min-h-11 flex-1 rounded-full border text-base font-semibold ${measure === m ? "border-rose bg-rose-soft text-rose" : "border-line bg-card text-muted"}`}
          >
            {GROWTH_LABELS[m]}
          </button>
        ))}
      </div>

      {preterm && (
        <div className="flex flex-col gap-1 rounded-xl bg-paper p-3">
          <div className="flex gap-2" role="tablist" aria-label="月齢の数え方">
            {([false, true] as const).map((c) => (
              <button
                key={String(c)}
                type="button"
                role="tab"
                aria-selected={corrected === c}
                onClick={() => setCorrected(c)}
                className={`min-h-11 flex-1 rounded-full border text-base font-semibold ${corrected === c ? "border-rose bg-rose-soft text-rose" : "border-line bg-card text-muted"}`}
              >
                {c ? "修正月齢で見る" : "生まれた日から"}
              </button>
            ))}
          </div>
          <p className="text-sm text-muted">
            出産の記録の週数（{Math.floor(gest)}週{Math.round((gest % 1) * 7) ? `${Math.round((gest % 1) * 7)}日` : ""}）から、予定日より早かった分を引いて数えます。{CORRECTED_NOTE}
          </p>
          {corrected && beforeZero > 0 && <p className="text-sm text-muted">予定日より前の{beforeZero}件は曲線の外です（下の一覧には出ます）。</p>}
        </div>
      )}

      {sex === undefined ? (
        <p className="text-base text-muted">帯を用意しています…</p>
      ) : sex == null ? (
        <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
          <p className="text-base">帯は男の子と女の子で少し違います。どちらの帯で見ますか？</p>
          <div className="flex gap-2">
            <Btn kind="secondary" onClick={() => chooseSex("boy")}>男の子</Btn>
            <Btn kind="secondary" onClick={() => chooseSex("girl")}>女の子</Btn>
          </div>
        </div>
      ) : (
        <>
          <Chart measure={measure} sex={sex} points={drawn} corrected={shift > 0} showMid={showMid} />
          <label className="flex min-h-11 items-center gap-2 self-start text-sm text-muted">
            <input type="checkbox" checked={showMid} onChange={(e) => setShowMid(e.target.checked)} className="size-5" />
            真ん中の線も見る
          </label>
          <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
            <span>{sex === "boy" ? "男の子" : "女の子"}の帯</span>
            <button type="button" className="min-h-11 underline" onClick={() => chooseSex(sex === "boy" ? "girl" : "boy")}>
              {sex === "boy" ? "女の子" : "男の子"}の帯にする
            </button>
          </p>
        </>
      )}

      <p className="rounded-xl bg-sky-soft px-3 py-2 text-base">{GROWTH_NOTE}</p>

      {points.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-base">
          {points.map((p) => (
            <li key={`${p.date}-${p.value}`} className="flex min-h-11 items-center justify-between gap-2">
              <span>
                {jpDay(p.date)}　{GROWTH_LABELS[measure]} {Math.round(p.value * 100) / 100}
                {GROWTH_UNITS[measure]}
              </span>
              <PhotoSlot techoIds={items.filter((it) => it.page === "growth" && !it.pending && it.date === p.date).map((it) => it.id)} compact />
            </li>
          ))}
        </ul>
      )}

      <AddFromPaper today={today} onAdd={onAdd} />

      <Why label="帯の出どころ">
        <p>
          {GROWTH_SOURCE.title}（{GROWTH_SOURCE.year}年調査・{GROWTH_SOURCE.published.slice(0, 4)}年公表）の、3・50・97 パーセンタイル値。帯は、同じ月齢の子の94%が入る幅（3〜97パーセンタイル）です。小さく生まれた子は、その子の線の伸びで見ます。
        </p>
        <p>{GROWTH_APPROX_NOTE}</p>
        <p>
          <a href={GROWTH_SOURCE.url} target="_blank" rel="noreferrer" className="underline">
            こども家庭庁のページ
          </a>
        </p>
      </Why>
    </div>
  );
}

function Chart({ measure, sex, points, corrected, showMid }: { measure: GrowthMeasure; sex: GrowthSex; points: GrowthPoint[]; corrected: boolean; showMid: boolean }) {
  const { band, mid, yMin, yMax } = useMemo(() => {
    const steps: { m: number; p: number[] }[] = [];
    for (let m = 0; m <= X_MAX + 1e-9; m += 0.25) {
      const p = bandAt(measure, sex, m);
      if (p) steps.push({ m, p });
    }
    const inRange = points.filter((p) => p.month >= 0 && p.month <= X_MAX);
    let lo = Math.min(...steps.map((s) => s.p[0]), ...inRange.map((p) => p.value));
    let hi = Math.max(...steps.map((s) => s.p[6]), ...inRange.map((p) => p.value));
    const pad = (hi - lo) * 0.05;
    lo = Math.floor(lo - pad);
    hi = Math.ceil(hi + pad);
    return { band: steps, mid: steps.map((s) => ({ m: s.m, v: s.p[3] })), yMin: lo, yMax: hi };
  }, [measure, sex, points]);

  const x = (m: number) => PAD.l + (Math.min(m, X_MAX) / X_MAX) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b);
  const upper = band.map((s) => `${x(s.m)},${y(s.p[6])}`);
  const lower = [...band].reverse().map((s) => `${x(s.m)},${y(s.p[0])}`);
  const yStep = measure === "weight" ? 2 : 5;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yMin / yStep) * yStep; v <= yMax; v += yStep) yTicks.push(v);
  const shown = points.filter((p) => p.month >= 0 && p.month <= X_MAX);
  const unit = GROWTH_UNITS[measure];

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${GROWTH_LABELS[measure]}の発育曲線。帯は国の調査の3から97パーセンタイル${showMid ? "、線は50パーセンタイル" : ""}。点は記録（${shown.length}件）`}>
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="currentColor" className="text-line" strokeWidth={0.5} />
            <text x={PAD.l - 4} y={y(v) + 3} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
              {v}
            </text>
          </g>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((m) => (
          <text key={m} x={x(m)} y={H - PAD.b + 12} textAnchor="middle" fontSize={9} fill="currentColor" className="text-muted">
            {m}
          </text>
        ))}
        <text x={W - PAD.r} y={H - 4} textAnchor="end" fontSize={9} fill="currentColor" className="text-muted">
          {corrected ? "修正月齢（か月）" : "生後（か月）"}
        </text>
        <text x={4} y={PAD.t + 2} fontSize={9} fill="currentColor" className="text-muted">
          {unit}
        </text>
        <polygon points={[...upper, ...lower].join(" ")} fill="currentColor" className="text-sky" fillOpacity={0.18} />
        {showMid && <polyline points={mid.map((s) => `${x(s.m)},${y(s.v)}`).join(" ")} fill="none" stroke="currentColor" className="text-sky" strokeWidth={1.2} />}
        {shown.length > 1 && (
          <polyline points={shown.map((p) => `${x(p.month)},${y(p.value)}`).join(" ")} fill="none" stroke="currentColor" className="text-rose" strokeWidth={1.5} />
        )}
        {shown.map((p) => (
          <circle key={`${p.date}-${p.value}`} cx={x(p.month)} cy={y(p.value)} r={3.5} fill="currentColor" className="text-rose" />
        ))}
      </svg>
      <figcaption className="text-sm text-muted">
        帯: 同じ月齢の子の94%が入る幅（3〜97）{showMid ? "　線: 50" : ""}　点: わが家の記録{shown.length === 0 ? "（まだありません）" : ""}
      </figcaption>
    </figure>
  );
}

/** 紙の手帳に書いてある数字を写す（家族が入れた数字だけ。空の欄は入れない） */
function AddFromPaper({ today, onAdd }: { today: string; onAdd: (values: Record<string, number>, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const [hd, setHd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 通信・保存の失敗か（入れ忘れの声かけとは見せ方を分ける）
  const [failed, setFailed] = useState(false);
  if (!open) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="secondary" full onClick={() => setOpen(true)}>
          打って入れる
        </Btn>
        <Btn kind="secondary" full href="/capture">
          話す・撮る
        </Btn>
      </div>
    );
  }
  const save = async () => {
    const values: Record<string, number> = {};
    const pw = parseFloat(w);
    const ph = parseFloat(h);
    const phd = parseFloat(hd);
    if (pw > 0) values.weightKg = pw;
    if (ph > 0) values.heightCm = ph;
    if (phd > 0) values.headCm = phd;
    if (Object.keys(values).length === 0) {
      setFailed(false);
      setError("数字を1つ以上入れてください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(values, date);
      setW("");
      setH("");
      setHd("");
      setOpen(false);
    } catch (e) {
      setFailed(true);
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };
  const field = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base";
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        測った日
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          体重（kg）
          <input inputMode="decimal" value={w} onChange={(e) => setW(e.target.value)} className={field} placeholder="例 6.2" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          身長（cm）
          <input inputMode="decimal" value={h} onChange={(e) => setH(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          頭囲（cm）
          <input inputMode="decimal" value={hd} onChange={(e) => setHd(e.target.value)} className={field} />
        </label>
      </div>
      <p className="text-sm text-muted">紙に書いてある数字だけを入れてください。分からない欄は空のままで。</p>
      {error &&
        (failed ? (
          <Notice title="手帳に届きませんでした" safe="入れた数字は消えていません。もう一度「入れる」を押してください。" detail={error} />
        ) : (
          <p className="text-sm font-semibold">{error}</p>
        ))}
      <div className="flex gap-2">
        <Btn onClick={() => void save()} disabled={busy}>
          {busy ? "入れています…" : "入れる"}
        </Btn>
        <Btn kind="quiet" onClick={() => setOpen(false)}>
          やめる
        </Btn>
      </div>
    </div>
  );
}
