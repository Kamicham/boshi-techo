// からだの記録（家族の声②「体重などを入れたら、目で見て分かる形でいつも把握できるように」・2026-11-05 作り手が承認したプランの B）。
// 手帳の記録（TechoEntry）から、ママの妊娠中の数字と、赤ちゃんの体重・身長・頭囲の並びを作る純な関数。
// 画面（手帳のタブのからだの記録・健診で見せる1枚）とサーバ（lib/share-view.ts）の両方から読む（server-only にしない）。
// 約束: 体の判断はしない。良し悪し・前回との差・評価の言葉を持たない。入れた数字を日付の順に並べるだけ。
// - 週は日付と予定日から数え直す（lmp＝予定日−280日。保存された「24週」の字は見ない＝撮り間違い・打ち間違いで線が戻らない）
// - 外す物: OK 待ちの候補・今日より後の記録・生まれた後の妊婦健診
// - つらい別れ（hideCounts）の家族には null（数を出さない）
import { diffDays, lmpFromDue } from "./clock";
import type { Family } from "./demo-family";
import { hideCounts } from "./situation";
import type { TechoEntry } from "./techo";

/** 妊婦健診の1回（府令様式「妊娠中の経過」の列の順。腹囲は今の記録の形に無いので持たない） */
export interface CheckupRow {
  date: string;
  /** 妊娠週と日（日付と予定日から数え直した物） */
  week: number;
  day: number;
  fundusCm?: number;
  weightKg?: number;
  bpHigh?: number;
  bpLow?: number;
  edema?: string;
  urineProtein?: string;
  urineSugar?: string;
}

/** 家で測った1回（lib/techo.ts の HOME_PAGE_ID）。週と日は妊娠中の物だけ */
export interface HomeRow {
  date: string;
  week?: number;
  day?: number;
  weightKg?: number;
  bpHigh?: number;
  bpLow?: number;
  tempC?: number;
}

export interface MotherBody {
  /** 身長と妊娠前の体重（手帳の「妊婦の健康状態」。いちばん新しく書いた値） */
  heightCm?: number;
  preWeightKg?: number;
  /** 妊娠前の BMI（身長と妊娠前の体重がそろった時だけ。小数1桁）。区分の名前は持たない */
  bmi?: number;
  /** 双子など（体重の目安の幅は、公の値が無いので出さない） */
  multiple: boolean;
  checkups: CheckupRow[];
  home: HomeRow[];
}

export interface BabyPoint {
  date: string;
  /** 生まれた日から数えた日数（生まれた日＝0） */
  ageDays: number;
  weightKg?: number;
  heightCm?: number;
  headCm?: number;
}

export interface BabyBody {
  /** 記録の who（双子は「ひなた（1人目）」の形）。who の無い記録は子の名前の線に入れる */
  who: string;
  points: BabyPoint[];
}

export interface BodySeries {
  mother: MotherBody;
  babies: BabyBody[];
}

type BodyFamily = Pick<Family, "dueDate" | "birthDate" | "childName" | "situation">;

