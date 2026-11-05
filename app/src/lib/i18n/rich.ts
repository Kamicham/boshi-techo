// 画面の部品だけが使う（サーバの文は文字だけなので t()）。lib/i18n/screens.test.ts は tr() も t() と同じに読む（鍵が辞書にある・{名前} を渡している）。
// 訳した文の {名前} に、太字の数などの部品を差し込む（t() は文字だけを返すので）。
// 例: tr("写真 {n} 枚", { n: <b className="tabular">{count}</b> }) → 日本語は前と同じ「写真 <b>12</b> 枚」、English は「Photos: <b>12</b>」。
// 部品は数ではないので、英語の数の形（{n:photo|photos}）は使えない。数で形の変わらない言い方に訳す。
import { createElement, Fragment, type ReactNode } from "react";
import { t } from ".";

export function tr(key: string, parts: Readonly<Record<string, ReactNode>>): ReactNode {
  const s = t(key);
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(/\{(\w+)\}/g)) {
    if (!(m[1] in parts)) continue;
    const at = m.index ?? 0;
    if (at > last) out.push(s.slice(last, at));
    out.push(parts[m[1]]);
    last = at + m[0].length;
  }
  if (last < s.length) out.push(s.slice(last));
  return createElement(Fragment, null, ...out);
}
