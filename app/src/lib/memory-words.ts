// 思い出の画面（アルバム・一冊・映画・手紙）の言葉の小さな道具。画面の言葉で書き分ける
// （lib/i18n の currentLang。サーバ・試験・Claude への頼みでは、いつも日本語＝前と1字も変わらない）。
// 日付の書き方は components/techo/labels の jpDay と同じ（lib から components を読まないので、ここにも置く）。
import { childView } from "./call-name";
import type { Family } from "./demo-family";
import { currentLang } from "./i18n";
import { isMadeId, labelIn, nameIn } from "./i18n/names";

/**
 * 家族のデータの名前を、画面の言葉で描く（lib/i18n/names.ts の nameIn。English は見本の家族をローマ字・ばあば→Grandma、
 * 中文は作った家族の時だけ ばあば→外婆）。描く時だけ通す。保存する値・API に送る値には使わない
 */
export function nameOf<T extends string | null | undefined>(family: Pick<Family, "id">, name: T): T {
  return nameIn(name, madeOf(family));
}

/** 子どもに向けて、その人を言う形（lib/call-name.ts の childView「ママ（美咲）」）を、画面の言葉で（Mom (Misaki)・妈妈（美咲）） */
export function personOf(family: Pick<Family, "id" | "members">, name: string): string {
  return labelIn(childView(family, name), madeOf(family));
}

/** 作った家族か（names.ts の made に渡す形。声の題 voiceTitleShown・映画の台本 filmShots に渡す） */
export function madeOf(family: Pick<Family, "id">): { made: boolean } {
  return { made: isMadeId(family.id) };
}

/** 並べる時の区切り（日本語は「・」。中文・English は「 · 」＝訳に「・」を残さない） */
export function dot(): string {
  return currentLang() === "ja" ? "・" : " · ";
}

/** 人の言葉を引く括弧（日本語は「」、中文・English は “”） */
export function quote(s: string): string {
  return currentLang() === "ja" ? `「${s}」` : `“${s}”`;
}

/** 文を続ける（日本語・中文は詰める。English は空きを入れる） */
export function sentences(...xs: (string | false | null | undefined)[]): string {
  return xs.filter(Boolean).join(currentLang() === "en" ? " " : "");
}

const ymd = (s: string) => s.split("-").map(Number);
function english(s: string, o: Intl.DateTimeFormatOptions): string {
  const [y, m, d] = ymd(s);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** 2026年11月3日（中文も同じ。English は Nov 3, 2026） */
export function dayLong(s: string): string {
  if (currentLang() === "en") return english(s, { year: "numeric", month: "short", day: "numeric" });
  const [y, m, d] = ymd(s);
  return `${y}年${m}月${d}日`;
}

/** 11月3日（中文も同じ。English は Nov 3） */
export function monthDay(s: string): string {
  if (currentLang() === "en") return english(s, { month: "short", day: "numeric" });
  const [, m, d] = ymd(s);
  return `${m}月${d}日`;
}

/** 4月26日（中文も同じ。English は略さず April 26。家族に送る文など） */
export function monthDayFull(s: string): string {
  if (currentLang() === "en") return english(s, { month: "long", day: "numeric" });
  const [, m, d] = ymd(s);
  return `${m}月${d}日`;
}

/** 月の名前（「アルバムの5月に並びます」の5。English は May） */
export function monthName(s: string): string {
  if (currentLang() === "en") return english(s, { month: "long" });
  return String(Number(s.slice(5, 7)));
}

/** データの字を英語の文に差し込む時、全角の括弧を半角に（「Claude Code（Claude Opus 5.5）」→「Claude Code (Claude Opus 5.5)」）。日本語・中文はそのまま */
export function parens(s: string): string {
  return currentLang() === "en" ? s.replace(/\s*（/g, " (").replace(/）/g, ")") : s;
}
