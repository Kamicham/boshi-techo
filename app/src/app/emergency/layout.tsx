// 急ぎの時（/emergency）の題と組み立て方。page.tsx は画面の言葉で描くため "use client" にした（2026-11-05 多言語化）。
// "use client" のページからは題（metadata）と組み立て方（dynamic）を出せない（Next.js は、サーバの部品の物だけを読む）ので、ここに置く。
import type { Metadata } from "next";

// 訳さない: 作る時に1回だけ組み立てる題（下の force-static）。根の題「母子手帳」も訳していない
export const metadata: Metadata = { title: "急ぎの時 | 母子手帳" };
// 通信が無くても開けるよう、作る時に1回だけ組み立てる（家族の情報は何も入らない）。
// そのため、このページを直接開いた時・通信が無い時（public/sw.js の写し）は日本語。ほかの画面から移った時は、その画面の言葉の辞書で描く
export const dynamic = "force-static";

export default function EmergencyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
