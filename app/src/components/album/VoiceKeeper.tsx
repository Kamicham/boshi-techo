"use client";

// 声を残す（思い出の録り方）。押して始め、もう一度押して止める（長く話せるように）。
// 残した声は世帯の鍵で守って置き、Claude には送らない（記録の振り分けにもかけない）。文字にするのは自宅の機械だけ（画面の言葉は「手帳の中で」）。
// 根拠: 紙の母子手帳の「迎える気持ち」「誕生日のメッセージ」は文字の欄だけ（府令様式・こども家庭庁 令和5年度改正）。声はここで足す。
import Link from "next/link";
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { useRecorder } from "@/components/capture/useRecorder";
import { t } from "@/lib/i18n";
import { VOICE_MOMENTS, voiceMomentsFor, type ClientMedia } from "@/lib/media-shared";
import { monthName, nameOf, quote } from "@/lib/memory-words";
import { tr } from "@/lib/i18n/rich";
import { invalidateMedia } from "./useMedia";

type Moment = (typeof VOICE_MOMENTS)[number];

export function VoiceKeeper({ unavailable }: { unavailable?: boolean }) {
  const [moment, setMoment] = useState<Moment | null>(null);
  const { family, today } = useFamily();
  if (unavailable) return null;
  // おなかに話しかけるのは妊娠中だけ。生まれた後は今の声を先頭に
  const moments = voiceMomentsFor(family.birthDate, today);
  // つらい別れの後（静かにする）は、促す言葉を使わない。残したい時だけ残せる
  const loss = family.situation?.quiet === "loss";
  return (
    <section aria-label={t("声を残す")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
      <h2 className="font-display text-lg font-bold">{t("声を残す")}</h2>
      <p className="text-sm text-muted">
        {loss
          ? t("残したい時だけ、声のまま残せます。消さずにしまうこともできます。")
          : t("声のまま残します。聞き返す手がかりに、手帳の中で文字にして添えます（声は AI に送りません）。大きくなった子どもが、一冊の本の中で聞けます")}
      </p>
      <div className={`grid gap-2 ${moments.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {moments.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMoment(m)}
            className="flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border border-rose/40 bg-rose-soft px-1 py-2 text-center"
          >
            <span className="text-sm font-bold text-rose">{t(m.label)}</span>
            <span className="text-xs text-muted">{t(m.hint)}</span>
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
  const [saved, setSaved] = useState<ClientMedia | null>(null);
  const r = useRecorder({ onDone: ({ blob, sec }) => void save(blob, sec) });
  const { secs, error, setError } = r;
  const child = nameOf(family, family.childName) ?? t("赤ちゃん");
  const phaseNow: Phase = r.recording ? "recording" : phase;
  const start = r.start;
  const stop = r.stop;

  const save = async (blob: Blob, sec: number) => {
    setPhase("saving");
    try {
      const qs = new URLSearchParams({ familyId: family.id, today, moment: moment.id, sec: sec.toFixed(1), ...(me?.name ? { who: me.name } : {}) });
      const r = await fetch(`/api/media/voice?${qs}`, { method: "POST", headers: { "content-type": blob.type || "application/octet-stream" }, body: blob });
      const j = (await r.json().catch(() => ({}))) as { media?: ClientMedia; error?: string };
      if (!r.ok || !j.media) throw new Error(j.error ?? t("残せませんでした（{status}）", { status: r.status }));
      setSaved(j.media);
      setPhase("done");
      invalidateMedia();
    } catch (e) {
      setError((e as Error).message);
      setPhase("idle");
    }
  };

  const on = phaseNow === "recording";
  const prompt =
    moment.id === "belly"
      ? t("おなかの{child}に、今日の事を話してみてください", { child })
      : moment.id === "bedtime"
        ? t("{child}に、今日のおやすみを", { child })
        : t("{child}の名前を、呼んでみてください", { child });

  return (
    <div role="dialog" aria-modal="true" aria-label={t(moment.label)} className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={on ? undefined : onClose}>
      <div
        className="flex w-full max-w-lg flex-col gap-3 rounded-t-3xl bg-card px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-bold">{t(moment.label)}</h3>
        {phase === "done" && saved ? (
          <>
            <p className="text-base">
              {tr("残しました（{n}秒）。アルバムの{m}月に並びます。", { n: <span className="tabular">{Math.round(saved.durationSec ?? secs)}</span>, m: monthName(saved.date) })}
            </p>
            {saved.transcript && <p className="rounded-xl bg-paper px-3 py-2 text-sm text-muted">{quote(saved.transcript)}</p>}
            <Btn full href={`/album?voice=${encodeURIComponent(saved.id)}`}>
              {t("アルバムで聞く")}
            </Btn>
            <div className="flex gap-2">
              <Btn kind="secondary" onClick={() => { setSaved(null); setPhase("idle"); }}>
                {t("もう1つ")}
              </Btn>
              <Btn kind="quiet" onClick={onClose}>
                {t("閉じる")}
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
              <span className="font-display text-2xl font-bold">{on ? t("止める") : phase === "saving" ? t("残しています…") : t("録る")}</span>
              <span className={`tabular text-sm ${on ? "text-white/90" : "text-muted"}`}>
                {on ? t("{n}秒・押すと止めて残します", { n: secs }) : t("押して話し始め、もう一度押して止めます")}
              </span>
            </button>
            {error && <p className="text-sm text-alert">{error}</p>}
            <p className="text-xs text-muted">
              {t("声は家族の鍵で守って、この手帳の中だけに残します。声そのものは AI（Claude）に送りません。文字にするのも手帳の中です。一冊を作る時だけ、題と最初の一文の文字を Claude に渡します。消したい時はアルバムから消せます。")}
            </p>
            {!on && (
              <Link href="/album" className="text-sm text-muted underline-offset-2 hover:underline">
                {t("残した声を聞く ›")}
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
