// 手帳の欄に打つ時、手帳がもう知っている値を先に入れておく（VISION ①「入力ゼロ、でも押し付けない」2026-11-04）。
// - 週数・生後の日数は、手帳の時計（予定日・生まれた日）から
// - 医療機関・妊娠前の身長と体重など変わりにくい物は、同じページの前回の値から
// 体の数字（体重・血圧など）は毎回違うので、前回の値を入れない（打ち直しの手間より、古い値のまま入る方が困る）。
import { clockAt, diffDays, type FamilyDates } from "./clock";
import type { TechoPageId } from "./techo";

type Item = { page: string; date: string; values: Record<string, unknown>; pending?: boolean };

/** 前回の値を引き継ぐ欄（ページごと） */
const CARRY: Partial<Record<TechoPageId, readonly string[]>> = {
  "mother-health": ["heightCm", "weightKg", "history", "allergy", "medicine", "pastBirths", "smoking"],
  "pregnancy-checkup": ["facility"],
  "child-checkup": [],
  vaccine: ["facility"],
};

/** その日の欄の先入れ（文字の形。画面の欄にそのまま入る） */
export function techoPrefill(page: TechoPageId, f: FamilyDates, date: string, items: readonly Item[]): Record<string, string> {
  const out: Record<string, string> = {};
  const last = [...items].filter((x) => x.page === page && !x.pending && x.date <= date).sort((a, b) => b.date.localeCompare(a.date))[0];
  for (const k of CARRY[page] ?? []) {
    const v = last?.values[k];
    if (v != null && v !== "") out[k] = String(v);
  }
  const c = clockAt(f, date);
  const born = f.birthDate && diffDays(date, f.birthDate) >= 0 ? diffDays(date, f.birthDate) : null;
  if (page === "pregnancy-checkup" && c.phase === "pregnant" && c.pregnancyWeek != null) {
    out.week = `${c.pregnancyWeek}週${c.pregnancyDay ? `${c.pregnancyDay}日` : ""}`;
  }
  if (page === "newborn" && born != null) out.dayAge = String(born);
  if (page === "postpartum" && born != null) out.days = String(born);
  return out;
}
