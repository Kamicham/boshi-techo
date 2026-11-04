"use client";

// 声を残す（思い出の録り方）。押して始め、もう一度押して止める（長く話せるように）。
// 残した声は世帯の鍵で守って置き、Claude には送らない（記録の振り分けにもかけない）。文字にするのは自宅の機械だけ。
// 根拠: 紙の母子手帳の「迎える気持ち」「誕生日のメッセージ」は文字の欄だけ（府令様式・こども家庭庁 令和5年度改正）。声はここで足す。
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { pickAudioType } from "@/components/capture/media";
import { VOICE_MOMENTS, type ClientMedia } from "@/lib/media-shared";
import { invalidateMedia } from "./useMedia";

type Moment = (typeof VOICE_MOMENTS)[number];

export function VoiceKeeper({ unavailable }: { unavailable?: boolean }) {
  const [moment, setMoment] = useState<Moment | null>(null);
  const { family } = useFamily();
  if (unavailable) return null;
  // つらい別れの後（静かにする）は、促す言葉を使わない。残したい時だけ残せる
  const loss = family.situation?.quiet === "loss";
  return (
    <section aria-label="声を残す" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <h2 className="font-display text-lg font-bold">声を残す</h2>
      <p className="text-sm text-muted">
        {loss ? "残したい時だけ、声のまま残せます。消さずにしまうこともできます。" : "手帳には書かず、声のまま残します。一冊と映画で、いつか子どもが聞けます。"}
      </p>
      <div className="grid grid-cols-3 gap-2">
        {VOICE_MOMENTS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMoment(m)}
            className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-rose/40 bg-rose-soft px-1 py-2 text-center"
          >
            <span className="text-sm font-bold text-rose">{m.label}</span>
            <span className="text-xs text-muted">{m.hint}</span>
          </button>
        ))}
      </div>
      {moment && <VoiceSheet moment={moment} onClose={() => setMoment(null)} />}
    </section>
  );
}

type Phase = "idle" | "recording" | "saving" | "done";

function VoiceSheet({ moment, onClose }: { moment: Moment; onClose: () => void }) {
  const { family, today, me } = useFamily();
  const [phase, setPhase] = useState<Phase>("idle");
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState<ClientMedia | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const startedAt = useRef(0);
  const child = family.childName ?? "赤ちゃん";

  useEffect(() => {
    if (phase !== "recording") return;
    const t = setInterval(() => setSecs(Math.floor((Date.now() - startedAt.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [phase]);
  useEffect(() => () => rec.current?.stream.getTracks().forEach((t) => t.stop()), []);

  const start = async () => {
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
      const sec = (Date.now() - startedAt.current) / 1000;
      if (sec < 1) {
        setPhase("idle");
        return setError("短すぎました。もう一度どうぞ");
      }
      void save(new Blob(chunks, { type: r.mimeType || type || "audio/webm" }), sec);
    };
    rec.current = r;
    startedAt.current = Date.now();
    setSecs(0);
    r.start();
    setPhase("recording");
  };

  const stop = () => {
    if (rec.current?.state === "recording") rec.current.stop();
    rec.current = null;
  };

  const save = async (blob: Blob, sec: number) => {
    setPhase("saving");
    try {
      const qs = new URLSearchParams({ familyId: family.id, today, moment: moment.id, sec: sec.toFixed(1), ...(me?.name ? { who: me.name } : {}) });
      const r = await fetch(`/api/media/voice?${qs}`, { method: "POST", headers: { "content-type": blob.type || "application/octet-stream" }, body: blob });
      const j = (await r.json().catch(() => ({}))) as { media?: ClientMedia; error?: string };
      if (!r.ok || !j.media) throw new Error(j.error ?? `残せませんでした（${r.status}）`);
      setSaved(j.media);
      setPhase("done");
      invalidateMedia();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const on = phase === "recording";
  const prompt =
    moment.id === "belly" ? `おなかの${child}に、今日の事を話してみてください` : moment.id === "bedtime" ? `${child}に、今日のおやすみを` : `${child}の名前を、呼んでみてください`;

  return (
    <div role="dialog" aria-modal="true" aria-label={moment.label} className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={phase === "recording" ? undefined : onClose}>
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-card px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-bold">{moment.label}</h3>
        {phase === "done" && saved ? (
          <>
            <p className="text-base">
              残しました（<span className="tabular">{Math.round(saved.durationSec ?? secs)}</span>秒）。アルバムの{saved.date.slice(5, 7).replace(/^0/, "")}月に並びます。
            </p>
            {saved.transcript && <p className="rounded-xl bg-paper px-3 py-2 text-sm text-muted">「{saved.transcript}」</p>}
            <Btn full href={`/album?voice=${encodeURIComponent(saved.id)}`}>
              アルバムで聞く
            </Btn>
            <div className="flex gap-2">
              <Btn kind="secondary" onClick={() => { setSaved(null); setPhase("idle"); setSecs(0); }}>
                もう1つ
              </Btn>
              <Btn kind="quiet" onClick={onClose}>
                閉じる
              </Btn>
            </div>
          </>
        ) : (
          <>
            <p className="text-base">{prompt}</p>
            <button
              type="button"
              disabled={phase === "saving"}
              onClick={() => (on ? stop() : void start())}
              aria-pressed={on}
              className={`flex min-h-28 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-rose transition disabled:opacity-50 ${on ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
            >
              <span className="font-display text-2xl font-bold">{on ? "止める" : phase === "saving" ? "残しています…" : "録る"}</span>
              <span className={`tabular text-sm ${on ? "text-white/90" : "text-muted"}`}>{on ? `${secs}秒・押すと止めて残します` : "押して話し始め、もう一度押して止めます"}</span>
            </button>
            {error && <p className="text-sm text-alert">{error}</p>}
            <p className="text-xs text-muted">
              声は家族の鍵で守って、この手帳の中だけに残します。AI（Claude）には送りません。文字にするのは手帳の機械だけです。消したい時はアルバムから消せます。
            </p>
            {phase !== "recording" && (
              <Link href="/album" className="text-sm text-muted underline-offset-2 hover:underline">
                残した声を聞く ›
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
