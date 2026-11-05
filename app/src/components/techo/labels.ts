// 記録の値（TechoValueKeys のキー）を、画面の言葉と単位にする。判定の言葉は付けない。
// 言葉（2026-11-05 多言語化）: 日本語の画面は前と1字も変えない。中文・English では、
// - 欄の名前・日数・はい/いいえと、決まった言い方の値（週数・回・ワクチンの名前・できた事）は訳す
// - 作った家族の記録（source "seed"）は、作った言葉なので値も訳す
// - 本物の家族が書いた・紙から読み取った値（結果・病院の名前・メモなど）は、書いてあるまま
import { currentLang, t, type Vars } from "@/lib/i18n";
import { labelIn, nameIn } from "@/lib/i18n/names";
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
  days: ["産後"],
  care: ["産後ケア"],
  dayAge: ["生後"],
  feeding: ["栄養"],
  vitaminK: ["ビタミンK2"],
  colorNo: ["便の色の番号"],
  ageText: ["いつごろ"],
  item: ["できた事"],
  checkup: ["健診"],
  vaccine: ["ワクチン"],
  dose: ["回"],
  lot: ["ロット（シールの番号）"],
  doctor: ["医師"],
  has: ["相談できる人"],
  whom: ["相手"],
};

/** 数が日数の欄（「14日」。中文 14天・English 14 days） */
const DAY_KEYS = new Set(["days", "dayAge"]);

/**
 * 値を「体重 3.1kg」のような並びにする（text は本文として別に出すので除く）。
 * made は作った家族の記録か（値も訳す）。本物の家族の値は、決まった言い方の物だけ訳す
 */
export function valueLines(values: TechoEntry["values"], skip: string[] = [], made = false): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(values)) {
    if (v == null || v === "" || k === "text" || skip.includes(k)) continue;
    // 「いるけど頼みにくい」は has:false で保存している（consult-answer.ts）。本文に出るので「いない」と重ねて出さない
    if (k === "has" && v === false && values.text === "いるけど頼みにくい") continue;
    const [label, unit] = LABELS[k] ?? [k];
    // 相談した相手は「相手」（宛先の意味の訳）と分けた行で
    out.push(t(k === "whom" ? "相手 {value}" : "{label} {value}", { label: t(label), value: valueWords(k, v, unit, made) }));
  }
  return out;
}

function valueWords(k: string, v: string | number | boolean, unit: string | undefined, made: boolean): string {
  if (typeof v === "boolean") return t(v ? "いる" : "いない");
  if (typeof v === "number") return DAY_KEYS.has(k) ? t("{n}日", { n: v }) : `${v}${unit ?? ""}`;
  if (k === "vaccine") return vaccineName(v);
  if (k === "dose") return doseWords(v);
  if (made || k === "week" || k === "item") return techoWords(v);
  // 訳さない: 本物の家族が書いた・紙から読み取った値（結果・病院の名前・メモなど）は書いてあるまま
  return v;
}

/** 2026年11月3日（中文も同じ書き方）。English は Nov 3, 2026（画面の言葉で。lib/i18n） */
export function jpDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  if (currentLang() === "en") return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }).format(new Date(Date.UTC(y, m - 1, d)));
  // 訳さない: 日本語と中文で同じ並び（年・月・日）
  return `${y}年${m}月${d}日`;
}

export const SOURCE_LABEL: Record<TechoEntry["source"], string> = {
  voice: "話した",
  photo: "撮った",
  text: "書いた",
  seed: "見本",
};

/**
 * 接種の呼び方（保存する値は変えず、見出しだけそろえる）。家族が聞き慣れた呼び名＋正式な名前。
 * 出典: 厚生労働省「予防接種情報」の定期接種の名前（五種混合は2024年4月から。DPT-IPV-Hib）。
 * 左は保存されうる書き方（話した・撮った言葉の揺れも含む）、右は画面の見出し（描く所で t() で訳す）。
 */
const VACCINE_LABELS: [match: RegExp, label: string][] = [
  [/^(B型肝炎|HBV?|ＨＢ)/i, "B型肝炎"],
  [/^(ロタ|rota)/i, "ロタウイルス"],
  [/(肺炎球菌|PCV)/i, "小児用肺炎球菌"],
  [/^(五種混合|5種混合|DPT-IPV-Hib)/i, "五種混合"],
  [/^(四種混合|4種混合|DPT-IPV)$/i, "四種混合"],
  [/^(ヒブ|Hib)$/i, "ヒブ（Hib）"],
  [/^BCG/i, "BCG"],
  [/^(MR|麻しん風しん|麻疹風疹|麻しん・風しん)/i, "麻しん風しん（MR）"],
  [/^(水痘|水ぼうそう|みずぼうそう)/, "水ぼうそう（水痘）"],
  [/^(おたふく|ムンプス)/, "おたふくかぜ（任意）"],
];

/** 接種の名前を、画面の見出しの呼び方にする（知らない名前はそのまま。日本語のまま返す＝訳は vaccineName） */
export function vaccineLabel(name: string): string {
  const n = name.normalize("NFKC").trim();
  for (const [re, label] of VACCINE_LABELS) if (re.test(n)) return label;
  return n;
}

