// 母子手帳の記録（db の type "techo"）を出し入れする。サーバ側だけで使う。
// 約束: 体の数字は、家族が話したか紙の手帳から写した物だけ。撮った・話した記録は pending:true の候補で入り、家族の「OK」で確定する。
// 型の正本は ./techo.ts。ここでは中身を決まりどおりに整える（知らない欄・読めない値は捨てる）。
import "server-only";
import { get, list, put, remove, type Doc } from "./db";
import type { Family } from "./demo-family";
import { TECHO_PAGE_IDS, type TechoEntry, type TechoPageId, type TechoSource, type TechoValueKeys } from "./techo";
import { seedTecho } from "./techo-seed";

/**
 * 保存する1件（TechoEntry に、撮った紙の日付の確かさの印を足した物）。
 * dateUnsure: "guess" = 紙に日付が無く、ページの題と生まれた日から推した日／"none" = 推せず、家族に入れてもらう日。OK で消える。
 */
export type TechoStored = TechoEntry & { dateUnsure?: "guess" | "none" };
export type TechoDoc = Doc<TechoStored>;

/** わが家の id（family.ts の MINE_ID と同じ。family.ts は重いので読まない） */
const MINE = "mine";

// ── 中身の決まり（techo.ts の TechoValueKeys と型で突き合わせる。ずれると tsc が止まる） ──

type KeysOf<P extends TechoPageId> = readonly (keyof TechoValueKeys[P] & string)[];

/** page ごとに入れてよい欄 */
export const VALUE_KEYS: { [P in TechoPageId]: KeysOf<P> } = {
  "mother-health": ["heightCm", "weightKg", "history", "allergy", "medicine", "pastBirths", "smoking"],
  "pregnancy-checkup": ["week", "weightKg", "bpHigh", "bpLow", "fundusCm", "edema", "urineProtein", "urineSugar", "memo", "facility"],
  "pregnancy-test": ["test", "result"],
  feeling: ["text", "occasion"],
  birth: ["week", "weightG", "heightCm", "headCm", "chestCm", "method", "place"],
  postpartum: ["days", "text", "care"],
  newborn: ["dayAge", "weightG", "feeding", "vitaminK", "test", "result"],
  stool: ["colorNo", "ageText"],
  growth: ["weightKg", "heightCm", "headCm"],
  development: ["item"],
  "child-checkup": ["checkup", "result", "weightKg", "heightCm", "memo"],
  vaccine: ["vaccine", "dose", "lot", "facility", "doctor"],
  consult: ["has", "whom", "text"],
};

/** 無いと記録にならない欄（無ければその1件を捨てる） */
const REQUIRED: Partial<Record<TechoPageId, string>> = {
  "pregnancy-test": "test",
  feeling: "text",
  stool: "colorNo",
  development: "item",
  "child-checkup": "checkup",
  vaccine: "vaccine",
};

/** 数の欄（単位はキー名のとおり） */
const NUMBER_KEYS = new Set(["heightCm", "weightKg", "bpHigh", "bpLow", "fundusCm", "weightG", "headCm", "chestCm", "days", "dayAge", "colorNo"]);
/** はい・いいえの欄 */
const BOOL_KEYS = new Set(["has"]);

const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isPage = (s: unknown): s is TechoPageId => typeof s === "string" && (TECHO_PAGE_IDS as readonly string[]).includes(s);

/** 全角の数字・記号を半角に */
function half(s: string): string {
  return s.replace(/[０-９．，－]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

/** 「3,120」「3120g」「36.5」などを数にする。読めなければ null（作らない） */
export function toNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const m = half(v).replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!m) return null;
  const n = Number(m[0]);
  return Number.isFinite(n) ? n : null;
}

function toBool(v: unknown): boolean | null {
  if (typeof v === "boolean") return v;
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (/^(true|はい|いる|ある|有|あり)$/.test(s)) return true;
  if (/^(false|いいえ|いない|ない|無|なし)$/.test(s)) return false;
  return null;
}

