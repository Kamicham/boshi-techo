"use client";

// 便色カード: 国の7色を番号つきで並べ、親が押して選んだ番号を記録する。AI は色を判定しない。
// 出典: 母子健康手帳 府令様式の便色カード（こども家庭庁「母子健康手帳について」2026年版）。
// 画面の見本の色は印刷の色の近似。画面では色が変わるので、実物は紙の手帳のカードで見比べる。
import { useState } from "react";
import { Btn, Why } from "@/components/ui";
import { STOOL_COLORS, STOOL_NOTE } from "@/lib/techo";
import { jpDay } from "./labels";
import type { TechoItem } from "./useTecho";

export function StoolCard({ items, today, onAdd }: { items: TechoItem[]; today: string; onAdd: (colorNo: number, date: string) => Promise<void> }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const done = items.filter((i) => !i.pending && typeof i.values.colorNo === "number");

  const save = async () => {
    if (picked == null) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(picked, date);
      setSaved(`${jpDay(date)}に ${picked}番 を入れました`);
      setPicked(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base">紙の手帳の便色カードと見比べて、近い番号を押してください。</p>
      <ul className="grid grid-cols-4 gap-2" aria-label="便の色の番号">
        {STOOL_COLORS.map((c) => (
          <li key={c.no}>
            <button
              type="button"
              onClick={() => setPicked(c.no)}
              aria-pressed={picked === c.no}
              aria-label={`${c.no}番 ${c.name}`}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 p-1 ${picked === c.no ? "border-rose" : "border-line"}`}
            >
              <span className="h-8 w-full rounded-md border border-ink/10" style={{ background: c.sample }} aria-hidden />
              <span className="text-sm font-semibold">{c.no}</span>
            </button>
          </li>
        ))}
      </ul>
      {picked != null && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-base">
            {picked}番（{STOOL_COLORS[picked - 1].name}）
          </p>
          <label className="flex flex-col gap-1 text-sm text-muted">
            見た日
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-lg border border-line bg-card px-3 text-base" />
          </label>
          <div className="flex gap-2">
            <Btn onClick={() => void save()} disabled={busy}>
              {busy ? "入れています…" : "記録する"}
            </Btn>
            <Btn kind="quiet" onClick={() => setPicked(null)}>
              やめる
            </Btn>
          </div>
        </div>
      )}
      {saved && <p className="text-sm text-muted" aria-live="polite">{saved}</p>}
      {error && <p className="text-sm text-alert">{error}</p>}
      {/* 急ぎの案内は消さない（手帳の文言の要約） */}
      <p className="rounded-xl bg-alert/10 px-3 py-2 text-base font-semibold text-alert">{STOOL_NOTE}</p>
      <div className="flex flex-wrap gap-2">
        <Btn href="tel:%238000" kind="secondary">
          #8000 に電話
        </Btn>
      </div>
      {done.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-base">
          {done.map((i) => (
            <li key={i.id}>
              {jpDay(i.date)}　{String(i.values.colorNo)}番
            </li>
          ))}
        </ul>
      )}
      <Why>
        <p>画面の色は見本で、紙に印刷された色の近似です。スマホの明るさで色が変わるので、必ず紙の手帳のカードで見比べてください。</p>
        <p>このアプリは色を見て判断しません。選んだ番号を、家族の記録として残すだけです。</p>
        <p>紙の手帳には、生後2週・1か月・1〜4か月ごろに見た番号を書く欄があります（母子健康手帳の便色カード）。</p>
      </Why>
    </div>
  );
}
