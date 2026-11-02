"use client";

import { useMemo, useState } from "react";
import { addDays, clockAt, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import { scheduleFor, statusOf, type Milestone, type Status } from "@/lib/milestones";
import type { Family } from "@/lib/demo-family";

const STATUS_STYLE: Record<Status, string> = {
  まだ先: "bg-sky-soft text-sky",
  今やる: "bg-rose-soft text-rose",
  期限が近い: "bg-warn/15 text-warn",
  期限切れ: "bg-alert/10 text-alert",
  済み: "bg-ok/10 text-ok",
  過ぎた: "bg-line text-muted",
};

function jpDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${wd}）`;
}

export function Techo({ family }: { family: Family }) {
  const start = conceptionDate(family);
  const total = totalDays(family);
  // 早送りの開始位置: 妊娠8週ごろ
  const [day, setDay] = useState(42);
  const [marked, setMarked] = useState<Set<string>>(new Set());

  const today = addDays(start, day - 1);
  const clock = clockAt(family, today);
  const schedule = useMemo(() => scheduleFor(family), [family]);

  // デモの早送り: 通り過ぎた期限の事は、家族が済ませた前提にする
  const done = useMemo(() => {
    const s = new Set(marked);
    for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) s.add(m.id);
    return s;
  }, [marked, schedule, today]);

  const now = schedule.filter((m) => {
    const s = statusOf(m, today, done);
    return s === "今やる" || s === "期限が近い" || s === "期限切れ";
  });
  const next = schedule.filter((m) => statusOf(m, today, done) === "まだ先").slice(0, 3);

  const jump = (target: string) => setDay(Math.max(1, Math.min(total, diffDays(target, start) + 1)));

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-4 pb-16 pt-6">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-rose">{family.city}・{family.members.map((m) => m.name).join("と")}の手帳</p>
        <h1 className="font-display text-3xl font-bold">{clock.label}</h1>
        <p className="tabular text-sm text-muted">
          {jpDate(today)}・1000日のうち <b className="text-sky">{Math.max(clock.dayOf1000, 0)}</b> 日目
        </p>
      </header>

      <section aria-label="時計の早送り" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
        <label htmlFor="clock" className="text-xs font-semibold text-muted">時計を進める（デモ）</label>
        <input id="clock" type="range" min={1} max={total} value={day} onChange={(e) => setDay(Number(e.target.value))} className="accent-[var(--rose)]" />
        <div className="flex flex-wrap gap-2 text-xs">
          {[
            { label: "妊娠8週", d: addDays(start, 42) },
            { label: "妊娠30週", d: addDays(start, 30 * 7 - 14) },
            { label: "生まれた翌日", d: addDays(family.birthDate ?? family.dueDate, 1) },
            { label: "生後2か月", d: addDays(family.birthDate ?? family.dueDate, 61) },
            { label: "2歳", d: addDays(family.birthDate ?? family.dueDate, 731) },
          ].map((j) => (
            <button key={j.label} onClick={() => jump(j.d)} className="rounded-full border border-line px-3 py-1 hover:border-rose hover:text-rose">
              {j.label}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">今やる事 <span className="tabular text-sm font-normal text-muted">{now.length}件</span></h2>
        {now.length === 0 && <p className="text-sm text-muted">今日やる事はありません。次の事は手帳から声をかけます。</p>}
        {now.map((m) => (
          <Card key={m.id} m={m} status={statusOf(m, today, done)} today={today} onDone={() => setMarked(new Set(marked).add(m.id))} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">この先</h2>
        {next.map((m) => (
          <div key={m.id} className="flex items-baseline justify-between gap-3 border-b border-line pb-2 text-sm">
            <span className="min-w-0">{m.title}</span>
            <span className="tabular shrink-0 text-xs text-sky">{jpDate(m.startDate)}〜</span>
          </div>
        ))}
      </section>
    </main>
  );
}

function Card({ m, status, today, onDone }: { m: Milestone; status: Status; today: string; onDone: () => void }) {
  const left = m.deadlineDate ? diffDays(m.deadlineDate, today) : undefined;
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[status]}`}>{status}</span>
        <span className="text-muted">{m.kind}・{m.who}</span>
        {m.needsLocal && <span className="text-sky">町の情報を確かめる</span>}
      </div>
      <h3 className="font-semibold leading-snug">{m.title}</h3>
      {m.deadlineDate && (
        <p className="tabular text-sm">
          期限 {jpDate(m.deadlineDate)}
          {left !== undefined && left >= 0 && <span className="text-muted">（あと{left}日）</span>}
        </p>
      )}
      <p className="text-xs text-muted">根拠: {m.basis}</p>
      <button onClick={onDone} className="self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-paper">
        済んだ
      </button>
    </article>
  );
}
