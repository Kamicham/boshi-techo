/**
 * 里帰りの2つの町（第2波⑦）。住む町と里帰り先の町の近さと、住む町に戻る日を決める。
 * 出典: 都道府県の外への里帰りは13.5%・県内は13.1%（厚生労働省 子ども・子育て支援推進調査研究事業 2018）。
 */
import { addDays } from "./clock";
import type { Situation, SatogaeriBack } from "./situation";

export type SatogaeriReach = "同じ市" | "同じ県" | "ほかの県" | "わからない";

const norm = (x?: string) => (x ?? "").replace(/\s/g, "");

/** 里帰り先が住む町からどれだけ離れているか。里帰り先が無い・住む町がわからない時は「わからない」（今までどおり遠方の扱い） */
export function satogaeriReach(home: { city?: string; prefecture?: string }, s?: Situation): SatogaeriReach {
  const p = s?.satogaeri ? s.satogaeriPlace : undefined;
  if (!p || !norm(home.city) || !norm(home.prefecture)) return "わからない";
  if (norm(p.prefecture) !== norm(home.prefecture)) return "ほかの県";
  return norm(p.city) === norm(home.city) ? "同じ市" : "同じ県";
}

/**
 * 住む町に戻る日（生まれた日から何日目）。近似: 1か月健診（生後1か月）を里帰り先で受けてから戻る家族は生後35日ごろ、
 * 産後2か月ごろは60日、それより長くは90日。決めていない時は1か月健診のあとで置く（多い形の近似）
 */
export function backDays(b?: SatogaeriBack): number {
  return b === "産後2か月ごろ" ? 60 : b === "それより長く" ? 90 : 35;
}

export function backDate(birth: string, b?: SatogaeriBack): string {
  return addDays(birth, backDays(b));
}
