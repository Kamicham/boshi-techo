// 場所ごとの辞書（dict/）を、言葉ごとの1冊にまとめる。サーバ（layout・route()）と試験だけが読む。
// 画面の部品からは読まない（全部の言葉の辞書が画面の荷物に入る。画面は LocaleProvider が渡す今の言葉の分だけを使う）。
// 辞書の場所を足したら AREAS に並べる。同じ鍵が2つの場所にあると試験が落ちる（i18n.test.ts）
import { detectLang, langFromCookieHeader, translate, type Dict, type Entries, type Lang, type Vars } from ".";
import album from "./dict/album";
import answers from "./dict/answers";
import ask from "./dict/ask";
import basis from "./dict/basis";
import book from "./dict/book";
import capture from "./dict/capture";
import core from "./dict/core";
import draft from "./dict/draft";
import emergency from "./dict/emergency";
import memories from "./dict/memories";
import milestones from "./dict/milestones";
import now from "./dict/now";
import shell from "./dict/shell";
import stages from "./dict/stages";
import start from "./dict/start";
import today from "./dict/today";
import welcome from "./dict/welcome";

export const AREAS: Readonly<Record<string, Entries>> = { core, shell, welcome, start, stages, now, today, draft, milestones, ask, answers, album, book, memories, emergency, capture, basis };

function build(lang: "zh" | "en"): Dict {
  const out: Record<string, string> = {};
  for (const entries of Object.values(AREAS)) for (const [key, e] of Object.entries(entries)) if (e[lang]) out[key] = e[lang]!;
  return out;
}

export const DICTS: Readonly<Record<Lang, Dict>> = { ja: {}, zh: build("zh"), en: build("en") };

export function dictFor(lang: Lang): Dict {
  return DICTS[lang];
}

/** lang の言葉で引く（サーバの文に使う。画面は t()） */
export function tFor(lang: Lang, key: string, vars?: Vars): string {
  return translate(DICTS[lang], key, vars);
}

/** API の頼みの言葉（クッキー、無ければブラウザの言葉）。Request でなければ日本語 */
export function langOf(req: unknown): Lang {
  if (!(req instanceof Request)) return "ja";
  return detectLang(langFromCookieHeader(req.headers.get("cookie")), req.headers.get("accept-language"));
}
