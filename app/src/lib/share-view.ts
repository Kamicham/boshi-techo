// 健診で見せる1枚（家族の声②の C。2026-11-05 統括の割り振り・作り手が承認したプラン https://claude.ai/artifact/3XseGBAg5LzK2UWgvoCJRK ）の、
// 出してよい物の決まり。画面と印刷は思い出の会話が作る（一冊の印刷と同じ型）。ここは「1枚に何を出してよいか」と
// 「ママの欄を誰が選べるか」を1か所で決める純粋な関数（画面からもサーバからも読む。試験は share-view.test.ts）。
//
// 守る事:
// - 出してよい欄だけを、名前を決めて拾い直す（元の記録をそのまま渡さない）。id・世帯の id・名前・題・元の言葉・メモ・施設名・
//   ロット・医師は持たない。体の数字は B の bodySeries（lib/body-series.ts）と同じ拾い方にする（手帳の図と1枚で数字がずれない）
// - OK 待ちの候補（pending）と、今日より後の日付の記録は出さない
// - ママの欄（ママの頁・家で測った物・妊娠中の RS の行・ママの健診で聞く事）は、ママ本人（viewer が mother）の時だけ。
//   ほかの人には、選ぶ所も出さない（作り手の決め 2026-11-05: 読むだけの人には、ママの体の図と1枚のママの欄を見せない）
// - 出さない物: 検査の記録・気持ち・相談・産後の気分・お産のしかた・便色・できた日・写真と声・手紙・手帳に聞く・
//   お金（受診券・払った額）・職場
// - つらい別れの家族（lib/situation.ts の hideCounts）には、週数を出さない（体の図の束は空になる）
// - 短いはずの欄に長い文が入っていても、上限で切る（1枚に長い文を流さない）
import { bodySeries } from "./body-series";
import type { Family } from "./demo-family";
import { isMaternalVaccine, isMotherEntry, recordViewerOf, type RecordViewer } from "./mother-records";
import { hideCounts } from "./situation";
import type { TechoEntry } from "./techo";
import type { VisitPlan } from "./visit";

// ───────── 1枚を作る人（だれの記録か・だれが見るかは lib/mother-records.ts。手帳の一覧・書き出しと同じ決まり） ─────────

/** mother＝ママ本人 ／ writer＝ほかの書ける人（パートナーなど） ／ reader＝読むだけの人（member） */
export type ShareViewer = RecordViewer;

/** 1枚を作る人がだれか（関所の結果 HouseholdAccess をそのまま渡せる。lib/mother-records.ts の recordViewerOf と同じ） */
export const shareViewerOf = recordViewerOf;

// ───────── 束 ─────────

export type ShareBundle = "body" | "growth" | "checkups" | "vaccines" | "next" | "questions" | "motherHealth";

/**
 * 束の並び（1枚の上からこの順）。mother はママ本人だけが選べる束。
 * body＝母の体（妊婦健診の値・家で測った物・身長と妊娠前の体重）／ growth＝子の成長 ／ checkups＝健診の日 ／ vaccines＝接種 ／
 * next＝次の予定 ／ questions＝健診で聞きたい事 ／ motherHealth＝妊婦の健康状態（これまでの病気・アレルギー・薬など。既定でオフ）
 */
export const SHARE_BUNDLES: readonly { id: ShareBundle; mother: boolean; defaultOn: boolean }[] = [
  { id: "body", mother: true, defaultOn: true },
  { id: "growth", mother: false, defaultOn: true },
  { id: "checkups", mother: false, defaultOn: true },
  { id: "vaccines", mother: false, defaultOn: true },
  { id: "next", mother: false, defaultOn: true },
  { id: "questions", mother: false, defaultOn: true },
  { id: "motherHealth", mother: true, defaultOn: false },
];

/** その人が選べる束と、はじめの入り切り（ママ本人でなければ、ママの束は出さない） */
export function shareChoices(viewer: ShareViewer): { id: ShareBundle; on: boolean }[] {
  return SHARE_BUNDLES.filter((b) => !b.mother || viewer === "mother").map((b) => ({ id: b.id, on: b.defaultOn }));
}

// ───────── 1枚の形（id・名前・題・元の言葉・メモ・施設名・ロット・医師を持たない） ─────────

