"use client";

// 画面の枠の振り分け: 急ぎの時（/emergency）だけは、家族の読み込みを待たずにすぐ出す。
// ほかの画面は今までどおり FamilyProvider と Shell（家族の切り替え・下のタブ）で包む。
// 通信が無い時、FamilyProvider は家族の一覧を何度か読み直してから開くので、急ぎの画面がその間ふさがれないように分ける。
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { FamilyProvider } from "@/components/FamilyProvider";
import { Shell } from "@/components/Shell";

export const EMERGENCY_PATH = "/emergency";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  if (path === EMERGENCY_PATH) return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
  return (
    <FamilyProvider>
      <Shell>{children}</Shell>
    </FamilyProvider>
  );
}

/**
 * 急ぎの時のページを、通信が無くても開けるように取っておく service worker（public/sw.js）を登録する。
 * 本番（next build / next start）の時だけ。開発サーバ（3000番）・シミュレーションのサーバ（3100番・next dev）では登録せず、
 * 前に登録された物があれば外す（作り直しのたびに古い物が残って邪魔をしないように）。
 */
export function RegisterEmergencySW() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((rs) => rs.forEach((r) => r.active?.scriptURL.endsWith("/sw.js") && void r.unregister()));
      return;
    }
    // 家族の画面の読み込みを邪魔しないよう、落ち着いてから
    const t = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }, 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
