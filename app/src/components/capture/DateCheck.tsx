"use client";

// 手帳の候補の日付の欄。OK の前に、家族が日付を直せる。
// 撮った紙に日付が無かった時は、ページの題と子の生まれた日から推した日を入れて「この日で合っていますか？」と聞く（推せない時は空欄）。

export type DateUnsure = "guess" | "none" | undefined;

/** 候補の日付の欄の最初の値（推せなかった候補は空欄にして、入れてもらう） */
export const initialDate = (date: string, unsure: DateUnsure) => (unsure === "none" ? "" : date);

export function DateCheck({ id, value, onChange, unsure, max, disabled }: { id: string; value: string; onChange: (v: string) => void; unsure: DateUnsure; max: string; disabled?: boolean }) {
  const label =
    unsure === "guess"
      ? "紙に日付が無かったので、ページの題と生まれた日から推しました。この日で合っていますか？"
      : unsure === "none"
        ? "紙に日付がありませんでした。その日を入れてください"
        : "その事の日";
  return (
    <div className={`flex flex-col gap-1 rounded-lg px-2 py-1 ${unsure ? "bg-warn/10" : ""}`}>
      <label htmlFor={id} className={`text-sm ${unsure ? "font-semibold" : "text-muted"}`}>
        {label}
      </label>
      <input
        id={id}
        type="date"
        value={value}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="tabular min-h-11 w-full max-w-56 rounded-lg border border-line bg-card px-3 text-base"
      />
    </div>
  );
}
