"use client";

// ⑤ 健診: 一番上に「今やる1つ」（今日の健診／明日の健診／次の健診まであと◯日）。予約・聞く事・これまでは畳む。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Fold, NextStep, Pill, daysUntil } from "@/components/ui";
import { Briefing } from "@/components/visit/Briefing";
import { StatusChip } from "@/components/visit/StatusChip";
import { DEMO_AGENDA, DEMO_TRANSCRIPT, DEMO_VISIT_WEEKS } from "@/components/visit/demoTranscript";
import { addDays, lmpFromDue } from "@/lib/clock";
import { briefingDay, visitLabel, type AgendaItem, type VisitPlan, type VisitStatus } from "@/lib/visit";

interface Row {
  id: string;
  date: string;
  label: string;
  status: VisitStatus;
  demo?: boolean;
  summary: string | null;
}
interface ListRes {
  visits: Row[];
  plan: VisitPlan;
  agenda: AgendaItem[];
  agendaFor?: "today" | "next";
}

export default function VisitList() {
  const { family, families, today, isDemo, ready, setFamilyId, me } = useFamily();
  const mine = families.find((f) => f.id === "mine");
  const router = useRouter();
  const [data, setData] = useState<ListRes | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<ListRes>(`/api/visit?familyId=${encodeURIComponent(family.id)}&today=${today}`));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [family.id, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy("start");
    try {
      const r = await api<{ visit: { id: string } }>("/api/visit", { body: { familyId: family.id, date: today } });
      router.push(`/visit/${r.visit.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  };

  const demo = async () => {
    setBusy("demo");
    try {
      const date = addDays(lmpFromDue(family.dueDate), DEMO_VISIT_WEEKS * 7);
      const r = await api<{ visit: { id: string } }>("/api/visit", { body: { familyId: family.id, date, demo: true, agenda: DEMO_AGENDA } });
      await api(`/api/visit/${r.visit.id}/finish`, { body: { transcriptText: DEMO_TRANSCRIPT } });
      router.push(`/visit/${r.visit.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  };

  const savePlan = async (b: Record<string, unknown>) => {
    try {
      const r = await api<{ plan: VisitPlan }>("/api/visit/plan", { body: { familyId: family.id, today, ...b } });
      setData((d) => (d ? { ...d, plan: r.plan } : d));
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const ongoing = data?.visits.find((v) => v.date === today && (v.status === "ready" || v.status === "recording"));
  // 過ぎた予約は「次」として扱わない
  const next = data?.plan.next && data.plan.next.date >= today ? data.plan.next : null;
  const when = briefingDay(today, next?.date);
  // 母以外（パートナー・祖父母）が開いた時は、終わったばかりの健診のまとめを先に
  const notMom = !!me && me.role !== "母";
  const whose = notMom ? "ママの健診" : undefined;
  // 今日録った健診（整理中・できた）は、まとめを読むのが次の一手。母以外は3日以内の健診も
  const recent = data?.visits.find(
    (v) => !v.demo && v.status !== "ready" && v.status !== "recording" && (v.date === today || (notMom && v.status === "done" && daysUntil(v.date, today) <= 3)),
  );
  const startLabel = busy === "start" ? "準備しています…" : "今日の健診を始める";

  let top: React.ReactNode;
  if (!data) {
    top = err ? null : <p className="text-base text-muted">読み込んでいます…</p>;
  } else if (ongoing) {
    top = (
      <NextStep eyebrow={`今日・${ongoing.label}`} title="今日の健診を続ける">
        <Btn href={`/visit/${ongoing.id}`}>続ける</Btn>
      </NextStep>
    );
  } else if (isDemo) {
    // デモの家族のまま本物の健診を録らないよう、わが家への切り替えを先に出す
    top = (
      <NextStep eyebrow="いま見ているのはデモの家族" title="本物の健診は、わが家で" tone="sky">
        {mine ? <Btn onClick={() => setFamilyId(mine.id)}>わが家に切り替える</Btn> : <Btn href="/settings">わが家を作る</Btn>}
        <Btn kind="secondary" onClick={() => void demo()} disabled={!!busy}>
          {busy === "demo" ? "作っています…（30秒ほど）" : `デモの健診を見る（${DEMO_VISIT_WEEKS}週）`}
        </Btn>
        <Btn kind="quiet" onClick={() => void start()} disabled={!!busy || !ready}>
          {busy === "start" ? "準備しています…" : "デモで録音を試す"}
        </Btn>
      </NextStep>
    );
  } else if (recent) {
    top = (
      <NextStep eyebrow={`${recent.date === today ? "今日" : jpDate(recent.date)}・${recent.label}`} title="健診のまとめを読む" sub={recent.summary ?? undefined}>
        <Btn href={`/visit/${recent.id}`}>{recent.status === "done" ? "読む" : "見る"}</Btn>
      </NextStep>
    );
  } else if (when && next) {
    top = (
      <Briefing family={family} today={today} next={next} agenda={data.agenda} whose={whose}>
        {when === "day" && (
          <Btn onClick={() => void start()} disabled={!!busy || !ready}>
            {startLabel}
          </Btn>
        )}
      </Briefing>
    );
  } else if (next) {
    top = (
      <NextStep
        eyebrow={whose ?? "次の健診"}
        title={`${visitLabel(family, next.date)}の健診`}
        days={daysUntil(today, next.date)}
        dateLabel={`${jpDate(next.date)}${next.time ? ` ${next.time}` : ""}`}
      >
        <Btn kind="quiet" onClick={() => void start()} disabled={!!busy || !ready}>
          {busy === "start" ? "準備しています…" : "今日が健診なら、始める"}
        </Btn>
      </NextStep>
    );
  } else {
    top = (
      <NextStep eyebrow={whose ?? "次の健診"} title="次の健診の日を入れる">
        <NextAppointment next={null} onSave={(n) => void savePlan({ next: n })} />
        <Btn kind="quiet" onClick={() => void start()} disabled={!!busy || !ready}>
          {busy === "start" ? "準備しています…" : "今日が健診なら、始める"}
        </Btn>
      </NextStep>
    );
  }

  const agenda = data?.agenda ?? [];
  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <h1 className="font-display text-xl font-bold">健診</h1>

      {err && (
        <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-base text-alert">
          {err}
        </p>
      )}

      {top}

      {data && next && (
        <Fold title="次の健診の日">
          <NextAppointment next={next} onSave={(n) => void savePlan({ next: n })} />
        </Fold>
      )}

      {data && (
        <Fold title={data.agendaFor === "today" ? "今日聞く事" : "聞く事"} count={agenda.length}>
          <AskList agenda={agenda} onAdd={(t) => void savePlan({ concern: t })} onRemove={(id) => void savePlan({ removeConcern: id })} />
        </Fold>
      )}

      {data && data.visits.length > 0 && (
        <Fold title="これまでの健診" count={data.visits.length}>
          {data.visits.map((v) => (
            <Link key={v.id} href={`/visit/${v.id}`} className="flex min-h-11 flex-col gap-1 rounded-xl border border-line bg-card p-3 hover:border-rose">
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular text-base font-semibold">{jpDate(v.date)}</span>
                <span className="text-sm text-sky">{v.label}</span>
                <StatusChip status={v.status} />
                {v.demo && <Pill tone="sky">デモ</Pill>}
              </span>
              {v.summary && <span className="line-clamp-2 text-base">{v.summary}</span>}
            </Link>
          ))}
        </Fold>
      )}
    </main>
  );
}

function NextAppointment({ next, onSave }: { next: VisitPlan["next"]; onSave: (n: { date: string; time: string | null } | null) => void }) {
  const [date, setDate] = useState(next?.date ?? "");
  const [time, setTime] = useState(next?.time ?? "");
  const [editing, setEditing] = useState(!next);
  useEffect(() => {
    setDate(next?.date ?? "");
    setTime(next?.time ?? "");
  }, [next?.date, next?.time]);

  const field = "min-h-11 rounded-lg border border-line bg-card px-3 text-base";
  if (next && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-lg font-semibold">
          {jpDate(next.date)}
          {next.time && <span className="ml-2">{next.time}</span>}
        </span>
        {next.source === "visit" && next.said && <Pill tone="sky">先生「{next.said}」</Pill>}
        <Btn kind="quiet" onClick={() => setEditing(true)}>
          直す
        </Btn>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm text-muted">
        日付
        <input id="next-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        時刻
        <input id="next-time" type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <Btn
        disabled={!date}
        onClick={() => {
          onSave({ date, time: time || null });
          if (next) setEditing(false);
        }}
      >
        入れる
      </Btn>
      {next && (
        <Btn kind="quiet" onClick={() => setEditing(false)}>
          やめる
        </Btn>
      )}
    </div>
  );
}

function AskList({ agenda, onAdd, onRemove }: { agenda: AgendaItem[]; onAdd: (t: string) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      {agenda.length > 0 && (
        <ul className="flex flex-col gap-2">
          {agenda.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-base">
              <Pill tone={a.from === "前回の質問" ? "sky" : "rose"}>{a.from === "前回の質問" ? "前回" : "気がかり"}</Pill>
              <span className="min-w-0 flex-1">{a.text}</span>
              {a.from === "気がかり" && (
                <button type="button" onClick={() => onRemove(a.id)} className="min-h-11 shrink-0 px-2 text-sm text-muted" aria-label={`「${a.text}」を消す`}>
                  消す
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text.trim());
          setText("");
        }}
      >
        <input
          id="concern"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例: 夜に足がつって目が覚める"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-base"
        />
        <button className="min-h-11 shrink-0 rounded-full bg-ink px-5 text-base font-semibold text-paper">足す</button>
      </form>
    </>
  );
}
