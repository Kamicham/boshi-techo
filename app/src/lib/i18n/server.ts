// ページを描く頼みの言葉（layout.tsx が読む）。クッキー boshi_lang、無ければブラウザの言葉（lib/i18n の FOLLOW_BROWSER）。
// force-static のページ（/emergency）を組み立てる時はクッキーが空なので日本語。画面で言葉が違えば、次に移る時に読み直す（LocaleProvider）
import "server-only";
import { cookies, headers } from "next/headers";
import { detectLang, LANG_COOKIE, type Lang } from ".";

export async function requestLang(): Promise<Lang> {
  const [c, h] = await Promise.all([cookies(), headers()]);
  return detectLang(c.get(LANG_COOKIE)?.value, h.get("accept-language"));
}
