import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic, Noto_Sans_JP } from "next/font/google";
import { headers } from "next/headers";
import { AppFrame, RegisterEmergencySW } from "./emergency/Frame";
import "./globals.css";
import { LocaleProvider } from "@/components/LocaleProvider";
import { APP_NAME, HTML_LANG, type Lang } from "@/lib/i18n";
import { dictFor, tFor } from "@/lib/i18n/dicts";
import { requestLang } from "@/lib/i18n/server";
import { PUBLIC_UI } from "@/lib/trial-words";

const display = Zen_Maru_Gothic({ variable: "--font-display", weight: ["500", "700"], subsets: ["latin"] });
const body = Noto_Sans_JP({ variable: "--font-body", weight: ["400", "600"], subsets: ["latin"] });

/** 題と説明は頼みの言葉で（アプリの名前は lib/i18n の APP_NAME。日本語は前と同じ「母子手帳」） */
export async function generateMetadata(): Promise<Metadata> {
  const lang = await requestLang();
  return {
    title: APP_NAME[lang],
    description: tFor(lang, "家族の1000日を、一緒に動く手帳"),
    appleWebApp: { capable: true, title: APP_NAME[lang], statusBarStyle: "default" },
    // 体験版（公開版）は検索に載せない（作った家族の写しだけの場所・2026-11-05）
    ...(PUBLIC_UI ? { robots: { index: false, follow: false }, ...(await shareCard(lang)) } : {}),
  };
}

const OG_LOCALE: Readonly<Record<Lang, string>> = { ja: "ja_JP", zh: "zh_CN", en: "en_US" };

/**
 * 体験版の住所を LINE・X・Slack などに貼った時の札（og と twitter・2026-11-07 作り手が見本を承認）。絵は public/og.png（1200×630）。
 * 題と説明は、はじめの画面の文と訳をそのまま使う（新しい訳を作らない）。住所はその時の頼みの host から作る（middleware.ts と同じ読み方。
 * 自分で立てた公開版でも、その住所の絵を指す）。host が読めない時（作る時に1回だけ組み立てる /emergency）は札を付けない
 */
async function shareCard(lang: Lang): Promise<Metadata> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return {};
  const proto = h.get("x-forwarded-proto")?.split(",")[0].trim() || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const title = tFor(lang, "母子手帳を、再発明する");
  const description = [
    tFor(lang, "読む手帳から、") + (lang === "en" ? " " : "") + tFor(lang, "一緒に動く手帳へ。"),
    tFor(lang, "妊娠から2歳までの1000日。手帳が先に動いて、やる事を調べて用意します。家族の手は、赤ちゃんのために。"),
  ].join(lang === "en" ? " " : "");
  const image = { url: "/og.png", width: 1200, height: 630, alt: title };
  return {
    metadataBase: new URL(`${proto}://${host}`),
    openGraph: { type: "website", siteName: APP_NAME[lang], locale: OG_LOCALE[lang], title, description, images: [image] },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf6",
  viewportFit: "cover",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // 言葉（日本語・简体中文・English）: クッキー boshi_lang。画面へは今の言葉の辞書だけを渡す（lib/i18n。2026-11-05 多言語化）
  const lang = await requestLang();
  return (
    <html lang={HTML_LANG[lang]}>
      <body className={`${display.variable} ${body.variable} antialiased`}>
        <LocaleProvider lang={lang} dict={dictFor(lang)}>
          {/* 急ぎの時（/emergency）だけは家族の読み込みを待たずに出す。ほかは FamilyProvider と Shell で包む */}
          {/* 公開版（体験）の「作った家族です」は、入口の1枚と上の帯（見本の家族 ・ 時期を変える）で言う（最初の1分 2026-11-04。注意書きが自己紹介より先に出ていた） */}
          <AppFrame>{children}</AppFrame>
        </LocaleProvider>
        {/* 急ぎの時のページを通信が無くても開けるように（本番だけ。sw.js は /emergency とその部品しか扱わない） */}
        <RegisterEmergencySW />
      </body>
    </html>
  );
}