/** 妊婦健診の1回（紙の手帳「妊娠中の経過」の列の順。腹囲は今の記録の形に無い） */
export interface ShareCheckupValues {
  date: string;
  week?: number;
  day?: number;
  fundusCm?: number;
  weightKg?: number;
  bpHigh?: number;
  bpLow?: number;
  edema?: string;
  urineProtein?: string;
  urineSugar?: string;
}
/** 家で測った1回 */
export interface ShareHomeValues {
  date: string;
  week?: number;
  day?: number;
  weightKg?: number;
  bpHigh?: number;
  bpLow?: number;
  tempC?: number;
}
export interface ShareBody {
  heightCm?: number;
  preWeightKg?: number;
  bmi?: number;
  multiple: boolean;
  checkups: ShareCheckupValues[];
  home: ShareHomeValues[];
}
export interface ShareGrowth {
  /** 何人目か（bodySeries の babies の順。名前は持たない） */
  child: number;
  points: { date: string; ageDays: number; weightKg?: number; heightCm?: number; headCm?: number }[];
}
export interface ShareCheckupDay {
  date: string;
  kind: "pregnancy" | "child";
  /** 妊娠週と日（ママの健診だけ。つらい別れの家族には無い） */
  week?: number;
  day?: number;
  /** 乳幼児健診の名前（記録の字のまま。訳すのは画面） */
  name?: string;
  /** 双子などの時だけ、何人目か */
  child?: number;
}
export interface ShareVaccine {
  date: string;
  /** ワクチンの名前と回（記録の字のまま。訳すのは画面） */
  vaccine: string;
  dose?: string;
  /** 妊娠中の RS の行（ママ本人の時だけ入る） */
  mother?: true;
  child?: number;
}
export interface ShareQuestion {
  /** 子の健診で聞く事か（false はママの健診で聞く事＝ママ本人の時だけ入る） */
  forChild: boolean;
  text: string;
}
export interface ShareMotherHealth {
  heightCm?: number;
  preWeightKg?: number;
  history?: string;
  allergy?: string;
  medicine?: string;
  pastBirths?: string;
  smoking?: string;
}
export interface ShareSheet {
  /** 入れた束（頼んだ束のうち、この人が選べる物だけ。SHARE_BUNDLES の順） */
  bundles: ShareBundle[];
  /** つらい別れの家族（週数を出していない。体の図の束は空） */
  hideCounts: boolean;
  body?: ShareBody | null;
  growth?: ShareGrowth[];
  checkups?: ShareCheckupDay[];
  vaccines?: ShareVaccine[];
  next?: { date: string; time?: string } | null;
  questions?: ShareQuestion[];
  motherHealth?: ShareMotherHealth | null;
}

