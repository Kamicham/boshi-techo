// 言葉の切り替え（日本語・简体中文・English）。作り手 2026-11-05「すべての人へ、はこのプロジェクトの根幹」。
// 日本で暮らす中国語の話者の家族にも、母語で分かるように。体験版でも言葉を選べるように。
//
// 決め事:
// - 鍵は日本語の文そのもの（gettext の形）: t("ほかの時期")。訳の無い文は、どの言葉でも日本語のまま出る（消えない）。
// - 差し込みは {名前}: t("あと{n}日", { n: 3 })。英語の数の形は訳の側で {n:day|days}（n が 1 の時に左）。
// - 辞書は dict/ の下に場所ごと（1行に日本語の鍵と zh・en を並べる）。dicts.ts がまとめ、layout が今の言葉の分だけを画面へ渡す。
// - 言葉はクッキー boshi_lang（1年）。切り替えは components/LocaleProvider の switchLang（書いて読み直す）。
// - 保存する値（「母」「済み」など）は日本語のまま残し、出す時だけ訳す。勤め先・役所あての文書は日本語のまま作る。
//
// 画面での使い方:
// - 家族を読み終えてから描く所（ほぼすべての画面）: import { t } from "@/lib/i18n" → t("ほかの時期")
// - サーバでも描かれる所（/emergency・家族の読み込みの前の枠）: const t = useT()（components/LocaleProvider）
// - モジュールの頭で t() を呼ばない（言葉が決まる前に1回だけ評価され、日本語のまま固まる）。描く時に呼ぶ。
// サーバ（API・Claude への頼み・文書）の t() は、いつも日本語を返す。API の言葉は route()（lib/api.ts）が頼みのクッキーで訳す。

export type Lang = "ja" | "zh" | "en";
export const LANGS: readonly Lang[] = ["ja", "zh", "en"];
export const LANG_COOKIE = "boshi_lang";
/** <html lang> に書く値（简体字は zh-Hans。端末が简体字の字体を選ぶ手がかりにもなる） */
export const HTML_LANG: Readonly<Record<Lang, string>> = { ja: "ja", zh: "zh-Hans", en: "en" };
/** 切り替えの札（それぞれの言葉で書く） */
export const LANG_NAMES: Readonly<Record<Lang, string>> = { ja: "日本語", zh: "中文", en: "English" };
/**
 * アプリの名前（ブラウザのタブの題・ホーム画面のアイコンの下の名前）。言葉ごとの名前は作り手が決めた（2026-11-05 夕・AskUserQuestion）。
 * 名前なので辞書（日本語の文が鍵）には入れない（辞書の「母子手帳」は、用語集が公の手帳の名前＝母子健康手册と決めている）
 */
export const APP_NAME: Readonly<Record<Lang, string>> = { ja: "母子手帳", zh: "母子手册", en: "MCH Handbook" };
/** Intl（日付・数）に渡す名前 */
export const INTL_LOCALE: Readonly<Record<Lang, string>> = { ja: "ja-JP", zh: "zh-CN", en: "en-US" };

export type Dict = Readonly<Record<string, string>>;
export type Vars = Readonly<Record<string, string | number>>;
/** 辞書の1行: 日本語の文（鍵）→ 简体中文・English。片方が無い間は、その言葉でも日本語のまま出る */
export type Entry = { readonly zh?: string; readonly en?: string };
export type Entries = Readonly<Record<string, Entry>>;

export function isLang(x: unknown): x is Lang {
  return x === "ja" || x === "zh" || x === "en";
}

/**
 * ブラウザの言葉（Accept-Language）にも従うか。体験の筋（③: 入口・上の帯・下のタブ・いま・手帳に聞く）を訳し終えるまでは、
 * 自分で選んだ人（クッキーがある人）だけを切り替えていた（途中の画面で、日本語と訳が半端に混ざらないように）。
 * 健診の訳が main に入った（dbe551f・2026-11-05 夕）ので true（作り手 11/5 16:2x の決め事①。下の detectLang）
 */
export const FOLLOW_BROWSER = true;

/**
 * クッキーの値、無ければブラウザの言葉（従う時だけ）から選ぶ。作り手の決め事①（2026-11-05）:
 * 一覧に日本語が1つでもあれば日本語（日本語が読める人は日本語。審査員もほぼこれ）。日本語が無い時だけ、一覧で先に来る zh・en
 * （zh-* は简体字）。どれも無ければ日本語
 */
export function detectLang(cookie: string | null | undefined, acceptLanguage: string | null | undefined, followBrowser = FOLLOW_BROWSER): Lang {
  if (isLang(cookie)) return cookie;
  if (!followBrowser || !acceptLanguage) return "ja";
  const tags = acceptLanguage.split(",").map((part) => part.split(";")[0].trim().toLowerCase());
  if (tags.some((tag) => tag === "ja" || tag.startsWith("ja-"))) return "ja";
  for (const tag of tags) {
    if (tag === "zh" || tag.startsWith("zh-")) return "zh";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return "ja";
}

/** Cookie の頭（"a=1; boshi_lang=zh"）から言葉を読む。無い・知らない値なら null */
export function langFromCookieHeader(header: string | null | undefined): Lang | null {
  const v = header?.match(/(?:^|;\s*)boshi_lang=([^;]*)/)?.[1];
  return isLang(v) ? v : null;
}

/** {n} を差し込む。{n:day|days} は n が 1 の時に左、ほかは右（英語の数の形）。vars に無い名前はそのまま残す */
export function fill(s: string, vars: Vars): string {
  return s.replace(/\{(\w+)(?::([^|{}]*)\|([^{}]*))?\}/g, (whole, name: string, one?: string, other?: string) => {
    if (!(name in vars)) return whole;
    if (one === undefined) return String(vars[name]);
    return Number(vars[name]) === 1 ? one : (other ?? "");
  });
}

/** 辞書で引く。無ければ日本語の鍵のまま */
export function translate(dict: Dict | null | undefined, key: string, vars?: Vars): string {
  const s = dict?.[key] ?? key;
  return vars ? fill(s, vars) : s;
}

// 画面（ブラウザ）の今の言葉。サーバでは決めない（頼みをまたいで混ざるので、サーバはいつも日本語）
let now: { lang: Lang; dict: Dict } = { lang: "ja", dict: {} };

/** 画面の今の言葉を決める。LocaleProvider だけが呼ぶ（ブラウザでだけ効く） */
export function setLocale(lang: Lang, dict: Dict): void {
  if (typeof window === "undefined") return;
  now = { lang, dict };
}

/** 今の言葉（サーバではいつも ja） */
export function currentLang(): Lang {
  return now.lang;
}

/** 日本語の文を今の言葉にする */
export function t(key: string, vars?: Vars): string {
  return translate(now.dict, key, vars);
}

/** 名前などを並べる。日本語は「・」（前と同じ）、中文・English は Intl.ListFormat（美咲和健太・Misaki and Kenta） */
export function listOf(items: readonly string[]): string {
  if (now.lang === "ja" || items.length < 2) return items.join("・");
  return new Intl.ListFormat(INTL_LOCALE[now.lang], { style: "long", type: "conjunction" }).format(items);
}

/**
 * lang の言葉で fn を回す（同期だけ。終わったら元に戻す）。試験と、言葉を決めて書く所に使う
 * （例: 画面は中国語でも、勤め先あての文書の日付は日本語で書く → withLang("ja", () => jpDate(d))）
 */
export function withLang<T>(lang: Lang, fn: () => T, dict: Dict = {}): T {
  const prev = now;
  now = { lang, dict };
  try {
    return fn();
  } finally {
    now = prev;
  }
}
