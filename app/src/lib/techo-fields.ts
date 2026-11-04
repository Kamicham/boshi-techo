// 手帳の欄に、撮る・話すのほか、手で入れる（UX 2026-11-04・作り手の家族の声「撮ると話す、項目も欲しい」）。
// 紙の母子手帳の欄の名前のまま、欄ごとに入れる項目を並べる。保存の決まり（数に直す・空は捨てる）はサーバの cleanValues が正。
// 便色カード・成長・できた日・接種・気持ちは、それぞれの欄に専用の入れ方があるので、ここには置かない。
import type { TechoPageId } from "./techo";

export type TechoField = {
  key: string;
  label: string;
  /** 数の欄（単位はキー名のとおり） */
  unit?: string;
  /** 例（入れる形の見本。値の良し悪しは言わない） */
  hint?: string;
  /** 長い言葉の欄 */
  long?: boolean;
};

export type TechoForm = {
  /** 日付の欄の名前 */
  dateLabel: string;
  /** 見出しの作り方（入れた値から） */
  title: (v: Record<string, string>) => string;
  /** 無いと入らない欄 */
  required?: string;
  fields: TechoField[];
};

export const TECHO_FORMS: Partial<Record<TechoPageId, TechoForm>> = {
  "mother-health": {
    dateLabel: "書いた日",
    title: () => "妊婦の健康状態",
    fields: [
      { key: "heightCm", label: "身長", unit: "cm" },
      { key: "weightKg", label: "妊娠前の体重", unit: "kg" },
      { key: "history", label: "これまでの病気", long: true },
      { key: "allergy", label: "アレルギー" },
      { key: "medicine", label: "飲んでいる薬" },
      { key: "pastBirths", label: "前のお産", hint: "例: 初めて" },
      { key: "smoking", label: "たばこ", hint: "例: 吸わない" },
    ],
  },
  "pregnancy-checkup": {
    dateLabel: "健診の日",
    title: (v) =>
      v.week ? `妊娠${v.week.replace(/週$/, "")}週の健診` : "妊婦健診",
    fields: [
      { key: "week", label: "週数", hint: "例: 24週" },
      { key: "weightKg", label: "体重", unit: "kg" },
      { key: "bpHigh", label: "血圧（上）", unit: "mmHg" },
      { key: "bpLow", label: "血圧（下）", unit: "mmHg" },
      { key: "fundusCm", label: "子宮底長", unit: "cm" },
      { key: "edema", label: "むくみ", hint: "紙に書いてある記号のまま" },
      {
        key: "urineProtein",
        label: "尿たんぱく",
        hint: "紙に書いてある記号のまま",
      },
      { key: "urineSugar", label: "尿糖", hint: "紙に書いてある記号のまま" },
      { key: "facility", label: "医療機関" },
      { key: "memo", label: "メモ", long: true },
    ],
  },
  "pregnancy-test": {
    dateLabel: "検査の日",
    title: (v) => v.test || "検査",
    required: "test",
    fields: [
      { key: "test", label: "検査", hint: "例: 血液型" },
      { key: "result", label: "結果（書いてある言葉のまま）" },
    ],
  },
  birth: {
    dateLabel: "生まれた日",
    title: () => "出産",
    fields: [
      { key: "week", label: "週数", hint: "例: 39週2日" },
      { key: "weightG", label: "体重", unit: "g" },
      { key: "heightCm", label: "身長", unit: "cm" },
      { key: "headCm", label: "頭囲", unit: "cm" },
      { key: "chestCm", label: "胸囲", unit: "cm" },
      { key: "method", label: "お産のしかた" },
      { key: "place", label: "場所" },
    ],
  },
  postpartum: {
    dateLabel: "その日",
    title: (v) => (v.days ? `産後${v.days}日` : "産後の経過"),
    fields: [
      { key: "days", label: "産後", unit: "日" },
      { key: "text", label: "気分（自分の言葉で）", long: true },
      { key: "care", label: "産後ケア" },
    ],
  },
  newborn: {
    dateLabel: "その日",
    title: (v) => (v.dayAge ? `生後${v.dayAge}日` : "新生児の記録"),
    fields: [
      { key: "dayAge", label: "生後", unit: "日" },
      { key: "weightG", label: "体重", unit: "g" },
      { key: "feeding", label: "栄養", hint: "例: 母乳・ミルク" },
      { key: "vitaminK", label: "ビタミンK2", hint: "例: 1回目" },
      { key: "test", label: "検査", hint: "例: 聴覚の検査" },
      { key: "result", label: "結果（書いてある言葉のまま）" },
    ],
  },
  "child-checkup": {
    dateLabel: "健診の日",
    title: (v) => v.checkup || "乳幼児健診",
    required: "checkup",
    fields: [
      { key: "checkup", label: "健診", hint: "例: 1か月健診" },
      { key: "heightCm", label: "身長", unit: "cm" },
      { key: "weightKg", label: "体重", unit: "kg" },
      { key: "result", label: "結果（書いてある言葉のまま）" },
      { key: "memo", label: "メモ", long: true },
    ],
  },
};

/** 入れた欄を、送る形にする（空は捨てる）。必須が無い・1つも無い時は null */
export function formValues(
  form: TechoForm,
  raw: Record<string, string>,
): Record<string, string> | null {
  const out: Record<string, string> = {};
  for (const f of form.fields) {
    const v = (raw[f.key] ?? "").trim();
    if (v) out[f.key] = v;
  }
  if (form.required && !out[form.required]) return null;
  return Object.keys(out).length ? out : null;
}
