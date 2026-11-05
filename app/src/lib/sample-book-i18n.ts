// 見本の一冊（同梱の一冊・bundled）の文を、頼みの言葉に差し替える（多言語化⑤・2026-11-05）。
// 英語や中文で体験版を開いた人が、一冊の本文まで読めるように。訳は lib/i18n/dict/sample-books.ts（無ければ画面の辞書。お宮参りなど）。
// - 元の一冊（lib/demo-books.json）は変えない。日本語の時は、受け取った一冊をそのまま返す（1字も変わらない）
// - 家族が作り直した一冊（bundled でない）は訳さない（家族の言葉はデータ）
// - 時期の名前（period）は日本語のまま返す（画面が t() で訳す）。写真と声の番号・日付・秒数も変えない
// - 動画の書き出し（/api/book/film）は日本語のまま（ここを通さない）
import "server-only";
import type { Book } from "./book";
import { withLang, type Entries, type Lang } from "./i18n";
import { DICTS } from "./i18n/dicts";
import sampleBooks from "./i18n/dict/sample-books";
import { nameIn } from "./i18n/names";

const SAMPLE_BOOKS: Entries = sampleBooks;

/** 見本の一冊の1つの文の訳（訳が無ければ日本語のまま） */
export function sampleBookLine(lang: Lang, s: string): string {
  if (lang === "ja" || !s) return s;
  return SAMPLE_BOOKS[s]?.[lang] ?? DICTS[lang][s] ?? s;
}

/** 見本の一冊を lang の言葉にする（日本語・見本でない一冊・null はそのまま） */
export function localizeSampleBook<B extends Book | null>(book: B, lang: Lang): B {
  if (!book || lang === "ja" || !book.bundled) return book;
  const tr = (s: string) => sampleBookLine(lang, s);
  const out: Book = {
    ...book,
    title: tr(book.title),
    dedication: tr(book.dedication),
    closing: tr(book.closing),
    // 表紙の宛名（「To ○○」）。名前の決め事は画面と同じ lib/i18n/names.ts（見本の一冊は作った家族の物）
    childName: withLang(lang, () => nameIn(book.childName, { made: true })),
    chapters: book.chapters.map((c) => ({
      ...c,
      title: tr(c.title),
      text: tr(c.text),
      moments: c.moments.map((m) => ({ ...m, text: tr(m.text) })),
      photos: c.photos.map((p) => ({ ...p, line: tr(p.line) })),
      voices: c.voices.map((v) => ({ ...v, line: tr(v.line) })),
    })),
    film: book.film.map((x) => ({ ...x, caption: tr(x.caption) })),
  };
  return out as B;
}
