"use client";

// デモの早送り（デモの家族の時だけ、画面の下に小さく）。
import { addDays, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";

export function DemoClock({ family, today, setToday }: { family: Family; today: string; setToday: (d: string) => void }) {
  const start = conceptionDate(family);
  const total = totalDays(family);
  const day = diffDays(today, start) + 1;
  const birth = family.birthDate ?? family.dueDate;
  const jump = (target: string) => setToday(addDays(start, Math.max(1, Math.min(total, diffDays(target, start) + 1)) - 1));
  const jumps = [
    { label: "8週", d: addDays(start, 42) },
    { label: "30週", d: addDays(start, 30 * 7 - 14) },
    { label: "生まれた翌日", d: addDays(birth, 1) },
    { label: "生後2か月", d: addDays(birth, 61) },
    { label: "2歳", d: addDays(birth, 731) },
  ];
  return (
    <details className="text-sm text-muted">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center underline underline-offset-2">時計を進める（デモ）</summary>
      <div className="flex flex-col gap-2 pt-1">
        <input
          aria-label="1000日のどこを見るか"
          type="range"
          min={1}
          max={total}
          value={Math.max(1, Math.min(total, day))}
          onChange={(e) => setToday(addDays(start, Number(e.target.value) - 1))}
          className="h-11 accent-[var(--rose)]"
        />
        <div className="flex flex-wrap gap-2">
          {jumps.map((j) => (
            <button key={j.label} type="button" onClick={() => jump(j.d)} className="min-h-11 rounded-full border border-line px-3 hover:border-rose hover:text-rose">
              {j.label}
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
