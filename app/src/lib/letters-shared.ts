// 未来の手紙（画面とサーバの両方で使う）。開く日の選び方と、画面に渡す形。
// 開く日は「誕生日から」の選び方なら、読むたびに今の家族の設定（生まれた日・予定日）から計算し直す（生まれる前に書いた手紙も、生まれた日に合う）。
import { addDays, diffDays, monthsBetween } from "./clock";

export const LETTER_OPENS = [
  { id: "1y", label: "1歳の誕生日", short: "1歳の誕生日に" },
  { id: "school", label: "小学校に入る春", short: "小学校に入る春に" },
  { id: "10y", label: "10歳の誕生日", short: "10歳の誕生日に" },
  { id: "20y", label: "20歳の誕生日", short: "20歳の誕生日に" },
  { id: "date", label: "日を選ぶ", short: "" },
  { id: "now", label: "封をしない", short: "いつでも読める" },
] as const;

export type LetterOpen = (typeof LETTER_OPENS)[number]["id"];

export const MAX_LETTER_CHARS = 4000;
/** 手紙に添える声の長さ（秒） */
export const MAX_LETTER_VOICE_SEC = 300;

export function isLetterOpen(v: unknown): v is LetterOpen {
  return LETTER_OPENS.some((o) => o.id === v);
}

const addYears = (d: string, n: number) => {
  const [y, m, day] = d.split("-").map(Number);
  // 2/29 生まれは、うるう年でない年は 2/28
  const ny = y + n;
  const leap = (ny % 4 === 0 && ny % 100 !== 0) || ny % 400 === 0;
  const dd = m === 2 && day === 29 && !leap ? 28 : day;
  return `${ny}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
};

/**
 * 小学校に入る春（4月1日）。満6歳になった次の4月1日に入る（学校教育法 第17条。4月1日生まれは前の学年＝「早生まれ」は1月1日〜4月1日）。
 * 誕生日の前日に年を取る（年齢計算ニ関スル法律）ので、4月1日生まれは3月31日に6歳になり、その年の4月に入る
 */
export function schoolEntry(birth: string): string {
  const [y, m, d] = birth.split("-").map(Number);
  const early = m < 4 || (m === 4 && d === 1);
  return `${y + (early ? 6 : 7)}-04-01`;
}

/** 開く日（YYYY-MM-DD）。封をしない手紙は null（いつでも読める） */
export function letterOpenOn(open: LetterOpen, f: { birthDate?: string; dueDate?: string } | null, date?: string | null): string | null {
  if (open === "now") return null;
  if (open === "date") return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const birth = f?.birthDate ?? f?.dueDate;
  if (!birth) return null;
  if (open === "school") return schoolEntry(birth);
  return addYears(birth, open === "1y" ? 1 : open === "10y" ? 10 : 20);
}

/** 画面に渡す手紙1通。封の間は中身（body）を渡さない */
export interface ClientLetter {
  id: string;
  from: string;
  relation?: string;
  to: string;
  open: LetterOpen;
  /** 開く日（封をしない手紙は null） */
  openOn: string | null;
  /** 封をした日（作った家族は画面の「今日」） */
  sealedOn: string;
  opened: boolean;
  /** 自分が書いた手紙（消せる） */
  mine: boolean;
  /** 開いた手紙だけ（声だけの手紙は空の文字） */
  body?: string;
  /** 声を添えた手紙は、その秒（封の間も「声つき」とだけ出す。声そのものは開いた後に ./[id]/voice から） */
  voiceSec?: number;
}

/** 「2046年4月27日に開きます」「20歳の誕生日に（2046年4月27日）」 */
export function openLine(l: Pick<ClientLetter, "open" | "openOn">): string {
  if (!l.openOn) return "いつでも読めます";
  const [y, m, d] = l.openOn.split("-").map(Number);
  const day = `${y}年${m}月${d}日`;
  const o = LETTER_OPENS.find((x) => x.id === l.open);
  return o && o.short && l.open !== "date" ? `${o.short}（${day}）` : `${day}に`;
}

/** 開いた知らせを出す間（開いた日から） */
export const LETTER_NEWS_DAYS = 14;
export function recentlyOpened(l: Pick<ClientLetter, "openOn" | "opened">, today: string): boolean {
  return !!l.opened && !!l.openOn && l.openOn <= today && addDays(l.openOn, LETTER_NEWS_DAYS) > today;
}

/**
 * 開いた知らせの一言。生まれる前に書いた手紙は「おなかにいた頃の手紙」、生まれた後は書いた日から開いた日までの満年で数える
 * （年の数字の差だけで数えると、1年2か月前を「1年前」、11か月前も年をまたげば「1年前」と言ってしまう）
 */
export function openedNewsLine(l: Pick<ClientLetter, "sealedOn" | "openOn">, f: { birthDate?: string } | null): string {
  if (f?.birthDate && diffDays(l.sealedOn, f.birthDate) < 0) return "おなかにいた頃の手紙が開きました";
  const years = l.openOn ? Math.floor(monthsBetween(l.sealedOn, l.openOn) / 12) : 0;
  return years > 0 ? `${years}年前の手紙が開きました` : "封をした手紙が開きました";
}
