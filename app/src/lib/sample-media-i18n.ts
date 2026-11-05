// 見本の家族の写真の一言と、みんなの章の続柄の注を、頼みの言葉に差し替える（多言語化・2026-11-05。見本の一冊の⑤と同じ形）。
// English や中文で体験版を開いた人が、アルバムの一言まで読めるように。訳は lib/i18n/dict/sample-media.ts → 見本の一冊の辞書
// （sample-books.ts）→ 画面の辞書の順に引く（lib/sample-book-i18n.ts の sampleBookLine）。
// - 作った写真（made）で、一言が種の文とぴったり同じ物だけ。本物の家族の写真・書き直した一言は訳さない（家族の言葉はデータ）
// - 日本語の時は、受け取った物をそのまま返す（1字も変わらない）。元の行は変えない（写しを返す）
// - 動画の書き出し（lib/film-render.ts）は日本語のまま（ここを通さない）
import "server-only";
import type { Entries, Lang } from "./i18n";
import sampleMedia from "./i18n/dict/sample-media";
import type { MediaData } from "./media-shared";
import { sampleBookLine } from "./sample-book-i18n";

const SAMPLE_MEDIA: Entries = sampleMedia;

/** 見本の写真の一言・続柄の注の1つの訳（訳が無ければ日本語のまま） */
export function sampleMediaLine(lang: Lang, s: string): string {
  if (lang === "ja" || !s) return s;
  return SAMPLE_MEDIA[s]?.[lang] ?? sampleBookLine(lang, s);
}

/** 作った写真の行を lang の言葉にする（一言と、みんなの章の続柄の注）。日本語・作った写真でない行は、そのまま返す */
export function localizeMadeMedia<R extends { data: MediaData }>(row: R, lang: Lang): R {
  if (lang === "ja" || !row.data.made) return row;
  const caption = row.data.caption ? sampleMediaLine(lang, row.data.caption) : undefined;
  const relation = row.data.from?.relation ? sampleMediaLine(lang, row.data.from.relation) : undefined;
  if (caption === row.data.caption && relation === row.data.from?.relation) return row;
  return {
    ...row,
    data: {
      ...row.data,
      ...(caption !== undefined ? { caption } : {}),
      ...(row.data.from && relation !== undefined ? { from: { ...row.data.from, relation } } : {}),
    },
  };
}
