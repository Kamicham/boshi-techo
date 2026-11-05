// 記録の題と本文のうち、アプリが日本語の決まった形で書いた所を、出す時に画面の言葉にする
// （保存する値は日本語のまま残し、出す時だけ訳す＝lib/i18n の決め事。11/5 UX）。
// - 「打つ」の体温: 題「体温 37.5℃」（lib/manual-entry.ts の temperatureRecord）
// - 「打つ」の時刻つきの予定: 本文「10:00から」（lib/manual-entry.ts の cleanManual）
// - 「話す・撮る」の期限: 本文「期限。出どころ: 区役所の通知」（lib/capture.ts。出どころは読み取った言葉なので、訳さずに差し込む）
// 家族が書いた文・Claude が読み取った文は、そのまま出す。日本語の画面は1字も変わらない。試験は record-text.test.ts
import { t } from "@/lib/i18n";

const TEMPERATURE = /^体温 (\d{2}\.\d)℃$/;
const FROM_TIME = /^((?:[01]\d|2[0-3]):[0-5]\d)から$/;
const DEADLINE_SOURCE = /^期限。出どころ: ([\s\S]+)$/;

/** 記録の題（体温の決まった形だけ訳す） */
export function recordTitleShown(title: string): string {
  const m = TEMPERATURE.exec(title);
  return m ? t("体温 {n}℃", { n: m[1] }) : title;
}

/** 記録の本文（時刻つきの予定と、期限の出どころの決まった形だけ訳す） */
export function recordDetailShown(detail: string): string {
  const time = FROM_TIME.exec(detail);
  if (time) return t("{time}から", { time: time[1] });
  const src = DEADLINE_SOURCE.exec(detail);
  if (src) return t("期限。出どころ: {source}", { source: src[1] });
  return detail;
}
