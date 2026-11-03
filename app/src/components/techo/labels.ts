// 記録の値（TechoValueKeys のキー）を、画面の言葉と単位にする。判定の言葉は付けない。
import type { TechoEntry } from "@/lib/techo";

const LABELS: Record<string, [label: string, unit?: string]> = {
  heightCm: ["身長", "cm"],
  weightKg: ["体重", "kg"],
  weightG: ["体重", "g"],
  headCm: ["頭囲", "cm"],
  chestCm: ["胸囲", "cm"],
  history: ["これまでの病気"],
  allergy: ["アレルギー"],
  medicine: ["飲んでいる薬"],
  pastBirths: ["前のお産"],
  smoking: ["たばこ"],
  week: ["週数"],
  bpHigh: ["血圧（上）"],
  bpLow: ["血圧（下）"],
  fundusCm: ["子宮底長", "cm"],
  edema: ["むくみ"],
  urineProtein: ["尿たんぱく"],
  urineSugar: ["尿糖"],
  memo: ["メモ"],
  facility: ["医療機関"],
  test: ["検査"],
  result: ["結果（書いてある言葉のまま）"],
  occasion: ["いつ"],
  method: ["お産のしかた"],
  place: ["場所"],
  days: ["産後", "日"],
  care: ["産後ケア"],
  dayAge: ["生後", "日"],
  feeding: ["栄養"],
  vitaminK: ["ビタミンK2"],
  colorNo: ["便の色の番号"],
  ageText: ["いつごろ"],
  item: ["できた事"],
  checkup: ["健診"],
  vaccine: ["ワクチン"],
  dose: ["回"],
  lot: ["ロット"],
  doctor: ["医師"],
  has: ["相談できる人"],
  whom: ["相手"],
};

/** 値を「体重 3.1kg」のような並びにする（text は本文として別に出すので除く） */
export function valueLines(values: TechoEntry["values"], skip: string[] = []): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (v == null || v === "" || k === "text" || skip.includes(k)) continue;
    const [label, unit] = LABELS[k] ?? [k];
    const shown = typeof v === "boolean" ? (v ? "いる" : "いない") : `${v}${unit && typeof v === "number" ? unit : ""}`;
    out.push(`${label} ${shown}`);
  }
  return out;
}

export function jpDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

export const SOURCE_LABEL: Record<TechoEntry["source"], string> = {
  voice: "話した",
  photo: "撮った",
  text: "書いた",
  seed: "見本",
};
