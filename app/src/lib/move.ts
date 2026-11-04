// 引っ越しと、生まれた日を入れた日（見直し C10）。家族の口2つ（/api/family・/api/account/profile）で同じ決まりにする。
// 画面とサーバの両方が読む（server-only にしない）。
import { addDays } from "./clock";
import type { Family } from "./demo-family";

const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

/** 設定の「町の名前を直しただけ（引っ越していない）」の答え */
export const NOT_MOVED = "not-moved";

/** 町を変えたか（前の町がある家族で、市区町村か都道府県が違う） */
export function townChanged(prior: Pick<Family, "city" | "prefecture"> | null | undefined, next: { city: string; prefecture?: string }): boolean {
  return !!prior?.city && (prior.city !== next.city || (prior.prefecture ?? "") !== (next.prefecture ?? ""));
}

/**
 * 町を変えたら、前の町と引っ越した日を覚える（参謀の「町が変わった」・引っ越しの行の起点）。
 * 引っ越した日は家族が答えた日。答えが無い・読めない・今日より先・1年より前の時は今日（保存した日）にする。
 * 「町の名前を直しただけ」（NOT_MOVED）の時は引っ越していない（前の引っ越しの欄のまま）
 */
export function moveFields(
  prior: Family | null | undefined,
  next: { city: string; prefecture?: string; movedOn?: unknown },
  today: string,
): Pick<Family, "previousCity" | "previousPrefecture" | "movedOn"> & { moved: boolean } {
  const keep = { previousCity: prior?.previousCity, previousPrefecture: prior?.previousPrefecture, movedOn: prior?.movedOn, moved: false };
  if (!townChanged(prior, next) || next.movedOn === NOT_MOVED) return keep;
  const asked = isDay(next.movedOn) && next.movedOn <= today && next.movedOn >= addDays(today, -366) ? next.movedOn : today;
  return { previousCity: prior!.city, previousPrefecture: prior!.prefecture || undefined, movedOn: asked, moved: true };
}

/**
 * 生まれた日を入れた日（参謀の「早く生まれた」を出す窓の起点＝見直し C10④）。
 * 生まれた日を新しく入れた・変えた時は今日。同じ生まれた日のままなら前のまま（11/5 より前に入れた家族は持たない＝生まれた日から数える）
 */
export function birthKnownField(prior: Pick<Family, "birthDate" | "birthKnownOn"> | null | undefined, birthDate: string | undefined, today: string): Pick<Family, "birthKnownOn"> {
  if (!birthDate) return {};
  if (prior?.birthDate === birthDate) return prior.birthKnownOn ? { birthKnownOn: prior.birthKnownOn } : {};
  return { birthKnownOn: today };
}

/** 覚えている役所の窓口（keep.office）。staleFrom: 町を変えた時に付ける「前の町の窓口」の印（前の町の名前） */
export type Office = { name?: string; address?: string; staleFrom?: string };

/** 覚えている役所の窓口（前の町の窓口の印が付いている時は、下書き・予定の場所に使わない＝無い事にする） */
export function officeOf(office: Office | undefined): Office | undefined {
  return office && !office.staleFrom ? office : undefined;
}
