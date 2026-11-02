// 家族が決め直した担当を DB に置く（1家族1件。種類は「いつもの」と同じ profile）。
import "server-only";
import { get, put } from "@/lib/db";
import type { Assign, Assignments } from "@/lib/assign";

const assignId = (familyId: string) => `assign:${familyId}`;

export function getAssignments(familyId: string): Assignments {
  return get<{ map: Assignments }>(assignId(familyId))?.data.map ?? {};
}

/** 1件を決め直す。null は「予定表の目安に戻す」 */
export function setAssignment(familyId: string, milestoneId: string, a: Assign | null): Assignments {
  const map = { ...getAssignments(familyId) };
  if (a) map[milestoneId] = a.memberId ? { who: a.who, memberId: a.memberId } : { who: a.who };
  else delete map[milestoneId];
  put(familyId, "profile", { map, updatedAt: new Date().toISOString() }, { id: assignId(familyId) });
  return map;
}
