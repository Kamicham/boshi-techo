// 日付の言い方（日付は小さく添える物。大きく出すのは「あと◯日」。30日より先の言い方は task.ts の whenDate）。
// today を渡すと、年が今日と違う日にだけ年を付ける（「1/26（金）」が2029年の物だと分からなかった＝第31回）。

function parts(s: string): { y: number; m: number; d: number; wd: string } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d, wd: "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] };
}

const otherYear = (s: string, today?: string) => !!today && s.slice(0, 4) !== today.slice(0, 4);

/** 11月23日（月）。today と年が違えば 2027年11月23日（火） */
export function jpDate(s: string, today?: string): string {
  const { y, m, d, wd } = parts(s);
  return `${otherYear(s, today) ? `${y}年` : ""}${m}月${d}日（${wd}）`;
}

/** 11/23（月）。today と年が違えば 2029/1/26（金） */
export function jpShort(s: string, today?: string): string {
  const { y, m, d, wd } = parts(s);
  return `${otherYear(s, today) ? `${y}/` : ""}${m}/${d}（${wd}）`;
}
