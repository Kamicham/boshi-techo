// あと◯日の色と言葉（ui.tsx の Countdown が使う。試験できるよう .ts に分ける）
import { t } from "@/lib/i18n";

/** あと◯日の色と言葉（試験できるよう純粋な関数に） */
export function countdownLook(days: number, kind: "deadline" | "start" = "deadline"): { color: "text-ink" | "text-warn" | "text-alert"; text: string } {
  if (kind === "start") return { color: "text-ink", text: days <= 0 ? t("今日から") : days === 1 ? t("あしたから") : t("{n}日後から", { n: days }) };
  if (days < 0) return { color: "text-ink", text: t("今からでもできます") };
  const color = days <= 1 ? "text-alert" : days <= 3 ? "text-warn" : "text-ink";
  return { color, text: days === 0 ? t("今日まで") : days === 1 ? t("あしたまで") : t("あと{n}日", { n: days }) };
}
