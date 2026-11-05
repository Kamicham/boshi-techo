"use client";

// 画面の言葉（日本語・简体中文・English）。layout.tsx が頼みの言葉と、その言葉の辞書だけを渡す（lib/i18n の頭）。
// - 家族を読み終えてから描く所は、lib/i18n の t() を使う（ここで今の言葉を決めてから、子を描く）
// - サーバでも描かれる所（/emergency など）は useT()（サーバと画面で同じ辞書を使い、描き直しの食い違いを出さない）
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from "react";
import { LANG_COOKIE, langFromCookieHeader, setLocale, translate, type Dict, type Lang, type Vars } from "@/lib/i18n";

const LocaleCtx = createContext<{ lang: Lang; dict: Dict }>({ lang: "ja", dict: {} });

export function LocaleProvider({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  // 子を描く前に、画面の t() が読む言葉を決める（ブラウザでだけ効く。言葉は読み直すまで変わらない）
  setLocale(lang, dict);
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  // 作る時に1回だけ組み立てたページ（/emergency）から開くと、クッキーが見えず日本語で描かれている。
  // 選んだ言葉と違えば、ほかの画面へ移った時に1回読み直す（その画面はクッキーを読んで描く）
  const path = usePathname();
  const first = useRef(path);
  useEffect(() => {
    if (path === first.current) return;
    const want = langFromCookieHeader(document.cookie);
    if (want && want !== lang) location.reload();
  }, [path, lang]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

/**
 * 囲んだ所だけ、決まった言葉で描く（useT()・useLang() が読む言葉を替える。setLocale は呼ばず、画面の言葉は変えない）。
 * 病院あての1枚（健診で見せる記録・/techo/share）は、画面が中文・English でも日本語で描く: <LocaleScope lang="ja" dict={{}}>
 */
export function LocaleScope({ lang, dict, children }: { lang: Lang; dict: Dict; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, dict }), [lang, dict]);
  return <LocaleCtx.Provider value={value}>{children}</LocaleCtx.Provider>;
}

export function useLang(): Lang {
  return useContext(LocaleCtx).lang;
}

/** サーバでも描かれる所の t()。家族を読み終えてから描く所は lib/i18n の t() でよい */
export function useT(): (key: string, vars?: Vars) => string {
  const { dict } = useContext(LocaleCtx);
  return useCallback((key: string, vars?: Vars) => translate(dict, key, vars), [dict]);
}

/** 言葉を変える: クッキーに1年残して読み直す（サーバで描く所も、その言葉で描き直すため） */
export function switchLang(lang: Lang): void {
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`;
  location.reload();
}
