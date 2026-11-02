"use client";

// ⑤ 健診の当日: 録音 → 文字起こし → 整理、今日聞く事、院内の道案内。
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Guide } from "@/components/visit/Guide";
import { Recorder } from "@/components/visit/Recorder";
import { Results } from "@/components/visit/Results";
import { StatusChip } from "@/components/visit/StatusChip";
import { looksStuck, type VisitStatus, type VisitView } from "@/lib/visit";

const STEPS: { key: VisitStatus; label: string; doing: string }[] = [
  { key: "recording", label: "録音", doing: "" },
  { key: "transcribing", label: "文字起こし", doing: "録音を文字にしています（家の機械で。外には出しません）" },
  { key: "organizing", label: "整理", doing: "Claude が先生の話を整理しています" },
  { key: "done", label: "できた", doing: "" },
];

export default function VisitDay() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [visit, setVisit] = useState<VisitView | null>(null);
  const [err, setErr] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<{ visit: VisitView }>(`/api/visit/${id}`);
      setVisit(r.visit);
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // 文字起こし・整理の間は3秒ごとに見に行く
  const processing = visit?.status === "transcribing" || visit?.status === "organizing";
  useEffect(() => {
    if (!processing) return;
    const t = setInterval(() => void load(), 3000);
    return () => clearInterval(t);
  }, [processing, load]);

  const retry = async () => {
    try {
      await api(`/api/visit/${id}/finish`, { body: {} });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const markAsked = async (itemId: string, asked: boolean) => {
    if (!visit) return;
    setVisit({ ...visit, agenda: visit.agenda?.map((a) => (a.id === itemId ? { ...a, asked } : a)) });
    try {
      await api(`/api/visit/${id}`, { method: "PATCH", body: { asked: { id: itemId, asked } } });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const del = async () => {
    try {
      await api(`/api/visit/${id}`, { method: "DELETE" });
      router.push("/visit");
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  if (!visit) {
    return (
      <main className="flex flex-col gap-4 px-4 pt-4">
        <Link href="/visit" className="text-sm text-muted">← 健診の一覧</Link>
        {err ? <p role="alert" className="text-sm text-alert">{err}</p> : <p className="text-sm text-muted">読み込んでいます…</p>}
      </main>
    );
  }

  const stuck = processing && !visit.running && looksStuck(visit, Date.now(), 3);
  const canRecord = visit.status === "ready" || visit.status === "recording" || (visit.status === "failed" && !visit.transcript);
  const stepIdx = STEPS.findIndex((s) => s.key === visit.status);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4 pb-6">
      <Link href="/visit" className="text-sm text-muted">← 健診の一覧</Link>
      <header className="flex flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip status={visit.status} />
          {visit.demo && <span className="rounded-full bg-sky-soft px-2 py-0.5 text-xs text-sky">デモ用の例（作った会話）</span>}
        </div>
        <h1 className="font-display text-2xl font-bold">
          {jpDate(visit.date)}の健診
        </h1>
        <p className="text-sm text-sky">{visit.label}</p>
      </header>

      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}

      {processing && (
        <section aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-sky bg-sky-soft p-4">
          <ol className="flex items-center gap-1 text-xs">
            {STEPS.map((s, i) => (
              <li key={s.key} className="flex flex-1 flex-col items-center gap-1">
                <span className={`h-1.5 w-full rounded-full ${i < stepIdx ? "bg-sky" : i === stepIdx ? "animate-pulse bg-sky" : "bg-line"}`} />
                <span className={i === stepIdx ? "font-semibold text-sky" : "text-muted"}>{s.label}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm font-semibold text-sky">{STEPS[stepIdx]?.doing}…</p>
          <p className="text-xs text-muted">
            {visit.status === "transcribing" ? "15分の録音で1〜2分ほど。" : "30秒〜1分ほど。"}この画面を閉じても、続きはサーバで進みます。
          </p>
          {stuck && (
            <button onClick={() => void retry()} className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper">
              止まっているようです。やり直す
            </button>
          )}
        </section>
      )}

      {visit.status === "failed" && (
        <section className="flex flex-col gap-2 rounded-xl border border-alert bg-alert/10 p-4">
          <p className="text-sm text-alert">{visit.error ?? "うまくいきませんでした"}</p>
          {(visit.transcript || visit.takes?.some((t) => t.chunks > 0)) && (
            <button onClick={() => void retry()} className="self-start rounded-lg bg-ink px-4 py-2 text-sm font-semibold text-paper">
              もう一度やってみる
            </button>
          )}
          <p className="text-xs text-muted">録音はこの手帳の中に残っています。</p>
        </section>
      )}

      {visit.status === "done" && <Results visit={visit} />}

      {canRecord && <Recorder visit={visit} onFinished={() => void load()} />}

      {visit.status !== "done" && visit.agenda && visit.agenda.length > 0 && (
        <section aria-label="今日聞く事" className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
          <h2 className="font-display text-lg font-bold">今日聞く事</h2>
          <p className="text-xs text-muted">聞けたら押しておくと、整理の時に先生の答えを探します。</p>
          <ul className="flex flex-col gap-2">
            {visit.agenda.map((a) => (
              <li key={a.id}>
                <label className="flex items-start gap-3 text-sm">
                  <input type="checkbox" checked={!!a.asked} onChange={(e) => void markAsked(a.id, e.target.checked)} className="mt-1 h-5 w-5 shrink-0 accent-[var(--rose)]" />
                  <span className={a.asked ? "text-muted line-through" : ""}>{a.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Guide visit={visit} onChange={(guide) => setVisit({ ...visit, guide })} />

      <div className="flex justify-end pt-2">
        {confirmDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span>録音も一緒に消えます。</span>
            <button onClick={() => void del()} className="rounded-lg bg-alert px-3 py-1.5 font-semibold text-white">消す</button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1.5 text-muted">やめる</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-muted underline">この健診の記録を消す</button>
        )}
      </div>
    </main>
  );
}
