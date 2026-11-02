"use client";

// 健診の録音。10秒ごとに一切れずつサーバへ送るので、途中でページが閉じても送れた所までは残る。
import { useEffect, useRef, useState } from "react";
import { extFromMime, extFromName, formatClock, pickMime, type VisitView } from "@/lib/visit";

type Phase = "idle" | "consent" | "starting" | "recording" | "paused" | "sending" | "importing";

const TIMESLICE = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function Recorder({ visit, onFinished }: { visit: VisitView; onFinished: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");
  const [, tick] = useState(0);
  const [level, setLevel] = useState(0);
  const [counts, setCounts] = useState({ made: 0, sent: 0 });
  const [backup, setBackup] = useState<{ url: string; name: string } | null>(null);

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const queue = useRef<{ seq: number; blob: Blob }[]>([]);
  const all = useRef<Blob[]>([]);
  const pumping = useRef(false);
  const seq = useRef(0);
  const take = useRef(0);
  const mime = useRef("");
  const startedAt = useRef(0);
  const before = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const elapsed = () => (before.current + (phase === "recording" && startedAt.current ? Date.now() - startedAt.current : 0)) / 1000;

  // 経過時間を進める
  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => tick((n) => n + 1), 500);
    return () => clearInterval(t);
  }, [phase]);

  // 録音中にページを閉じようとしたら止める
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === "recording" || phaseRef.current === "paused" || queue.current.length) e.preventDefault();
    };
    const onVis = () => {
      if (document.visibilityState === "visible" && (phaseRef.current === "recording" || phaseRef.current === "paused")) void lockScreen();
    };
    window.addEventListener("beforeunload", onBefore);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.removeEventListener("beforeunload", onBefore);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // 画面を離れたら、マイクと画面の鍵を返す
  useEffect(() => () => release(), []);

  async function lockScreen() {
    try {
      wake.current = (await navigator.wakeLock?.request("screen")) ?? null;
    } catch {
      // 画面の鍵が取れなくても録音は続ける
    }
  }

  function release() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    void audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    void wake.current?.release().catch(() => {});
    wake.current = null;
  }

  /** 送り待ちを順に送る。電波が切れたら待って送り直す */
  async function pump() {
    if (pumping.current) return;
    pumping.current = true;
    while (queue.current.length) {
      const c = queue.current[0];
      try {
        const r = await fetch(`/api/visit/${visit.id}/chunk?seq=${c.seq}&take=${take.current}&ext=${extFromMime(mime.current)}`, {
          method: "POST",
          headers: { "content-type": mime.current || "application/octet-stream" },
          body: c.blob,
        });
        if (r.status >= 400 && r.status < 500) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          queue.current.shift();
          setErr(j.error ?? `録音の一部を受け取ってもらえませんでした（${r.status}）`);
          continue;
        }
        if (!r.ok) throw new Error(String(r.status));
        queue.current.shift();
        setCounts((n) => ({ ...n, sent: n.sent + 1 }));
        setNetErr("");
      } catch {
        setNetErr("いま送れていません。録音は続いていて、電波が戻ったら自動で送ります");
        await sleep(3000);
      }
    }
    pumping.current = false;
  }

  async function begin() {
    setErr("");
    setPhase("starting");
    try {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error("この機械のブラウザでは録音ができません。下の「録音ファイルを取り込む」を使ってください");
      const m = pickMime((t) => MediaRecorder.isTypeSupported(t));
      const s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, autoGainControl: true, noiseSuppression: true } });
      stream.current = s;
      mime.current = m ?? "";
      const r = new MediaRecorder(s, { ...(m ? { mimeType: m } : {}), audioBitsPerSecond: 64_000 });
      if (!m) mime.current = r.mimeType;
      take.current = visit.takes?.length ?? 0;
      seq.current = 0;
      queue.current = [];
      all.current = [];
      setCounts({ made: 0, sent: 0 });
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        if (!mime.current && e.data.type) mime.current = e.data.type;
        queue.current.push({ seq: seq.current++, blob: e.data });
        all.current.push(e.data);
        setCounts((n) => ({ ...n, made: n.made + 1 }));
        void pump();
      };
      r.onstop = () => void afterStop();
      r.onerror = () => setErr("録音が止まりました。送れた所までは残っています");
      rec.current = r;
      r.start(TIMESLICE);
      startedAt.current = Date.now();
      before.current = 0;
      setPhase("recording");
      void lockScreen();
      meter(s);
      void fetch(`/api/visit/${visit.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ consent: true }) });
    } catch (e) {
      release();
      const name = (e as Error).name;
      setErr(
        name === "NotAllowedError"
          ? "マイクが使えません。ブラウザの設定で、このページのマイクを「許可」にしてください"
          : name === "NotFoundError"
            ? "マイクが見つかりません"
            : (e as Error).message || "録音を始められませんでした",
      );
      setPhase("idle");
    }
  }

  /** 声の大きさの目安（マイクが拾えているか見るため） */
  function meter(s: MediaStream) {
    try {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new Ctx();
      audioCtx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      const loop = () => {
        if (audioCtx.current !== ctx) return;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const v of buf) sum += ((v - 128) / 128) ** 2;
        setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
        setTimeout(loop, 150);
      };
      loop();
    } catch {
      // 目安が出せなくても録音は続ける
    }
  }

  function pause() {
    if (rec.current?.state !== "recording") return;
    rec.current.pause();
    before.current += Date.now() - startedAt.current;
    startedAt.current = 0;
    setPhase("paused");
  }

  function resume() {
    if (rec.current?.state !== "paused") return;
    rec.current.resume();
    startedAt.current = Date.now();
    setPhase("recording");
  }

  function stop() {
    if (!rec.current || rec.current.state === "inactive") return;
    if (startedAt.current) before.current += Date.now() - startedAt.current;
    startedAt.current = 0;
    setPhase("sending");
    rec.current.stop();
  }

  async function afterStop() {
    release();
    setLevel(0);
    if (all.current.length) {
      const name = `健診-${visit.date}.${extFromMime(mime.current)}`;
      setBackup({ url: URL.createObjectURL(new Blob(all.current, { type: mime.current })), name });
    }
    // 最後の一切れが届くまで待つ
    await sleep(50);
    while (queue.current.length || pumping.current) await sleep(500);
    await finish();
  }

  async function finish() {
    try {
      const r = await fetch(`/api/visit/${visit.id}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `うまくいきませんでした（${r.status}）`);
      onFinished();
    } catch (e) {
      setErr(`文字起こしを始められませんでした: ${(e as Error).message}`);
      setPhase("idle");
    }
  }

  async function importFile(file: File) {
    setErr("");
    setPhase("importing");
    try {
      const ext = extFromName(file.name) ?? extFromMime(file.type);
      const t = visit.takes?.length ?? 0;
      const r = await fetch(`/api/visit/${visit.id}/chunk?seq=0&take=${t}&ext=${ext}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? `送れませんでした（${r.status}）`);
      await finish();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  const sentSome = (visit.takes ?? []).some((t) => t.chunks > 0);
  const live = phase === "recording" || phase === "paused";

  return (
    <section aria-label="録音" className="flex flex-col gap-4 rounded-xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold">先生の話を録音する</h2>

      {phase === "idle" && (
        <>
          {sentSome && (
            <p className="rounded-lg bg-sky-soft px-3 py-2 text-sm text-sky">
              前に録った分（{(visit.takes ?? []).reduce((n, t) => n + t.chunks, 0) * 10}秒ほど）が届いています。続きを録るか、このまま整理できます。
            </p>
          )}
          <button onClick={() => setPhase("consent")} className="rounded-full bg-rose py-5 font-display text-xl font-bold text-white">
            {sentSome ? "続きを録音する" : "録音を始める"}
          </button>
          {sentSome && (
            <button onClick={() => void finish()} className="rounded-lg border border-ink py-2 text-sm font-semibold">
              録った分を整理する
            </button>
          )}
        </>
      )}

      {phase === "consent" && (
        <div className="flex flex-col gap-3 rounded-xl bg-rose-soft p-4">
          <p className="font-display text-lg font-bold leading-snug">先生に「録音してもいいですか」と聞きましたか？</p>
          <p className="text-sm text-muted">録音は家族があとで聞き返すためだけに使い、この手帳の中に置きます。</p>
          <div className="flex gap-2">
            <button onClick={() => void begin()} className="flex-1 rounded-lg bg-rose py-3 font-semibold text-white">聞いた。始める</button>
            <button onClick={() => setPhase("idle")} className="rounded-lg border border-line bg-card px-4 py-3 text-sm">まだ</button>
          </div>
        </div>
      )}

      {phase === "starting" && <p className="text-sm text-muted">マイクを準備しています…</p>}

      {(live || phase === "sending") && (
        <div className="flex flex-col items-center gap-3">
          <p className="flex items-center gap-2 text-sm font-semibold text-rose">
            <span className={`inline-block h-3 w-3 rounded-full bg-rose ${phase === "recording" ? "animate-pulse" : "opacity-40"}`} />
            {phase === "recording" ? "録音中" : phase === "paused" ? "一時停止中" : "残りを送っています…"}
          </p>
          <p className="tabular font-display text-6xl font-bold" aria-live="off">{formatClock(elapsed())}</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-rose transition-[width] duration-150" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <p className="tabular text-xs text-muted">
            送った {counts.sent} / 録った {counts.made}（10秒ずつ）・画面はつけたままでOK
          </p>
          {live && (
            <div className="flex w-full gap-2">
              {phase === "recording" ? (
                <button onClick={pause} className="rounded-lg border border-line px-4 py-3 text-sm">一時停止</button>
              ) : (
                <button onClick={resume} className="rounded-lg border border-rose px-4 py-3 text-sm text-rose">再開</button>
              )}
              <button onClick={stop} className="flex-1 rounded-lg bg-ink py-3 font-semibold text-paper">止めて整理する</button>
            </div>
          )}
        </div>
      )}

      {phase === "importing" && <p className="text-sm text-muted">録音ファイルを送っています…（長い録音は少しかかります）</p>}

      {netErr && <p className="rounded-lg bg-warn/15 px-3 py-2 text-sm text-warn">{netErr}</p>}
      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}

      {backup && (
        <a href={backup.url} download={backup.name} className="text-center text-xs text-muted underline">
          念のため、この端末にも録音を保存する
        </a>
      )}

      {phase === "idle" && (
        <label className="cursor-pointer text-center text-xs text-muted underline">
          録音ファイルを取り込む（ボイスメモなど）
          <input
            type="file"
            accept="audio/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) void importFile(f);
            }}
          />
        </label>
      )}
    </section>
  );
}
