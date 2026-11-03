"use client";

// 撮った・話した直後の候補。家族が見て「OK」を押すと手帳に入る（最後は OK だけ）。
import { useState } from "react";
import { Btn, Why } from "@/components/ui";
import { TECHO_PAGES } from "@/lib/techo";
import { EntryCard } from "./EntryCard";
import type { TechoItem } from "./useTecho";

const pageTitle = (id: string) => TECHO_PAGES.find((p) => p.id === id)?.title ?? "";

export function PendingBox({ items, onConfirm }: { items: TechoItem[]; onConfirm: (ids: string[]) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (items.length === 0) return null;
  const ok = async (ids: string[], key: string) => {
    setBusy(key);
    setError("");
    try {
      await onConfirm(ids);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-warn/10 p-4" aria-labelledby="pending-title">
      <h2 id="pending-title" className="font-display text-lg font-bold">
        見てから OK してください（{items.length}件）
      </h2>
      <p className="text-sm">紙の手帳と見比べて、合っていれば OK。違う時は OK せず、撮り直すか話し直してください。</p>
      {items.map((it) => (
        <div key={it.id} className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">{pageTitle(it.page)}</p>
          <EntryCard item={it}>
            <div className="pt-1">
              <Btn onClick={() => void ok([it.id], it.id)} disabled={busy != null}>
                {busy === it.id ? "入れています…" : "OK"}
              </Btn>
            </div>
          </EntryCard>
        </div>
      ))}
      {error && <p className="text-sm text-alert">{error}</p>}
      <Why>
        <p>撮った写真や話した言葉から読み取った物は、まだ候補です。読めなかった値は入れていません。</p>
        <p>手帳に入れるのは、家族が OK した物だけです。</p>
      </Why>
    </section>
  );
}
