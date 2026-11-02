"use client";

// ① 入力ゼロ: 話すだけ・撮るだけで、記録と予定になる
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import type { CaptureRecord, CaptureResult, RecordSource } from "@/lib/capture";
import { HoldToTalk } from "./HoldToTalk";
import { shrinkPhoto } from "./media";
import { RecordItem, Timeline } from "./Timeline";

type Last = CaptureResult & { transcript?: string; source: RecordSource };

export function CaptureScreen() {
  const { family, today, isDemo } = useFamily();
  const [records, setRecords] = useState<CaptureRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState("");
  const [last, setLast] = useState<Last | null>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const j = await api<{ records: CaptureRecord[] }>(`/api/capture?familyId=${encodeURIComponent(family.id)}`);
      setRecords(j.records);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [family.id]);

  useEffect(() => {
    setLast(null);
    void load();
  }, [load]);

  useEffect(() => {
    if (!busy) return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  /** 待ちの長い処理を、いま何をしているかを出しながら走らせる */
  const run = async (label: string, fn: () => Promise<Last>) => {
    setError("");
    setBusy(label);
    try {
      const r = await fn();
      setLast(r);
      setAnswer("");
      await load();
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const sendVoice = (blob: Blob) =>
    run("聞き取って、手帳に書いています", async () => {
      const r = await fetch(`/api/capture/voice?familyId=${encodeURIComponent(family.id)}&today=${today}`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const j = (await r.json().catch(() => ({}))) as Last & { error?: string };
      if (!r.ok) throw new Error(j.error ?? `うまくいきませんでした（${r.status}）`);
      return { ...j, source: "voice" };
    });

  const sendPhoto = async (file: File) => {
    let image: string;
    try {
      image = await shrinkPhoto(file);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    await run("写真の紙を読んでいます", async () => ({
      ...(await api<CaptureResult>("/api/capture/photo", { body: { familyId: family.id, today, image } })),
      source: "photo",
    }));
  };

  const sendText = async () => {
    const t = text.trim();
    if (!t) return;
    const ok = await run("手帳に書いています", async () => ({
      ...(await api<CaptureResult>("/api/capture", { body: { familyId: family.id, today, text: t } })),
      source: "text",
    }));
    if (ok) setText("");
  };

  const sendAnswer = async () => {
    if (!last?.oneQuestion || !answer.trim()) return;
    const prev = last;
    await run("答えと合わせて書き直しています", async () => ({
      ...(await api<CaptureResult>("/api/capture/answer", {
        body: { familyId: family.id, today, captureId: prev.captureId, basis: prev.basis, question: prev.oneQuestion, answer, source: prev.source },
      })),
      source: prev.source,
    }));
  };

  const seed = async () => {
    setError("");
    try {
      await api("/api/capture/seed", { body: { familyId: family.id } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const hasSeed = records.some((r) => r.data.seed);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">話す・撮る</h1>
        <p className="text-sm text-muted">
          思った事を話すだけ、届いた紙を撮るだけ。日付をつけて手帳に書き、期限は予定にします。
          <span className="tabular">（今日 {jpDate(today)}）</span>
        </p>
      </header>

      <section aria-label="入れる" className="grid grid-cols-2 gap-3">
        <HoldToTalk disabled={!!busy} onAudio={(b) => void sendVoice(b)} onError={setError} />
        <button
          type="button"
          disabled={!!busy}
          onClick={() => photoInput.current?.click()}
          className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 border-sky bg-sky-soft text-sky disabled:opacity-50"
        >
          <CameraIcon />
          <span className="font-display text-2xl font-bold">撮る</span>
          <span className="text-xs text-muted">封筒・通知・健診の紙</span>
        </button>
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) void sendPhoto(f);
          }}
        />
      </section>

      <section className="flex flex-col gap-2">
        <label htmlFor="capture-text" className="text-xs font-semibold text-muted">
          声を出せない時は、ここに書いても
        </label>
        <textarea
          id="capture-text"
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例: 来週の火曜に保育園の見学。最近よく足がつる"
          className="w-full rounded-lg border border-line bg-card px-3 py-2 text-sm"
        />
        <button onClick={() => void sendText()} disabled={!!busy || !text.trim()} className="self-end rounded-lg bg-ink px-4 py-1.5 text-sm font-semibold text-paper disabled:opacity-40">
          手帳に書く
        </button>
      </section>

      {busy && (
        <p role="status" className="flex items-center gap-2 rounded-xl bg-sky-soft px-4 py-3 text-sm text-sky">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky" />
          {busy}…<span className="tabular text-xs text-muted">{secs}秒</span>
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-alert/10 px-4 py-3 text-sm text-alert">
          {error}
        </p>
      )}

      {last && !busy && (
        <section aria-label="いま書いた事" className="flex flex-col gap-3 rounded-2xl border border-rose/40 bg-rose-soft/50 p-4">
          <p className="font-display text-base font-bold leading-relaxed">{last.reply}</p>
          {last.transcript && <p className="text-xs text-muted">聞き取った言葉: 「{last.transcript}」</p>}
          {last.records.length > 0 && (
            <ul className="flex flex-col gap-2">
              {last.records.map((r) => (
                <RecordItem key={r.id} r={r} family={family} />
              ))}
            </ul>
          )}
          {last.oneQuestion && (
            <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
              <label htmlFor="capture-answer" className="text-sm font-semibold">
                ひとつだけ教えてください: {last.oneQuestion}
              </label>
              <div className="flex gap-2">
                <input
                  id="capture-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void sendAnswer()}
                  className="min-w-0 flex-1 rounded-lg border border-line px-3 py-2 text-sm"
                />
                <button onClick={() => void sendAnswer()} disabled={!answer.trim()} className="rounded-lg bg-rose px-4 text-sm font-semibold text-white disabled:opacity-40">
                  答える
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {isDemo && !hasSeed && (
        <button onClick={() => void seed()} className="self-start rounded-full border border-line px-3 py-1 text-xs text-muted hover:border-rose hover:text-rose">
          デモ: 作った家族の1000日の記録を入れる
        </button>
      )}

      <div className="flex flex-col gap-5 pb-6">
        <Timeline records={records} family={family} today={today} isDemo={isDemo} />
      </div>
    </main>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
