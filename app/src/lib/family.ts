// 家族を引く（サーバ側）。デモの家族は固定、「わが家」は DB の profile から。
import "server-only";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { get, put } from "./db";
import { scheduleFor } from "./milestones";
import { birthFacts, isMadeFamily } from "./techo-seed";
import { listTecho } from "./techo-store";
import { cleanOlderKids, cleanQuiet, type Leave, type MotherWork, type Situation, type Work } from "./situation";
import { HttpError } from "./http-error";
import { isTrialId } from "./trial-cookie";

export const MINE_ID = "mine";

/** わが家の保存と同じく、途中から使い始めた家族は、使い始める前に期限が過ぎた事を済み扱いにする */
function seedStartedLate(f: Family) {
  if (!f.startedOn) return;
  // 生まれた時の体重で足す事（小さく生まれた子の届け）も、同じく済み扱いにする
  for (const m of scheduleFor(withBirthFacts(f))) {
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

/**
 * 作った家族（コードに固定の一覧）なら、その種類。id の形ではなく、一覧に有るかで決める。
 * - demo: 見本の家族（demo-sato）。いつでも
 * - sim: 作った30家族と1000組。シミュレーションのサーバ（BOSHI_SIM=1）の時だけ
 * lib/access.ts が、ログインなしで通す世帯を決めるのに使う
 */
export function madeFamilyKind(id: string): "demo" | "sim" | null {
  if (id === DEMO_FAMILY.id) return "demo";
  // 公開版の体験の写し（開けるのは札の持ち主だけ。lib/access.ts）
  if (isTrialId(id)) return "demo";
  if (process.env.BOSHI_SIM !== "1") return null;
  if (simFamilies().some((f) => f.id === id)) return "sim";
  if (popFamily(id)) return "sim";
  return null;
}

export function getFamily(id: string): Family | null {
  const f = rawFamily(id);
  return f ? withBirthFacts(f) : null;
}

function rawFamily(id: string): Family | null {
  if (id === DEMO_FAMILY.id) return DEMO_FAMILY;
  if (isTrialId(id)) return { ...DEMO_FAMILY, id };
  if (id.startsWith("sim-")) return simFamilies().find((f) => f.id === id) ?? null;
  if (id.startsWith("pop-")) return popFamily(id);
  if (id === MINE_ID) {
    const f = get<Family>(`profile:${MINE_ID}`)?.data;
    return f ? fromSaved(f) : null;
  }
  // アカウントで作った世帯: 家族の設定は profile:<世帯の id>（saveFamilyProfile）。
  // 誰が見てよいかは、ここではなく lib/access.ts の withHousehold が先に確かめる
  const f = get<Family>(`profile:${id}`)?.data;
  return f ? fromSaved({ ...f, id }) : null;
}

/** 「38週2日」→ 38 */
const weekOf = (v: unknown): number | undefined => {
  const m = String(v ?? "").normalize("NFKC").match(/(\d+)\s*週/);
  return m ? Number(m[1]) : undefined;
};

/**
 * 生まれた時の体重と週数を、手帳の出産の記録から埋める（保存はしない）。予定の「小さく生まれた子」の届け・助成が読む。
 * - わが家: 家族が OK した出産の記録（birth の weightG・week）。双子などは一番小さい子の体重
 * - 作った家族: 作った記録と同じ値（techo-seed の birthFacts）。生まれた日のある家族だけ
 * 記録が無ければ何も足さない（わからない＝出さない）
 */
export function withBirthFacts(f: Family): Family {
  if (!f.birthDate) return f;
  if (isMadeFamily(f.id)) {
    const { gestDays, weightsG } = birthFacts(f);
    return { ...f, birthWeightG: Math.min(...weightsG), birthWeek: Math.floor(gestDays / 7) };
  }
  const births = listTecho(f.id).filter((d) => d.data.page === "birth" && !d.data.pending);
  const weights = births.map((d) => Number(d.data.values.weightG)).filter((n) => Number.isFinite(n) && n > 0);
  const week = births.map((d) => weekOf(d.data.values.week)).find((n) => n != null);
  return { ...f, ...(weights.length ? { birthWeightG: Math.min(...weights) } : {}), ...(week != null ? { birthWeek: week } : {}) };
}

/**
 * 前の形で保存した「わが家」を今の形に直して読む（保存し直すまでは DB の中は前の形のまま）。
 * 祖父母の人は外し、人の来る日・伝え方のヒントは読み捨てる。家族の形は cleanSituation で直す。
 */
function fromSaved(f: Family): Family {
  const members = (f.members ?? [])
    .filter((m) => m.role === "母" || m.role === "パートナー")
    .map((m) => ({ id: m.id, name: m.name, role: m.role }));
  const { situation: raw, ...rest } = f;
  const situation = cleanSituation(raw, members.some((m) => m.role === "パートナー"));
  return { ...rest, members, ...(situation ? { situation } : {}) };
}

export function saveMine(f: Omit<Family, "id">): Family {
  const fam: Family = { ...f, id: MINE_ID };
  put(MINE_ID, "profile", fam, { id: `profile:${MINE_ID}` });
  return fam;
}

/** アカウントで作った世帯の家族の設定を保存する（id は世帯の id。権限は呼ぶ前に withHousehold で確かめる） */
export function saveFamilyProfile(householdId: string, f: Omit<Family, "id">): Family {
  if (householdId === DEMO_FAMILY.id || isTrialId(householdId)) throw new HttpError(403, "見本の家族の設定は変えられません");
  const fam: Family = { ...f, id: householdId };
  put(householdId, "profile", fam, { id: `profile:${householdId}` });
  return fam;
}

export function allFamilies(): Family[] {
  const sim = simFamilies();
  if (sim.length) return [...sim, DEMO_FAMILY].map(withBirthFacts);
  const mine = getFamily(MINE_ID);
  return mine ? [mine, withBirthFacts(DEMO_FAMILY)] : [withBirthFacts(DEMO_FAMILY)];
}

/** API ルートで家族を必ず引く */
export function requireFamily(id: unknown): Family {
  const f = typeof id === "string" ? getFamily(id) : null;
  if (!f) throw new HttpError(404, "家族が見つかりません");
  return f;
}

// HttpError は lib/http-error.ts に移した（visit などが今もここから読むので、出し直しておく）
export { HttpError } from "./http-error";

// ───────── 家族の形（設定の画面から来た値を確かめる） ─────────

const WORKS: Work[] = ["会社員・公務員", "パート・派遣", "自営・フリー", "仕事なし"];
const MOTHER_WORKS: MotherWork[] = [...WORKS, "出産で辞める"];
const LEAVES: Leave[] = ["取る", "取らない", "未定"];

function oneOf<T extends string>(v: unknown, list: readonly T[]): T | undefined {
  return typeof v === "string" && (list as readonly string[]).includes(v) ? (v as T) : undefined;
}

/**
 * はい・いいえの欄を読む。前の形で保存された値も読む:
 * 配列（上の子の生まれ年月）は1人以上で true、空で false。オブジェクト（里帰り先の町）は true、null は false。
 */
function yesNo(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return true;
  return undefined;
}

/**
 * 設定の画面から来た家族の形を確かめる（保存してある前の形の値も、ここで今の形に直す）。
 * 決まった選びに無い値・形の違う値は捨てる（= わからない）。消した欄（母の育休・夜勤・単身赴任・祖父母）は読み捨てる。
 * 何も残らなければ undefined（今までどおりの予定が出る）。
 */
export function cleanSituation(x: unknown, hasPartner: boolean): Situation | undefined {
  if (!x || typeof x !== "object") return undefined;
  const r = x as Record<string, unknown>;
  const s: Situation = {};
  s.motherWork = oneOf(r.motherWork, MOTHER_WORKS);
  if (hasPartner) {
    s.partnerWork = oneOf(r.partnerWork, WORKS);
    s.partnerLeave = oneOf(r.partnerLeave, LEAVES);
  }
  s.olderChildren = yesNo(r.olderChildren);
  if (s.olderChildren === true) {
    const kids = cleanOlderKids(r.olderKids);
    if (kids.length) s.olderKids = kids;
  }
  if (typeof r.babies === "number" && Number.isInteger(r.babies) && r.babies >= 1 && r.babies <= 5) s.babies = r.babies;
  s.satogaeri = yesNo(r.satogaeri);
  s.quiet = cleanQuiet(r.quiet);
  s.publicServant = yesNo(r.publicServant);
  s.babyInsurance = r.babyInsurance === "勤め先" || r.babyInsurance === "国保" ? r.babyInsurance : undefined;
  // わからない欄（undefined）は持たない
  const out = Object.fromEntries(Object.entries(s).filter(([, v]) => v !== undefined)) as Situation;
  return Object.keys(out).length ? out : undefined;
}
