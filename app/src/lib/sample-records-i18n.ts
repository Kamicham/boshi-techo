// 見本の家族が話す・撮るで残した記録（lib/capture.ts の seedItems の20件）の題と本文を、頼みの言葉に差し替える（多言語化⑤・2026-11-05）。
// English や中文で体験版を開いた人が、話す・撮るの時系列まで読めるように。写真の一言（lib/sample-media-i18n.ts）と同じ形。
// 訳は lib/i18n/dict/sample-records.ts → 見本の一冊の辞書（sample-books.ts）→ 画面の辞書の順に引く（lib/sample-book-i18n.ts の sampleBookLine）。
// - 作った記録（seed）で、題・本文が種の文とぴったり同じ物だけ。家族が書いた記録・直した記録は訳さない（家族の言葉はデータ）
// - 日本語の時は、受け取った物をそのまま返す（1字も変わらない）。元の行は変えない（写しを返す）
// - Claude に渡す記録（気づき・手帳に聞く）は日本語のまま（ここを通すのは /api/capture の GET だけ）
import "server-only";
import type { CaptureRecord } from "./capture";
import type { Entries, Lang } from "./i18n";
import sampleRecords from "./i18n/dict/sample-records";
import { sampleBookLine } from "./sample-book-i18n";

const SAMPLE_RECORDS: Entries = sampleRecords;

/** 見本の記録の題・本文の1つの訳（訳が無ければ日本語のまま） */
export function sampleRecordLine(lang: Lang, s: string): string {
  if (lang === "ja" || !s) return s;
  return SAMPLE_RECORDS[s]?.[lang] ?? sampleBookLine(lang, s);
}

/** 作った記録（seed）を lang の言葉にする。日本語・作った記録でない行は、そのまま返す */
export function localizeSeedRecord<R extends Pick<CaptureRecord, "data">>(r: R, lang: Lang): R {
  if (lang === "ja" || !r.data.seed) return r;
  const title = sampleRecordLine(lang, r.data.title);
  const detail = sampleRecordLine(lang, r.data.detail);
  if (title === r.data.title && detail === r.data.detail) return r;
  return { ...r, data: { ...r.data, title, detail } };
}
