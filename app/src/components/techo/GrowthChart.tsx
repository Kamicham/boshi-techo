"use client";

// 発育曲線: 国の調査（令和5年）の 3〜97 パーセンタイルの帯に、家族の記録の点を打つ。50 の線は「真ん中の線も見る」で出す（既定は描かない＝真ん中と比べさせない）。
// 在胎37週未満で生まれた子は、修正月齢で見るのを既定にする（その子の線の伸びで見る）。
// 点の位置で良し悪しを言わない。手帳と同じ注意書き（GROWTH_NOTE）をそのまま出す。
// 帯の男女は家族ごとに覚える（/api/keep の childSex）。早く生まれた子は、修正月齢で見る切り替えを出す。
// からだの記録（家族の声②・プランの B の7・2026-11-05）: 男女を選ぶ前も帯なしで点と線を描く（選ばせない）。横軸は記録の範囲に合わせる
// （最短3か月〜最長24か月）。双子などは who で線を分ける。描く所は props だけの部品 GrowthLines（健診で見せる1枚でも使う）。
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Notice, plainError, Why } from "@/components/ui";
import { diffDays } from "@/lib/clock";
import {
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
import { t } from "@/lib/i18n";
import { GROWTH_NOTE } from "@/lib/techo";
import { GrowthLines, type GrowthLine } from "./GrowthLines";
import { jpDay } from "./labels";
import { PhotoSlot } from "./TechoPhotos";
import type { TechoItem } from "./useTecho";

/** 赤ちゃんの体・身長・頭囲を拾うページ */
const CHILD_PAGES = new Set(["growth", "birth", "newborn", "child-checkup"]);

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
    if (!CHILD_PAGES.has(it.page)) continue;
    const days = diffDays(it.date, birthDate);
    if (days < 0) continue;
    out.push({ month: monthsFromDays(days), value, date: it.date });
  }
  return out.sort((a, b) => a.month - b.month);
}

/**
 * 子ごとの線（双子などは記録の who で分ける。who の無い記録は子の名前の線へ）。並びは呼び名の順（「1人目」→「2人目」）。
 * 点の無い子は線を作らない
 */
export function growthLines(items: TechoItem[], birthDate: string, measure: GrowthMeasure, childName?: string): GrowthLine[] {
  const by = new Map<string, TechoItem[]>();
  for (const it of items) {
    if (!CHILD_PAGES.has(it.page)) continue;
    const who = it.who?.trim() || childName || "";
    by.set(who, [...(by.get(who) ?? []), it]);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([label, xs]) => ({ label, points: growthPoints(xs, birthDate, measure) }))
    .filter((l) => l.points.length > 0);
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

export function GrowthChart({ items, onAdd }: { items: TechoItem[]; onAdd: (values: Record<string, number>, date: string, who?: string) => Promise<void> }) {
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
  const lines = useMemo(() => (birth ? growthLines(items, birth, measure, family.childName) : []), [items, birth, measure, family.childName]);
  // 修正月齢で見る時は、点だけを予定日から数えた月齢に動かす（帯はそのまま）
  const drawn = useMemo(() => (shift ? lines.map((l) => ({ ...l, points: l.points.map((p) => ({ ...p, month: p.month - shift })) })) : lines), [lines, shift]);
  const beforeZero = drawn.reduce((n, l) => n + l.points.filter((p) => p.month < 0).length, 0);
  // 下の一覧（日付の順。双子などは誰の点かを添える）
  const twins = lines.length > 1;
  const listed = useMemo(() => lines.flatMap((l) => l.points.map((p) => ({ ...p, who: l.label }))).sort((a, b) => a.date.localeCompare(b.date)), [lines]);

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

      {/* 帯の男女がまだ決まっていない時（読んでいる間も）は、帯なしで点と線を描く（選ばせない） */}
      <GrowthLines measure={measure} sex={sex ?? null} lines={drawn} corrected={shift > 0} showMid={showMid} />
      {sex === null && (
        <p className="flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>{t("帯を見る:")}</span>
          <button type="button" className="min-h-11 underline" onClick={() => chooseSex("boy")}>
            {t("男の子")}
          </button>
          <button type="button" className="min-h-11 underline" onClick={() => chooseSex("girl")}>
            {t("女の子")}
          </button>
        </p>
      )}
      {sex && (
        <>
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

      {listed.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-base">
          {listed.map((p) => (
            <li key={`${p.who}-${p.date}-${p.value}`} className="flex min-h-11 items-center justify-between gap-2">
              <span>
                {twins && <span className="text-muted">{p.who} </span>}
                {jpDay(p.date)}　{GROWTH_LABELS[measure]} {Math.round(p.value * 100) / 100}
                {GROWTH_UNITS[measure]}
              </span>
              <PhotoSlot
                techoIds={items
                  .filter((it) => it.page === "growth" && !it.pending && it.date === p.date && (!twins || (it.who?.trim() || family.childName || "") === p.who))
                  .map((it) => it.id)}
                compact
              />
            </li>
          ))}
        </ul>
      )}

      <AddFromPaper today={today} onAdd={onAdd} whos={twins ? lines.map((l) => l.label) : []} />

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

/** 紙の手帳に書いてある数字を写す（家族が入れた数字だけ。空の欄は入れない） */
function AddFromPaper({
  today,
  onAdd,
  whos,
}: {
  today: string;
  onAdd: (values: Record<string, number>, date: string, who?: string) => Promise<void>;
  /** 双子などの時の子の呼び名（どの子の数字かを選ぶ。1人の時は空） */
  whos: string[];
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [who, setWho] = useState("");
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
    if (whos.length > 1 && !whos.includes(who)) {
      setFailed(false);
      setError(t("どの子の数字かを選んでください"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd(values, date, whos.length > 1 ? who : undefined);
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
      {whos.length > 1 && (
        <fieldset className="flex flex-col gap-1">
          <legend className="text-sm text-muted">{t("どの子の数字か")}</legend>
          <div className="flex flex-wrap gap-2">
            {whos.map((w) => (
              <label key={w} className={`flex min-h-11 items-center gap-2 rounded-full border px-3 text-base ${who === w ? "border-rose bg-rose-soft" : "border-line bg-card"}`}>
                <input type="radio" name="growth-who" value={w} checked={who === w} onChange={() => setWho(w)} className="size-4" />
                {w}
              </label>
            ))}
          </div>
        </fieldset>
      )}
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
