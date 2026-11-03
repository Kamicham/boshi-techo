"use client";

// 「手帳に入れる候補」: 話した・撮った中から手帳のページに入りそうな物を出し、家族の「OK」で確定、「違う」で消す。
// 数字や色の良い悪いは言わない。手帳と同じ注意書きだけを添える。
import { useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { vaccineLabel } from "@/components/techo/labels";
import { Btn, Notice, Pill, plainError, Why } from "@/components/ui";
import { DEVELOPMENT_NOTE, GROWTH_NOTE, STOOL_COLORS, STOOL_NOTE, TECHO_PAGES, type TechoEntry } from "@/lib/techo";
import type { TechoDoc } from "@/lib/techo-store";
import { DateCheck, initialDate } from "./DateCheck";

/** 欄の名前と単位（画面の言葉） */
const LABELS: Record<string, [string, string?]> = {
  week: ["週数"],
  weightKg: ["体重", "kg"],
  weightG: ["体重", "g"],
  heightCm: ["身長", "cm"],
  headCm: ["頭囲", "cm"],
  chestCm: ["胸囲", "cm"],
  bpHigh: ["血圧（上）"],
  bpLow: ["血圧（下）"],
  fundusCm: ["子宮底長", "cm"],
  edema: ["むくみ"],
  urineProtein: ["尿たんぱく"],
  urineSugar: ["尿糖"],
  days: ["産後", "日"],
  dayAge: ["生まれて", "日"],
  colorNo: ["便色カード", "番"],
  ageText: ["時期"],
  item: ["できた事"],
  test: ["検査"],
  result: ["結果"],
  checkup: ["健診"],
  vaccine: ["ワクチン"],
  dose: ["回"],
  lot: ["ロット（シールの番号）"],
  facility: ["医療機関"],
  doctor: ["医師"],
  text: ["言葉"],
  occasion: ["いつ"],
  whom: ["相談した相手"],
  has: ["相談できる人"],
  method: ["お産の方法"],
  place: ["場所"],
  feeding: ["栄養"],
  vitaminK: ["ビタミンK2"],
  care: ["産後ケア"],
  memo: ["メモ"],
  history: ["かかった病気"],
  allergy: ["アレルギー"],
  medicine: ["薬"],
  pastBirths: ["前のお産"],
  smoking: ["たばこ"],
};

const pageTitle = (id: TechoEntry["page"]) => TECHO_PAGES.find((p) => p.id === id)?.title ?? id;

function valueText(key: string, v: TechoEntry["values"][string]): string {
  const [label, unit] = LABELS[key] ?? [key];
  if (typeof v === "boolean") return `${label}: ${v ? "いる" : "いない"}`;
  if (key === "vaccine" && typeof v === "string") return `${label}: ${vaccineLabel(v)}`;
  if (key === "colorNo" && typeof v === "number") return `${label}: ${v}番（${STOOL_COLORS.find((c) => c.no === v)?.name ?? ""}）`;
  return `${label}: ${v}${unit ?? ""}`;
}

function Candidate({
  d,
  date,
  onDate,
  today,
  onOk,
  onNo,
  busy,
}: {
  d: TechoDoc;
  date: string;
  onDate: (v: string) => void;
  today: string;
  onOk: () => void;
  onNo: () => void;
  busy: boolean;
}) {
  const e = d.data;
  const color = e.page === "stool" && typeof e.values.colorNo === "number" ? STOOL_COLORS.find((c) => c.no === e.values.colorNo) : undefined;
  const note = e.page === "stool" ? STOOL_NOTE : e.page === "growth" ? GROWTH_NOTE : e.page === "development" ? DEVELOPMENT_NOTE : null;
  const shown = Object.entries(e.values).filter(([k]) => !(e.page === "development" && k === "item") && !(e.page === "feeling" && k === "text"));
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="sky">{pageTitle(e.page)}</Pill>
        {e.who && <span className="text-sm text-muted">{e.who}</span>}
      </div>
      <p className="flex items-center gap-2 text-base font-semibold">
        {color && <span className="inline-block h-5 w-5 shrink-0 rounded-full border border-line" style={{ background: color.sample }} aria-hidden />}
        {e.page === "vaccine" && typeof e.values.vaccine === "string" ? vaccineLabel(e.values.vaccine) : e.title}
      </p>
      {e.page === "feeling" && typeof e.values.text === "string" && <p className="text-base">「{e.values.text}」</p>}
      {shown.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
          {shown.map(([k, v]) => (
            <li key={k} className="tabular">
              {valueText(k, v)}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-sm text-muted">{note}</p>}
      <DateCheck id={`date-${d.id}`} value={date} onChange={onDate} unsure={e.dateUnsure} max={today} disabled={busy} />
      <div className="flex gap-2">
        <Btn onClick={onOk} disabled={busy || !date}>
          OK
        </Btn>
        <Btn kind="secondary" onClick={onNo} disabled={busy}>
          違う
        </Btn>
      </div>
    </li>
  );
}

/** いま入れた事から出た、手帳の候補 */
export function TechoCandidates({ familyId, items, onChange }: { familyId: string; items: TechoDoc[]; onChange?: () => void }) {
  const { today } = useFamily();
  const [left, setLeft] = useState<TechoDoc[]>(() => items.filter((d) => d.data.pending));
  // 候補ごとの日付（OK の時にこの日で確定する）
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(items.map((d) => [d.id, initialDate(d.data.date, d.data.dateUnsure)])));
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (action: "confirm" | "remove", ids: string[]) => {
    setBusy(true);
    setError("");
    try {
      const pick = action === "confirm" ? Object.fromEntries(ids.map((id) => [id, dates[id]]).filter(([, v]) => v)) : undefined;
      await api("/api/techo", { body: { familyId, today, action, ids, ...(pick ? { dates: pick } : {}) } });
      setLeft((cur) => cur.filter((d) => !ids.includes(d.id)));
      if (action === "confirm") setDone((n) => n + ids.length);
      onChange?.();
    } catch (e) {
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!left.length && !done) return null;
  return (
    <section aria-label="手帳に入れる候補" className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">手帳に入れる候補</h2>
        {left.length > 1 && (
          <Btn kind="secondary" onClick={() => void send("confirm", left.map((d) => d.id))} disabled={busy || left.some((d) => !dates[d.id])}>
            {left.length}件ともOK
          </Btn>
        )}
      </div>
      {left.length > 0 && <p className="text-sm text-muted">合っていれば OK。数字は話した・書いてあるとおりだけ写しています。OK は後で手帳の上からもできます。OK した後も手帳から消せます</p>}
      {done > 0 && (
        <p role="status" className="text-sm font-semibold text-ok">
          {done}件を手帳に入れました
        </p>
      )}
      {error && <Notice title="手帳に届きませんでした" safe="候補はそのまま残っています。もう一度押してください。" detail={error} />}
      {left.length > 0 && (
        <ul className="flex flex-col gap-2">
          {left.map((d) => (
            <Candidate
              key={d.id}
              d={d}
              date={dates[d.id] ?? ""}
              onDate={(v) => setDates((cur) => ({ ...cur, [d.id]: v }))}
              today={today}
              busy={busy}
              onOk={() => void send("confirm", [d.id])}
              onNo={() => void send("remove", [d.id])}
            />
          ))}
        </ul>
      )}
      {left.length > 0 && (
        <Why>
          <p>撮った・話した事は、すぐには手帳に入れず候補にします。家族が OK した物だけが記録になります（紙の手帳が正本のまま）。</p>
          <p>読めなかった・言っていない数字は空のままにしています。手帳のページで足してください。</p>
          <p>OK した後も、手帳の記録の「消す」で消せます。</p>
          <p>紙に日付が無い時は、今日の日付にせず、ページの題（1か月児健診など）と生まれた日から推した日を出します。違う時は直してから OK してください。</p>
        </Why>
      )}
    </section>
  );
}
