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
        <AppFrame>{children}</AppFrame>
        {/* 急ぎの時のページを通信が無くても開けるように（本番だけ。sw.js は /emergency とその部品しか扱わない） */}
        <RegisterEmergencySW />
      </body>
    </html>
  );
}
