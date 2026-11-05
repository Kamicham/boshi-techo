// 記録の題と本文のうち、アプリが日本語の決まった形で書いた所を、出す時に画面の言葉にする
// （保存する値は日本語のまま残し、出す時だけ訳す＝lib/i18n の決め事。11/5 UX）。
// - 「打つ」の体温: 題「体温 37.5℃」（lib/manual-entry.ts の temperatureRecord）
// - 「打つ」の時刻つきの予定: 本文「10:00から」（lib/manual-entry.ts の cleanManual）
// - 「話す・撮る」の期限: 本文「期限。出どころ: 区役所の通知」（lib/capture.ts。出どころは読み取った言葉なので、訳さずに差し込む）
// - 「話す・撮る」の気がかりの本文の終わりに付く決まりの文（lib/capture.ts の CAPTURE_SYSTEM が Claude に添えさせる文と、
//   lib/samples.ts の見本の答えの文）: 「次の健診で聞く」「その日のうちに産院へ電話」など。前の本文（家族の言葉）はそのまま
// 家族が書いた文・Claude が読み取った文は、そのまま出す。日本語の画面は1字も変わらない。試験は record-text.test.ts
import { currentLang, t } from "@/lib/i18n";

const TEMPERATURE = /^体温 (\d{2}\.\d)℃$/;
const FROM_TIME = /^((?:[01]\d|2[0-3]):[0-5]\d)から$/;
const DEADLINE_SOURCE = /^期限。出どころ: ([\s\S]+)$/;

/** 本文の終わりに付く決まりの文（辞書の鍵。長い物から試す） */
export const DETAIL_TAILS = [
  "その日のうちに産院（子どもの事ならかかりつけ・迷ったら #8000）へ電話",
  "その日のうちにかかりつけへ電話。迷ったら #8000",
  "その日のうちに産院へ電話",
  "次の健診で先生に聞く",
  "次の健診で聞く",
] as const;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const TAIL = new RegExp(`^([\\s\\S]*?)([、,。\\s]*)(${DETAIL_TAILS.map(esc).join("|")})。?\\s*$`);

/** 記録の題（体温の決まった形だけ訳す） */
export function recordTitleShown(title: string): string {
  const m = TEMPERATURE.exec(title);
  return m ? t("体温 {n}℃", { n: m[1] }) : title;
}

/** 記録の本文（時刻つきの予定・期限の出どころ・終わりの決まりの文だけ訳す） */
export function recordDetailShown(detail: string): string {
  const time = FROM_TIME.exec(detail);
  if (time) return t("{time}から", { time: time[1] });
  const src = DEADLINE_SOURCE.exec(detail);
  if (src) return t("期限。出どころ: {source}", { source: src[1] });
  // 終わりの決まりの文。日本語の画面は元のまま（区切りの「、」や終わりの「。」も変えない）
  if (currentLang() === "ja") return detail;
  const tail = TAIL.exec(detail);
  if (!tail) return detail;
  const [, body, sep, phrase] = tail;
  // 前の本文が無い時は決まりの文だけ。改行で区切っていれば改行を残し、「、」などで続けていれば改行にする（訳の文は独り立ちの文）
  return body ? `${body}${sep.includes("\n") ? sep : "\n"}${t(phrase)}` : t(phrase);
}
