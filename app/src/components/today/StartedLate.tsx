"use client";

// 手帳を始める前の事（UI/UX 見直し 2026-11-04）。
// 途中から使い始めた家族は、始めた日より前に期限（目安）が過ぎた事を、サーバが「済み」にしておく（auto: started-late）。
// 多くの家族は済ませているが、黙って済みにすると、まだの家族は抜け落ちる（例: 11週で始めた人の母子手帳の届け）。
// そこで、始めた日の前の60日に期限が過ぎた事だけを「済んでいますか？」で1回聞く。
// 「まだ」なら、予定の並びには戻さず（目安を過ぎた事は畳まれるので）、この1枚に「まだの事」として出し続ける。
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Family } from "@/lib/demo-family";
import { scheduleFor, type Milestone } from "@/lib/milestones";
import { recentlyPassed } from "@/lib/started-late";
import { api } from "../FamilyProvider";
import { jpShort } from "./dates";

type Item = { id: string; open: boolean };

/**
 * onCount: 聞く事とまだの事の数（「いま」の「大丈夫」の言い方を変える）
 * onOpen: 「まだ」と答えた事の id（「いま」が一番上の札に上げる。UX 2026-11-04: 小さな札だけで、先に動いていなかった）
 * lifted: 一番上の札に上げた事（ここの「まだの事」には重ねて出さない）。version: 変わったら読み直す
 * forPartner: 見ているのがパートナーの時は、母の番の事を聞かない（母の手続きを、パートナーの一番先の事にしない。UX 2026-11-04）
 */
export function StartedLate({ family, today, onCount, onOpen, lifted, version = 0, forPartner = false }: { family: Family; today: string; onCount?: (n: number) => void; onOpen?: (ids: string[]) => void; lifted?: string; version?: number; forPartner?: boolean }) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(() => {
    api<{ startedLate?: Item[] }>(`/api/done?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => setItems(r.startedLate ?? []))
      .catch(() => setItems([]));
  }, [family.id, today]);
  useEffect(load, [load, version]);

  const schedule = useMemo(() => scheduleFor(family, today), [family, today]);
  const { ask, open } = useMemo(() => {
    const byId = new Map(schedule.map((m) => [m.id, m]));
    const recent = new Set(recentlyPassed(schedule, family.startedOn ?? today).map((m) => m.id));
    const pick = (f: (i: Item) => boolean) =>
      (items ?? [])
        .filter(f)
        .map((i) => byId.get(i.id))
        .filter((m): m is Milestone => !!m && !(forPartner && m.who === "母"));
    return { ask: pick((i) => !i.open && recent.has(i.id)), open: pick((i) => i.open) };
  }, [items, schedule, family.startedOn, today, forPartner]);
  const count = ask.length + open.length;
  useEffect(() => onCount?.(count), [count, onCount]);
  const openKey = open.map((m) => m.id).join(",");
  useEffect(() => onOpen?.(openKey ? openKey.split(",") : []), [openKey, onOpen]);
  const shownOpen = open.filter((m) => m.id !== lifted);
  if (!ask.length && !shownOpen.length) return null;
  if (!count) return null;

  const answer = async (id: string, done: boolean) => {
    setBusy(id);
    try {
      await api("/api/done", { body: { familyId: family.id, milestoneId: id, today, ...(done ? {} : { open: true }) } });
      load();
    } finally {
      setBusy(null);
    }
  };

  return (
    <section aria-label="手帳を始める前の事" className="flex flex-col gap-3 rounded-2xl border border-line bg-card px-4 py-4">
      {ask.length > 0 && (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-bold">もう済んでいますか？</h2>
            <p className="text-sm text-muted">手帳を始める前の時期の事です。「まだ」を押すと、やる事に入れます。</p>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {ask.map((m) => (
              <li key={m.id} className="flex flex-col gap-2 py-2">
                <span className="text-base">
                  {m.plain}
                  <span className="text-sm text-muted">（目安 {jpShort(m.deadlineDate!, today)}）</span>
                </span>
                <span className="flex gap-2">
                  <button type="button" disabled={busy === m.id} onClick={() => void answer(m.id, true)} className="min-h-11 rounded-full bg-ok/10 px-4 text-base font-semibold text-ok disabled:opacity-50">
                    済んでいる
                  </button>
                  <button type="button" disabled={busy === m.id} onClick={() => void answer(m.id, false)} className="min-h-11 rounded-full bg-rose-soft px-4 text-base font-semibold text-rose disabled:opacity-50">
                    まだ
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
      {shownOpen.length > 0 && (
        <>
          <h2 className="font-display text-lg font-bold">始める前の事で、まだの事</h2>
          <ul className="flex flex-col divide-y divide-line">
            {shownOpen.map((m) => (
              <li key={m.id} className="flex flex-col gap-1 py-2">
                <span className="text-base font-semibold">{m.plain}</span>
                {m.hint && <span className="text-sm text-muted">{m.hint}</span>}
                <span>
                  <button type="button" disabled={busy === m.id} onClick={() => void answer(m.id, true)} className="min-h-11 rounded-full bg-ok/10 px-4 text-base font-semibold text-ok disabled:opacity-50">
                    済んだ
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
