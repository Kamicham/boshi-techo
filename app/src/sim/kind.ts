// 作った家族の世帯の種類（households.kind）。純粋な関数だけ（DB もサーバも読まない）。
// - demo: 見本の家族（demo-sato）
// - sim: 作った30家族（families.ts）と、現実の割合から作った1000組（population.ts）
// - それ以外（わが家の "mine"・アカウントで作った世帯）は本物（null ＝ kind = real）
// id の形（sim- で始まるか）では決めず、コードに固定の一覧に有るかで決める（lib/family.ts の madeFamilyKind と同じ決まり。
// あちらは BOSHI_SIM=1 の時だけ sim を返す。こちらは早送りの試験から使うので、いつでも返す）。
import { DEMO_FAMILY } from "../lib/demo-family";
import { SIM_FAMILIES } from "./families";
import { popFamilyById } from "./population";

export type MadeKind = "demo" | "sim";

const SIM_IDS = new Set(SIM_FAMILIES.map((f) => f.id));

/** 作った家族なら、その世帯の種類。本物の世帯は null */
export function madeHouseholdKind(id: string): MadeKind | null {
  if (id === DEMO_FAMILY.id) return "demo";
  if (SIM_IDS.has(id)) return "sim";
  if (popFamilyById(id)) return "sim";
  return null;
}

/** 1000組（現実の割合から作った家族）の1組か */
export function isPopulationFamily(id: string): boolean {
  return !SIM_IDS.has(id) && popFamilyById(id) != null;
}
