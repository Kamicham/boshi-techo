"use client";

// 撮った・話した直後の候補。家族が見て「OK」を押すと手帳に入る（最後は OK だけ）。
// OK の前に日付を直せる。撮った紙に日付が無かった候補は、推した日で「この日で合っていますか？」と聞く（推せない時は空欄）。
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { DateCheck, initialDate, type DateUnsure } from "@/components/capture/DateCheck";
import { Btn, Why } from "@/components/ui";
import { TECHO_PAGES } from "@/lib/techo";
import { EntryCard } from "./EntryCard";
import type { TechoItem } from "./useTecho";

const pageTitle = (id: string) => TECHO_PAGES.find((p) => p.id === id)?.title ?? "";

/** 日付の確かさの印（useTecho が渡していない版でも動くように、無ければ印なし） */
const unsureOf = (it: TechoItem): DateUnsure => (it as TechoItem & { dateUnsure?: DateUnsure }).dateUnsure;

export function PendingBox({ items, onConfirm }: { items: TechoItem[]; onConfirm: (ids: string[], dates?: Record<string, string>) => Promise<void> }) {
  const { today } = useFamily();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  // 家族が直した日付（直していない候補は、候補の日のまま）
  const [edited, setEdited] = useState<Record<string, string>>({});
  if (items.length === 0) return null;
  const dateOf = (it: TechoItem) => edited[it.id] ?? initialDate(it.date, unsureOf(it));
  const ok = async (it: TechoItem) => {
    const date = dateOf(it);
    if (!date) return;
    setBusy(it.id);
    setError("");
    try {
      const dates = { [it.id]: date };
      // 日付を直した・推した日の候補は、その日で確定する（onConfirm が日付を /api/techo へ渡す）
      await onConfirm([it.id], dates);
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
      <p className="text-sm">紙の手帳と見比べて、合っていれば OK。日付が違う時は直してから OK。中身が違う時は OK せず、撮り直すか話し直してください。</p>
      {items.map((it) => (
        <div key={it.id} className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">{pageTitle(it.page)}</p>
          <EntryCard item={it}>
            <div className="flex flex-col gap-2 pt-1">
              <DateCheck
                id={`pending-date-${it.id}`}
                value={dateOf(it)}
                onChange={(v) => setEdited((cur) => ({ ...cur, [it.id]: v }))}
                unsure={unsureOf(it)}
                max={today}
                disabled={busy != null}
              />
              <div>
                <Btn onClick={() => void ok(it)} disabled={busy != null || !dateOf(it)}>
                  {busy === it.id ? "入れています…" : "OK"}
                </Btn>
              </div>
            </div>
          </EntryCard>
        </div>
      ))}
      {error && <p className="text-sm text-alert">{error}</p>}
      <Why>
        <p>撮った写真や話した言葉から読み取った物は、まだ候補です。読めなかった値は入れていません。</p>
        <p>紙に日付が無い時は、今日の日付にせず、ページの題と生まれた日から推した日を出します。</p>
        <p>手帳に入れるのは、家族が OK した物だけです。</p>
      </Why>
    </section>
  );
}
