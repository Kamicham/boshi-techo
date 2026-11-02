// 家族を引く（サーバ側）。デモの家族は固定、「わが家」は DB の profile から。
import "server-only";
import { DEMO_FAMILY, type Family } from "./demo-family";
import { get, put } from "./db";

export const MINE_ID = "mine";

export function getFamily(id: string): Family | null {
  if (id === DEMO_FAMILY.id) return DEMO_FAMILY;
  if (id === MINE_ID) return get<Family>(`profile:${MINE_ID}`)?.data ?? null;
  return null;
}

export function saveMine(f: Omit<Family, "id">): Family {
  const fam: Family = { ...f, id: MINE_ID };
  put(MINE_ID, "profile", fam, { id: `profile:${MINE_ID}` });
  return fam;
}

export function allFamilies(): Family[] {
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
