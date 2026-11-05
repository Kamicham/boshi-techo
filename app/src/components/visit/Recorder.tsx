"use client";

// 健診の録音。10秒ごとに一切れずつサーバへ送るので、途中でページが閉じても送れた所までは残る。
import { useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { extFromMime, extFromName, formatClock, pickMime, type VisitView } from "@/lib/visit";
import { setRecordingBusy } from "@/lib/recording-state";

type Phase = "idle" | "consent" | "starting" | "recording" | "paused" | "sending" | "importing";

const TIMESLICE = 10_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// 出す時に t() で訳す（辞書の鍵）
const WAKE_WARN = "この端末は画面を消さない設定が使えません。自動ロックで画面が消えると録音が止まります。設定 > 画面表示と明るさ > 自動ロック を「なし」にしてください";
/** マイクが止められた時の知らせ（マイクが戻ったら、この知らせだけを消す。訳した文で見分ける） */
const MIC_MUTED = "マイクが止められています（画面が消えた・ほかのアプリ・着信など）。この画面に戻ると続きを録ります";

/** 新しい録音の番号をサーバで確保する。電波が無い時は手元の番号で進める */
async function reserveTake(visitId: string, fallback: number): Promise<number> {
  try {
    const r = await fetch(`/api/visit/${visitId}/take`, { method: "POST", signal: AbortSignal.timeout(8000) });
    const j = (await r.json().catch(() => ({}))) as { take?: number; error?: string };
    if (r.status === 409) throw Object.assign(new Error(j.error ?? t("この健診はもう文字起こしを始めています")), { fatal: true });
    if (r.ok && typeof j.take === "number") return Math.max(j.take, fallback);
  } catch (e) {
    if ((e as { fatal?: boolean }).fatal) throw e;
  }
  return fallback;
}

export function Recorder({ visit, onFinished }: { visit: VisitView; onFinished: () => void }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");
  const [, tick] = useState(0);
  const [level, setLevel] = useState(0);
  const [counts, setCounts] = useState({ made: 0, sent: 0 });
  const [backup, setBackup] = useState<{ url: string; name: string } | null>(null);
  const [warn, setWarn] = useState("");
  const [wakeWarn, setWakeWarn] = useState("");

  const rec = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const queue = useRef<{ take: number; seq: number; blob: Blob }[]>([]);
  const all = useRef<Blob[]>([]);
  const pumping = useRef(false);
  const seq = useRef(0);
  const take = useRef(0);
  /** 次に使ってよい録音の番号（画面の情報が古くても前の録音を上書きしないため） */
  const nextTake = useRef(0);
  /** 本人が「止める」を押したか（着信などで止められた時と分ける） */
  const userStopped = useRef(false);
  const hiddenAt = useRef(0);
  /** 最後に声らしい音を拾った時刻（無音が続いたら知らせる） */
  const lastSound = useRef(0);
  const [silent, setSilent] = useState(false);
  const mime = useRef("");
  const startedAt = useRef(0);
  const before = useRef(0);
  const phaseRef = useRef<Phase>("idle");
  phaseRef.current = phase;

  const live = phase === "recording" || phase === "paused";

  // 録音中・送り中は、下のタブなどで別の画面へ移れないようにする
  useEffect(() => {
    setRecordingBusy(live || phase === "sending");
  }, [live, phase]);
  useEffect(() => () => setRecordingBusy(false), []);

  const elapsed = () => (before.current + (phase === "recording" && startedAt.current ? Date.now() - startedAt.current : 0)) / 1000;

  // 経過時間を進め、無音が10秒続いたら知らせる（マイクが取られている・塞がれている時）
  useEffect(() => {
    if (phase !== "recording") {
      setSilent(false);
      return;
    }
    lastSound.current = Date.now();
    const t = setInterval(() => {
      tick((n) => n + 1);
      setSilent(Date.now() - lastSound.current > 10_000);
    }, 500);
    return () => clearInterval(t);
  }, [phase]);

  // 録音中にページを閉じようとしたら止める
  useEffect(() => {
    const onBefore = (e: BeforeUnloadEvent) => {
      if (phaseRef.current === "recording" || phaseRef.current === "paused" || queue.current.length) e.preventDefault();
    };
    const onVis = () => {
      const on = phaseRef.current === "recording" || phaseRef.current === "paused";
      if (!on) return;
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      void lockScreen();
      // iPhone は画面が隠れている間マイクを止めるので、録れていない時間を知らせる
      if (hiddenAt.current && phaseRef.current === "recording") {
        const sec = Math.round((Date.now() - hiddenAt.current) / 1000);
        const time = sec >= 60 ? t("{m}分{s}秒", { m: Math.floor(sec / 60), s: sec % 60 }) : t("{n}秒", { n: sec });
        if (sec >= 3) setWarn(t("画面が消えていた・ほかのアプリにいた {time}ほどは、録れていないかもしれません", { time }));
      }
      hiddenAt.current = 0;
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
      if (!navigator.wakeLock) throw new Error("no wake lock");
      wake.current = await navigator.wakeLock.request("screen");
      setWakeWarn("");
    } catch {
      // 画面の鍵が取れなくても録音は続けるが、自動ロックで止まる事を知らせる
      setWakeWarn(t(WAKE_WARN));
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
    let refused = 0;
    while (queue.current.length) {
      const c = queue.current[0];
      try {
        const r = await fetch(`/api/visit/${visit.id}/chunk?seq=${c.seq}&take=${c.take}&ext=${extFromMime(mime.current)}`, {
          method: "POST",
          headers: { "content-type": mime.current || "application/octet-stream" },
          body: c.blob,
          // 電波の切り替わりで通信が固まっても、30秒で見切って送り直す
          signal: AbortSignal.timeout(30_000),
        });
        if (r.status >= 400 && r.status < 500) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          // 頭の一切れが抜けると録音全体が読めなくなるので、何回か送り直す
          if (c.seq === 0 && r.status !== 409 && ++refused < 5) {
            await sleep(2000);
            continue;
          }
          refused = 0;
          queue.current.shift();
          setErr(j.error ?? t("録音の一部を受け取ってもらえませんでした（{status}）。念のため、下の「この端末にも録音を保存する」を押してください", { status: r.status }));
          continue;
        }
        if (!r.ok) throw new Error(String(r.status));
        queue.current.shift();
        setCounts((n) => ({ ...n, sent: n.sent + 1 }));
        setNetErr("");
      } catch {
        setNetErr(
          phaseRef.current === "recording" || phaseRef.current === "paused"
            ? t("いま送れていません。録音は続いていて、電波が戻ったら自動で送ります")
            : t("残りを送れていません。電波が戻ったら自動で送ります。急ぐ時は下の「この端末にも録音を保存する」を押してください"),
        );
        await sleep(3000);
      }
    }
    pumping.current = false;
  }

  async function begin() {
    setErr("");
    setWarn("");
    setPhase("starting");
    try {
      if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) throw new Error(t("この機械のブラウザでは録音ができません。下の「録音ファイルを取り込む」を使ってください"));
      const m = pickMime((t) => MediaRecorder.isTypeSupported(t));
      const s = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, autoGainControl: true, noiseSuppression: true } });
      stream.current = s;
      mime.current = m ?? "";
      const r = new MediaRecorder(s, { ...(m ? { mimeType: m } : {}), audioBitsPerSecond: 64_000 });
      if (!m) mime.current = r.mimeType;
      take.current = await reserveTake(visit.id, Math.max(visit.takes?.length ?? 0, nextTake.current));
      nextTake.current = take.current + 1;
      seq.current = 0;
      userStopped.current = false;
      all.current = [];
      setCounts({ made: 0, sent: 0 });
      const thisTake = take.current;
      r.ondataavailable = (e) => {
        if (!e.data.size) return;
        if (!mime.current && e.data.type) mime.current = e.data.type;
        queue.current.push({ take: thisTake, seq: seq.current++, blob: e.data });
        all.current.push(e.data);
        setCounts((n) => ({ ...n, made: n.made + 1 }));
        void pump();
      };
      r.onstop = () => void (userStopped.current ? afterStop() : afterInterrupt());
      r.onerror = () => setErr(t("録音が止まりました。送れた所までは残っています"));
      // マイクが取り上げられた（着信・ほかのアプリ）時は、録音を区切って続きを録れるようにする
      for (const track of s.getAudioTracks()) {
        track.onended = () => {
          if (rec.current === r && r.state !== "inactive") r.stop();
        };
        track.onmute = () => {
          if (rec.current === r && r.state === "recording") setWarn(t(MIC_MUTED));
        };
        track.onunmute = () => setWarn((w) => (w === t(MIC_MUTED) ? "" : w));
      }
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
          ? t("マイクが使えません。ブラウザの設定で、このページのマイクを「許可」にしてください")
          : name === "NotFoundError"
            ? t("マイクが見つかりません")
            : (e as Error).message || t("録音を始められませんでした"),
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
        const lv = Math.min(1, Math.sqrt(sum / buf.length) * 4);
        setLevel(lv);
        if (lv > 0.02) lastSound.current = Date.now();
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
    userStopped.current = true;
    setPhase("sending");
    rec.current.stop();
  }

  function keepBackup() {
    if (!all.current.length) return;
    const name = t("健診-{date}-{n}.{ext}", { date: visit.date, n: take.current + 1, ext: extFromMime(mime.current) });
    setBackup({ url: URL.createObjectURL(new Blob(all.current, { type: mime.current })), name });
  }

  async function afterStop() {
    release();
    setLevel(0);
    keepBackup();
    // 最後の一切れが届くまで待つ
    await sleep(50);
    while (queue.current.length || pumping.current) await sleep(500);
    await finish();
  }

  /** 着信・画面のロックなどで録音が止められた時: 整理は始めず、続きを録れるようにする */
  async function afterInterrupt() {
    release();
    setLevel(0);
    keepBackup();
    if (startedAt.current) before.current += Date.now() - startedAt.current;
    startedAt.current = 0;
    setWarn("");
    setErr(t("録音が途切れました（着信・ほかのアプリ・画面のロックなど）。録れた所までは残っています。「続きを録音する」で続けられます"));
    setPhase("idle");
    await sleep(50);
    while (queue.current.length || pumping.current) await sleep(500);
    onFinished();
  }

  async function finish() {
    try {
      let r: Response;
      try {
        r = await fetch(`/api/visit/${visit.id}/finish`, { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: AbortSignal.timeout(30_000) });
      } catch {
        throw new Error(t("通信できませんでした。電波が戻ったら「録った分を整理する」を押してください"));
      }
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? t("うまくいきませんでした（{status}）", { status: r.status }));
      onFinished();
    } catch (e) {
      setErr(t("文字起こしを始められませんでした: {message}", { message: (e as Error).message }));
      setPhase("idle");
      // 画面の健診の情報を読み直す（届いた録音があれば「録った分を整理する」が出る）
      onFinished();
    }
  }

  async function importFile(file: File) {
    setErr("");
    setPhase("importing");
    try {
      const ext = extFromName(file.name) ?? extFromMime(file.type);
      const takeNo = await reserveTake(visit.id, Math.max(visit.takes?.length ?? 0, nextTake.current));
      nextTake.current = takeNo + 1;
      const r = await fetch(`/api/visit/${visit.id}/chunk?seq=0&take=${takeNo}&ext=${ext}`, {
        method: "POST",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? t("送れませんでした（{status}）", { status: r.status }));
      await finish();
    } catch (e) {
      setErr((e as Error).message);
      setPhase("idle");
    }
  }

  const sentSome = (visit.takes ?? []).some((k) => k.chunks > 0) || counts.sent > 0;
  const sentSec = (visit.takes ?? []).reduce((n, k) => n + k.chunks, 0) * 10;

  return (
    <section aria-label={t("録音")} className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-4">
      {/* 録音中は止めるボタンを一番上にするため、見出しを出さない */}
      {!(live || phase === "sending") && <h2 className="font-display text-xl font-bold">{t("先生の話を録音する")}</h2>}

      {phase === "idle" && (
        <>
          {sentSome && (
            <p className="rounded-lg bg-sky-soft px-3 py-2 text-base text-sky">
              {t("前に録った分（{n}秒ほど）が届いています", { n: sentSec })}
            </p>
          )}
          <button onClick={() => setPhase("consent")} className="rounded-full bg-rose py-5 font-display text-xl font-bold text-white">
            {sentSome ? t("続きを録音する") : t("録音を始める")}
          </button>
          {sentSome && (
            <button onClick={() => void finish()} className="min-h-11 rounded-full border border-ink/20 bg-card text-base font-semibold">
              {t("録った分を整理する")}
            </button>
          )}
        </>
      )}

      {/* 先生に聞く言葉（録音してもいいですか・家族が聞き返すためだけに使います）は、中文・English の訳でも日本語を括弧で並べる（辞書の側） */}
      {phase === "consent" && (
        <div className="flex flex-col gap-3 rounded-xl bg-rose-soft p-4">
          <p className="font-display text-lg font-bold leading-snug">{t("先生に「録音してもいいですか」と聞きましたか？")}</p>
          <p className="text-base text-muted">{t("家族が聞き返すためだけに使います")}</p>
          <div className="flex gap-2">
            <button onClick={() => void begin()} className="min-h-12 flex-1 rounded-full bg-rose text-base font-semibold text-white">{t("聞いた。始める")}</button>
            <button onClick={() => setPhase("idle")} className="min-h-12 rounded-full border border-ink/20 bg-card px-5 text-base">{t("まだ")}</button>
          </div>
        </div>
      )}

      {phase === "starting" && <p className="text-base text-muted">{t("マイクを準備しています…")}</p>}

      {(live || phase === "sending") && (
        <div className="flex flex-col items-center gap-3">
          {/* 小さな画面でも止めるボタンが隠れないよう、操作を一番上に置く */}
          {live && (
            <div className="flex w-full gap-2">
              {phase === "recording" ? (
                <button onClick={pause} className="min-h-12 rounded-full border border-ink/20 px-5 text-base">{t("一時停止")}</button>
              ) : (
                <button onClick={resume} className="min-h-12 rounded-full border border-rose px-5 text-base font-semibold text-rose">{t("再開")}</button>
              )}
              <button onClick={stop} className="min-h-12 flex-1 rounded-full bg-ink text-base font-semibold text-paper">{t("止めて整理する")}</button>
            </div>
          )}
          <div className="flex w-full items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-base font-semibold text-rose">
              <span className={`inline-block h-3 w-3 rounded-full bg-rose ${phase === "recording" ? "animate-pulse" : "opacity-40"}`} />
              {phase === "recording" ? t("録音中") : phase === "paused" ? t("一時停止中") : t("残りを送っています…")}
            </p>
            <p className="tabular font-display text-4xl font-bold" aria-live="off">{formatClock(elapsed())}</p>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full rounded-full bg-rose transition-[width] duration-150" style={{ width: `${Math.round(level * 100)}%` }} />
          </div>
          <p className="tabular self-start text-xs text-muted">
            {t("送った {sent} / 録った {made}（10秒ずつ）", { sent: counts.sent, made: counts.made })}
          </p>
          {silent && (
            <p role="alert" className="w-full rounded-lg bg-alert/10 px-3 py-2 text-sm font-semibold text-alert">
              {t("10秒以上、音が入っていません。マイクを指で塞いでいないか、通話などほかのアプリがマイクを使っていないか確かめてください")}
            </p>
          )}
          {live && (
            <p className="w-full rounded-lg bg-rose-soft px-3 py-2 text-base font-semibold text-rose">
              {t("画面を消さない・ほかのアプリに切り替えない（iPhone は録音が止まります）")}
            </p>
          )}
        </div>
      )}

      {phase === "importing" && <p className="text-base text-muted">{t("録音ファイルを送っています…")}</p>}

      {live && wakeWarn && <p className="rounded-lg bg-warn/15 px-3 py-2 text-base text-warn">{wakeWarn}</p>}
      {warn && <p role="status" className="rounded-lg bg-warn/15 px-3 py-2 text-base text-warn">{warn}</p>}
      {netErr && <p className="rounded-lg bg-warn/15 px-3 py-2 text-base text-warn">{netErr}</p>}
      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-base text-alert">{err}</p>}

      {backup && (
        <a
          href={backup.url}
          download={backup.name}
          className={
            netErr || err
              ? "inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 bg-card text-base font-semibold"
              : "inline-flex min-h-11 items-center justify-center text-sm text-muted underline"
          }
        >
          {t("念のため、この端末にも録音を保存する")}
        </a>
      )}

      {phase === "idle" && (
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center text-sm text-muted underline">
          {t("録音ファイルを取り込む（ボイスメモなど）")}
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
