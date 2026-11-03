"use client";

// 画面の枠: 上に家族の切り替えと「急ぎの時」、下にタブ（今日・健診・話す撮る・手帳）、右下に「聞く」。一冊は手帳の最後から入る。
// タブの並びは lib/app-guide.ts（手帳に聞くが使い方を答える画面の地図）と共有する。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { recordingBusy, recordingBusyServer, subscribeRecording } from "@/lib/recording-state";
import { TABS } from "@/lib/app-guide";
import { AskButton } from "./ask/AskSheet";
import { useFamily } from "./FamilyProvider";


export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { family, families, setFamilyId, isDemo, ready, accountsEnabled, account, households } = useFamily();
  // 録音中は別の画面へ移ると録音が止まるので、切り替えを止める
  const recording = useSyncExternalStore(subscribeRecording, recordingBusy, recordingBusyServer);
  // 合言葉・ログイン・招待の画面では、家族の切り替えもタブも出さない
  if (path === "/unlock" || path === "/login" || (path.startsWith("/invite/") && path !== "/invite/new")) return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
  const here = households.find((h) => h.id === family.id);
  const labelOf = (f: (typeof families)[number]) => {
    const h = households.find((x) => x.id === f.id);
    if (h) return h.name || "わが家";
    return f.id === "mine" ? "わが家" : `デモ（作った家族）: ${f.members.map((m) => m.name).join("・")}`;
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs">
        <label className="flex min-w-0 shrink items-center gap-1 text-muted">
          <span className="sr-only">見ている手帳</span>
          <select
            id="family-select"
            value={family.id}
            onChange={(e) => setFamilyId(e.target.value)}
            disabled={recording}
            className="min-h-11 w-full min-w-0 truncate rounded-full border border-line bg-card px-3 py-1 text-base text-ink disabled:opacity-50"
          >
            {families.map((f) => (
              <option key={f.id} value={f.id}>
                {labelOf(f)}
              </option>
            ))}
          </select>
        </label>
        <div className={`flex shrink-0 items-center gap-1 whitespace-nowrap ${recording ? "invisible" : ""}`}>
          {isDemo && <span className="rounded-full bg-sky-soft px-2 py-0.5 font-semibold text-sky">デモ</span>}
          <Link href="/settings" className="flex min-h-11 items-center px-2 text-muted underline-offset-2 hover:underline">わが家の設定</Link>
        </div>
        {/* 急ぎの案内は録音中でも隠さない（産院・119・#8000 への橋）。
            いつも見える所を赤で塗ると、夜中に開くたびに緊張させるので、文字は ink・赤は直径6pxの点だけ（赤は命の橋の印） */}
        <Link href="/emergency" className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-semibold text-ink underline-offset-2 hover:underline">
          <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-alert" />
          急ぎの時
        </Link>
      </div>
      {accountsEnabled && !recording && <AccountBar isDemo={isDemo} signedIn={!!account} hasOwn={households.length > 0} consentFor={here?.needsRecordConsent ? here.id : null} />}
      {/* 家族を読み終えるまで中身を出さない（わが家の人に、デモの家族が一瞬見えないように） */}
      <div className="flex-1 pb-40">{ready ? children : <div className="mx-4 mt-4 h-40 rounded-2xl bg-rose-soft/60" aria-hidden />}</div>
      {/* 手帳に聞く（どの画面からも）。録音中・急ぎの時・家族の読み込み前は出さない */}
      <AskButton hidden={recording || !ready || path === "/emergency"} />
      <nav
        aria-label="画面の切り替え"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-card/95 backdrop-blur"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {recording && (
          <p className="mx-auto max-w-md px-4 py-3 text-center text-sm font-semibold text-rose">
            録音中です。ほかの画面へ移ると録音が止まるので、終わるまでこの画面のままにしてください
          </p>
        )}
        <ul className={`mx-auto flex max-w-md justify-between px-2 ${recording ? "hidden" : ""}`}>
          {TABS.map((t) => {
            // 一冊（/book）は手帳の中の1ページとして「手帳」を光らせる
            const on = t.href === "/" ? path === "/" : path.startsWith(t.href) || (t.href === "/techo" && path.startsWith("/book"));
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  className={`flex min-h-12 flex-col items-center justify-center py-1 text-xs font-semibold ${on ? "text-rose" : "text-muted"}`}
                  aria-current={on ? "page" : undefined}
                >
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** 上の1行の入口: デモを見ている人にはアカウントを作る入口、同意がまだの世帯には同意の入口 */
function AccountBar({ isDemo, signedIn, hasOwn, consentFor }: { isDemo: boolean; signedIn: boolean; hasOwn: boolean; consentFor: string | null }) {
  const row = "mx-4 mt-2 flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm";
  if (consentFor)
    return (
      <p className={`${row} bg-rose-soft`}>
        <span>はじめに「記録を残す同意」をしてください</span>
        <Link href={`/account/consent?familyId=${encodeURIComponent(consentFor)}`} className="flex min-h-11 shrink-0 items-center font-semibold text-rose underline underline-offset-2">
          同意の画面へ
        </Link>
      </p>
    );
  if (!isDemo) return null;
  if (!signedIn)
    return (
      <p className={`${row} bg-sky-soft`}>
        <span>アカウントを作ると、自分の世帯ができます</span>
        <Link href="/login" className="flex min-h-11 shrink-0 items-center font-semibold text-sky underline underline-offset-2">
          はじめる
        </Link>
      </p>
    );
  if (!hasOwn)
    return (
      <p className={`${row} bg-sky-soft`}>
        <span>まだ自分の世帯がありません</span>
        <Link href="/account/new" className="flex min-h-11 shrink-0 items-center font-semibold text-sky underline underline-offset-2">
          世帯を作る
        </Link>
      </p>
    );
  return null;
}
