"use client";

// 押している間だけ録音する大きなボタン
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { pickAudioType } from "./media";

type Phase = "idle" | "starting" | "recording";

export function HoldToTalk({ disabled, onAudio, onError }: { disabled: boolean; onAudio: (blob: Blob) => void; onError: (msg: string) => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const holding = useRef(false);
  const startedAt = useRef(0);

  useEffect(() => {
    if (phase !== "recording") return;
    const timer = setInterval(() => setSecs(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(timer);
  }, [phase]);

  const start = async () => {
    if (disabled || phase !== "idle") return;
    holding.current = true;
    setPhase("starting");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("idle");
      onError(t("この機械では録音が使えません。下の欄に書いてください"));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("idle");
      onError(t("マイクが使えませんでした。ブラウザの設定でマイクを許可してください"));
      return;
    }
    // 許可を待つ間に指を離していたら、録らずに終える
    if (!holding.current) {
      stream.getTracks().forEach((track) => track.stop());
      setPhase("idle");
      onError(t("押している間だけ録音します。もう一度、押したまま話してください"));
      return;
    }
    const type = pickAudioType();
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const ms = Date.now() - startedAt.current;
      setPhase("idle");
      setSecs(0);
      if (ms < 700) return onError(t("短すぎました。押したまま話してください"));
      onAudio(new Blob(chunks, { type: r.mimeType || type || "audio/webm" }));
    };
    rec.current = r;
    startedAt.current = Date.now();
    r.start();
    setPhase("recording");
  };

  const stop = () => {
    holding.current = false;
    if (rec.current && rec.current.state === "recording") rec.current.stop();
    rec.current = null;
  };

  const on = phase === "recording";
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        void start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.key === " " || e.key === "Enter") && !e.repeat) {
          e.preventDefault();
          void start();
        }
      }}
      onKeyUp={(e) => (e.key === " " || e.key === "Enter") && stop()}
      aria-pressed={on}
      className={`flex min-h-36 w-full touch-none px-1 select-none flex-col items-center justify-center gap-1 rounded-3xl border-2 transition [-webkit-touch-callout:none] disabled:opacity-50 ${
        on ? "scale-[0.97] border-rose bg-rose text-white" : "border-rose bg-rose-soft text-rose"
      }`}
    >
      <MicIcon />
      <span className="font-display text-xl font-bold">{t(on ? "話しています" : phase === "starting" ? "マイク準備中" : "話す")}</span>
      <span className={`tabular text-xs ${on ? "text-white/90" : "text-muted"}`}>{on ? t("{n}秒・指を離すと送ります", { n: secs }) : t("押している間")}</span>
    </button>
  );
}

function MicIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </svg>
  );
}