// ───────── 今の言葉で（日本語は前と同じ字を返す） ─────────

/** English は見出しの頭を大文字に（辞書には文の中で使う小文字の形がある: hepatitis B・rolling over） */
export function head(s: string): string {
  return currentLang() === "en" && s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** 接種の名前を今の言葉の見出しに（日本語は保存した名前のまま。知らない名前は書いてあるまま） */
export function vaccineName(name: string): string {
  if (currentLang() === "ja") return name;
  const label = vaccineLabel(name);
  for (const k of [label, name.trim()]) if (t(k) !== k) return head(t(k));
  return label;
}

/** 回（1回目・4回目（追加）・1期）の今の言葉（外国語版の母子健康手帳の書き方: 第1次・1st）。RS ウイルスの「妊娠30週2日」も */
const DOSES = ["1回目", "2回目", "3回目", "4回目"];
const TERMS = ["1期", "2期"];
export function doseWords(s: string): string {
  if (currentLang() === "ja") return s;
  const n = s.normalize("NFKC").trim().replace(/\(/g, "（").replace(/\)/g, "）");
  if (t(n) !== n) return t(n);
  const dose = /^第?(\d+)回目?$/.exec(n);
  if (dose && DOSES[Number(dose[1]) - 1]) return t(DOSES[Number(dose[1]) - 1]);
  const term = /^第?(\d+)期$/.exec(n);
  if (term && TERMS[Number(term[1]) - 1]) return t(TERMS[Number(term[1]) - 1]);
  return techoWords(s);
}

/** 決まった形の題・値（数だけが変わる言い方）。左が保存した日本語の形、真ん中が辞書の鍵 */
const SHAPES: [match: RegExp, key: string, vars: (m: RegExpExecArray) => Vars][] = [
  [/^(\d+)週(\d+)日$/, "{w}週{d}日", (m) => ({ w: m[1], d: m[2] })],
  [/^(\d+)週$/, "{w}週", (m) => ({ w: m[1] })],
  [/^妊娠(\d+)週(\d+)日$/, "妊娠{w}週{d}日", (m) => ({ w: m[1], d: m[2] })],
  [/^妊娠(\d+)週$/, "妊娠{w}週", (m) => ({ w: m[1] })],
  [/^妊娠(\d+)週の健診$/, "妊娠{w}週の健診", (m) => ({ w: m[1] })],
  [/^産後(\d+)日$/, "産後{n}日", (m) => ({ n: m[1] })],
  [/^生後(\d+)日$/, "生後{n}日", (m) => ({ n: m[1] })],
  [/^生後(\d+)週$/, "生後{n}週", (m) => ({ n: m[1] })],
  [/^生後(\d+)か月$/, "生後{n}か月", (m) => ({ n: m[1] })],
  [/^便の色 (\d+)番$/, "便の色 {n}番", (m) => ({ n: m[1] })],
  [/^(A|B|O|AB)型 Rh\(([+-])\)$/, "{abo}型 Rh({rh})", (m) => ({ abo: m[1], rh: m[2] })],
  [/^相談できる人（(.+)）$/, "相談できる人（{when}）", (m) => ({ when: t(m[1]) })],
  [/^(.+)（(\d+)人目）$/, "{name}（{n}人目）", (m) => ({ name: techoWords(m[1]), n: m[2] })],
  // 接種の題（「B型肝炎 1回目」「RSウイルス（妊娠中） 妊娠30週2日」＝app/techo/page.tsx と作った家族の記録）
  [/^(.+?) ((?:第?\d+回目?|第?\d+期|追加|妊娠\d+週(?:\d+日)?)(?:（追加）)?)$/, "{vaccine} {dose}", (m) => ({ vaccine: vaccineName(m[1]), dose: doseWords(m[2]) })],
];

/**
 * 決まった言い方の題・値（作った家族の記録・手で入れた時の題・できた事・週数など）を今の言葉に。
 * 辞書にも上の形にも無い言葉は、書いてあるまま返す（家族が書いた・紙から読み取った言葉）。日本語はそのまま
 */
export function techoWords(s: string): string {
  if (currentLang() === "ja" || !s) return s;
  const n = s.trim();
  if (t(n) !== n) return head(t(n));
  for (const [re, key, vars] of SHAPES) {
    const m = re.exec(n);
    if (m) return head(t(key, vars(m)));
  }
  return s;
}

/**
 * 記録の「誰の・誰が」を今の言葉に（名前は names.ts の決まり。made は作った家族か＝中文のばあば・じいじ）。
 * 双子は「ひなた（1人目）」の形で残している（lib/techo-seed.ts）。名前の無い子は「子（1人目）」
 */
export function whoIn(who: string, made: boolean): string {
  if (currentLang() === "ja") return who;
  const twin = /^(.+)（(\d+)人目）$/.exec(who.trim());
  if (twin) return t("{name}（{n}人目）", { name: twin[1] === "子" ? head(t("赤ちゃん")) : nameIn(twin[1], { made }), n: twin[2] });
  return labelIn(who, { made });
}
