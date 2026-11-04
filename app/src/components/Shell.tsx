"use client";

// 画面の枠: 上に「わたし」と「急ぎの時」、下にタブ（いま・話す撮る・手帳・一冊）、右下に「手帳に聞く」。健診は「いま」から入る（UI/UX 見直し 2026-11-04）。
// タブの並びは lib/app-guide.ts（手帳に聞くが使い方を答える画面の地図）と共有する。
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { clockAt } from "@/lib/clock";
import { recordingBusy, recordingBusyServer, subscribeRecording } from "@/lib/recording-state";
import { TABS } from "@/lib/app-guide";
import { AskButton } from "./ask/AskSheet";
import { useFamily } from "./FamilyProvider";
import { readWelcomed, StageSheet, Welcome } from "./Welcome";


export function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { family, families, setFamilyId, isDemo, ready, accountsEnabled, account, households, me, today } = useFamily();
  // 録音中は別の画面へ移ると録音が止まるので、切り替えを止める
  const recording = useSyncExternalStore(subscribeRecording, recordingBusy, recordingBusyServer);
  // 見本の家族を初めて開いた時だけ、入口の1枚（何のアプリか・時期を選ぶ）。Shell は家族を読み終えてから描くので、端末の記憶をそのまま読める
  const [welcomed, setWelcomed] = useState(() => (typeof window === "undefined" ? true : readWelcomed()));
  const [stageOpen, setStageOpen] = useState(false);
  // 合言葉・ログイン・招待の画面では、家族の切り替えもタブも出さない
  if (path === "/unlock" || path === "/login" || path === "/start" || (path.startsWith("/invite/") && path !== "/invite/new")) return <div className="mx-auto min-h-dvh max-w-md">{children}</div>;
  // 映画は画面いっぱいに映す（タブも家族の切り替えも出さない）
  if (path === "/book/film") return <>{children}</>;
  const here = households.find((h) => h.id === family.id);
  const labelOf = (f: (typeof families)[number]) => {
    const h = households.find((x) => x.id === f.id);
    if (h) return h.name || "わが家";
    return f.id === "mine" ? "わが家" : `デモ（作った家族）: ${f.members.map((m) => m.name).join("・")}`;
  };
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col">
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-xs">
        {/* 手帳の切り替えは、切り替える先がある時だけ（自分の世帯が2つ以上・デモを見ている時）。
            1つしか無いのに一番大きな部品で「作った家族 sim-…」と出すと、本人には意味が無い（UI/UX 見直し 2026-11-03） */}
        {households.length > 1 || (isDemo && families.length > 1) ? (
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
        ) : null}
        {isDemo ? (
          /* 見本の家族: 「デモ」「わたし: 美咲」を、何を見ているかの1本にまとめる（だれの手帳か・いつか・変える所） */
          <button
            type="button"
            onClick={() => setStageOpen(true)}
            disabled={recording}
            className="flex min-h-11 min-w-0 shrink items-center gap-1.5 rounded-full bg-sky-soft px-3 text-left text-sm text-ink disabled:opacity-50"
          >
            <span className="truncate">
              見本の家族 ・ <b className="font-semibold">{clockAt(family, today).label.replace(/(\d+週)\d+日/, "$1")}</b>
            </span>
            <span className="shrink-0 font-semibold whitespace-nowrap text-sky">時期を変える ▾</span>
          </button>
        ) : (
        <div className={`flex min-w-0 shrink items-center gap-1 whitespace-nowrap ${recording ? "invisible" : ""}`}>
          {/* 「わたし」は誰の画面かと、設定（家族・町・使う人）の入口を兼ねる */}
          <Link href="/settings" className="flex min-h-11 min-w-0 items-center gap-1 px-1 text-sm text-ink underline-offset-2 hover:underline">
            <span className="truncate">{me ? `わたし: ${me.name}` : "わたしは？"}</span>
            <span className="text-muted" aria-hidden>▾</span>
          </Link>
        </div>
        )}
        {/* 急ぎの案内は録音中でも隠さない（産院・119・#8000 への橋）。
            いつも見える所を赤で塗ると、夜中に開くたびに緊張させるので、文字は ink・赤は直径6pxの点だけ（赤は命の橋の印） */}
        <Link href="/emergency" className="flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 font-semibold text-ink underline-offset-2 hover:underline">
          <span aria-hidden className="inline-block size-1.5 shrink-0 rounded-full bg-alert" />
          急ぎの時
        </Link>
      </div>
      {isDemo && !welcomed && <Welcome onClose={() => setWelcomed(true)} />}
      {isDemo && stageOpen && <StageSheet onClose={() => setStageOpen(false)} />}
      {accountsEnabled && !recording && <AccountBar isDemo={isDemo} signedIn={!!account} hasOwn={households.length > 0} consentFor={here?.needsRecordConsent && !path.startsWith("/account/consent") ? here.id : null} />}
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
            const on = t.href === "/" ? path === "/" || path.startsWith("/visit") : path.startsWith(t.href);
            // 話す・撮るは、家族の口（記録の入口）なので真ん中で丸く目立たせる
            const mouth = t.href === "/capture";
            return (
              <li key={t.href} className="flex-1">
                <Link
                  href={t.href}
                  className={`flex min-h-12 flex-col items-center justify-center py-1 text-xs font-semibold ${on ? "text-rose" : "text-muted"}`}
                  aria-current={on ? "page" : undefined}
                >
                  {mouth ? (
                    <span className={`flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-sm ${on ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}>
                      <span aria-hidden>🎤</span>
                      {t.label}
                    </span>
                  ) : (
                    t.label
                  )}
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
  // 見本の家族を見ている人へ、自分の手帳の入口（3つ答えるとその場で動く /start。「世帯」という言葉は出さない）
  if (!signedIn || !hasOwn)
    return (
      <p className={`${row} bg-sky-soft`}>
        <span>自分の手帳は、3つ答えるとすぐ動きます</span>
        <Link href="/start" className="flex min-h-11 shrink-0 items-center font-semibold text-sky underline underline-offset-2">
          始める
        </Link>
      </p>
    );
  return null;
}
