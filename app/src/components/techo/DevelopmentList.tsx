"use client";

// できた日: 手帳の保護者の記録と同じく「できた時期」を書く形。目安と比べたり、遅い・早いを言ったりしない。
// 出典: 母子健康手帳 府令様式（保護者の記録）。こども家庭庁「母子健康手帳について」2026年版。
import { useState } from "react";
import { Btn } from "@/components/ui";
import { DEVELOPMENT_ITEMS, DEVELOPMENT_NOTE } from "@/lib/techo";
import { jpDay } from "./labels";
import type { TechoItem } from "./useTecho";

export function DevelopmentList({ items, today, onAdd }: { items: TechoItem[]; today: string; onAdd: (item: string, date: string) => Promise<void> }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // 項目ごとに一番早い「できた日」
  const doneOn = new Map<string, string>();
  for (const it of items) {
    if (it.pending) continue;
    const name = String(it.values.item ?? it.title ?? "");
    const prev = doneOn.get(name);
    if (!prev || it.date < prev) doneOn.set(name, it.date);
  }
  const save = async (name: string) => {
    setBusy(true);
    setError("");
    try {
      await onAdd(name, date);
      setEditing(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col divide-y divide-line">
        {DEVELOPMENT_ITEMS.map((name) => {
          const d = doneOn.get(name);
          return (
            <li key={name} className="flex flex-col gap-2 py-1">
              <div className="flex min-h-11 items-center justify-between gap-2">
                <span className="text-base">{name}</span>
                {d ? (
                  <span className="text-base font-semibold text-rose">{jpDay(d)}</span>
                ) : editing === name ? null : (
                  <button
                    type="button"
                    className="min-h-11 rounded-full border border-ink/20 px-4 text-sm font-semibold"
                    onClick={() => {
                      setEditing(name);
                      setDate(today);
                    }}
                  >
                    できた日を入れる
                  </button>
                )}
              </div>
              {editing === name && (
                <div className="flex flex-wrap items-end gap-2 pb-2">
                  <label className="flex flex-col gap-1 text-sm text-muted">
                    できた日
                    <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-lg border border-line bg-card px-3 text-base" />
                  </label>
                  <Btn onClick={() => void save(name)} disabled={busy}>
                    {busy ? "入れています…" : "入れる"}
                  </Btn>
                  <Btn kind="quiet" onClick={() => setEditing(null)}>
                    やめる
                  </Btn>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-alert">{error}</p>}
      <p className="rounded-xl bg-sky-soft px-3 py-2 text-base">{DEVELOPMENT_NOTE}</p>
    </div>
  );
}
