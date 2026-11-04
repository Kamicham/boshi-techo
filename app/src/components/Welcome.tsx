"use client";

// 初めて見本の家族を開いた時だけの1枚（UI/UX 見直し「最初の1分」2026-11-04）。
// 最初の数秒で「何のアプリか」「手帳が先に動く」を言い、見本の家族の時期を選んで入る。
// 選んだら、その時期まで時計を進め、作った記録（話した・撮った）を入れてから開く（手帳と一冊が空で始まらない）。
import { useState } from "react";
import { api, useFamily } from "./FamilyProvider";
import { demoStages, StagePicker } from "./today/StagePicker";

export const WELCOMED_KEY = "boshi.welcomed";
// 公開版（体験）では合言葉の口（/unlock）を閉じているので、合言葉の扉は出さない（middleware.ts）
const PUBLIC = process.env.NEXT_PUBLIC_BOSHI_PUBLIC === "1";

function markWelcomed() {
  try {
    localStorage.setItem(WELCOMED_KEY, "1");
  } catch {}
}

export function readWelcomed(): boolean {
  try {
    return localStorage.getItem(WELCOMED_KEY) === "1";
  } catch {
    // 読めない端末（プライベート・サムネイル）では毎回出さない
    return true;
  }
}

/** 何のアプリかを、手帳がする事3つで見せる（作った例） */
const DOES = [
  { icon: "📮", head: "手続きは、先に用意", body: "町の窓口・持ち物・書く事のメモを、期限の前に手帳が作っておく" },
  { icon: "🩺", head: "健診は、聞く事から", body: "話した気がかりを、先生への質問にして健診の日に出す" },
  { icon: "📖", head: "2歳の日に、一冊", body: "話した事・撮った写真が、子どもへ語りかける本になる" },
];

export function Welcome({ onClose }: { onClose: () => void }) {
  const { family, setToday } = useFamily();
  const [busy, setBusy] = useState(false);
  const child = "赤ちゃん";
  const names = family.members.map((m) => `${m.name}さん`).join("・");

  const start = async (date: string) => {
    setBusy(true);
    setToday(date);
    // 作った記録（話した・撮った）を入れておく。入らなくても手帳は開く
    await api("/api/capture/seed", { body: { familyId: family.id } }).catch(() => {});
    markWelcomed();
    onClose();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="fixed inset-0 z-50 overflow-y-auto bg-paper">
      <div className="mx-auto flex max-w-md flex-col gap-5 px-4 pt-[max(env(safe-area-inset-top),1.75rem)] pb-16">
        <header className="flex flex-col gap-2">
          <p className="text-sm font-semibold text-rose">母子手帳を、再発明する</p>
          <h1 id="welcome-title" className="font-display text-3xl leading-snug font-bold text-ink">
            母子手帳が、
            <br />
            先に動く。
          </h1>
          <p className="text-base leading-relaxed text-ink">
            妊娠から2歳までの1000日。やる事を手帳が先に調べて用意し、家族は見て「済んだ」を押すだけ。
          </p>
        </header>

        <ul className="flex flex-col gap-2 border-y border-line py-3">
          {DOES.map((d) => (
            <li key={d.head} className="flex items-baseline gap-2.5">
              <span aria-hidden className="text-lg">
                {d.icon}
              </span>
              <span className="min-w-0 text-base leading-snug">
                <b className="text-ink">{d.head}</b>
                <span className="block text-sm text-muted">{d.body}</span>
              </span>
            </li>
          ))}
        </ul>

        {/* 扉2つ（同じ大きさ）: 自分の手帳を始める・家族に入れてもらう。合言葉の扉はログインの画面の「家族の合言葉で入る」と同じ /unlock */}
        <nav aria-label="入口" className="flex flex-col gap-3">
          <a href="/start" onClick={markWelcomed} className="flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 border-rose px-4 py-2 text-center text-rose">
            <span className="font-display text-lg font-bold">自分の手帳を始める</span>
            <span className="text-sm">3つ答える</span>
          </a>
          {!PUBLIC && (
            <a href="/unlock" onClick={markWelcomed} className="flex min-h-16 flex-col items-center justify-center rounded-2xl border-2 border-rose px-4 py-2 text-center text-rose">
              <span className="text-sm">家族に「入れて」と言われた人は</span>
              <span className="font-display text-lg font-bold">→ 合言葉で入る</span>
            </a>
          )}
        </nav>

        <section className="flex flex-col gap-3" aria-labelledby="welcome-try">
          <div className="flex flex-col gap-1">
            <h2 id="welcome-try" className="font-display text-xl font-bold text-ink">
              見本の家族の手帳で、触ってみる
            </h2>
            <p className="text-sm text-muted">
              {names}と{child}（{family.city}・作った家族）。時期を選ぶと、その日の手帳が開きます。
            </p>
          </div>
          <div className={busy ? "pointer-events-none opacity-60" : ""} aria-busy={busy}>
            <StagePicker family={family} today="" onPick={(d) => void start(d)} />
          </div>
          {busy && (
            <p className="text-base text-muted" aria-live="polite">
              手帳を開いています…
            </p>
          )}
          <p className="text-sm text-muted">作った家族です。あなただけの写しで、7日で消えます。本物の記録は書かないでください。</p>
        </section>
      </div>
    </div>
  );
}

/** 帯から開く「時期を変える」 */
export function StageSheet({ onClose }: { onClose: () => void }) {
  const { family, today, setToday } = useFamily();
  return (
    <div role="dialog" aria-modal="true" aria-label="見本の家族のほかの時期を見る" className="fixed inset-0 z-40 flex items-end bg-ink/30" onClick={onClose}>
      <div className="mx-auto flex max-h-[85dvh] w-full max-w-md flex-col gap-3 overflow-y-auto rounded-t-3xl bg-paper px-4 pt-4 pb-[max(env(safe-area-inset-bottom),1.5rem)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">ほかの時期を見る</h2>
          <button type="button" onClick={onClose} className="min-h-11 px-2 text-base text-muted underline underline-offset-2">
            閉じる
          </button>
        </div>
        <p className="text-sm text-muted">
          見本の家族（{family.members.map((m) => `${m.name}さん`).join("・")}）の1000日の、どの日の手帳を見るか。
        </p>
        <StagePicker
          family={family}
          today={today}
          slider
          onPick={(d) => {
            setToday(d);
            if (demoStages(family).some((s) => s.date === d)) onClose();
          }}
        />
        <p className="text-sm text-muted">作った家族です。あなただけの写しで、7日で消えます。本物の記録は書かないでください。</p>
      </div>
    </div>
  );
}