/** 欄の値を決まりどおりに整える。読めない・空の値は捨てる（空のまま） */
export function cleanValues(page: TechoPageId, raw: Record<string, unknown> | undefined | null): TechoEntry["values"] {
  const out: TechoEntry["values"] = {};
  if (!raw) return out;
  for (const key of VALUE_KEYS[page] as readonly string[]) {
    const v = raw[key];
    if (v == null || v === "") continue;
    if (NUMBER_KEYS.has(key)) {
      const n = toNumber(v);
      if (n == null || n < 0) continue;
      // 便色カードは国の7色の番号だけ
      if (key === "colorNo" && !(Number.isInteger(n) && n >= 1 && n <= 7)) continue;
      out[key] = n;
    } else if (BOOL_KEYS.has(key)) {
      const b = toBool(v);
      if (b != null) out[key] = b;
    } else {
      const s = String(v).trim().slice(0, 2000);
      if (s) out[key] = s;
    }
  }
  return out;
}

/** 1件を決まりどおりに整える。ページ・日付・必須の欄が無ければ null（入れない） */
export function cleanEntry(e: Partial<TechoStored> & { values?: Record<string, unknown> }, fallback: { today: string; source?: TechoSource }): TechoStored | null {
  if (!isPage(e.page)) return null;
  const values = cleanValues(e.page, e.values);
  const req = REQUIRED[e.page];
  if (req && values[req] == null) return null;
  // 中身が1つも無い記録は入れない
  if (Object.keys(values).length === 0) return null;
  const source: TechoSource = e.source === "voice" || e.source === "photo" || e.source === "text" || e.source === "seed" ? e.source : (fallback.source ?? "text");
  const entry: TechoStored = {
    page: e.page,
    date: isDate(e.date) ? e.date : fallback.today,
    title: (typeof e.title === "string" && e.title.trim() ? e.title.trim() : String(values[req ?? ""] ?? "記録")).slice(0, 60),
    values,
    source,
  };
  if (typeof e.who === "string" && e.who.trim()) entry.who = e.who.trim().slice(0, 30);
  if (typeof e.note === "string" && e.note.trim()) entry.note = e.note.trim().slice(0, 500);
  if (typeof e.captureId === "string" && e.captureId) entry.captureId = e.captureId;
  if (e.pending) entry.pending = true;
  // 日付の確かさの印は、まだ OK していない候補だけが持つ
  if (e.pending && (e.dateUnsure === "guess" || e.dateUnsure === "none")) entry.dateUnsure = e.dateUnsure;
  return entry;
}

/** ページの並び（府令様式の順）→ その事の日の順 → 入れた順 */
export function sortTecho<T extends { data: TechoEntry; date: string | null; createdAt: string }>(docs: T[]): T[] {
  const order = new Map(TECHO_PAGE_IDS.map((id, i) => [id, i]));
  return [...docs].sort(
    (a, b) =>
      (order.get(a.data.page) ?? 99) - (order.get(b.data.page) ?? 99) ||
      (a.data.date ?? "").localeCompare(b.data.date ?? "") ||
      a.createdAt.localeCompare(b.createdAt),
  );
}

// ── 出し入れ ──

/** 作った家族の記録を入れた印（一覧には出さない）。家族が全部消しても入れ直さないため */
const isMarker = (d: Doc<unknown>) => d.id.endsWith(":seeded");

function rawList(familyId: string): TechoDoc[] {
  return list<TechoEntry>(familyId, "techo", { limit: 5000 }).filter((d) => !isMarker(d) && d.data && isPage(d.data.page));
}

/**
 * 家族の手帳の記録（ページの並び・日付の順）。今日より後の日付の記録は返さない。
 * 作った家族（わが家以外）は、作った記録（techo-seed）をその日の時点で毎回作って混ぜる（保存しない。時計を進め戻ししてもずれない）。
 * 家族が自分で足した記録は保存した物を返す。わが家には作った記録を入れない。
 */
