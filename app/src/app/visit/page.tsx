"use client";

// ⑤ 健診: 次の健診の準備（予約日・聞く事・前日の声かけ）と、これまでの健診。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Briefing } from "@/components/visit/Briefing";
import { StatusChip } from "@/components/visit/StatusChip";
import { DEMO_AGENDA, DEMO_TRANSCRIPT, DEMO_VISIT_WEEKS } from "@/components/visit/demoTranscript";
import { addDays, lmpFromDue } from "@/lib/clock";
import { visitLabel, type AgendaItem, type VisitPlan, type VisitStatus } from "@/lib/visit";

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
  const { family, families, today, isDemo, ready, setFamilyId } = useFamily();
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
  const next = data?.plan.next ?? null;

  return (
    <main className="flex flex-col gap-6 px-4 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">健診</h1>
        <p className="text-sm text-muted">先生の話を録音して、あとで家族で読み返せる形にします。分からなかった言葉は、次に聞く質問にして残します。</p>
      </header>

      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}

      <section className="flex flex-col gap-3">
        {ongoing ? (
          <Link href={`/visit/${ongoing.id}`} className="rounded-xl bg-rose px-5 py-4 text-center font-display text-lg font-bold text-white">
            今日の健診を続ける
          </Link>
        ) : isDemo ? (
          // デモの家族のまま本物の健診を録らないよう、わが家への切り替えを先に出す
          <div className="flex flex-col gap-2 rounded-xl border border-sky bg-sky-soft p-4">
            <p className="text-sm font-semibold text-sky">いま見ているのはデモの家族（作った家族）です。</p>
            {mine ? (
              <button onClick={() => setFamilyId(mine.id)} className="rounded-xl bg-rose px-5 py-4 font-display text-lg font-bold text-white">
                わが家に切り替えて健診を始める
              </button>
            ) : (
              <Link href="/settings" className="rounded-xl bg-rose px-5 py-4 text-center font-display text-lg font-bold text-white">
                本物の健診は、先に「わが家の設定」へ
              </Link>
            )}
            <button onClick={start} disabled={!!busy || !ready} className="rounded-lg border border-line bg-card py-2 text-sm disabled:opacity-60">
              {busy === "start" ? "準備しています…" : "デモの家族で録音を試す"}
            </button>
          </div>
        ) : (
          <button onClick={start} disabled={!!busy || !ready} className="rounded-xl bg-rose px-5 py-4 font-display text-lg font-bold text-white disabled:opacity-60">
            {busy === "start" ? "準備しています…" : "新しい健診を始める"}
          </button>
        )}
        <p className="text-center text-xs text-muted">
          {jpDate(today)}・{visitLabel(family, today)}の健診として始めます
        </p>
        {isDemo && (
          <button onClick={demo} disabled={!!busy} className="rounded-xl border border-sky bg-sky-soft px-5 py-3 text-sm font-semibold text-sky disabled:opacity-60">
            {busy === "demo" ? "デモの健診を作っています…（Claude が整理中・30秒ほど）" : `デモの健診を作る（${DEMO_VISIT_WEEKS}週・作った会話）`}
          </button>
        )}
      </section>

      {data && <Briefing family={family} today={today} next={next} agenda={data.agenda} />}

      <NextAppointment next={next} onSave={(n) => savePlan({ next: n })} />

      <AskList agenda={data?.agenda ?? []} forToday={data?.agendaFor === "today"} onAdd={(t) => savePlan({ concern: t })} onRemove={(id) => savePlan({ removeConcern: id })} />

      <section className="flex flex-col gap-3 pb-6">
        <h2 className="font-display text-lg font-bold">これまでの健診</h2>
        {!data && !err && <p className="text-sm text-muted">読み込んでいます…</p>}
        {data && data.visits.length === 0 && <p className="text-sm text-muted">まだありません。健診の日に「新しい健診を始める」を押してください。</p>}
        {data?.visits.map((v) => (
          <Link key={v.id} href={`/visit/${v.id}`} className="flex flex-col gap-1 rounded-xl border border-line bg-card p-4 hover:border-rose">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="tabular font-semibold">{jpDate(v.date)}</span>
              <span className="text-sky">{v.label}</span>
              <StatusChip status={v.status} />
              {v.demo && <span className="rounded-full bg-sky-soft px-2 py-0.5 text-sky">デモ用の例</span>}
            </div>
            <p className="line-clamp-2 text-sm">{v.summary ?? (v.status === "done" ? "" : "まだ整理されていません")}</p>
          </Link>
        ))}
      </section>
    </main>
  );
}

function NextAppointment({ next, onSave }: { next: VisitPlan["next"]; onSave: (n: { date: string; time: string | null } | null) => void }) {
  const [date, setDate] = useState(next?.date ?? "");
  const [time, setTime] = useState(next?.time ?? "");
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    setDate(next?.date ?? "");
    setTime(next?.time ?? "");
  }, [next?.date, next?.time]);

  const field = "rounded-lg border border-line bg-card px-3 py-2 text-sm";
  return (
    <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold">次の健診</h2>
      {next && !editing ? (
        <>
          <p className="tabular text-xl font-semibold text-sky">
            {jpDate(next.date)}
            {next.time && <span className="ml-2">{next.time}</span>}
          </p>
          {next.source === "visit" && next.said && <p className="text-xs text-muted">前回の健診で「{next.said}」と言われた日です</p>}
          <button onClick={() => setEditing(true)} className="self-start text-xs text-muted underline">日付を直す</button>
        </>
      ) : (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted">
            日付
            <input id="next-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            時刻（任意）
            <input id="next-time" type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
          <button
            disabled={!date}
            onClick={() => {
              onSave({ date, time: time || null });
              setEditing(false);
            }}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
          >
            入れる
          </button>
          {editing && (
            <button onClick={() => setEditing(false)} className="px-2 py-2 text-xs text-muted">やめる</button>
          )}
        </div>
      )}
      {!next && <p className="text-xs text-muted">予約の日を入れると、前の日と当日に持ち物と聞く事をお知らせします。</p>}
    </section>
  );
}

function AskList({ agenda, forToday, onAdd, onRemove }: { agenda: AgendaItem[]; forToday: boolean; onAdd: (t: string) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState("");
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold">{forToday ? "今日の健診で聞く事" : "次の健診で聞く事"}</h2>
      {forToday && <p className="text-xs text-muted">今日の健診が始まっているので、足した事は今日の「今日聞く事」に入ります。</p>}
      {agenda.length === 0 && <p className="text-sm text-muted">気になっている事を書いておくと、健診の日に「今日聞く事」として出します。</p>}
      <ul className="flex flex-col gap-2">
        {agenda.map((a) => (
          <li key={a.id} className="flex items-start gap-2 rounded-lg border border-line bg-card px-3 py-2 text-sm">
            <span className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-xs ${a.from === "前回の質問" ? "bg-sky-soft text-sky" : "bg-rose-soft text-rose"}`}>{a.from}</span>
            <span className="min-w-0 flex-1">{a.text}</span>
            {a.from === "気がかり" && (
              <button onClick={() => onRemove(a.id)} className="shrink-0 text-xs text-muted" aria-label={`「${a.text}」を消す`}>
                消す
              </button>
            )}
          </li>
        ))}
      </ul>
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
          className="min-w-0 flex-1 rounded-lg border border-line bg-card px-3 py-2 text-base"
        />
        <button className="shrink-0 rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper">足す</button>
      </form>
    </section>
  );
}
