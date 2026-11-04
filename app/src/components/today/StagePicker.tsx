"use client";

// 見本の家族の「時期」を選ぶ（入口の1枚と、上の帯の「時期を変える」で使う）。
// 1000日のどこを見るかを、その時期に手帳が何をしているかの一言と一緒に並べる（UI/UX 見直し「最初の1分」2026-11-04）。
import { addDays, clockAt, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { demoStages, type Stage } from "./stages";

export { demoFirstDay, demoStages, type Stage } from "./stages";

/** 今日に一番近い時期（帯の「妊娠30週」などは clockAt で出すので、ここは選んだ印だけ） */
function nearest(stages: Stage[], today: string): string | null {
  const hit = stages.find((s) => s.date === today);
  return hit?.key ?? null;
}

export function StagePicker({ family, today, onPick, slider = false }: { family: Family; today: string; onPick: (date: string, focus?: string) => void; slider?: boolean }) {
  const stages = demoStages(family);
  const on = nearest(stages, today);
  const start = conceptionDate(family);
  const total = totalDays(family);
  const day = diffDays(today, start) + 1;
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
                  <b className={`text-base ${!picked && s.tone === "sky" ? "text-sky" : ""}`}>{s.label}</b>
                  <span className={`text-sm ${picked ? "text-white/90" : "text-muted"}`}>{s.what}</span>
                </span>
                <span aria-hidden className={picked ? "text-white" : "text-muted"}>
                  ›
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {slider && (
        <label className="flex flex-col gap-1 pt-2 text-sm text-muted">
          <span>1000日のどこでも（{clockAt(family, today).label}）</span>
          <input
            type="range"
            min={1}
            max={total}
            value={Math.max(1, Math.min(total, day))}
            onChange={(e) => onPick(addDays(start, Number(e.target.value) - 1))}
            className="h-11 accent-[var(--rose)]"
          />
        </label>
      )}
    </div>
  );
}
