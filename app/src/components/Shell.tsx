"use client";

// 画面の枠: 上に家族の切り替え、下にタブ。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { recordingBusy, recordingBusyServer, subscribeRecording } from "@/lib/recording-state";
import { useFamily } from "./FamilyProvider";

const TABS = [
  { href: "/", label: "今日" },
  { href: "/visit", label: "健診" },
  { href: "/capture", label: "話す・撮る" },
  { href: "/family", label: "家族" },
  { href: "/book", label: "一冊" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { family, families, setFamilyId, isDemo, me, setMeId, ready } = useFamily();
  // 録音中は別の画面へ移ると録音が止まるので、切り替えを止める
  const recording = useSyncExternalStore(subscribeRecording, recordingBusy, recordingBusyServer);
  // 合言葉の画面では、家族の切り替えもタブも出さない
  if (path === "/unlock") return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
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
                {f.id === "mine" ? "わが家" : `デモ（作った家族）: ${f.members.map((m) => m.name).join("・")}`}
              </option>
            ))}
          </select>
        </label>
        <div className={`flex shrink-0 items-center gap-1 whitespace-nowrap ${recording ? "invisible" : ""}`}>
          {isDemo && <span className="rounded-full bg-sky-soft px-2 py-0.5 font-semibold text-sky">デモ</span>}
          {me && (
            <button onClick={() => setMeId(null)} className="flex min-h-11 items-center px-2 text-muted" aria-label="使う人を変える">
              {me.name}
            </button>
          )}
          <Link href="/map" className="flex min-h-11 min-w-11 items-center justify-center px-2 text-muted underline-offset-2 hover:underline">地図</Link>
          <Link href="/settings" className="flex min-h-11 items-center px-2 text-muted underline-offset-2 hover:underline">わが家の設定</Link>
        </div>
      </div>
      {ready && !me && family.members.length > 0 && path !== "/settings" && (
        // この端末を使うのは誰か、を最初に1回だけ聞く（その人の事を先に出すため）
        <div className="mx-4 mt-3 flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
          <p className="font-display text-lg font-bold">この手帳を使うのは？</p>
          <div className="flex flex-wrap gap-2">
            {family.members.map((m) => (
              <button key={m.id} onClick={() => setMeId(m.id)} className="min-h-11 rounded-full bg-rose-soft px-5 text-base font-semibold text-rose">
                わたしは{m.name}
              </button>
            ))}
          </div>
        </div>
      )}
      {/* 家族を読み終えるまで中身を出さない（わが家の人に、デモの家族が一瞬見えないように） */}
      <div className="flex-1 pb-24">{ready ? children : <div className="mx-4 mt-4 h-40 rounded-2xl bg-rose-soft/60" aria-hidden />}</div>
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
            const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
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