export interface ShareInput {
  /** 手帳の記録（lib/techo-store.ts の listTecho の data。id などほかの欄が付いていても読まない） */
  entries: readonly TechoEntry[];
  /** 次の予約と健診で聞く事（lib/visit.ts の VisitPlan。無ければ null） */
  plan?: Pick<VisitPlan, "next" | "concerns"> | null;
  /** 家族の設定（予定日・生まれた日・子の呼び名・つらい別れ・双子の数を読む） */
  family: Pick<Family, "dueDate" | "birthDate" | "childName" | "situation">;
  /** 今日（YYYY-MM-DD）。これより後の記録は出さない */
  today: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_QUESTIONS = 30;

/** 字の欄: 空白をそろえ、上限で切る。字でも数でもない物・空は無し */
function text(v: unknown, max: number): string | undefined {
  if (typeof v !== "string" && typeof v !== "number") return undefined;
  const s = String(v).replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

/** 数の欄（数で入る。字の「58.2」も読む）。0 以下・読めない物は無し */
function num(v: unknown): number | undefined {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\s*\d+(\.\d+)?\s*$/.test(v) ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

/** undefined の欄を落とす（JSON に空の鍵を残さない） */
function compact<T extends object>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

/**
 * 1枚の中身。頼んだ束のうち、その人が選べる物だけを入れる（ママの束は mother の時だけ）。
 * 束の中でも、ママの行（ママの健診の日・妊娠中の RS・ママの健診で聞く事）は mother の時だけ入る
 */
export function shareView(input: ShareInput, opts: { viewer: ShareViewer; bundles: readonly ShareBundle[] }): ShareSheet {
  const mother = opts.viewer === "mother";
  const quiet = hideCounts(input.family);
  const today = DATE.test(input.today) ? input.today : "0000-00-00";
  const bundles = SHARE_BUNDLES.filter((b) => (!b.mother || mother) && opts.bundles.includes(b.id)).map((b) => b.id);
  const want = new Set(bundles);
  const live = input.entries.filter((e) => e && !e.pending && typeof e.date === "string" && DATE.test(e.date) && e.date <= today && (mother || !isMotherEntry(e)));
  // 体の数字は B と同じ拾い方（どの束でも、何人目かの番号をそろえるために毎回作る）
  const series = bodySeries(live, input.family, today);

  // 何人目か: bodySeries の babies の順（同じ呼び名の決め方: who が無ければ子の呼び名）。2人以上の時だけ checkups・vaccines に付ける
  const order = (series?.babies ?? []).map((b) => b.who);
  const whoOf = (e: TechoEntry) => e.who?.trim() || input.family.childName || "";
  for (const e of live) if (["growth", "child-checkup", "newborn", "birth", "vaccine"].includes(e.page) && !isMotherEntry(e) && !order.includes(whoOf(e))) order.push(whoOf(e));
  const childOf = (e: TechoEntry) => (order.length > 1 ? order.indexOf(whoOf(e)) + 1 || undefined : undefined);

  const sheet: ShareSheet = { bundles, hideCounts: quiet };

  if (want.has("body")) {
    const m = series?.mother;
    sheet.body = m
      ? compact<ShareBody>({
          heightCm: num(m.heightCm),
          preWeightKg: num(m.preWeightKg),
          bmi: num(m.bmi),
          multiple: !!m.multiple,
          checkups: m.checkups.map((r) =>
            compact<ShareCheckupValues>({
              date: r.date,
              week: r.week,
              day: r.day,
              fundusCm: num(r.fundusCm),
              weightKg: num(r.weightKg),
              bpHigh: num(r.bpHigh),
              bpLow: num(r.bpLow),
              edema: text(r.edema, 20),
              urineProtein: text(r.urineProtein, 20),
              urineSugar: text(r.urineSugar, 20),
            }),
          ),
          home: m.home.map((r) =>
            compact<ShareHomeValues>({ date: r.date, week: r.week, day: r.day, weightKg: num(r.weightKg), bpHigh: num(r.bpHigh), bpLow: num(r.bpLow), tempC: num(r.tempC) }),
          ),
        })
      : null;
  }

  if (want.has("growth")) {
    sheet.growth = (series?.babies ?? []).map((b, i) => ({
      child: i + 1,
      points: b.points.map((p) => compact({ date: p.date, ageDays: p.ageDays, weightKg: num(p.weightKg), heightCm: num(p.heightCm), headCm: num(p.headCm) })),
    }));
  }

  if (want.has("checkups")) {
    const days: ShareCheckupDay[] = [];
    if (mother) for (const r of series?.mother.checkups ?? []) days.push(compact<ShareCheckupDay>({ date: r.date, kind: "pregnancy", week: r.week, day: r.day }));
    for (const e of live) {
      if (e.page !== "child-checkup") continue;
      days.push(compact<ShareCheckupDay>({ date: e.date, kind: "child", name: text(e.values.checkup, 30), child: childOf(e) }));
    }
    sheet.checkups = days.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (want.has("vaccines")) {
    const rows: ShareVaccine[] = [];
    for (const e of live) {
      if (e.page !== "vaccine") continue;
      const vaccine = text(e.values.vaccine, 40);
      if (!vaccine) continue;
      const ofMother = isMaternalVaccine(e);
      if (ofMother && !mother) continue;
      rows.push(
        compact<ShareVaccine>({
          date: e.date,
          vaccine,
          // 妊娠中の RS の回は妊娠週数（つらい別れの家族には出さない）
          dose: ofMother && quiet ? undefined : text(e.values.dose, 20),
          mother: ofMother ? true : undefined,
          child: ofMother ? undefined : childOf(e),
        }),
      );
    }
    sheet.vaccines = rows.sort((a, b) => a.date.localeCompare(b.date));
  }

  if (want.has("next")) {
    const n = input.plan?.next;
    sheet.next = n && typeof n.date === "string" && DATE.test(n.date) && n.date >= today ? compact({ date: n.date, time: text(n.time, 10) }) : null;
  }

  if (want.has("questions")) {
    sheet.questions = (input.plan?.concerns ?? [])
      .filter((c) => c && (c.for === "child" || mother))
      .flatMap((c) => {
        const t = text(c.text, 300);
        return t ? [{ forChild: c.for === "child", text: t }] : [];
      })
      .slice(0, MAX_QUESTIONS);
  }

  if (want.has("motherHealth")) {
    // いちばん新しく書いた値を欄ごとに（bodySeries の身長・妊娠前の体重と同じ拾い方）
    const pick: Record<string, unknown> = {};
    for (const e of live.filter((e) => e.page === "mother-health").sort((a, b) => b.date.localeCompare(a.date))) {
      for (const [k, v] of Object.entries(e.values)) if (pick[k] === undefined && v !== null && v !== "") pick[k] = v;
    }
    const h = compact<ShareMotherHealth>({
      heightCm: num(pick.heightCm),
      preWeightKg: num(pick.weightKg),
      history: text(pick.history, 300),
      allergy: text(pick.allergy, 300),
      medicine: text(pick.medicine, 300),
      pastBirths: text(pick.pastBirths, 100),
      smoking: text(pick.smoking, 100),
    });
    sheet.motherHealth = Object.keys(h).length ? h : null;
  }

  return sheet;
}
