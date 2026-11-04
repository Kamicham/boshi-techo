import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic, Noto_Sans_JP } from "next/font/google";
import { AppFrame, RegisterEmergencySW } from "./emergency/Frame";
import "./globals.css";

const display = Zen_Maru_Gothic({ variable: "--font-display", weight: ["500", "700"], subsets: ["latin"] });
const body = Noto_Sans_JP({ variable: "--font-body", weight: ["400", "600"], subsets: ["latin"] });

export const metadata: Metadata = {
  title: "母子手帳",
  description: "家族の1000日を、一緒に動く手帳",
  appleWebApp: { capable: true, title: "母子手帳", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#fbfaf6",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${display.variable} ${body.variable} antialiased`}>
        {/* 急ぎの時（/emergency）だけは家族の読み込みを待たずに出す。ほかは FamilyProvider と Shell で包む */}
        {/* 公開版（体験）: 作った家族だと分かるように、いつも上に1行（NEXT_PUBLIC_BOSHI_PUBLIC は組み立てる時に入れる） */}
        {process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1" && (
          <div role="note" className="bg-amber-100 px-4 pt-[max(env(safe-area-inset-top),0.25rem)] pb-1 text-center text-xs text-amber-900">
            体験版です。作った家族の手帳を、あなただけの写しで触れます（7日で消えます）。本物の記録は書かないでください
          </div>
        )}
        <AppFrame>{children}</AppFrame>
        {/* 急ぎの時のページを通信が無くても開けるように（本番だけ。sw.js は /emergency とその部品しか扱わない） */}
        <RegisterEmergencySW />
      </body>
    </html>
  );
}
