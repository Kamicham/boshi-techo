"use client";

// 未来へ手紙を書く。開く日を選んで封をする。封をしたら、書いた本人も開く日まで読めない（消すことはできる）。
// 声も添えられる（5分まで・声だけの手紙もよい）。声はアルバムには並ばず、開く日まで書いた本人にも流れない。
// 中身は家族の鍵で守って置き、Claude には送らない。封をした手紙は一冊の「未来の手紙」に並ぶ。
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRecorder, type Recorded } from "@/components/capture/useRecorder";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { LETTER_OPENS, letterOpenOn, MAX_LETTER_CHARS, MAX_LETTER_VOICE_SEC, openLine, type ClientLetter, type LetterOpen } from "@/lib/letters-shared";

export function LetterKeeper({ unavailable }: { unavailable?: boolean }) {
  const [open, setOpen] = useState(false);
  const { family } = useFamily();
  if (unavailable) return null;
  const quiet = family.situation?.quiet;
  return (
    <section aria-label="未来へ手紙" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <h2 className="font-display text-lg font-bold">未来へ手紙</h2>
      <p className="text-sm text-muted">
        {quiet === "loss"
          ? "伝えたい事がある時だけ、手紙にして残せます。封をせず、いつでも読める形にもできます。"
          : `開く日を決めて封をします。${family.childName ?? "子ども"}が大きくなった日に、一冊の中で開きます。`}
      </p>
      <Btn kind="secondary" full onClick={() => setOpen(true)}>
        ✉ 手紙を書く
      </Btn>
      {open && <LetterSheet onClose={() => setOpen(false)} />}
    </section>
  );
}

