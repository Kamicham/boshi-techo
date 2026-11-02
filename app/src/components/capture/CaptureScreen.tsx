"use client";

// ① 入力ゼロ: 話すだけ・撮るだけで、記録と予定になる。
// 開いた瞬間に出すのは「話す」「撮る」の2つだけ。記録の一覧は下に畳む。
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import type { CaptureRecord, CaptureResult, RecordSource } from "@/lib/capture";
import { HoldToTalk } from "./HoldToTalk";
import { shrinkPhoto } from "./media";
import { RecordItem, Timeline } from "./Timeline";

type Last = CaptureResult & { transcript?: string; source: RecordSource };

/** いつも出しておく連絡先（固定の文。消さない） */
const CALL_LINE = "急ぎの時は 産院（夜間も）・119。子どもは #8000";

/** 文字起こしまではできたが、手帳に書けなかった時のエラー */
class VoiceError extends Error {
  transcript: string;
  constructor(message: string, transcript: string) {
    super(message);
    this.transcript = transcript;
  }
}

export function CaptureScreen() {
  const { family, today, isDemo } = useFamily();
  const [records, setRecords] = useState<CaptureRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
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
      if (e instanceof VoiceError) {
        // 聞き取った言葉は書く欄に入れて、送り直せるようにする
        setText((cur) => (cur.trim() ? `${cur.trim()}\n${e.transcript}` : e.transcript));
        setWriting(true);
      }
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const sendVoice = (blob: Blob) =>
    run("聞き取っています", async () => {
      const r = await fetch(`/api/capture/voice?familyId=${encodeURIComponent(family.id)}&today=${today}`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const j = (await r.json().catch(() => ({}))) as Last & { error?: string };
      if (!r.ok) {
        const msg = j.error ?? `うまくいきませんでした（${r.status}）`;
        if (j.transcript) throw new VoiceError(msg, j.transcript);
        throw new Error(msg);
      }
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
    await run("紙を読んでいます", async () => ({
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
    if (ok) {
      setText("");
      setWriting(false);
    }
  };

  const sendAnswer = async () => {
    if (!last?.oneQuestion || !answer.trim()) return;
    const prev = last;
    await run("書き直しています", async () => ({
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
    <main className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="sr-only">話す・撮る</h1>
      <p className="text-base text-muted">話すだけ・撮るだけで、手帳に書きます</p>

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
          <span className="text-sm text-muted">届いた紙・健診の紙</span>
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

      <p className="text-sm font-semibold text-alert">{CALL_LINE}</p>

      {busy && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-sky-soft px-4 py-4 text-lg font-semibold text-sky">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-sky" />
          {busy}…<span className="tabular text-sm font-normal text-muted">{secs}秒</span>
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-2xl bg-alert/10 px-4 py-3 text-base text-alert">
          {error}
        </p>
      )}

      {last && !busy && (
        <section aria-label="いま書いた事" className="flex flex-col gap-3 rounded-2xl bg-rose-soft p-5">
          <p className="font-display text-xl leading-relaxed font-bold">{last.reply}</p>
          {last.oneQuestion && (
            <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
              <label htmlFor="capture-answer" className="text-base font-semibold">
                {last.oneQuestion}
              </label>
              <div className="flex gap-2">
                <input
                  id="capture-answer"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && void sendAnswer()}
                  className="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-base"
                />
                <Btn onClick={() => void sendAnswer()} disabled={!answer.trim()}>
                  答える
                </Btn>
              </div>
            </div>
          )}
          {last.records.length > 0 && (
            <ul className="flex flex-col gap-2">
              {last.records.map((r) => (
                <RecordItem key={r.id} r={r} family={family} today={today} />
              ))}
            </ul>
          )}
          {last.transcript && (
            <Why label="聞き取った言葉">
              <p>「{last.transcript}」</p>
            </Why>
          )}
        </section>
      )}

      {writing ? (
        <section className="flex flex-col gap-2">
          <label htmlFor="capture-text" className="text-sm font-semibold text-muted">
            書いて入れる
          </label>
          <textarea
            id="capture-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: 来週の火曜に保育園の見学"
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-base"
          />
          <div className="flex justify-end gap-2">
            <Btn kind="quiet" onClick={() => setWriting(false)}>
              やめる
            </Btn>
            <Btn onClick={() => void sendText()} disabled={!!busy || !text.trim()}>
              手帳に書く
            </Btn>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Btn kind="secondary" onClick={() => setWriting(true)}>
            声を出せない時は書く
          </Btn>
          {isDemo && !hasSeed && (
            <Btn kind="quiet" onClick={() => void seed()}>
              デモの記録を入れる
            </Btn>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pb-6">
        <Timeline records={records} family={family} today={today} isDemo={isDemo} />
      </div>
    </main>
  );
}

function CameraIcon() {
  return (
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
