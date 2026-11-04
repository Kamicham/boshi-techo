"use client";

// 声を録る小さな道具（声を残す・手紙に声を添える の両方で使う）。押して始め、もう一度押して止める。
// 録った声は端末の中の Blob のまま返す（どこへも送らない。送るのは使う側）。録音中は全画面の印を立てる（タブで移らないように）。
import { useCallback, useEffect, useRef, useState } from "react";
import { pickAudioType } from "./media";
import { setRecordingBusy } from "@/lib/recording-state";

export interface Recorded {
  blob: Blob;
  sec: number;
}

export function useRecorder(opts: { maxSec?: number; onDone: (r: Recorded) => void }) {
  const [recording, setRecording] = useState(false);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const done = useRef(opts.onDone);
  done.current = opts.onDone;

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
    rec.current = null;
  }, []);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSecs(s);
      if (opts.maxSec && s >= opts.maxSec) stop();
    }, 250);
    return () => clearInterval(t);
  }, [recording, opts.maxSec, stop]);
  useEffect(
    () => () => {
      rec.current?.stream.getTracks().forEach((t) => t.stop());
      setRecordingBusy(false);
    },
    [],
  );

  const start = useCallback(async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") return setError("この機械では録音が使えません");
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return setError("マイクが使えませんでした。ブラウザの設定でマイクを許可してください");
    }
    const type = pickAudioType();
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      setRecording(false);
      setRecordingBusy(false);
      const sec = (Date.now() - startedAt.current) / 1000;
      if (sec < 1) return setError("短すぎました。もう一度どうぞ");
      done.current({ blob: new Blob(chunks, { type: r.mimeType || type || "audio/webm" }), sec });
    };
    rec.current = r;
    startedAt.current = Date.now();
    setSecs(0);
    r.start();
    setRecording(true);
    setRecordingBusy(true);
  }, []);

  return { recording, secs, error, setError, start, stop };
}