/** 手紙を書く画面（「話す・撮る」の LetterKeeper と、一冊の「未来へ手紙」から開く） */
export function LetterSheet({ onClose }: { onClose: () => void }) {
  const { family, today, me } = useFamily();
  const quiet = family.situation?.quiet === "loss";
  const [to, setTo] = useState(family.childName ?? "");
  const [when, setWhen] = useState<LetterOpen>(quiet ? "now" : "20y");
  const [date, setDate] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ClientLetter | null>(null);
  const [voice, setVoice] = useState<(Recorded & { url: string }) | null>(null);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const rec = useRecorder({ maxSec: MAX_LETTER_VOICE_SEC, onDone: (r) => setVoice({ ...r, url: URL.createObjectURL(r.blob) }) });
  useEffect(
    () => () => {
      if (voice) URL.revokeObjectURL(voice.url);
    },
    [voice],
  );
  const preview = when === "date" ? (date || null) : letterOpenOn(when, family);

  const seal = async () => {
    setError("");
    setBusy(true);
    try {
      const fields = { familyId: family.id, today, body, to, open: when, date, from: me?.name ?? "" };
      let init: RequestInit;
      if (voice) {
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v ?? "");
        fd.set("sec", voice.sec.toFixed(1));
        fd.set("voice", voice.blob, "voice");
        init = { method: "POST", body: fd };
      } else init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fields) };
      // familyId は道にも付ける（声を添えた時、サーバは関所を通ってから声を読む・lib/api.ts の formAfterGate）
      const r = await fetch(`/api/letters?familyId=${encodeURIComponent(family.id)}`, init);
      const j = (await r.json().catch(() => ({}))) as { letter?: ClientLetter; error?: string };
      if (!r.ok || !j.letter) throw new Error(j.error ?? `残せませんでした（${r.status}）`);
      setDone(j.letter);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="手紙を書く" className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={busy || rec.recording ? undefined : onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-card px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-bold">{done ? "封をしました" : "未来へ手紙"}</h3>
        {done ? (
          <>
            <p className="text-base">
              {done.to}へ{done.voiceSec !== undefined ? "、声を添えて" : ""}。{done.openOn ? `${openLine(done)}開きます。それまでは、書いたあなたも${done.voiceSec !== undefined ? "読めず、声も聞けません" : "読めません"}。` : "いつでも読めます。"}
            </p>
            <p className="text-sm text-muted">一冊の「未来の手紙」に並びます。消したい時は、そこから消せます。</p>
            <div className="flex gap-2">
              <Btn href="/book#letters">一冊で見る</Btn>
              <Btn kind="quiet" onClick={onClose}>
                閉じる
              </Btn>
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">誰へ</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} maxLength={40} className="rounded-lg border border-line bg-paper px-3 py-2 text-base" />
            </label>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm text-muted">いつ開くか</legend>
              <div className="grid grid-cols-2 gap-2">
                {LETTER_OPENS.map((o) => (
                  <label key={o.id} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${when === o.id ? "border-rose bg-rose-soft font-bold text-rose" : "border-line"}`}>
                    <input type="radio" name="when" value={o.id} checked={when === o.id} onChange={() => setWhen(o.id)} className="sr-only" />
                    {o.label}
                  </label>
                ))}
              </div>
              {when === "date" && (
                <input type="date" value={date} min={today} onChange={(e) => setDate(e.target.value)} aria-label="開く日" className="rounded-lg border border-line bg-paper px-3 py-2 text-base" />
              )}
              <p className="tabular text-xs text-muted">{preview ? `${openLine({ open: when, openOn: preview })}開きます` : when === "now" ? "封をせず、いつでも読める手紙にします" : ""}</p>
            </fieldset>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-muted">手紙</span>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                maxLength={MAX_LETTER_CHARS}
                placeholder={`${to || "あなた"}へ。`}
                className="rounded-lg border border-line bg-paper px-3 py-2 text-base leading-relaxed"
              />
            </label>
            <VoiceRow voice={voice} open={voiceOpen} rec={rec} onOpen={() => setVoiceOpen(true)} onClear={() => setVoice(null)} />
            {(error || rec.error) && <p className="text-sm text-alert">{error || rec.error}</p>}
            <Btn full onClick={() => void seal()} disabled={busy || rec.recording || (!body.trim() && !voice) || (when === "date" && !date)}>
              {busy ? "封をしています…" : when === "now" ? "残す" : "封をする"}
            </Btn>
            <p className="text-xs text-muted">
              {when === "now" ? "" : `封をすると、開く日まで書いたあなたも${voice ? "読めず、声も聞けません" : "読めません"}。`}手紙{voice ? "と声" : ""}は家族の鍵で守って、この手帳の中だけに残します。AI（Claude）には送りません。
            </p>
            <Link href="/book#letters" className="text-sm text-muted underline-offset-2 hover:underline">
              書いた手紙を見る ›
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** 手紙に声を添える行。録る → 聞き直す・録り直す・外す。録った声は封をするまで端末の中だけ */
function VoiceRow({
  voice,
  open,
  rec,
  onOpen,
  onClear,
}: {
  voice: (Recorded & { url: string }) | null;
  open: boolean;
  rec: ReturnType<typeof useRecorder>;
  onOpen: () => void;
  onClear: () => void;
}) {
  if (voice)
    return (
      <div className="flex flex-col gap-2 rounded-xl border border-rose/40 bg-rose-soft px-3 py-2">
        <p className="tabular text-sm font-semibold text-rose">🎙 声を添えます（{mmss(voice.sec)}）</p>
        <audio controls src={voice.url} className="w-full" />
        <div className="flex gap-3 text-sm">
          <button type="button" onClick={() => { onClear(); void rec.start(); }} className="min-h-11 text-rose underline-offset-2 hover:underline">
            録り直す
          </button>
          <button type="button" onClick={onClear} className="min-h-11 text-muted underline-offset-2 hover:underline">
            声を外す
          </button>
        </div>
      </div>
    );
  if (!open && !rec.recording)
    return (
      <button type="button" onClick={onOpen} className="flex min-h-11 items-center gap-2 self-start rounded-full border border-rose/40 px-4 text-sm font-semibold text-rose">
        🎙 声も添える
      </button>
    );
  const on = rec.recording;
  return (
    <button
      type="button"
      onClick={() => (on ? rec.stop() : void rec.start())}
      aria-pressed={on}
      className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-rose transition ${on ? "bg-rose text-white" : "bg-rose-soft text-rose"}`}
    >
      <span className="font-display text-xl font-bold">{on ? "止める" : "🎙 録る"}</span>
      <span className={`tabular text-xs ${on ? "text-white/90" : "text-muted"}`}>
        {on ? `${mmss(rec.secs)} / ${mmss(MAX_LETTER_VOICE_SEC)}・押すと止めます` : `押して話し、もう一度押して止めます（${MAX_LETTER_VOICE_SEC / 60}分まで）`}
      </span>
    </button>
  );
}
