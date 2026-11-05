// 予定のボタン（components/MilestoneActions.tsx）が何を出すかの判定。画面を持たない純関数（試験から読むため .ts に置く）。
import { DRAFTABLE } from "@/lib/draft-kinds";
import type { Milestone } from "@/lib/milestones";

/**
 * この事に「どこへ行くか見る」（町の窓口を調べる）と「◯を作る・見る」（下書き）があるか。どちらも無い事では何も描かない。
 * 役所の窓口を調べるのは、役所に出す手続きだけ（産院・職場に出す物を役所で調べると、違う行き先が出る＝sim-14 の直接支払制度）。
 * TaskBody が描く前に読んで、主ボタンを決める（描いた後に数えると、一瞬ちがうボタンが主に見える）
 */
export function actionsOf(m: Pick<Milestone, "id" | "needsLocal" | "kind" | "title" | "plain">, city: string | undefined): { canLocal: boolean; canDraft: boolean } {
  return {
    canLocal: !!m.needsLocal && !!city && !(m.kind === "仕事" || /産院|職場/.test(`${m.title}${m.plain}`)),
    canDraft: m.id in DRAFTABLE,
  };
}
