// 日付の言い方（日付は小さく添える物。大きく出すのは「あと◯日」。30日より先の言い方は task.ts の whenDate）。
// today を渡すと、年が今日と違う日にだけ年を付ける（「1/26（金）」が2029年の物だと分からなかった＝第31回）。
// 画面の言葉（lib/i18n）で書き分ける: 中文は同じ並びで曜日だけ「周一」、English は Intl（Mon, Nov 23）。日本語は前と1字も変えない。
// 勤め先・役所あての文書の日付は lib/blanks.ts の jpDate（いつも日本語）
import { currentLang } from "@/lib/i18n";

const JA_WEEK = "日月火水木金土";
const ZH_WEEK = "日一二三四五六";

function parts(s: string): { y: number; m: number; d: number; w: number } {
  const [y, m, d] = s.split("-").map(Number);
  return { y, m, d, w: new Date(Date.UTC(y, m - 1, d)).getUTCDay() };
}

const otherYear = (s: string, today?: string) => !!today && s.slice(0, 4) !== today.slice(0, 4);

/** 曜日の札: 月 / 周一 */
const week = (w: number) => (currentLang() === "zh" ? `周${ZH_WEEK[w]}` : JA_WEEK[w]);

/** English の日付（暦日なので UTC で書く） */
function en(s: string, opts: Intl.DateTimeFormatOptions): string {
  const { y, m, d } = parts(s);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** 11月23日（月）。today と年が違えば 2027年11月23日（火）。中文 11月23日（周一）・English Mon, Nov 23 */
export function jpDate(s: string, today?: string): string {
  const { y, m, d, w } = parts(s);
  const year = otherYear(s, today);
  if (currentLang() === "en") return en(s, { weekday: "short", month: "short", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  return `${year ? `${y}年` : ""}${m}月${d}日（${week(w)}）`;
}

/** 11/23（月）。today と年が違えば 2029/1/26（金）。中文 11/23（周一）・English Mon, 11/23 */
export function jpShort(s: string, today?: string): string {
  const { y, m, d, w } = parts(s);
  const year = otherYear(s, today);
  if (currentLang() === "en") return en(s, { weekday: "short", month: "numeric", day: "numeric", ...(year ? { year: "numeric" } : {}) });
  return `${year ? `${y}/` : ""}${m}/${d}（${week(w)}）`;
}
