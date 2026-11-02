"use client";

// 「今日」の画面: 家族の時計と、今やる事・この先。
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, clockAt, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { scheduleFor, statusOf, type Milestone, type Status } from "@/lib/milestones";
import { briefingDay, type VisitPlan } from "@/lib/visit";
import { api, useFamily } from "./FamilyProvider";
import { MilestoneActions } from "./MilestoneActions";

const STATUS_STYLE: Record<Status, string> = {
  まだ先: "bg-sky-soft text-sky",
  今やる: "bg-rose-soft text-rose",
  期限が近い: "bg-warn/15 text-warn",
  期限切れ: "bg-alert/10 text-alert",
  済み: "bg-ok/10 text-ok",
  過ぎた: "bg-line text-muted",
};

export function jpDate(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  const wd = "日月火水木金土"[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  return `${m}月${d}日（${wd}）`;
}

export function Techo() {
  const { family, today, setToday, isDemo } = useFamily();
  const start = conceptionDate(family);
  const total = totalDays(family);
  const day = diffDays(today, start) + 1;
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [lastDone, setLastDone] = useState<{ id: string; title: string } | null>(null);
  const [doneError, setDoneError] = useState("");
  const [nextVisit, setNextVisit] = useState<VisitPlan["next"]>(null);

  // 済んだ印（DB の done）を読む
  useEffect(() => {
    let alive = true;
    setMarked(new Set());
    setLastDone(null);
    setDoneError("");
    api<{ done: string[] }>(`/api/done?familyId=${encodeURIComponent(family.id)}`)
      .then((j) => alive && setMarked(new Set(j.done)))
      .catch((e: Error) => alive && setDoneError(e.message));
    return () => {
      alive = false;
    };
  }, [family.id]);

  // 次の健診の日（健診の画面と同じ GET /api/visit の plan.next）
  useEffect(() => {
    let alive = true;
    setNextVisit(null);
    api<{ plan: VisitPlan }>(`/api/visit?familyId=${encodeURIComponent(family.id)}`)
      .then((j) => alive && setNextVisit(j.plan?.next ?? null))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id]);

  const setDone = useCallback(
    async (m: Milestone, on: boolean) => {
      setDoneError("");
      const prev = marked;
      const next = new Set(marked);
      if (on) next.add(m.id);
      else next.delete(m.id);
      setMarked(next);
      setLastDone(on ? { id: m.id, title: m.title } : null);
      try {
        await api("/api/done", { method: on ? "POST" : "DELETE", body: { familyId: family.id, milestoneId: m.id, today } });
      } catch (e) {
        setMarked(prev);
        setLastDone(null);
        setDoneError((e as Error).message);
      }
    },
    [marked, family.id, today],
  );

  const clock = clockAt(family, today);
  const schedule = useMemo(() => scheduleFor(family), [family]);

  // デモの早送り: 通り過ぎた期限の事は、家族が済ませた前提にする
  const done = useMemo(() => {
    const s = new Set(marked);
    if (isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < today) s.add(m.id);
    return s;
  }, [marked, schedule, today, isDemo]);

  const now = schedule.filter((m) => {
    const s = statusOf(m, today, done);
    return s === "今やる" || s === "期限が近い" || s === "期限切れ";
  });
  const next = schedule.filter((m) => statusOf(m, today, done) === "まだ先").slice(0, 4);

  const birth = family.birthDate ?? family.dueDate;
  const jump = (target: string) => setToday(addDays(start, Math.max(1, Math.min(total, diffDays(target, start) + 1)) - 1));

  return (
    <main className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-rose">
          {family.city}・{family.members.map((m) => m.name).join("と") || "わが家"}の手帳
        </p>
        <h1 className="font-display text-3xl font-bold">{clock.label}</h1>
        <p className="tabular text-sm text-muted">
          {jpDate(today)}・1000日のうち <b className="text-sky">{Math.max(clock.dayOf1000, 0)}</b> 日目
        </p>
      </header>

      {isDemo && (
        <section aria-label="時計の早送り" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <label htmlFor="clock" className="text-xs font-semibold text-muted">時計を進める（デモ）</label>
          <input
            id="clock"
            type="range"
            min={1}
            max={total}
            value={Math.max(1, Math.min(total, day))}
            onChange={(e) => setToday(addDays(start, Number(e.target.value) - 1))}
            className="accent-[var(--rose)]"
          />
          <div className="flex flex-wrap gap-2 text-xs">
            {[
              { label: "妊娠8週", d: addDays(start, 42) },
              { label: "妊娠30週", d: addDays(start, 30 * 7 - 14) },
              { label: "生まれた翌日", d: addDays(birth, 1) },
              { label: "生後2か月", d: addDays(birth, 61) },
              { label: "2歳", d: addDays(birth, 731) },
            ].map((j) => (
              <button key={j.label} onClick={() => jump(j.d)} className="rounded-full border border-line px-3 py-1 hover:border-rose hover:text-rose">
                {j.label}
              </button>
            ))}
          </div>
        </section>
      )}

      <VisitNudge family={family} today={today} next={nextVisit} />

      <Link
        href="/capture"
        className="flex items-center justify-between gap-3 rounded-xl border border-sky/40 bg-sky-soft px-4 py-3 text-sky"
      >
        <span className="flex flex-col">
          <span className="font-display text-base font-bold">話す・撮る</span>
          <span className="text-xs text-muted">気になった事を話すだけ、届いた紙を撮るだけで手帳に書きます</span>
        </span>
        <span aria-hidden className="text-xl">›</span>
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-bold">
          今やる事 <span className="tabular text-sm font-normal text-muted">{now.length}件</span>
        </h2>
        {lastDone && (
          <p role="status" className="flex items-center justify-between gap-3 rounded-lg bg-ok/10 px-3 py-2 text-sm text-ok">
            <span className="min-w-0">「{lastDone.title}」を済みにしました</span>
            <button
              onClick={() => {
                const m = schedule.find((x) => x.id === lastDone.id);
                if (m) void setDone(m, false);
              }}
              className="shrink-0 rounded-lg border border-ok/40 px-3 py-1 text-xs font-semibold"
            >
              戻す
            </button>
          </p>
        )}
        {doneError && (
          <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">
            済んだ印を保存できませんでした: {doneError}
          </p>
        )}
        {now.length === 0 && <p className="text-sm text-muted">今日やる事はありません。次の事は手帳から声をかけます。</p>}
        {now.map((m) => (
          <Card key={m.id} m={m} status={statusOf(m, today, done)} today={today} onDone={() => void setDone(m, true)} />
        ))}
      </section>

      <section className="flex flex-col gap-3 pb-6">
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

/** 次の健診の前日・当日だけ出す、短い声かけ（くわしくは健診の画面） */
function VisitNudge({ family, today, next }: { family: Family; today: string; next: VisitPlan["next"] }) {
  const when = briefingDay(today, next?.date);
  if (!when || !next) return null;
  const c = clockAt(family, next.date);
  const what = c.phase === "pregnant" ? `${c.pregnancyWeek}週の健診` : "健診";
  return (
    <section aria-label="健診の声かけ" className="flex flex-col gap-2 rounded-xl border-2 border-rose bg-rose-soft p-4">
      <p className="font-display text-lg font-bold leading-snug">
        {when === "eve" ? "明日" : "今日"}は{what}です{next.time ? `（${next.time}）` : ""}。先生の説明を録音しましょう
      </p>
      <Link href="/visit" className="self-start rounded-lg bg-rose px-4 py-1.5 text-sm font-semibold text-white">
        健診を開く
      </Link>
    </section>
  );
}

function Card({ m, status, today, onDone }: { m: Milestone; status: Status; today: string; onDone: () => void }) {
  const left = m.deadlineDate ? diffDays(m.deadlineDate, today) : undefined;
  return (
    <article className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLE[status]}`}>{status}</span>
        <span className="text-muted">{m.kind}・{m.who}</span>
      </div>
      <h3 className="font-semibold leading-snug">{m.title}</h3>
      {m.deadlineDate && (
        <p className="tabular text-sm">
          期限 {jpDate(m.deadlineDate)}
          {left !== undefined && left >= 0 && <span className="text-muted">（あと{left}日）</span>}
        </p>
      )}
      <p className="text-xs text-muted">根拠: {m.basis}</p>
      <MilestoneActions milestone={m} today={today} />
      <button onClick={onDone} className="self-start rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-paper">
        済んだ
      </button>
    </article>
  );
}
