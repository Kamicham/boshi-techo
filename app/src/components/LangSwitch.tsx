"use client";

// 言葉の切り替え（日本語・中文・English。lib/i18n）。作り手 11/5「デモサイトでも言語を切り替えれるように」。
// - 入口の1枚: 3つを並べて見せる（日本語が読めない人が、最初の画面で自分の言葉を見つけられるように）
// - 上の帯: 🌐 と今の言葉の1つ。押すと端末の選ぶ画面（select）。名前は3つの言葉で書く（どの言葉の画面でも分かるように）
import { HTML_LANG, LANG_NAMES, LANGS, type Lang } from "@/lib/i18n";
import { switchLang, useLang } from "./LocaleProvider";

// 訳さない: 言葉の名前は、それぞれの言葉で書く（どの言葉の画面でも、自分の言葉を見つけられるように）
const LABEL = "言葉 / 语言 / Language";
/** 上の帯の短い札（English は2文字で足りる） */
// 訳さない: 言葉の名前は、それぞれの言葉で書く
const SHORT: Readonly<Record<Lang, string>> = { ja: "日本語", zh: "中文", en: "EN" };

/** onSwitch: 読み直す前に呼ぶ（開き直した入口の1枚を、読み直した後も開いたままにする時など） */
export function LangRow({ className = "", onSwitch }: { className?: string; onSwitch?: () => void }) {
  const lang = useLang();
  return (
    <nav aria-label={LABEL} className={`flex flex-wrap items-center text-sm ${className}`}>
      <span aria-hidden className="pr-1">
        🌐
      </span>
      {LANGS.map((l, i) => (
        <span key={l} className="flex items-center">
          {i > 0 && (
            <span aria-hidden className="text-line">
              |
            </span>
          )}
          <button
            type="button"
            lang={HTML_LANG[l]}
            onClick={() => {
              if (l === lang) return;
              onSwitch?.();
              switchLang(l);
            }}
            aria-current={l === lang ? "true" : undefined}
            className={`min-h-11 px-2 ${l === lang ? "font-semibold text-ink" : "text-sky underline underline-offset-2"}`}
          >
            {LANG_NAMES[l]}
          </button>
        </span>
      ))}
    </nav>
  );
}

export function LangPicker({ disabled = false }: { disabled?: boolean }) {
  const lang = useLang();
  return (
    <label className={`relative flex min-h-11 shrink-0 items-center gap-1 px-1 text-sm whitespace-nowrap text-ink ${disabled ? "opacity-50" : ""}`}>
      <span aria-hidden>🌐</span>
      <span aria-hidden lang={HTML_LANG[lang]}>
        {SHORT[lang]}
      </span>
      <select
        value={lang}
        disabled={disabled}
        onChange={(e) => switchLang(e.target.value as Lang)}
        aria-label={LABEL}
        className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default"
      >
        {LANGS.map((l) => (
          <option key={l} value={l} lang={HTML_LANG[l]}>
            {LANG_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
