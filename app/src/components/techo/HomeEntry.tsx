"use client";

// 家で測った体重・血圧を1行で入れる口と、家で測った記録の一覧（からだの記録・家族の声②・プランの B の4・6）。
// 体重の線の下に置く。「体重 [　] kg ［入れる］」。日付は今日で、変えられる。「血圧も」を押すと血圧の欄が出る。
// 入れる先は手帳の page "home"（妊婦健診のページには入れない＝健診の回数と受診券の残りがずれないように）。
// 入力を促す言葉は使わない。数字の良し悪しは言わない（桁の打ち間違いだけを聞き返す）。体温は打つ画面（TypeSheet）の「家で測った」から。
import { useState } from "react";
import { Btn, Notice, plainError } from "@/components/ui";
import { t } from "@/lib/i18n";
import { HOME_PAGE_ID, type TechoEntry } from "@/lib/techo";
import type { TechoItem } from "./useTecho";

/** 打ち間違い（桁の取り違え）だけを止める幅。良し悪しの線ではない */
const RANGE = { weightKg: [20, 250], bpHigh: [50, 260], bpLow: [30, 200] } as const;
const inRange = (k: keyof typeof RANGE, v: number) => v >= RANGE[k][0] && v <= RANGE[k][1];
const md = (date: string) => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const n1 = (v: unknown) => (typeof v === "number" ? String(Math.round(v * 10) / 10) : "");

/** 家で測った1件を短い1行に（体重 58.2kg・血圧 112/70・体温 36.6℃） */
export function homeLine(values: TechoEntry["values"]): string {
  const parts: string[] = [];
  if (typeof values.weightKg === "number") parts.push(t("体重 {kg}kg", { kg: n1(values.weightKg) }));
  if (typeof values.bpHigh === "number" || typeof values.bpLow === "number") parts.push(t("血圧 {hi}/{lo}", { hi: n1(values.bpHigh), lo: n1(values.bpLow) }));
  if (typeof values.tempC === "number") parts.push(t("体温 {c}℃", { c: n1(values.tempC) }));
  return parts.join(t("、"));
}

export function HomeEntry({
  today,
  rows,
  add,
  remove,
  who,
}: {
  today: string;
  /** 家で測った記録（page "home"・OK 済み） */
  rows: TechoItem[];
  add: (entry: Omit<TechoEntry, "source">) => Promise<void>;
  remove: (ids: string[]) => Promise<void>;
  /** 測った人の呼び名（ママ） */
  who?: string;
}) {
  const [kg, setKg] = useState("");
  const [date, setDate] = useState(today);
  const [bpOpen, setBpOpen] = useState(false);
  const [hi, setHi] = useState("");
  const [lo, setLo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 通信・保存の失敗か（打ち間違いの聞き返しとは見せ方を分ける）
  const [failed, setFailed] = useState(false);

  const save = async () => {
    const values: Record<string, number> = {};
    const w = parseFloat(kg);
    const h = parseInt(hi, 10);
    const l = parseInt(lo, 10);
    if (kg.trim()) {
      if (!inRange("weightKg", w)) return ask(t("体重の数字の桁を確かめてください"));
      values.weightKg = Math.round(w * 10) / 10;
    }
    if (bpOpen && (hi.trim() || lo.trim())) {
      if (!inRange("bpHigh", h) || !inRange("bpLow", l)) return ask(t("血圧は上と下の両方の数字を入れてください"));
      values.bpHigh = h;
      values.bpLow = l;
    }
    if (!Object.keys(values).length) return ask(t("数字を1つ以上入れてください"));
    setBusy(true);
    setError("");
    try {
      // 訳さない: 記録の題（手帳のデータ。画面では題を出さず、数字を画面の言葉で組む）
      await add({ page: HOME_PAGE_ID, date, title: "家で測った", ...(who ? { who } : {}), values });
      setKg("");
      setHi("");
      setLo("");
    } catch (e) {
      setFailed(true);
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };
  function ask(message: string) {
    setFailed(false);
    setError(message);
  }

  const field = "min-h-11 rounded-lg border border-line bg-card px-3 text-base tabular-nums";
  const recent = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <div className="flex flex-col gap-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label className="flex items-center gap-2 text-base">
          {t("体重")}
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} className={`${field} w-24`} aria-label={t("家で測った体重（kg）")} />
          kg
        </label>
        <Btn onClick={() => void save()} disabled={busy}>
          {busy ? t("入れています…") : t("入れる")}
        </Btn>
      </form>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        <label className="flex items-center gap-1">
          {t("測った日")}
          <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value || today)} className="min-h-11 rounded-lg border border-line bg-card px-2 text-sm" />
        </label>
        {!bpOpen && (
          <button type="button" className="min-h-11 underline underline-offset-2" onClick={() => setBpOpen(true)}>
            {t("血圧も")}
          </button>
        )}
      </div>
      {bpOpen && (
        <div className="flex flex-wrap items-center gap-2 text-base">
          {t("血圧")}
          <input inputMode="numeric" value={hi} onChange={(e) => setHi(e.target.value)} className={`${field} w-20`} aria-label={t("血圧（上）")} />
          /
          <input inputMode="numeric" value={lo} onChange={(e) => setLo(e.target.value)} className={`${field} w-20`} aria-label={t("血圧（下）")} />
          mmHg
        </div>
      )}
      {error &&
        (failed ? (
          <Notice title={t("手帳に届きませんでした")} safe={t("入れた数字は消えていません。もう一度「入れる」を押してください。")} detail={error} />
        ) : (
          <p className="text-sm font-semibold">{error}</p>
        ))}
      {recent.length > 0 && (
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-sm text-muted [&::-webkit-details-marker]:hidden">
            <span className="underline underline-offset-2">{t("家で測った記録（{n}件）", { n: recent.length })}</span>
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <ul className="mt-1 flex flex-col">
            {recent.map((r) => (
              <li key={r.id} className="flex min-h-11 items-center justify-between gap-2 border-b border-line text-base">
                <span className="tabular-nums">
                  {md(r.date)}　{homeLine(r.values)}
                </span>
                <button type="button" className="min-h-11 px-2 text-sm text-muted underline underline-offset-2" onClick={() => void remove([r.id])}>
                  {t("消す")}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
