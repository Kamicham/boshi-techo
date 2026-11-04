"use client";

// 予防接種の記録: 接種日・ワクチン・回・ロット・医療機関を、証明の控えとして並べる。
// 名前は「今日」の画面の予定（lib/milestones.ts の vaccines-*）と同じ呼び方に合わせる。
// 出典: 予防接種法・同施行令の定期接種（五種混合は2024年4月から）。厚生労働省「予防接種情報」https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/kekkaku-kansenshou/yobou-sesshu/index.html
// 正本は紙の手帳の「予防接種の記録」欄（医療機関が書く・シールを貼る）。ここは家族の控え。
import { useState } from "react";
import { Btn, Why } from "@/components/ui";
import { jpDay, vaccineLabel } from "./labels";
import type { TechoItem } from "./useTecho";

/** 2歳までの定期接種（今日の画面の予定と同じ名前） */
export const VACCINE_NAMES = ["B型肝炎", "ロタ", "小児用肺炎球菌", "五種混合", "BCG", "麻しん風しん", "水痘"] as const;

export function VaccineList({ items, today, onAdd }: { items: TechoItem[]; today: string; onAdd: (v: { vaccine: string; dose?: string; lot?: string; facility?: string }, date: string) => Promise<void> }) {
  const done = items.filter((i) => !i.pending);
  // ワクチンごとに束ねる（回の順＝日付の順）。見出しは呼び方の表でそろえる（「水痘」と「水ぼうそう」を1つに）
  const groups = new Map<string, TechoItem[]>();
  for (const it of done) {
    const name = vaccineLabel(String(it.values.vaccine ?? it.title ?? ""));
    groups.set(name, [...(groups.get(name) ?? []), it]);
  }
  const known = VACCINE_NAMES.map(vaccineLabel);
  const order = [...known.filter((n) => groups.has(n)), ...[...groups.keys()].filter((n) => !known.includes(n))];

  return (
    <div className="flex flex-col gap-3">
      {order.length > 0 ? (
        <div className="flex flex-col gap-3">
          {order.map((name) => (
            <section key={name} className="flex flex-col gap-1">
              <h4 className="text-base font-bold">{name}</h4>
              <ul className="flex flex-col gap-1">
                {groups.get(name)!.map((it) => (
                  <li key={it.id} className="rounded-lg bg-paper px-3 py-2 text-base">
                    <span className="font-semibold">{jpDay(it.date)}</span>
                    {it.values.dose ? `　${String(it.values.dose)}` : ""}
                    <span className="block text-sm text-muted">
                      {[it.values.lot ? `ロット（シールの番号） ${String(it.values.lot)}` : "", it.values.facility ? String(it.values.facility) : ""].filter(Boolean).join("　") || "ロット（シールの番号）・医療機関は未記入"}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <AddVaccine today={today} onAdd={onAdd} />
      <Why>
        <p>正式な記録は、紙の手帳の「予防接種の記録」欄です（医療機関が書き、シールを貼ります）。ここはその控えです。</p>
        <p>保育園・学校・海外へ行く時に、受けた日とロット（シールの番号）を聞かれる事があります。手元に控えがあると、すぐ答えられます。</p>
      </Why>
    </div>
  );
}

function AddVaccine({ today, onAdd }: { today: string; onAdd: (v: { vaccine: string; dose?: string; lot?: string; facility?: string }, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [vaccine, setVaccine] = useState<string>(VACCINE_NAMES[0]);
  const [other, setOther] = useState("");
  const [dose, setDose] = useState("1回目");
  const [lot, setLot] = useState("");
  const [facility, setFacility] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
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
  const field = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base";
  const save = async () => {
    const name = vaccine === "その他" ? other.trim() : vaccine;
    if (!name) {
      setError("ワクチンの名前を入れてください");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({ vaccine: name, dose: dose || undefined, lot: lot.trim() || undefined, facility: facility.trim() || undefined }, date);
      setLot("");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        受けた日
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        ワクチン
        <select value={vaccine} onChange={(e) => setVaccine(e.target.value)} className={field}>
          {[...VACCINE_NAMES, "その他"].map((n) => (
            <option key={n} value={n}>
              {n === "その他" ? n : vaccineLabel(n)}
            </option>
          ))}
        </select>
      </label>
      {vaccine === "その他" && <input value={other} onChange={(e) => setOther(e.target.value)} className={field} placeholder="ワクチンの名前" aria-label="ワクチンの名前" />}
      <label className="flex flex-col gap-1 text-sm text-muted">
        回
        <select value={dose} onChange={(e) => setDose(e.target.value)} className={field}>
          {["1回目", "2回目", "3回目", "4回目（追加）", ""].map((d) => (
            <option key={d} value={d}>
              {d || "分からない"}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        ロット（シールの番号）
        <input value={lot} onChange={(e) => setLot(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        医療機関
        <input value={facility} onChange={(e) => setFacility(e.target.value)} className={field} />
      </label>
      {error && <p className="text-sm text-alert">{error}</p>}
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
