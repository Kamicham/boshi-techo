import type { Metadata, Viewport } from "next";
import { Zen_Maru_Gothic, Noto_Sans_JP } from "next/font/google";
import { FamilyProvider } from "@/components/FamilyProvider";
import { Shell } from "@/components/Shell";
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
        <FamilyProvider>
          <Shell>{children}</Shell>
        </FamilyProvider>
      </body>
    </html>
  );
}
