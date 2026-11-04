// 現実の割合から作った1000組（すべて作った家族。実在の人物ではない。町だけは実在の市区町村）。
// 割合と出典は stats.ts（一覧は docs/SIM_STATS.md）。決まった種（POP_SEED）で作るので、毎回同じ1000組になる。
//
// ばらばらに抽選すると「19歳で第3子」のような現実に無い組み合わせが出るので、つながりのある順に決める:
//   都道府県 → 市・政令市・23区・町村・離島 → 母の年齢 → 何人目 → 体外受精 → 双子 → 週数 → 体重 → NICU → 帝王切開
//   → 国籍と婚姻（ひとり親）→ 祖父母 → 里帰り → 言葉 → 学歴 → 母の仕事と育休 → 父の仕事・夜勤・単身赴任・育休 → 引っ越し → 耳
// 家族ごとに自分の乱数（種 + 番号）を持つので、1組の作り方を変えても、ほかの家族は変わらない。
//
// 出力は今の Family 型（lib/demo-family.ts）＋ persona（なりきり用）＋ profile（今の型で表せない事: NICU・国籍・祖父母・夜勤・単身赴任など）。
// 家族の人（members）は母とパートナーだけ。祖父母・夜勤・単身赴任はアプリでは聞かないが、現実の家族にはいるので profile と persona.who に残す。
// 予定日は、今日（POP_TODAY）から見て「授かる前〜2歳過ぎ」に一様にばらける。どの家族も今日から使い始める（startedOn = 今日）。
import { addDays, addMonths, clockAt, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import type { Family, Member } from "../lib/demo-family";
import type { Situation } from "../lib/situation";
import type { Persona, SimFamily } from "./types";
import {
  ART_AGE_WEIGHT,
  BIRTH_ORDER_BY_AGE,
  BIRTHS_2024,
  KU23,
  KU23_BIRTHS,
  PLACES,
  POP_SIZE,
  SEIREI_BIRTHS,
  STATS,
  TOKYO_BIRTHS,
  WEEK_WEIGHT_RHO,
  type AgeBand,
  type Order,
} from "./stats";

export const POP_SEED = 20261103;
export const POP_TODAY = "2026-11-03";
/** 予定日を今日からどこまでずらすか（日）。-750 = 2歳を少し過ぎた家族、+340 = 授かる2か月前の家族 */
export const DUE_RANGE: [number, number] = [-750, 340];

// ───────── 型 ─────────

export type PlaceType = "政令指定都市" | "東京23区" | "その他の市" | "町村" | "離島";
export type GrandmaPlace = "同居" | "同じ市区町村" | "遠く" | "国外" | "亡くなっている";
export type MotherWork = "正規" | "非正規" | "自営など" | "無職";
export type FatherWork = "正規" | "自営など" | "その他";

export interface PopProfile {
  index: number;
  /** 今日の時期（授かる前・妊娠初期…2歳過ぎ） */
  stageToday: Stage;
  placeType: PlaceType;
  motherAge: number;
  ageBand: AgeBand;
  order: Order;
  /** この子が生まれた時の上の子の年齢（か月） */
  olderChildrenMonths: number[];
  art: boolean;
  twins: boolean;
  /** 生まれた時の妊娠日数（最終月経から）と週 */
  gestDays: number;
  weeks: number;
  /** 子ごとの体重（g） */
  weights: number[];
  nicu: boolean;
  cesarean: boolean;
  marital: "婚姻" | "事実婚" | "ひとり親";
  nationality: { kind: string; mother: string; father?: string };
  /** 日本語に不安があるか */
  japaneseAnxious: { mother: boolean; father: boolean };
  education: string;
  grandma: { mother: GrandmaPlace; father?: GrandmaPlace };
  satogaeri: null | { kind: "同じ市町村" | "同じ都道府県" | "ほかの都道府県"; city: string; prefecture: string };
  motherWork: {
    atPregnancy: MotherWork;
    /** 生まれた後: 育休 / 育休なしで続ける / 退職 / もとから仕事なし */
    after: "育休" | "育休なしで継続" | "退職" | "仕事なし";
    leaveDays?: number;
    /** 育休の後に戻るか */
    returns?: boolean;
  };
  father?: { work: FatherWork; nightShift: boolean; tanshin: boolean; leave: null | { days: number; papa: boolean } };
  move: null | { kind: "同じ市区町村の中" | "県内のほかの市町村" | "ほかの都道府県" | "国外から"; on: string; from: string; fromPrefecture: string; inFamily: boolean };
  hearing: null | "母" | "パートナー";
}

export type PopFamily = SimFamily & { profile: PopProfile };

export const STAGES = ["授かる前", "妊娠初期", "妊娠中期", "妊娠後期", "生後0〜3か月", "生後4〜11か月", "1歳〜2歳", "2歳過ぎ"] as const;
export type Stage = (typeof STAGES)[number];

// ───────── 乱数 ─────────

function hash(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export type Rng = () => number;

export function rngFor(seed: number, key: string | number): Rng {
  let a = hash(`${seed}:${key}`);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const chance = (r: Rng, pct: number) => r() * 100 < pct;

/**
 * 層別の乱数（ラテン超方格）: 項目ごとに 0〜1 を1000の層に分け、家族ごとに別の層を1つずつ割り当てる。
 * 1000組の割合が統計にぴったり近づき（ただの抽選だと ±3ポイントほど揺れる）、しかも家族ごとの値はほかの家族の作り方に左右されない。
 */
const perms = new Map<string, Uint16Array>();
function stratified(seed: number, item: string, index: number): number {
  const key = `${seed}:${item}`;
  let p = perms.get(key);
  if (!p) {
    const r = rngFor(seed, `perm:${item}`);
    p = new Uint16Array(POP_SIZE).map((_, i) => i);
    for (let i = POP_SIZE - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    perms.set(key, p);
  }
  const jitter = rngFor(seed, `jitter:${item}:${index}`)();
  return (p[(index - 1) % POP_SIZE] + jitter) / POP_SIZE;
}

/** 割合の表から、0〜1 の値 u で1つ選ぶ */
function pickU<K extends string>(u: number, dist: Record<K, number>): K {
  return bandAt(u, dist).band;
}

/** 標準正規の分位点（Acklam の近似） */
function invPhi(p: number): number {
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  const q0 = Math.min(Math.max(p, 1e-10), 1 - 1e-10);
  if (q0 < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(q0));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (q0 > 1 - 0.02425) {
    const q = Math.sqrt(-2 * Math.log(1 - q0));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  const q = q0 - 0.5;
  const r = q * q;
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
}
const uniformInt = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const oneOf = <T>(r: Rng, xs: readonly T[]): T => xs[Math.floor(r() * xs.length)];

/** 割合の表から1つ選ぶ（合計が100でなくても割り戻す） */
export function pick<K extends string>(r: Rng, dist: Record<K, number>): K {
  const entries = Object.entries(dist) as [K, number][];
  const total = entries.reduce((n, [, v]) => n + v, 0);
  let x = r() * total;
  for (const [k, v] of entries) {
    x -= v;
    if (x < 0) return k;
  }
  return entries[entries.length - 1][0];
}

function normal(r: Rng): number {
  const u = Math.max(r(), 1e-12);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** 標準正規の分布関数（Abramowitz–Stegun 7.1.26） */
function phi(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const erf = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return z >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** 0〜1 の値で、割合の表の帯を選ぶ（帯の順は表の順） */
function bandAt<K extends string>(u: number, dist: Record<K, number>): { band: K; within: number } {
  const entries = Object.entries(dist) as [K, number][];
  const total = entries.reduce((n, [, v]) => n + v, 0);
  let acc = 0;
  for (const [k, v] of entries) {
    const next = acc + v / total;
    if (u < next || k === entries[entries.length - 1][0]) return { band: k, within: v > 0 ? Math.min(0.999, Math.max(0, (u - acc) / (v / total))) : 0 };
    acc = next;
  }
  const last = entries[entries.length - 1][0];
  return { band: last, within: 0.5 };
}

// ───────── 組み立てに使う割合（stats.ts から計算） ─────────

const C_TWIN_CHILD = 2.51; // 生まれた子のうち複産児（%）
type WeekBand = keyof typeof STATS.weeks.dist;
type WeightBand = keyof typeof STATS.weight.dist;

/** 単胎の週数 = 全体から双子の分を引いた物（生まれた子全体では統計に戻る） */
const WEEKS_SINGLE = Object.fromEntries(
  (Object.keys(STATS.weeks.dist) as WeekBand[]).map((k) => [k, Math.max(0, (STATS.weeks.dist[k] - (C_TWIN_CHILD / 100) * STATS.weeksTwins.dist[k]) / (1 - C_TWIN_CHILD / 100))]),
) as Record<WeekBand, number>;

/** 双子の体重: 2,500g未満69%を、全体の2,500g未満の帯の比で分ける（近似） */
const LBW_BANDS: WeightBand[] = ["1,000g未満", "1,000-1,499g", "1,500-1,999g", "2,000-2,499g"];
const LBW_ALL = LBW_BANDS.reduce((n, k) => n + STATS.weight.dist[k], 0);
const WEIGHT_TWINS = Object.fromEntries([...LBW_BANDS.map((k) => [k, (69 * STATS.weight.dist[k]) / LBW_ALL]), ["2,500g以上", 31]]) as Record<WeightBand, number>;
const WEIGHT_SINGLE = Object.fromEntries(
  (Object.keys(STATS.weight.dist) as WeightBand[]).map((k) => [k, (STATS.weight.dist[k] - (C_TWIN_CHILD / 100) * WEIGHT_TWINS[k]) / (1 - C_TWIN_CHILD / 100)]),
) as Record<WeightBand, number>;

const WEEK_DAYS: Record<WeekBand, [number, number]> = { "22-27週": [154, 195], "28-31週": [196, 223], "32-36週": [224, 258], "37-41週": [259, 293], "42週以上": [294, 300] };
const WEIGHT_G: Record<WeightBand, [number, number]> = { "1,000g未満": [450, 999], "1,000-1,499g": [1000, 1499], "1,500-1,999g": [1500, 1999], "2,000-2,499g": [2000, 2499], "2,500g以上": [2500, 4000] };

/** 週数ごとの体重の中央値（g）。日本の出生時体重の標準を丸めた近似 */
const MEDIAN_G: [number, number][] = [[154, 500], [168, 650], [182, 850], [196, 1100], [210, 1450], [224, 1800], [238, 2200], [252, 2600], [266, 2950], [280, 3150], [294, 3300], [300, 3350]];
function medianGrams(days: number): number {
  if (days <= MEDIAN_G[0][0]) return MEDIAN_G[0][1];
  for (let i = 1; i < MEDIAN_G.length; i++) {
    const [d0, g0] = MEDIAN_G[i - 1];
    const [d1, g1] = MEDIAN_G[i];
    if (days <= d1) return g0 + ((days - d0) / (d1 - d0)) * (g1 - g0);
  }
  return MEDIAN_G[MEDIAN_G.length - 1][1];
}
const TWIN_CESAREAN = 80;
const SINGLE_CESAREAN = (STATS.cesarean.dist["帝王切開"] - (STATS.multiple.dist["多胎"] * TWIN_CESAREAN) / 100) / (1 - STATS.multiple.dist["多胎"] / 100);

function nicuRate(g: number): number {
  const d = STATS.nicuByWeight.dist;
  if (g < 1500) return d["1,500g未満"];
  if (g < 2000) return d["1,500-1,999g"];
  if (g < 2500) return d["2,000-2,499g"];
  return d["2,500g以上"];
}

/** 体外受精の年齢ごとの割合（重みを全体12.6%に割り戻す） */
const ART_BY_AGE: Record<AgeBand, number> = (() => {
  const ages = STATS.motherAge.dist as Record<AgeBand, number>;
  const total = Object.values(ages).reduce((n, v) => n + v, 0);
  const mean = (Object.keys(ages) as AgeBand[]).reduce((n, k) => n + (ages[k] / total) * ART_AGE_WEIGHT[k], 0);
  const k = STATS.art.dist["体外受精など"] / mean;
  return Object.fromEntries((Object.keys(ages) as AgeBand[]).map((a) => [a, Math.min(95, k * ART_AGE_WEIGHT[a])])) as Record<AgeBand, number>;
})();

/** 都道府県の中の住む場所の割合 */
const PREF_TOTAL = Object.values(STATS.prefecture.dist).reduce((n: number, v) => n + v, 0);
function prefBirths(pref: string): number {
  return ((STATS.prefecture.dist as Record<string, number>)[pref] / PREF_TOTAL) * BIRTHS_2024;
}
const SEIREI_BY_PREF: Record<string, { city: string; births: number }[]> = {};
for (const [city, v] of Object.entries(SEIREI_BIRTHS)) (SEIREI_BY_PREF[v.pref] ??= []).push({ city, births: v.births });
/** 政令市・23区以外の部分の割合 */
function restShare(pref: string): number {
  const big = (SEIREI_BY_PREF[pref] ?? []).reduce((n, c) => n + c.births, 0) + (pref === "東京都" ? KU23_BIRTHS * (prefBirths(pref) / TOKYO_BIRTHS) : 0);
  return Math.max(0, 1 - big / prefBirths(pref));
}
const PT = STATS.placeType.dist;
const REST_ALL = Object.keys(PLACES).reduce((n, p) => n + (prefBirths(p) / BIRTHS_2024) * restShare(p), 0);
const TOWN_FRAC = PT["町村"] / 100 / REST_ALL;
const ISLAND_FRAC = PT["離島"] / 100 / Object.keys(PLACES).filter((p) => PLACES[p].islands?.length).reduce((n, p) => n + (prefBirths(p) / BIRTHS_2024) * restShare(p), 0);

export function placeIn(r: Rng, pref: string, u: number = r()): { city: string; type: PlaceType } {
  let x = u * prefBirths(pref);
  if (pref === "東京都") {
    const ku = KU23_BIRTHS * (prefBirths(pref) / TOKYO_BIRTHS);
    if (x < ku) return { city: oneOf(r, KU23), type: "東京23区" };
    x -= ku;
  }
  for (const c of SEIREI_BY_PREF[pref] ?? []) {
    if (x < c.births) return { city: c.city, type: "政令指定都市" };
    x -= c.births;
  }
  const p = PLACES[pref];
  // 政令市・23区で使わなかった分の u を、市・町村・離島の選び分けに使い直す
  const y = Math.min(0.999999, x / (prefBirths(pref) * restShare(pref) || 1));
  if (p.islands?.length && y < ISLAND_FRAC) return { city: oneOf(r, p.islands), type: "離島" };
  if (y < (p.islands?.length ? ISLAND_FRAC : 0) + TOWN_FRAC) return { city: oneOf(r, p.towns), type: "町村" };
  return { city: oneOf(r, p.cities), type: "その他の市" };
}

/** 同じ県の別の市町村（引っ越し前・里帰り先）。無ければ同じ所 */
function otherPlaceIn(r: Rng, pref: string, not: string): string {
  for (let i = 0; i < 8; i++) {
    const c = placeIn(r, pref).city;
    if (c !== not) return c;
  }
  const all = [...(SEIREI_BY_PREF[pref] ?? []).map((c) => c.city), ...PLACES[pref].cities, ...PLACES[pref].towns].filter((c) => c !== not);
  return all.length ? oneOf(r, all) : not;
}

function otherPref(r: Rng, not: string): string {
  const d = { ...(STATS.prefecture.dist as Record<string, number>) };
  delete d[not];
  return pick(r, d);
}

// 祖父母・里帰り（stats の割合から条件つきの割合を作る。全体で統計の割合に戻るように）
const TG = STATS.threeGen.dist["三世代"];
const WM = STATS.wifeMother.dist;
const HM = STATS.husbandMother.dist;
const SIDE_MOTHER = WM["同居"] / (WM["同居"] + HM["同居"]);
const GRANDMA_REST = (d: typeof WM) => ({ 同じ市区町村: d["同じ市区町村"], 遠く: d["それ以外の地域"], 亡くなっている: d["亡くなっている"] });
const SATO = (() => {
  const s = STATS.satogaeri.dist;
  const placed = s["同じ市町村"] + s["同じ都道府県"] + s["ほかの都道府県"];
  const k = (placed + s["した（場所無回答）"]) / placed;
  const total = s["しない"] + placed * k;
  const same = (s["同じ市町村"] * k) / total;
  const pref = (s["同じ都道府県"] * k) / total;
  const out = (s["ほかの都道府県"] * k) / total;
  // 妻の母が近い・遠い家族の割合（日本国籍の母・同居でない）
  const jpMother = 1 - (STATS.nationality.dist["父日本・母外国"] + STATS.nationality.dist["父母とも外国"] + STATS.nationality.dist["母外国・嫡出でない子"]) / 100;
  const notCo = 1 - (TG / 100) * SIDE_MOTHER;
  const rest = GRANDMA_REST(WM);
  const restTotal = rest["同じ市区町村"] + rest["遠く"] + rest["亡くなっている"];
  const near = jpMother * notCo * (rest["同じ市区町村"] / restTotal);
  const far = jpMother * notCo * (rest["遠く"] / restTotal);
  return { none: 1 - same - pref - out, same, pref, out, ifNear: Math.min(1, same / near), ifFar: Math.min(1, (pref + out) / far), prefShareOfFar: pref / (pref + out) };
})();

// 母の仕事（第1子）: 働いていた妻の 正規・非正規・自営 の割合を、継続率から解く（stats の motherWorkByType）
const MW1 = STATS.motherWorkFirst.dist;
const MWT = STATS.motherWorkByType.dist;
const WORKING_FIRST = 100 - MW1["妊娠前から無職・不詳"];
const CONT_ALL = (MW1["続けた・育休あり"] + MW1["続けた・育休なし"]) / WORKING_FIRST; // 0.805
const MWA = STATS.motherWorkAfter.dist;
/** 働く母のうち自営など（末子0歳の母の表から。0.104） */
const SELF_SHARE = MWA["自営など"] / (MWA["正規"] + MWA["非正規"] + MWA["自営など"]);
/** 自営を除いた働く妻のうち正規（継続率 80.5% = 自営 + 残り×(88.0×正規 + 56.0×非正規) から解く。0.695） */
const SEISHA_SHARE = ((CONT_ALL - SELF_SHARE) / (1 - SELF_SHARE) - MWT["非正規の継続率"] / 100) / ((MWT["正規の継続率"] - MWT["非正規の継続率"]) / 100);
/** 第1子で続けた雇われの妻のうち育休を使った割合（育休あり ÷ 続けた人から自営を除いた数。0.947） */
const LEAVE_IF_CONT_FIRST = MW1["続けた・育休あり"] / (MW1["続けた・育休あり"] + MW1["続けた・育休なし"] - WORKING_FIRST * SELF_SHARE);

function leaveDaysFrom(r: Rng, dist: Record<string, number>): number {
  const d = { ...dist };
  delete d["不明"];
  const band = pick(r, d);
  const M = 30.4;
  const ranges: Record<string, [number, number]> = {
    "5日未満": [1, 4], "5日〜2週間": [5, 13], "2週間〜1か月": [14, 29], "1〜3か月": [30, 3 * M - 1], "3〜6か月": [3 * M, 6 * M - 1], "6〜8か月": [6 * M, 8 * M - 1],
    "8〜10か月": [8 * M, 10 * M - 1], "10〜12か月": [10 * M, 12 * M - 1], "12〜18か月": [12 * M, 18 * M - 1], "18〜24か月": [18 * M, 24 * M - 1], "24〜36か月": [24 * M, 36 * M - 1],
    "36か月以上": [36 * M, 36 * M], "18か月以上・不明": [18 * M, 18 * M],
  };
  const [lo, hi] = ranges[band];
  return Math.round(lo + r() * (hi - lo));
}

// ───────── 名前（作った名前。ありふれた名前・外国籍は国籍に合う名前） ─────────

const JP = {
  mother: ["美咲", "彩", "麻衣", "愛", "優子", "恵", "沙織", "千尋", "奈々", "瞳", "舞", "香織", "智子", "裕子", "彩花", "綾香", "美穂", "明日香", "遥", "葵", "菜摘", "結衣", "杏奈", "里奈", "美月", "さくら", "七海", "萌", "真由", "由佳"],
  father: ["翔太", "大輔", "健太", "拓也", "直樹", "達也", "亮", "和也", "剛", "誠", "大樹", "隆", "浩二", "翼", "悠斗", "陽介", "雄大", "慎吾", "健一", "祐介"],
  grandma: ["和子", "恵子", "洋子", "幸子", "久美子", "京子", "順子", "節子", "美智子", "典子", "由美子", "真理子"],
  child: ["陽翔", "蓮", "湊", "蒼", "律", "樹", "悠真", "陽葵", "凛", "紬", "翠", "澪", "芽依", "結菜", "莉子", "杏", "心春", "ひなた", "そら", "ゆい"],
};
const FOREIGN: Record<string, { f: string[]; m: string[] }> = {
  中国: { f: ["李華", "王芳", "張敏", "劉静", "陳麗"], m: ["王偉", "李強", "張磊", "劉洋", "陳杰"] },
  フィリピン: { f: ["マリア", "ジョアン", "クリスティン", "ロウェナ"], m: ["ジョン・ポール", "マーク", "ジェイソン", "ロナルド"] },
  "韓国・朝鮮": { f: ["ミンジ", "ジヒョン", "スジン", "ユナ"], m: ["ジフン", "ミンジュン", "ソンホ", "ヒョヌ"] },
  ブラジル: { f: ["アナ", "ジュリアナ", "カミラ", "フェルナンダ"], m: ["ルーカス", "ガブリエル", "ハファエル", "チアゴ"] },
  ペルー: { f: ["ロサ", "カルメン", "ルシア"], m: ["ホセ", "カルロス", "ルイス"] },
  米国: { f: ["エミリー", "ジェシカ", "サラ", "アシュリー"], m: ["マイケル", "デイビッド", "ジェームズ", "クリストファー"] },
  タイ: { f: ["ニパー", "スダー", "プローイ"], m: ["ソムチャイ", "アナン", "クリット"] },
  英国: { f: ["エマ", "シャーロット", "ソフィー"], m: ["オリバー", "ジャック", "ハリー"] },
  ベトナム: { f: ["グエン・ティ・ラン", "チャン・ティ・フオン", "レ・ティ・マイ"], m: ["グエン・ヴァン・ナム", "チャン・ミン・ドゥック"] },
  ネパール: { f: ["サリタ", "スニタ", "ビナ"], m: ["ラム", "ビカス", "スレシュ"] },
  インドネシア: { f: ["シティ", "デウィ", "ルスミ"], m: ["アグス", "ブディ", "リズキ"] },
  ミャンマー: { f: ["エイエイ", "ティダ", "スースー"], m: ["アウン", "ミンテッ", "コーコー"] },
};
const OTHER_NATIONS = ["ベトナム", "ネパール", "インドネシア", "ミャンマー"];
/** 「その他」の国籍の名前の国（統計に内訳が無いので等分・近似） */
function nameNation(r: Rng, nat: string, memo: Map<string, string>): string {
  if (nat !== "その他") return nat;
  // 家族の中では1回だけ決める（母と父と子と祖母で国がずれないように）
  if (!memo.has(nat)) memo.set(nat, oneOf(r, OTHER_NATIONS));
  return memo.get(nat)!;
}

// ───────── 時期 ─────────

export function stageAt(f: Family, day: string): Stage {
  const known = f.birthDate && day >= f.birthDate ? f : { ...f, birthDate: undefined };
  const c = clockAt(known, day);
  if (c.phase === "trying") return "授かる前";
  if (c.phase === "pregnant") return (c.pregnancyWeek ?? 0) < 16 ? "妊娠初期" : (c.pregnancyWeek ?? 0) < 28 ? "妊娠中期" : "妊娠後期";
  if (c.phase === "after") return "2歳過ぎ";
  const m = c.ageMonths ?? 0;
  return m < 4 ? "生後0〜3か月" : m < 12 ? "生後4〜11か月" : "1歳〜2歳";
}

// ───────── 1組を作る ─────────

export function makeFamily(seed: number, index: number): PopFamily {
  const r = rngFor(seed, index);
  const U = (item: string) => stratified(seed, item, index);
  const id = `pop-${String(index).padStart(4, "0")}`;

  // 都道府県 → 市区町村
  const prefecture = pickU(U("prefecture"), STATS.prefecture.dist as Record<string, number>);
  const place = placeIn(r, prefecture, U("place"));

  // 母の年齢 → 何人目
  const ageBand = pickU(U("age"), STATS.motherAge.dist) as AgeBand;
  const lo = Number(ageBand.slice(0, 2));
  const motherAge = uniformInt(r, lo, lo + 4);
  let order = pickU(U("order"), BIRTH_ORDER_BY_AGE[ageBand]);
  // 上の子の年齢（上の子を産んだ時に母が16歳以上になるように。無理なら1つ下げる）
  const olderChildrenMonths: number[] = [];
  const nOlder = order === "第1子" ? 0 : order === "第2子" ? 1 : 2;
  const room = (motherAge - 16) * 12;
  if (nOlder && room < 12 * nOlder) {
    order = nOlder === 2 && room >= 12 ? "第2子" : "第1子";
  }
  const n = order === "第1子" ? 0 : order === "第2子" ? 1 : 2;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    let gap = uniformInt(r, 18, 48);
    if (acc + gap > room) gap = Math.max(12, room - acc);
    acc += gap;
    olderChildrenMonths.push(acc);
  }

  // 体外受精 → 双子 → 週数 → 体重 → NICU → 帝王切開
  const art = U("art") * 100 < ART_BY_AGE[ageBand];
  const twins = U("twins") * 100 < STATS.multiple.dist["多胎"];
  const z = invPhi(U("weeks"));
  const wk = bandAt(phi(z), twins ? STATS.weeksTwins.dist : WEEKS_SINGLE);
  const [d0, d1] = WEEK_DAYS[wk.band];
  // 双子は38週（266日）までに生まれる形にする（近似）
  const gestDays = Math.min(twins ? 266 : 300, Math.round(d0 + wk.within * (d1 - d0)));
  const weights: number[] = [];
  for (let i = 0; i < (twins ? 2 : 1); i++) {
    const z2 = WEEK_WEIGHT_RHO * z + Math.sqrt(1 - WEEK_WEIGHT_RHO ** 2) * normal(r);
    const w = bandAt(phi(z2), twins ? WEIGHT_TWINS : WEIGHT_SINGLE);
    const [g0, g1] = WEIGHT_G[w.band];
    // 週数で有り得る範囲に収める（中央値の0.6〜1.4倍。双子は1割軽い。近似）
    const med = medianGrams(gestDays) * (twins ? 0.9 : 1);
    const g = Math.round(g0 + w.within * (g1 - g0));
    weights.push(Math.round(Math.min(med * 1.4, Math.max(med * 0.6, g))));
  }
  // 32週未満はみな NICU（近似）。それ以外は体重ごとの割合
  const nicu = gestDays < 224 || weights.some((g) => chance(r, nicuRate(g)));
  // 双子は約8割が帝王切開。全体が統計の23%に戻るよう、単胎の割合を下げる（近似）
  const cesarean = U("cesarean") * 100 < (twins ? TWIN_CESAREAN : SINGLE_CESAREAN);

  // 国籍と婚姻 → ひとり親
  const natKind = pickU(U("nationality"), STATS.nationality.dist);
  const unmarried = natKind.includes("嫡出でない");
  const single = unmarried && chance(r, (STATS.unmarried.dist["0〜2歳のひとり親（推計）"] / (STATS.nationality.dist["母日本・嫡出でない子"] + STATS.nationality.dist["母外国・嫡出でない子"])) * 100);
  const marital: PopProfile["marital"] = !unmarried ? "婚姻" : single ? "ひとり親" : "事実婚";
  let motherNat = "日本";
  let fatherNat: string | undefined = "日本";
  if (natKind === "母日本・父外国") fatherNat = pick(r, STATS.foreignHusband.dist);
  else if (natKind === "父日本・母外国") motherNat = pick(r, STATS.foreignWife.dist);
  else if (natKind === "父母とも外国") fatherNat = motherNat = pick(r, STATS.foreignMother.dist);
  else if (natKind === "母外国・嫡出でない子") {
    motherNat = pick(r, STATS.foreignMother.dist);
    fatherNat = motherNat; // 事実婚の父は同じ国籍とした（近似）
  }
  if (single) fatherNat = undefined;
  const motherForeign = motherNat !== "日本";
  const fatherForeign = !!fatherNat && fatherNat !== "日本";

  // 祖父母（同居 → 同じ市区町村・遠く・亡くなっている。外国籍の親の母は国外）
  let gmMother: GrandmaPlace;
  let gmFather: GrandmaPlace | undefined;
  const coRes = U("cores") * 100 < (single ? STATS.singleWithParents.dist["親と同居"] : TG);
  const coSide: "mother" | "father" | null = !coRes ? null : single ? "mother" : chance(r, SIDE_MOTHER * 100) ? "mother" : "father";
  gmMother = coSide === "mother" ? "同居" : pickU(U("gm-mother"), GRANDMA_REST(WM));
  if (!single) gmFather = coSide === "father" ? "同居" : pickU(U("gm-father"), GRANDMA_REST(HM));
  if (motherForeign && gmMother !== "亡くなっている" && gmMother !== "同居") gmMother = "国外";
  if (fatherForeign && gmFather && gmFather !== "亡くなっている" && gmFather !== "同居") gmFather = "国外";

  // 里帰り（妻の母の住む所に合わせる）
  let satogaeri: PopProfile["satogaeri"] = null;
  const us = U("satogaeri");
  if (gmMother === "同じ市区町村" && us < SATO.ifNear) satogaeri = { kind: "同じ市町村", city: place.city, prefecture };
  else if (gmMother === "遠く" && us < SATO.ifFar) {
    if (chance(r, SATO.prefShareOfFar * 100)) satogaeri = { kind: "同じ都道府県", city: otherPlaceIn(r, prefecture, place.city), prefecture };
    else {
      const p = otherPref(r, prefecture);
      satogaeri = { kind: "ほかの都道府県", city: placeIn(r, p).city, prefecture: p };
    }
  }

  // 言葉 → 学歴
  const japaneseAnxious = { mother: motherForeign && chance(r, STATS.japanese.dist["外国籍の親のうち日本語に不安あり"]), father: fatherForeign && chance(r, STATS.japanese.dist["外国籍の親のうち日本語に不安あり"]) };
  let education = pickU(U("education"), STATS.education.dist);
  if (motherAge < 22 && (education === "大学" || education === "大学院")) education = motherAge < 20 ? "高校" : "専修・専門学校";
  if (motherAge < 24 && education === "大学院") education = "大学";
  if (motherAge < 18 && education !== "中学") education = "中学";
  if (motherAge < 20 && (education === "短大・高専" || education === "専修・専門学校")) education = "高校";

  // 母の仕事と育休
  let atPregnancy: MotherWork;
  let after: PopProfile["motherWork"]["after"];
  if (order === "第1子") {
    // 1つの層別の値で、無職 → 自営 → 正規 → 非正規 の順に区切る
    const u = U("mother-work");
    const w0 = MW1["妊娠前から無職・不詳"] / 100;
    const self = (1 - w0) * SELF_SHARE;
    const sei = (1 - w0) * (1 - SELF_SHARE) * SEISHA_SHARE;
    atPregnancy = u < w0 ? "無職" : u < w0 + self ? "自営など" : u < w0 + self + sei ? "正規" : "非正規";
    if (atPregnancy === "無職") after = "仕事なし";
    else if (atPregnancy === "自営など") after = "育休なしで継続";
    else {
      const cont = U("mother-cont") * 100 < (atPregnancy === "正規" ? MWT["正規の継続率"] : MWT["非正規の継続率"]);
      after = !cont ? "退職" : U("mother-leave") < LEAVE_IF_CONT_FIRST ? "育休" : "育休なしで継続";
    }
  } else {
    const w = pickU(U("mother-work"), MWA);
    atPregnancy = w === "仕事なし" ? "無職" : (w as MotherWork);
    after = atPregnancy === "無職" ? "仕事なし" : atPregnancy === "自営など" ? "育休なしで継続" : U("mother-leave") * 100 < (atPregnancy === "正規" ? MWT["続けた正規の育休"] : MWT["続けた非正規の育休"]) ? "育休" : "育休なしで継続";
  }
  const motherWork: PopProfile["motherWork"] = { atPregnancy, after };
  if (after === "育休") {
    motherWork.leaveDays = leaveDaysFrom(r, STATS.leaveWomen.dist);
    motherWork.returns = chance(r, STATS.returnRate.dist["女性・復職"]);
  }

  // 父の仕事・夜勤・単身赴任・育休
  let father: PopProfile["father"];
  if (!single) {
    const fw = pickU(U("father-work"), STATS.fatherWork.dist);
    const work: FatherWork = fw === "正規" ? "正規" : fw === "自営など" ? "自営など" : "その他";
    const nightShift = work !== "自営など" && U("night") * 100 < STATS.nightShift.dist["ある"];
    const tb = STATS.tanshin.dist;
    const tanshin = work === "正規" && !nightShift && U("tanshin") * 100 < (motherAge < 30 ? tb["20〜29歳"] : motherAge < 40 ? tb["30〜39歳"] : tb["40〜49歳"]);
    let leave: { days: number; papa: boolean } | null = null;
    if (work === "正規" && U("father-leave") * 100 < STATS.leaveRate.dist["男性"]) {
      leave = { days: leaveDaysFrom(r, STATS.leaveMen.dist), papa: chance(r, (STATS.leaveRate.dist["男性のうち産後パパ育休"] / STATS.leaveRate.dist["男性"]) * 100) };
    }
    father = { work, nightShift, tanshin, leave };
  }

  // 予定日・生まれた日（今日から見て授かる前〜2歳過ぎに一様）
  const dueDate = addDays(POP_TODAY, DUE_RANGE[0] + Math.floor(U("due") * (DUE_RANGE[1] - DUE_RANGE[0] + 1)));
  const lmp = lmpFromDue(dueDate);
  const birthDate = addDays(lmp, gestDays);

  // 引っ越し（1000日の中で一様。使い始めた後の、町が変わる引っ越しだけを Family に書く）
  let move: PopProfile["move"] = null;
  const mk = pickU(U("move"), STATS.moving.dist);
  if (mk !== "しない") {
    const on = addDays(lmp, uniformInt(r, 14, diffDays(addMonths(birthDate, 24), lmp)));
    let from = place.city;
    let fromPrefecture = prefecture;
    if (mk === "県内のほかの市町村") from = otherPlaceIn(r, prefecture, place.city);
    else if (mk === "ほかの都道府県") {
      fromPrefecture = otherPref(r, prefecture);
      from = placeIn(r, fromPrefecture).city;
    } else if (mk === "国外から") {
      from = "国外";
      fromPrefecture = "国外";
    }
    const changes = mk === "県内のほかの市町村" || mk === "ほかの都道府県";
    move = { kind: mk, on, from, fromPrefecture, inFamily: changes && on > POP_TODAY };
  }

  // 耳（父母のどちらか）
  const hearing: PopProfile["hearing"] = U("hearing") * 100 < STATS.hearing.dist["父母のどちらか"] ? (single || chance(r, 50) ? "母" : "パートナー") : null;

  // ───── 家族の形（Family 型） ─────
  const nations = new Map<string, string>();
  const motherName = motherForeign ? oneOf(r, FOREIGN[nameNation(r, motherNat, nations)].f) : oneOf(r, JP.mother);
  const partnerName = fatherNat ? (fatherForeign ? oneOf(r, FOREIGN[nameNation(r, fatherNat, nations)].m) : oneOf(r, JP.father)) : undefined;
  // 子の名前は親と同じにしない。双子は別の名前
  const childPool = (motherForeign && fatherForeign ? FOREIGN[nameNation(r, motherNat, nations)].f.concat(FOREIGN[nameNation(r, motherNat, nations)].m) : JP.child).filter(
    (n) => n !== motherName && n !== partnerName,
  );
  const child1 = oneOf(r, childPool);
  const childName = twins ? `${child1}と${oneOf(r, childPool.filter((n) => n !== child1))}` : child1;
  const members: Member[] = [{ id: "haha", name: motherName, role: "母" }];
  if (partnerName) members.push({ id: "partner", name: partnerName, role: "パートナー" });
  // なりきりの説明（persona.who に入れる。アプリの家族の型には持たない）
  const voices: Record<string, string> = { haha: motherVoice(), partner: partnerVoice() };
  if (coSide) {
    // 同居の祖母は家族の人に入れない（2026-11-03 に祖父母の役を消した）。名前の乱数は前と同じ回数だけ引いて捨てる（後の乱数がずれて、1000組が別の家族にならないように）
    const gmNat = coSide === "mother" ? motherNat : (fatherNat ?? "日本");
    void (gmNat === "日本" ? oneOf(r, JP.grandma) : oneOf(r, FOREIGN[nameNation(r, gmNat, nations)].f.filter((n) => n !== motherName)));
    const gm = `${coSide === "mother" ? motherName : partnerName}の母と同居している`;
    for (const id of Object.keys(voices)) voices[id] = voices[id] ? `${voices[id]}。${gm}` : gm;
  }

  function motherVoice(): string {
    const work = { 正規: "正社員", 非正規: "パート・派遣", 自営など: "自営", 無職: "仕事はしていない" }[atPregnancy];
    const plan = after === "育休" ? `。育休を${Math.round((motherWork.leaveDays ?? 0) / 30.4)}か月取る予定` : after === "退職" ? "。出産で仕事を辞める" : "";
    return `${motherAge}歳。${order}${twins ? "（双子）" : ""}。${work}${plan}${japaneseAnxious.mother ? `。${motherNat === "その他" ? "外国" : motherNat}の出身で、日本語の読み書きに不安がある` : ""}${hearing === "母" ? "。耳が聞こえにくい（筆談・文字が頼り）" : ""}`;
  }
  function partnerVoice(): string {
    if (!father) return "";
    const work = { 正規: "会社員", 自営など: "自営", その他: "非正規・その他" }[father.work];
    const bits = [work, father.nightShift ? "夜勤がある" : "", father.tanshin ? "単身赴任中" : "", father.leave ? `育休を${father.leave.days < 30 ? `${father.leave.days}日` : `${Math.round(father.leave.days / 30.4)}か月`}取る予定` : ""].filter(Boolean);
    return `${bits.join("。")}${japaneseAnxious.father ? `。${fatherNat === "その他" ? "外国" : fatherNat}の出身で、日本語に不安がある` : ""}${hearing === "パートナー" ? "。耳が聞こえにくい" : ""}${marital === "事実婚" ? "。婚姻届は出していない（事実婚）" : ""}`;
  }

  const fam: Family = {
    id,
    city: place.city,
    prefecture,
    dueDate,
    birthDate,
    startedOn: POP_TODAY,
    members,
  };
  if (birthDate <= POP_TODAY) fam.childName = childName;
  if (move?.inFamily) {
    // 今日より後に引っ越す家族: 今の町は引っ越した後の町（統計の都道府県の割合は、子が生まれた後の住所の割合として使う）
    fam.previousCity = move.from;
    fam.previousPrefecture = move.fromPrefecture;
    fam.movedOn = move.on;
  }

  const profile: PopProfile = {
    index,
    stageToday: stageAt(fam, POP_TODAY),
    placeType: place.type,
    motherAge,
    ageBand,
    order,
    olderChildrenMonths,
    // 体外受精は夫婦か事実婚が対象（学会の規定）。ひとり親には当てない
    art: art && !single,
    twins,
    gestDays,
    weeks: Math.floor(gestDays / 7),
    weights,
    nicu,
    cesarean,
    marital,
    nationality: { kind: natKind, mother: motherNat, father: fatherNat },
    japaneseAnxious,
    education,
    grandma: { mother: gmMother, father: gmFather },
    satogaeri,
    motherWork,
    father,
    move,
    hearing,
  };
  const persona = personaFor(r, fam, profile, voices);
  // 家族の形は、profile を作った後で写すだけ（乱数を引かないので、1000組の顔ぶれと割合は変わらない）
  fam.situation = situationFromProfile(profile, fam.dueDate);
  return { ...fam, persona, profile };
}

// ───────── profile → 家族の形（Family.situation） ─────────

/** 作った家族の profile を、アプリが読む家族の形に写す。統計で決めていない事（里帰りの期間など）は空のまま */
export function situationFromProfile(p: PopProfile, dueDate?: string): Situation {
  const mw = p.motherWork;
  const motherWork: Situation["motherWork"] =
    mw.after === "退職" ? "出産で辞める" : { 正規: "会社員・公務員", 非正規: "パート・派遣", 自営など: "自営・フリー", 無職: "仕事なし" }[mw.atPregnancy] as Situation["motherWork"];
  const s: Situation = {
    motherWork,
    olderChildren: p.olderChildrenMonths.length > 0,
    babies: p.twins ? 2 : 1,
    satogaeri: !!p.satogaeri,
  };
  // 上の子の生まれた日は、上の子の月齢（予定日の時点）から戻す。通う所は乱数を引かずに近似で決める:
  // 6歳3か月以上は小学校、母が妊娠中に働いていれば保育園（保育所等の利用は共働きが前提）、3歳以上は幼稚園、ほかは家。
  // 3歳以上の保育所等と幼稚園の利用はおよそ半々（こども家庭庁「保育所等関連状況取りまとめ」2024・文部科学省「学校基本調査」2024 から近似）
  if (dueDate && p.olderChildrenMonths.length) {
    const working = mw.atPregnancy !== "無職";
    s.olderKids = p.olderChildrenMonths.map((m) => ({
      birthDate: addMonths(dueDate, -m),
      care: m >= 75 ? "小学校" : working ? "保育園" : m >= 36 ? "幼稚園" : "家",
    }));
  }
  // 仕事に戻りたい時期（第2波④）: 育休の日数（雇用均等基本調査から配った物）が1年以上なら「1歳を過ぎて」、それより短い・育休なしで続けるなら「1歳まで」。
  // 辞める・仕事なし・戻らない母は持たない（保育園の予定が出ない）
  if (mw.after === "育休" && mw.returns !== false) s.returnAt = (mw.leaveDays ?? 0) >= 365 ? "1歳を過ぎて" : "1歳まで";
  else if (mw.after === "育休なしで継続") s.returnAt = "1歳まで";
  if (p.father) {
    // 「その他」は非正規・無職・不詳をまとめた区分。いちばん多い非正規に寄せた（近似）
    s.partnerWork = { 正規: "会社員・公務員", 自営など: "自営・フリー", その他: "パート・派遣" }[p.father.work] as Situation["partnerWork"];
    s.partnerLeave = p.father.leave ? "取る" : "取らない";
    // 育休の長さ（第2波⑤）: 配ってある日数から。14日以上で出生後休業支援給付の条件に届く
    if (p.father.leave) s.partnerLeaveLen = p.father.leave.days < 14 ? "14日未満" : p.father.leave.days < 30 ? "2週間〜1か月" : "1か月以上";
  }
  return s;
}

// ───────── persona（なりきり用。家族の状況から機械で作る） ─────────

function personaFor(r: Rng, f: Family, p: PopProfile, voices: Record<string, string>): Persona {
  const partner = f.members.find((m) => m.role === "パートナー");
  const me = partner && chance(r, 40) ? partner : f.members[0];
  const isMother = me.role === "母";
  const anxious = isMother ? p.japaneseAnxious.mother : p.japaneseAnxious.father;
  const literacy: Persona["literacy"] = anxious ? "やさしい日本語が要る" : "ふつう";
  const start = f.startedOn ?? POP_TODAY;
  const end = addDays(secondBirthday(f), 30);
  const d1 = minDay(addDays(start, uniformInt(r, 0, 6)), end);
  const span = diffDays(end, d1);
  const first = { on: d1, want: wantAt(r, f, p, d1, isMother) };
  // 2つ目は、1つ目と違う目的になる日を探す（その時期に目的が1つしか無ければ同じでよい）
  let second = { on: span >= 1 ? addDays(d1, 1) : d1, want: first.want };
  for (let i = 0; i < 6; i++) {
    const on = span > 45 ? addDays(d1, uniformInt(r, 30, Math.min(span, 400))) : span >= 1 ? addDays(d1, uniformInt(r, 1, span)) : d1;
    second = { on, want: wantAt(r, f, p, on, isMother) };
    if (second.want !== first.want) break;
  }
  const goals = [first, second];
  return {
    label: labelOf(f, p),
    meId: me.id,
    who: `${me.name}（${isMother ? "母" : "パートナー"}・${f.prefecture}${f.city}）。${voices[me.id] ?? ""}`,
    literacy,
    goals,
    watch: watchOf(p),
  };
}

const minDay = (a: string, b: string) => (a < b ? a : b);

function wantAt(r: Rng, f: Family, p: PopProfile, on: string, isMother: boolean): string {
  const s = stageAt(f, on);
  const works = p.motherWork.atPregnancy !== "無職";
  const opts: string[] = [];
  switch (s) {
    case "授かる前":
      opts.push("授かる前に、今のうちにやっておく事があるか知りたい");
      if (p.order !== "第1子") opts.push("上の子がいる中で、妊娠したら何から始めればいいか知りたい");
      break;
    case "妊娠初期":
      opts.push("妊娠がわかった。役所にいつ届ければいいか知りたい");
      if (works && isMother) opts.push(p.motherWork.atPregnancy === "自営など" ? "自営業でも出産でもらえるお金があるか知りたい" : "職場にいつ、どう伝えればいいか知りたい");
      if (p.japaneseAnxious.mother) opts.push("母子手帳をやさしい日本語で読みたい。届けに何を持っていくか知りたい");
      break;
    case "妊娠中期":
      opts.push(works ? "産休と育休の申し出を、いつ出せばいいか知りたい" : "出産でもらえるお金と、健診の補助券の使い方を知りたい");
      if (!isMother && p.father?.leave) opts.push("自分の育休を、いつ職場に伝えればいいか知りたい");
      if (p.satogaeri?.kind === "ほかの都道府県") opts.push(`里帰り先（${p.satogaeri.prefecture}${p.satogaeri.city}）で健診を受ける手続きを知りたい`);
      break;
    case "妊娠後期":
      opts.push("入院の準備と、生まれた後すぐの手続きを知りたい");
      if (p.satogaeri) opts.push(`里帰り（${p.satogaeri.city}）の前に、こちらで済ませておく事を知りたい`);
      if (p.order !== "第1子") opts.push("入院中の上の子の預け先と、段取りを決めたい");
      break;
    case "生後0〜3か月":
      opts.push(p.twins ? "双子の出生届と児童手当を、2人分どう出すか知りたい" : "出生届と児童手当を、誰がいつ出すか決めたい");
      if (p.nicu) opts.push("NICU に入院している間に、出生届や医療費の手続きをどうするか知りたい");
      if (p.nationality.mother !== "日本" || (p.nationality.father && p.nationality.father !== "日本")) opts.push("親の国の大使館への届けも要るか知りたい");
      if (p.marital === "ひとり親") opts.push("ひとりで出生届と児童手当を出す段取りと、使える助けを知りたい");
      break;
    case "生後4〜11か月":
      opts.push("予防接種の予定と、次の健診の日を知りたい");
      if (p.motherWork.after === "育休") opts.push("仕事に戻る前に、保育園の申し込みがいつか知りたい");
      break;
    case "1歳〜2歳":
      opts.push("1歳半の健診と、この先の予防接種を知りたい");
      if (p.motherWork.after === "育休") opts.push("職場に戻った後の、保育園の手続きを確かめたい");
      break;
    case "2歳過ぎ":
      opts.push("2歳までの記録を、一冊にまとめたい", "次の健診（3歳児健診）がいつ来るか知りたい");
      break;
  }
  return oneOf(r, opts);
}

function stageLabel(f: Family, day: string): string {
  const known = f.birthDate && day >= f.birthDate ? f : { ...f, birthDate: undefined };
  return clockAt(known, day).label;
}

function labelOf(f: Family, p: PopProfile): string {
  const bits = [
    stageLabel(f, POP_TODAY),
    `${p.motherAge}歳`,
    `${p.order}`,
    p.twins ? "双子" : "",
    p.nicu ? "NICU" : "",
    p.marital === "ひとり親" ? "ひとり親" : p.marital === "事実婚" ? "事実婚" : "",
    p.motherWork.atPregnancy === "無職" ? "母は仕事なし" : p.father && p.father.work !== "自営など" && p.motherWork.after !== "退職" ? "共働き" : p.motherWork.atPregnancy === "自営など" || p.father?.work === "自営など" ? "自営" : "",
    p.father?.nightShift ? "父が夜勤" : "",
    p.father?.tanshin ? "単身赴任" : "",
    p.satogaeri ? `里帰り（${p.satogaeri.kind}）` : "",
    p.nationality.mother !== "日本" ? `母は${p.nationality.mother === "その他" ? "外国" : p.nationality.mother}籍` : p.nationality.father && p.nationality.father !== "日本" ? `父は${p.nationality.father === "その他" ? "外国" : p.nationality.father}籍` : "",
    p.grandma.mother === "同居" || p.grandma.father === "同居" ? "祖父母と同居" : "",
    p.hearing ? "耳が聞こえにくい親" : "",
    p.move?.inFamily ? "これから引っ越す" : "",
    p.placeType,
  ].filter(Boolean);
  return bits.join("・");
}

function watchOf(p: PopProfile): string[] {
  const w: string[] = [];
  if (p.twins) w.push("双子を1人分の手続きとして出さない");
  if (p.nicu) w.push("NICU に入っている間の手続き（出生届の期限・医療費）を表せない");
  if (p.marital === "ひとり親") w.push("「パパの番」と出さない");
  if (p.satogaeri?.kind === "ほかの都道府県") w.push("里帰り先の町の健診・窓口を表せない");
  if (p.motherWork.atPregnancy === "自営など") w.push("自営に「職場に伝える」「育休」をそのまま出さない");
  if (p.japaneseAnxious.mother || p.japaneseAnxious.father) w.push("やさしい日本語で伝わるか");
  return w;
}

// ───────── 1000組 ─────────

let cache: PopFamily[] | null = null;

/** 決まった種の1000組（毎回同じ） */
export function getPopulation(): PopFamily[] {
  cache ??= generatePopulation(POP_SEED, POP_SIZE);
  return cache;
}

export function generatePopulation(seed: number, n: number = POP_SIZE): PopFamily[] {
  return Array.from({ length: Math.min(n, POP_SIZE) }, (_, i) => makeFamily(seed, i + 1));
}

/** id（pop-0001〜pop-1000）から1組。作るのはその1組だけ */
export function popFamilyById(id: string): PopFamily | null {
  const m = /^pop-(\d{4})$/.exec(id);
  if (!m) return null;
  const i = Number(m[1]);
  if (i < 1 || i > POP_SIZE) return null;
  return cache ? cache[i - 1] : makeFamily(POP_SEED, i);
}

// ───────── なりきりの家族の選び方（Workflow simulate が使う。pick.json に前もって書き出す） ─────────

export interface PickedFamily {
  id: string;
  label: string;
  meId: string;
  who: string;
  literacy: Persona["literacy"];
  goals: Persona["goals"];
  watch?: string[];
}

export interface PickRound {
  round: number;
  /** 1000組から、割合のまま選んだ6家族（同じ時期は2家族まで） */
  families: PickedFamily[];
  /** 30家族から、珍しい型を1家族（順番に入れ替え） */
  rare: string;
}

export function pickRounds(pop: PopFamily[], rareIds: string[], rounds = 30): PickRound[] {
  // 今日から30日以上触れる家族だけ（2歳を過ぎた家族は、なりきっても触る所が無い）
  const usable = pop.filter((f) => diffDays(addDays(secondBirthday(f), 30), POP_TODAY) >= 30);
  const out: PickRound[] = [];
  for (let round = 0; round < rounds; round++) {
    const r = rngFor(POP_SEED, `pick:${round}`);
    const pool = [...usable];
    const chosen: PopFamily[] = [];
    const perStage = new Map<Stage, number>();
    while (chosen.length < 6 && pool.length) {
      const f = pool.splice(Math.floor(r() * pool.length), 1)[0];
      const s = f.profile.stageToday;
      if ((perStage.get(s) ?? 0) >= 2) continue;
      perStage.set(s, (perStage.get(s) ?? 0) + 1);
      chosen.push(f);
    }
    out.push({
      round,
      families: chosen.map((f) => ({ id: f.id, label: f.persona.label, meId: f.persona.meId, who: f.persona.who, literacy: f.persona.literacy, goals: f.persona.goals, watch: f.persona.watch })),
      rare: rareIds[round % rareIds.length],
    });
  }
  return out;
}
