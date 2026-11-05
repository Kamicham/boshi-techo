// 予定（lib/milestones.ts・lib/older.ts）の言葉を、画面の言葉にする。予定のデータは日本語のまま持ち（下書き・Claude への頼み・試験はそのまま）、
// 画面に描く時だけここを通す。辞書は dict/milestones.ts。家族の形で変わる言い方（名前・人数・町）は、形を見て差し込みの鍵で引く
// （components/today/StagePicker.tsx の stageWords と同じやり方）。試験は milestones-i18n.test.ts（作った家族の予定の言葉をすべて引く）
import { currentLang, t } from ".";

/** 今の言葉の辞書に、その鍵の訳があるか（訳の無い鍵は、t() が日本語の鍵のまま返す） */
function has(key: string): boolean {
  return t(key) !== key;
}

/**
 * 上の子の呼び方（lib/older.ts の olderLabel: 呼び名・「上の子」・「上の子2」）。「上の子」「上の子2」だけ訳し、呼び名はそのまま。
 * 「上の子」だけの鍵は持たない（設定の画面などの「上の子」と訳を分けるため）。「上の子{n}」の {n} を空にして引く
 */
function childWord(label: string): string {
  const m = /^上の子(\d*)$/.exec(label);
  return m ? t("上の子{n}", { n: m[1] }).trim() : label;
}

/** 文の途中に入れる言葉（English は頭を小文字に。「Child allowance (児童手当)」→「child allowance (児童手当)」） */
function mid(s: string): string {
  return currentLang() === "en" ? s.charAt(0).toLowerCase() + s.slice(1) : s;
}

/** 家族の形で変わる言い方（lib/milestones.ts の adjust・lib/older.ts）。上から順に形を見て、差し込みの鍵で引く */
const SHAPES: readonly (readonly [RegExp, (m: RegExpExecArray) => string])[] = [
  // 双子など: 「（2人分）」「（おなかの子2人分）」と、支援給付の2回目の一言
  [/^(.+)（おなかの子(\d+)人分）$/, (m) => t("{what}（おなかの子{n}人分）", { what: msWords(m[1]), n: Number(m[2]) })],
  [/^(.+)（(\d+)人分）$/, (m) => t("{what}（{n}人分）", { what: msWords(m[1]), n: Number(m[2]) })],
  [/^予定日の8週前から。(\d+)人分（1人5万円の目安）$/, (m) => t("予定日の8週前から。{n}人分（1人5万円の目安）", { n: Number(m[1]) })],
  // 里帰り: 出生届を出せる町と、里帰り先の町の名前（町の名前は日本語のまま。窓口で使う）
  [/^14日以内。([^・]+)・([^・]+)・本籍地で出せる$/, (m) => t("14日以内。{city}・{there}・本籍地で出せる", { city: m[1], there: m[2] })],
  [
    /^里帰り先の町（(.+)）で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる$/,
    (m) => t("里帰り先の町（{city}）で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる", { city: m[1] }),
  ],
  // お金が届いたか確かめる（lib/money.ts の paidDef）。名前と確かめ先は辞書で引く（用語集の訳。窓口の言葉は日本語を括弧で並べる）
  [/^(.+)が届いたか確かめる（届く時期を過ぎたら(.+)に確かめる）$/, (m) => t("{what}が届いたか確かめる（届く時期を過ぎたら{ask}に確かめる）", { what: mid(t(m[1])), ask: mid(t(m[2])) })],
  [/^(.+)が届いたか見る$/, (m) => t("{what}が届いたか見る", { what: mid(t(m[1])) })],
  [/^届いたら「済んだ」。まだなら(.+)に$/, (m) => t("届いたら「済んだ」。まだなら{ask}に", { ask: mid(t(m[1])) })],
  // 上の子: 年月だけ答えた生まれた日の印と、正式な言い方（上の子（2024年12月生まれ）の3歳児健診）
  [/^(.+)（月の1日で数えた目安）$/, (m) => t("{what}（月の1日で数えた目安）", { what: msWords(m[1]) })],
  [
    /^(.+?)（(\d{4})年(\d{1,2})月生まれ）の(.+)$/,
    (m) => t("{name}（{year}年{month}月生まれ）の{what}", { name: childWord(m[1]), year: m[2], month: m[3], what: msWords(m[4]) }),
  ],
];

/** 予定の見出し・一言・正式な言い方を今の言葉に（訳が無ければ日本語のまま）。日本語の画面では1字も変えない */
export function msWords(s: string): string {
  if (currentLang() === "ja" || has(s)) return t(s);
  for (const [re, to] of SHAPES) {
    const m = re.exec(s);
    if (m) return to(m);
  }
  // 名前の入る見出し: パートナーの呼び名（翔太の育休を職場に伝える）と、上の子の見出し（上の子の3歳児健診・陽菜の1歳の予防接種）。
  // 呼び名に「の」が入っていても（ゆきの）合うよう、「の」の切れ目を前から順に試す。上の子の「BCG を受ける」は「BCG 」になるので、空白を落として引く
  for (let i = s.indexOf("の"); i > 0; i = s.indexOf("の", i + 1)) {
    const key = `{name}の${s.slice(i + 1).trim()}`;
    if (has(key)) return t(key, { name: childWord(s.slice(0, i)) });
  }
  return s;
}
