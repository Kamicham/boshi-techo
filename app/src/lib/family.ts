// 家族を引く（サーバ側）。デモの家族は固定、「わが家」は DB の profile から。
import "server-only";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { get, put } from "./db";
import { scheduleFor } from "./milestones";

export const MINE_ID = "mine";

/** わが家の保存と同じく、途中から使い始めた家族は、使い始める前に期限が過ぎた事を済み扱いにする */
function seedStartedLate(f: Family) {
  if (!f.startedOn) return;
  for (const m of scheduleFor(f)) {
    const id = `done:${f.id}:${m.id}`;
    if (m.deadlineDate && m.deadlineDate < f.startedOn && !get(id)) {
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
