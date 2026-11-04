"use client";

// 見本の家族の「時期」を選ぶ（入口の1枚と、上の帯の「時期を変える」で使う）。
// 1000日のどこを見るかを、その時期に手帳が何をしているかの一言と一緒に並べる（UI/UX 見直し「最初の1分」2026-11-04）。
import { addDays, addMonths, clockAt, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { advisorMoments } from "@/lib/advisor";

export type Stage = { key: string; label: string; what: string; date: string; tone?: "sky" };

/** 見本の家族の時期（日付はその家族の予定日・生まれた日から） */
export function demoStages(family: Family): Stage[] {
  const start = conceptionDate(family);
  const birth = family.birthDate ?? family.dueDate;
  const lmp = addDays(family.dueDate, -280);
  const stages: Stage[] = [
    { key: "w8", label: "妊娠8週", what: "母子手帳をもらう・最初の届け出", date: addDays(lmp, 8 * 7) },
    { key: "w28", label: "妊娠28週", what: "手帳が気づいた事・次の健診の予約", date: addDays(lmp, 28 * 7) },
    { key: "w30", label: "妊娠30週", what: "産休・出産のお金・入院の準備", date: addDays(lmp, 30 * 7) },
    { key: "born", label: "生まれた翌日", what: "出生届・14日以内の手続き", date: addDays(birth, 1) },
    { key: "m2", label: "生後2か月", what: "初めての予防接種と健診", date: addDays(birth, 61) },
    { key: "y1", label: "1歳の誕生日", what: "おなかにいた頃の手紙が開く・この1年の一冊", date: addMonths(birth, 12) },
    { key: "y2", label: "2歳", what: "1000日の記録から、子どもへの一冊", date: addDays(birth, 731) },
  ];
  // 予定どおりに行かなかった日（早く生まれた・引っ越した）に、手帳が気づいて組み直す所
  for (const m of advisorMoments(family)) {
    const early = family.birthDate ? diffDays(family.dueDate, family.birthDate) : 0;
    const label = m.label === "生まれた日" ? (early > 0 ? `予定より${Math.round(early / 7)}週早く生まれた` : "予定と違う日に生まれた") : m.label;
    stages.push({ key: `adv-${m.date}`, label: `もしも: ${label}`, what: "手帳が気づいて、予定を組み直す", date: m.date, tone: "sky" });
  }
  const total = totalDays(family);
  return stages.map((s) => ({ ...s, date: addDays(start, Math.max(1, Math.min(total, diffDays(s.date, start) + 1)) - 1) }));
}

/** 今日に一番近い時期（帯の「妊娠30週」などは clockAt で出すので、ここは選んだ印だけ） */
function nearest(stages: Stage[], today: string): string | null {
  const hit = stages.find((s) => s.date === today);
  return hit?.key ?? null;
}

export function StagePicker({ family, today, onPick, slider = false }: { family: Family; today: string; onPick: (date: string) => void; slider?: boolean }) {
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
                onClick={() => onPick(s.date)}
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
