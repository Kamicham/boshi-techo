// 家族を引く（サーバ側）。デモの家族は固定、「わが家」は DB の profile から。
import "server-only";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { get, put } from "./db";
import { scheduleFor } from "./milestones";
import type { GrandparentPlace, Leave, MotherWork, Situation, Work } from "./situation";

export const MINE_ID = "mine";

/** わが家の保存と同じく、途中から使い始めた家族は、使い始める前に期限が過ぎた事を済み扱いにする */
function seedStartedLate(f: Family) {
  if (!f.startedOn) return;
  for (const m of scheduleFor(f)) {
    const id = `done:${f.id}:${m.id}`;
    if (m.deadlineDate && !m.awaitingBirth && m.deadlineDate < f.startedOn && !get(id)) {
      put(f.id, "done", { milestoneId: m.id, today: f.startedOn, at: new Date().toISOString(), auto: "started-late" }, { id, date: f.startedOn });
    }
  }
}

/** シミュレーションのサーバ（BOSHI_SIM=1）だけ、作った30家族を読む */
let simSeeded = false;
function simFamilies(): Family[] {
  if (process.env.BOSHI_SIM !== "1") return [];
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const list = (require("@/sim/families") as typeof import("@/sim/families")).SIM_FAMILIES;
  if (!simSeeded) {
    simSeeded = true;
    for (const f of list) seedStartedLate(f);
  }
  return list;
}

/** シミュレーションのサーバだけ、現実の割合から作った1000組（pop-0001〜pop-1000）を id で1家族ずつ引く。一覧（allFamilies）には入れない */
const popSeeded = new Set<string>();
function popFamily(id: string): Family | null {
  if (process.env.BOSHI_SIM !== "1") return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const f = (require("@/sim/population") as typeof import("@/sim/population")).popFamilyById(id);
  if (!f) return null;
  if (!popSeeded.has(id)) {
    popSeeded.add(id);
    seedStartedLate(f);
  }
  return f;
}

export function getFamily(id: string): Family | null {
  if (id === DEMO_FAMILY.id) return DEMO_FAMILY;
  if (id.startsWith("sim-")) return simFamilies().find((f) => f.id === id) ?? null;
  if (id.startsWith("pop-")) return popFamily(id);
  if (id === MINE_ID) return get<Family>(`profile:${MINE_ID}`)?.data ?? null;
  return null;
}

export function saveMine(f: Omit<Family, "id">): Family {
  const fam: Family = { ...f, id: MINE_ID };
  put(MINE_ID, "profile", fam, { id: `profile:${MINE_ID}` });
  return fam;
}

export function allFamilies(): Family[] {
  const sim = simFamilies();
  if (sim.length) return [...sim, DEMO_FAMILY];
  const mine = getFamily(MINE_ID);
  return mine ? [mine, DEMO_FAMILY] : [DEMO_FAMILY];
}

/** API ルートで家族を必ず引く */
export function requireFamily(id: unknown): Family {
  const f = typeof id === "string" ? getFamily(id) : null;
  if (!f) throw new HttpError(404, "家族が見つかりません");
  return f;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// ───────── 家族の形（設定の画面から来た値を確かめる） ─────────

const WORKS: Work[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし"];
const MOTHER_WORKS: MotherWork[] = [...WORKS, "出産で辞める"];
const LEAVES: Leave[] = ["取る", "取らない", "未定"];
const PLACES: GrandparentPlace[] = ["同居", "近く", "遠く", "いない"];

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}
const isDay = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
/** 町の名前（短い文字だけ。長すぎる・空は捨てる） */
const placeName = (v: unknown): string | undefined => (typeof v === "string" && v.trim() && v.trim().length <= 20 ? v.trim() : undefined);

/**
 * 設定の画面から来た家族の形を確かめる。決まった選びに無い値・形の違う値は捨てる（= わからない）。
 * 何も残らなければ undefined（今までどおりの予定が出る）。
 */
export function cleanSituation(x: unknown, hasPartner: boolean, thisYear: number): Situation | undefined {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  const s: Situation = {};
  s.motherWork = oneOf(r.motherWork, MOTHER_WORKS);
  s.motherLeave = oneOf(r.motherLeave, LEAVES);
  if (hasPartner) {
    s.partnerWork = oneOf(r.partnerWork, WORKS);
    s.partnerLeave = oneOf(r.partnerLeave, LEAVES);
    if (typeof r.partnerNightShift === "boolean") s.partnerNightShift = r.partnerNightShift;
    if (typeof r.partnerAway === "boolean") s.partnerAway = r.partnerAway;
  }
  // 上の子: YYYY-MM を最大10人。今年より先・40年より前は捨てる。空の配列は「上の子はいない」
  if (Array.isArray(r.olderChildren)) {
    const kept = r.olderChildren
      .filter((v): v is string => typeof v === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(v))
      .filter((v) => {
        const y = Number(v.slice(0, 4));
        return y <= thisYear && y >= thisYear - 40;
      })
      .slice(0, 10)
      .sort();
    // 「いる」と答えて年月が1つも読めない時は「わからない」にする（「いない」と取り違えない）
    if (kept.length || !r.olderChildren.length) s.olderChildren = kept;
  }
  if (typeof r.babies === "number" && Number.isInteger(r.babies) && r.babies >= 1 && r.babies <= 5) s.babies = r.babies;
  // 里帰り: null は「しない」。する時は先の町がいる（無ければ、わからない扱い）
  if (r.satogaeri === null) s.satogaeri = null;
  else if (r.satogaeri && typeof r.satogaeri === "object") {
    const g = r.satogaeri as Record<string, unknown>;
    const city = placeName(g.city);
    if (city) {
      const from = isDay(g.from) ? g.from : undefined;
      const until = isDay(g.until) && (!from || g.until >= from) ? g.until : undefined;
      s.satogaeri = { prefecture: placeName(g.prefecture) ?? "", city, ...(from ? { from } : {}), ...(until ? { until } : {}) };
    }
  }
  if (r.grandparents && typeof r.grandparents === "object") {
    const g = r.grandparents as Record<string, unknown>;
    const gp = { mother: oneOf(g.mother, PLACES), partner: hasPartner ? oneOf(g.partner, PLACES) : undefined };
    if (gp.mother || gp.partner) s.grandparents = Object.fromEntries(Object.entries(gp).filter(([, v]) => v)) as Situation["grandparents"];
  }
  // わからない欄（undefined）は持たない
  const out = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Situation;
  return Object.keys(out).length ? out : undefined;
}
