// 日付の言い方（日付は小さく添える物。大きく出すのは「あと◯日」）。

/** 11月23日（月） */
export function jpDate(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${wd}）`;
}

/** 11/23（月） */
export function jpShort(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}/${d}（${wd}）`;
}
