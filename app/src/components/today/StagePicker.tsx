"use client";

// 見本の家族の「時期」を選ぶ（入口の1枚と、上の帯の「時期を変える」で使う）。
// 1000日のどこを見るかを、その時期に手帳が何をしているかの一言と一緒に並べる（UI/UX 見直し「最初の1分」2026-11-04）。
import { useEffect, useRef, useState } from "react";
import { addDays, clockAt, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { demoStages, type Stage } from "./stages";

export { demoFirstDay, demoStages, type Stage } from "./stages";

/**
 * 札の言葉を画面の言葉に（多言語化 11/5。辞書は lib/i18n/dict/stages.ts）。札のデータ（stages.ts）は日本語のまま持ち、描く時に訳す。
 * 日付や週数の入った言葉は、形を見て差し込みの鍵で引く（stages.ts の書き方と合わせる）
 */
export function stageWords(s: string): string {
  const early = /^(.+)。(\d+)週早く生まれて、手帳が予定を組み直した日$/.exec(s);
  if (early) return t("{what}。{n}週早く生まれて、手帳が予定を組み直した日", { what: t(early[1]), n: Number(early[2]) });
  const off = /^(.+)。予定と違う日に生まれて、手帳が予定を組み直した日$/.exec(s);
  if (off) return t("{what}。予定と違う日に生まれて、手帳が予定を組み直した日", { what: t(off[1]) });
  const ifs = /^もしも: (.+)$/.exec(s);
  if (ifs) return t("もしも: {what}", { what: t(ifs[1]) });
  return t(s);
}

/** 今日に一番近い時期（帯の「妊娠30週」などは clockAt で出すので、ここは選んだ印だけ） */
function nearest(stages: Stage[], today: string): string | null {
  const hit = stages.find((s) => s.date === today);
  return hit?.key ?? null;
}

export function StagePicker({ family, today, onPick, slider = false }: { family: Family; today: string; onPick: (date: string, focus?: string) => void; slider?: boolean }) {
  const stages = demoStages(family);
  const on = nearest(stages, today);
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-col gap-2">
        {stages.map((s) => {
          const picked = s.key === on;
          return (
            <li key={s.key}>
              <button
                type="button"
                onClick={() => onPick(s.date, s.focus)}
                aria-pressed={picked}
                className={`flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl border px-4 py-2 text-left ${
                  picked ? "border-rose bg-rose text-white" : s.tone === "sky" ? "border-sky/40 bg-card text-ink hover:border-sky" : "border-line bg-card text-ink hover:border-rose"
                }`}
              >
                <span className="flex min-w-0 flex-col">
                  <b className={`text-base ${!picked && s.tone === "sky" ? "text-sky" : ""}`}>{stageWords(s.label)}</b>
                  <span className={`text-sm ${picked ? "text-white/90" : "text-muted"}`}>{stageWords(s.what)}</span>
                </span>
                <span aria-hidden className={picked ? "text-white" : "text-muted"}>
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {slider && <DaySlider family={family} today={today} onPick={onPick} />}
    </div>
  );
}

/**
 * 1000日のどこでも。動かしている間は言葉（何週・生後何か月）だけを変え、その日を開く（onPick）のは離した時だけ（マウス・指・キーボード）。
 * 前は1目盛りごとに日を変え、今日の画面が読み込みを4本ずつ出し直し、札の日を通るとシートが途中で閉じた（技術監査 ui-5）。
 */
function DaySlider({ family, today, onPick }: { family: Family; today: string; onPick: (date: string) => void }) {
  const start = conceptionDate(family);
  const total = totalDays(family);
  const day = Math.max(1, Math.min(total, diffDays(today, start) + 1));
  // 動かしている間の目盛り（離すまで、選んだ日は変えない）
  const [drag, setDrag] = useState<number | null>(null);
  const pending = useRef<number | null>(null);
  // キーを押している間（押したままだと目盛りが続けて動くので、離した時に1回だけ決める）
  const keyHeld = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  const commit = () => {
    const v = pending.current;
    pending.current = null;
    setDrag(null);
    if (v == null) return;
    const d = addDays(start, v - 1);
    if (d !== today) onPick(d);
  };
  // ネイティブの change（離した時に1回。範囲の外で離した時・読み上げの道具で動かした時も来る）。キーを押したままの間は、離した時（keyup）に決める
  const latest = useRef(commit);
  useEffect(() => {
    latest.current = commit;
  });
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    const onCommit = () => {
      if (!keyHeld.current) latest.current();
    };
    el.addEventListener("change", onCommit);
    return () => el.removeEventListener("change", onCommit);
  }, []);

  const value = drag ?? day;
  const label = clockAt(family, addDays(start, value - 1)).label;
  return (
    <label className="flex flex-col gap-1 pt-2 text-sm text-muted">
      <span>{t("1000日のどこでも（{label}）", { label })}</span>
      <input
        ref={input}
        type="range"
        min={1}
        max={total}
        value={value}
        aria-valuetext={label}
        onChange={(e) => {
          pending.current = Number(e.target.value);
          setDrag(pending.current);
        }}
        onPointerUp={commit}
        onPointerCancel={commit}
        onTouchEnd={commit}
        onTouchCancel={commit}
        onKeyDown={() => (keyHeld.current = true)}
        onKeyUp={() => {
          keyHeld.current = false;
          commit();
        }}
        onBlur={() => {
          keyHeld.current = false;
          commit();
        }}
        className="h-11 accent-[var(--rose)]"
      />
    </label>
  );
}