export function listTecho(familyId: string, opts: { family?: Family; today?: string } = {}): TechoDoc[] {
  const today = opts.today;
  // 前の版で保存した作った記録は読まない
  let docs = rawList(familyId).filter((d) => d.data.source !== "seed");
  if (familyId !== MINE && opts.family && today) {
    const at = `${today}T00:00:00.000Z`;
    const seeded = (seedTecho(opts.family, today) ?? [])
      .map((e: TechoEntry) => cleanEntry({ ...e, source: "seed", pending: false }, { today, source: "seed" }))
      .filter((e): e is TechoEntry => !!e)
      .map((entry, i) => ({ id: `techo:${familyId}:seed:${String(i + 1).padStart(3, "0")}`, familyId, type: "techo" as const, date: entry.date, data: entry, createdAt: at, updatedAt: at }));
    docs = [...docs, ...seeded];
  }
  if (today) docs = docs.filter((d) => (d.date ?? d.data.date) <= today);
  return sortTecho(docs);
}

/** 記録を足す（整えて入らなかった物は捨てる）。入った物を返す */
export function addTecho(familyId: string, entries: unknown[], opts: { today: string; source?: TechoSource; pending?: boolean; captureId?: string }): TechoDoc[] {
  const out: TechoDoc[] = [];
  for (const raw of entries) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Partial<TechoStored>;
    const entry = cleanEntry(
      { ...e, ...(opts.pending != null ? { pending: opts.pending } : {}), ...(opts.captureId ? { captureId: opts.captureId } : {}), ...(opts.source ? { source: opts.source } : {}) },
      { today: opts.today, source: opts.source },
    );
    if (entry) out.push(put<TechoStored>(familyId, "techo", entry, { date: entry.date }));
  }
  return out;
}

/** その家族の手帳の記録か（ほかの家族の id を触らせない） */
function owned(id: string, familyId?: string): TechoDoc | null {
  const d = get<TechoStored>(id);
  if (!d || d.type !== "techo" || isMarker(d)) return null;
  if (familyId != null && d.familyId !== familyId) return null;
  return d;
}

/**
 * 家族の「OK」で確定する（pending と日付の印を外す）。
 * date を渡すと、その日で確定する（家族が候補の日付を直した時）。今日より後の日・読めない日は受け取らない
 */
export function confirmTecho(id: string, familyId?: string, date?: string, today?: string): TechoDoc | null {
  const d = owned(id, familyId);
  if (!d) return null;
  if (!d.data.pending) return d;
  const { pending: _p, dateUnsure: _u, ...rest } = d.data;
  void _p;
  void _u;
  const day = isDate(date) && (!today || date <= today) ? date : rest.date;
  return put<TechoStored>(d.familyId, "techo", { ...rest, date: day }, { id: d.id, date: day });
}

/** 「違う」で消す */
export function removeTecho(id: string, familyId?: string): boolean {
  const d = owned(id, familyId);
  if (!d) return false;
  remove(id);
  return true;
}

/** 聞き返しで作り直す時、同じ束のまだ確定していない候補を消す */
export function removePendingByCapture(familyId: string, captureId: string): void {
  for (const d of rawList(familyId)) if (d.data.pending && d.data.captureId === captureId) remove(d.id);
}

/** 中身の一部を直す（家族が候補の値を直した時など） */
export function patchTecho(id: string, familyId: string, partial: Partial<TechoStored>): TechoDoc | null {
  const d = owned(id, familyId);
  if (!d) return null;
  const merged = cleanEntry({ ...d.data, ...partial, values: { ...d.data.values, ...(partial.values ?? {}) } }, { today: d.data.date });
  if (!merged) return null;
  return put<TechoStored>(d.familyId, "techo", merged, { id, date: merged.date });
}
