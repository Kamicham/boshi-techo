// 気をつける事の札（components/today/CautionCard.tsx）の、表に出す引用を選ぶ。画面を持たない純関数（試験から読むため .ts に置く）。
// 家族の声①への直し A「その時に1つ、聞かれたら全部」: 表には最初の2つと、強く注意する引用（tone のある物＝赤の命の橋・太字の「絶対に…ない」）だけ。
// 残りは「全部読む（N）›」で、元の並びのまま全部開く（引用は言い換えない・並びも変えない）。

/** 表に出す引用の数（強く注意する引用は、数に入れずにいつも出す） */
export const QUOTES_SHOWN = 2;

export function foldQuotes<Q extends { tone?: string }>(quotes: readonly Q[]): { shown: Q[]; folded: number } {
  const shown = quotes.filter((q, i) => i < QUOTES_SHOWN || !!q.tone);
  return { shown, folded: quotes.length - shown.length };
}
