// 見本の時期の札から開いた時だけ、選んだ時期の事を一番上に出す（UX の見直し C36・2026-11-05）。
// 札（StagePicker の Stage.focus）は、予定の id か ADVISOR（手帳が気づいた事＝組み直し）を持つ。
// 入口の1枚・上の帯の「ほかの時期」で札を押した時に、その日だけ今日の画面（Techo）へ渡す。
// 本物の家族の画面の並びは変えない。日を変えると（ほかの札・1000日のどこでも）普段の並びに戻る。読み直すと消える（覚えない）。
import { useSyncExternalStore } from "react";

/** 手帳が気づいた事（AdvisorCard）を一番上に出す印 */
export const ADVISOR = "advisor";

export type StageFocus = { id: string; day: string } | null;

let current: StageFocus = null;
const subs = new Set<() => void>();

/** 札を押した時に呼ぶ（focus の無い札・1000日のどこでもは undefined で、普段の並びに戻す） */
export function setStageFocus(id: string | undefined, day: string): void {
  current = id ? { id, day } : null;
  subs.forEach((f) => f());
}

function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

export function useStageFocus(): StageFocus {
  return useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );
}

/**
 * 今日の画面で上に出す物。札の focus は札の日だけ。URL の ?focus=（ほかの画面から「この事を開く」）は今までどおり。
 * taskId: 一番上に出す予定の id（済んだ・過ぎた事なら、画面は普段の並びのまま）／advisorFirst: 手帳が気づいた事を一番上の札より上に
 */
export function focusFor(stage: StageFocus, urlFocus: string | null, today: string): { taskId: string | null; advisorFirst: boolean } {
  const id = stage && stage.day === today ? stage.id : urlFocus;
  if (!id) return { taskId: null, advisorFirst: false };
  return id === ADVISOR ? { taskId: null, advisorFirst: true } : { taskId: id, advisorFirst: false };
}