/** 数の欄（数で入る。念のため字の「58.2」「５８．２kg」も読む）。0 以下・読めない物は無し */
function num(v: unknown): number | undefined {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : undefined;
  if (typeof v !== "string") return undefined;
  const m = v
    .replace(/[０-９．]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/,/g, "")
    .match(/\d+(?:\.\d+)?/);
  const n = m ? Number(m[0]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** 記号の欄（尿・むくみ。「−」「＋」などを書いたまま） */
function sym(v: unknown): string | undefined {
  if (typeof v === "number") return String(v);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/** 同じ日の物を1つに（先に入っている値を残し、空の欄だけ後の物で埋める） */
function fill<T extends object>(into: T, from: Partial<T>): void {
  for (const [k, v] of Object.entries(from)) if (v !== undefined && (into as Record<string, unknown>)[k] === undefined) (into as Record<string, unknown>)[k] = v;
}

const dropEmpty = <T extends object>(o: T): T => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** 赤ちゃんの数を拾うページ（同じ日に2つある時は、この順の物を先に使う） */
const BABY_PAGES = ["growth", "child-checkup", "newborn", "birth"] as const;

/**
 * からだの記録の並び。今日までの、家族が OK した記録だけ（日付の順）。
 * つらい別れの家族は null（画面は図を出さない）
 */
export function bodySeries(entries: readonly TechoEntry[], family: BodyFamily, today: string): BodySeries | null {
  if (hideCounts(family)) return null;
  const live = entries.filter((e) => !e.pending && typeof e.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(e.date) && e.date <= today);
  const lmp = lmpFromDue(family.dueDate);
  // 生まれた日（今日までに生まれていれば）。生まれた日以後の妊婦健診は外す
  const born = family.birthDate && family.birthDate <= today ? family.birthDate : undefined;
  const pregnancyOf = (date: string) => {
    const since = diffDays(date, lmp);
    if (since < 0 || (family.birthDate && date >= family.birthDate)) return null;
    return { week: Math.floor(since / 7), day: since % 7 };
  };

  // ── ママ: 身長と妊娠前の体重（いちばん新しく書いた値）
  let heightCm: number | undefined;
  let preWeightKg: number | undefined;
  for (const e of [...live].filter((e) => e.page === "mother-health").sort((a, b) => b.date.localeCompare(a.date))) {
    heightCm ??= num(e.values.heightCm);
    preWeightKg ??= num(e.values.weightKg);
  }
  const bmi = heightCm && preWeightKg ? Math.round((preWeightKg / (heightCm / 100) ** 2) * 10) / 10 : undefined;

  // ── ママ: 妊婦健診（同じ日の物は1行に）
  const byDate = new Map<string, CheckupRow>();
  for (const e of live) {
    if (e.page !== "pregnancy-checkup") continue;
    const p = pregnancyOf(e.date);
    if (!p) continue;
    const v = e.values;
    const row: CheckupRow = {
      date: e.date,
      ...p,
      fundusCm: num(v.fundusCm),
      weightKg: num(v.weightKg),
      bpHigh: num(v.bpHigh),
      bpLow: num(v.bpLow),
      edema: sym(v.edema),
      urineProtein: sym(v.urineProtein),
      urineSugar: sym(v.urineSugar),
    };
    const had = byDate.get(e.date);
    if (had) fill(had, row);
    else byDate.set(e.date, row);
  }
  const checkups = [...byDate.values()].map(dropEmpty).sort((a, b) => a.date.localeCompare(b.date));

  // ── ママ: 家で測った物（1日に何回あってもそのまま）
  const home = live
    .filter((e) => e.page === "home")
    .map((e) => {
      const p = pregnancyOf(e.date);
      return dropEmpty<HomeRow>({ date: e.date, ...(p ?? {}), weightKg: num(e.values.weightKg), bpHigh: num(e.values.bpHigh), bpLow: num(e.values.bpLow), tempC: num(e.values.tempC) });
    })
    .filter((r) => r.weightKg !== undefined || r.bpHigh !== undefined || r.bpLow !== undefined || r.tempC !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date));

  // ── 赤ちゃん: who ごとの体重・身長・頭囲（生まれた日から今日まで。同じ日の物は1つに）
  const babies = new Map<string, Map<string, BabyPoint>>();
  if (born) {
    const rank = (page: string) => BABY_PAGES.indexOf(page as (typeof BABY_PAGES)[number]);
    const pages = live.filter((e) => rank(e.page) >= 0 && e.date >= born).sort((a, b) => rank(a.page) - rank(b.page));
    for (const e of pages) {
      const v = e.values;
      const g = num(v.weightG);
      const point: BabyPoint = {
        date: e.date,
        ageDays: diffDays(e.date, born),
        weightKg: num(v.weightKg) ?? (g !== undefined ? Math.round(g) / 1000 : undefined),
        heightCm: num(v.heightCm),
        headCm: num(v.headCm),
      };
      if (point.weightKg === undefined && point.heightCm === undefined && point.headCm === undefined) continue;
      const who = e.who?.trim() || family.childName || "";
      const line = babies.get(who) ?? new Map<string, BabyPoint>();
      babies.set(who, line);
      const had = line.get(e.date);
      if (had) fill(had, point);
      else line.set(e.date, point);
    }
  }
  const babyList: BabyBody[] = [...babies.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([who, line]) => ({ who, points: [...line.values()].map(dropEmpty).sort((a, b) => a.date.localeCompare(b.date)) }));

  const multiple = (family.situation?.babies ?? 1) > 1 || babyList.length > 1;
  return {
    mother: dropEmpty<MotherBody>({ heightCm, preWeightKg, bmi, multiple, checkups, home }),
    babies: babyList,
  };
}

// ───────── 体重の目安（40週の所に1本だけ置く括弧） ─────────

/**
 * 妊娠中の体重の増え方の目安（日本産科婦人科学会「妊娠中の体重増加の目安について」2021年3月8日）。
 * 妊娠前の BMI で決まる、出産までの合計。週ごとの値は公に無いので、週ごとの帯は作らない。区分の名前（やせ・肥満）は画面に出さない。
 * BMI 30 以上は幅が無く「個別対応（上限5kgまでが目安）」の文だけ。双子など（多胎）は公の値が無いので出さない
 */
export const GAIN_GUIDE_SOURCE = { title: "日本産科婦人科学会「妊娠中の体重増加の目安について」", date: "2021-03-08", year: 2021 } as const;

export type GainGuide = { kind: "range"; lowKg: number; highKg: number } | { kind: "individual" };

/** 妊娠前の BMI から、出産までの増え方の目安（BMI が無い・多胎の時は null） */
export function gainGuide(bmi: number | undefined, multiple: boolean): GainGuide | null {
  if (multiple || bmi === undefined || !Number.isFinite(bmi) || bmi <= 0) return null;
  if (bmi < 18.5) return { kind: "range", lowKg: 12, highKg: 15 };
  if (bmi < 25) return { kind: "range", lowKg: 10, highKg: 13 };
  if (bmi < 30) return { kind: "range", lowKg: 7, highKg: 10 };
  return { kind: "individual" };
}
