"use client";

// 急ぎの時（/emergency）を、端末の言葉で描き直す（2026-11-05）。
// このページは作る時に1回だけ組み立てる（通信が無くても開けるよう。layout.tsx の force-static）ので、根の layout はクッキーを読めず、
// 日本語の辞書で描かれる（上の帯から移った時も、直接開いた時も、通信が無い時の写しも）。前は、中文・English の画面でも日本語のまま出ていた。
// 描いた後に端末の言葉（クッキー boshi_lang・根の layout と同じ選び方）を読み、日本語でなければ、この画面の辞書（lib/i18n/emergency-dict.ts。
// core.ts と dict/emergency.ts の分だけ）で囲み直し、<html lang> も合わせる（简体字の字体と読み上げのため）。
// 名前のローマ字（lib/i18n/names.ts の nameIn）は画面全体の言葉を読むので、そちらも合わせる。ほかの画面へ移る時は、LocaleProvider が読み直す。
import { useEffect, useState } from "react";
import { LocaleScope, useLang } from "@/components/LocaleProvider";
import { HTML_LANG, detectLang, langFromCookieHeader, setLocale, type Lang } from "@/lib/i18n";
import { EMERGENCY_DICTS } from "@/lib/i18n/emergency-dict";

export function EmergencyLang({ children }: { children: React.ReactNode }) {
  const lang = useLang();
  const [want, setWant] = useState<Lang | null>(null);
  useEffect(() => {
    const w = detectLang(langFromCookieHeader(document.cookie), navigator.languages?.join(",") || navigator.language);
    if (w === lang) return;
    setLocale(w, EMERGENCY_DICTS[w]);
    document.documentElement.lang = HTML_LANG[w];
    setWant(w);
  }, [lang]);
  if (!want) return <>{children}</>;
  return (
    <LocaleScope lang={want} dict={EMERGENCY_DICTS[want]}>
      {children}
    </LocaleScope>
  );
}
