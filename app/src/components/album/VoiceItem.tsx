"use client";

// アルバムの声1本: 再生・★・一言・隠す・ゴミ箱。声は世帯の鍵で復号して出し、端末には残さない（blob を開いている間だけ）。
import { useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { t } from "@/lib/i18n";
import { keptLine, voiceTitleShown, type ClientMedia } from "@/lib/media-shared";
import { minnaVoiceLabel } from "@/lib/book-intro";
import { dot, madeOf, nameOf, quote } from "@/lib/memory-words";
import { patchMedia, trashMedia } from "./useMedia";

/** 声の中身を読んで、端末の中だけの URL にする（Safari の audio は範囲の読み出しを求めるので、まとめて読む） */
export async function voiceUrl(m: Pick<ClientMedia, "urls">): Promise<string> {
  const r = await fetch(m.urls.orig);
  if (!r.ok) throw new Error(t("声を読めませんでした（{status}）", { status: r.status }));
  return URL.createObjectURL(await r.blob());
}

/** full: 家族の記録を書ける人（一冊・映画に入れない を切り替えられる）。みんなの章の人は自分の声の一言・★・ゴミ箱だけ。
 * minna: 一冊の「みんなの章」の中（見出しに名前があるので札を付けず「ばあばの声（17秒）」と出す） */
export function VoiceItem({ m, canWrite, full = canWrite, focus, minna }: { m: ClientMedia; canWrite: boolean; full?: boolean; focus?: boolean; minna?: boolean }) {
  const { family, me } = useFamily();
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(!!focus);
  const [msg, setMsg] = useState("");
  const [caption, setCaption] = useState(m.caption ?? "");
  const audio = useRef<HTMLAudioElement | null>(null);
  const url = useRef<string | null>(null);
  const box = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (focus) box.current?.scrollIntoView({ block: "center" });
  }, [focus]);
  useEffect(
    () => () => {
      audio.current?.pause();
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );

  const toggle = async () => {
    setMsg("");
    if (playing) {
      audio.current?.pause();
      return;
    }
    try {
      if (!url.current) {
        setLoading(true);
        url.current = await voiceUrl(m);
      }
      if (!audio.current) {
        const a = new Audio(url.current);
        a.onended = () => setPlaying(false);
        a.onpause = () => setPlaying(false);
        a.onplay = () => setPlaying(true);
        audio.current = a;
      }
      await audio.current.play();
    } catch (e) {
      setMsg((e as Error).message || t("再生できませんでした"));
    } finally {
      setLoading(false);
    }
  };

  const act = (p: Record<string, unknown>) => void patchMedia(family.id, m.id, { ...p, by: me?.name }).catch((e: Error) => setMsg(e.message));

  return (
    <li ref={box} className={`flex flex-col gap-1 rounded-xl border px-3 py-2 ${focus ? "border-rose bg-rose-soft" : "border-line bg-paper"} ${m.hidden ? "opacity-50" : ""}`}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void toggle()}
          aria-label={playing ? t("止める") : t("聞く")}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose text-white"
        >
          {loading ? "…" : playing ? <PauseIcon /> : <PlayIcon />}
        </button>
        <button type="button" onClick={() => setOpen((o) => !o)} className="flex min-w-0 flex-1 flex-col text-left">
          {/* 題と「みんなの章」の札は、切らずに折り返す（English は「From Grandma to Hinata」と「Everyone's chapter」が1行に収まらず、
              札が「Ever…」と切れていた＝11/5 UX）。札はひとかたまりで次の行の頭へ。題は2行まで */}
          <span className="flex flex-wrap items-center gap-x-2">
            <span className="line-clamp-2 min-w-0 text-base font-semibold">
              {minna && m.from ? minnaVoiceLabel(nameOf(family, m.from.name), m.durationSec) : voiceTitleShown(m, madeOf(family))}
              {m.star > 0 && <span className="ml-1 text-warn">★</span>}
            </span>
            {m.from && !minna && <span className="shrink-0 rounded-full bg-rose-soft px-2 py-0.5 text-xs font-bold whitespace-nowrap text-rose">{t("みんなの章")}</span>}
          </span>
          <span className="text-xs text-muted">
            {minna && m.from && m.title ? `${voiceTitleShown(m, madeOf(family))}${dot()}` : ""}
            {keptLine(family, m)}
            {!minna && m.durationSec ? `${dot()}${t("{n}秒", { n: Math.round(m.durationSec) })}` : ""}
          </span>
        </button>
      </div>
      {open && (
        <div className="flex flex-col gap-2 pt-1">
          {m.transcript && <p className="text-sm text-muted">{quote(m.transcript)}</p>}
          {canWrite && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-muted">{t("一言")}</span>
                <input
                  id={`voice-caption-${m.id}`}
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  onBlur={() => caption !== (m.caption ?? "") && act({ caption })}
                  className="rounded-lg border border-line bg-card px-2 py-1.5 text-base"
                  placeholder={t("例: 毎晩のおやすみ")}
                />
              </label>
              <div className="flex flex-wrap gap-2 text-sm">
                <button type="button" className="min-h-10 rounded-lg border border-line px-3" onClick={() => act({ star: !m.starredByMe })}>
                  {m.starredByMe ? t("★ を外す") : t("☆ 一冊に入れたい")}
                </button>
                {full && (
                  <button type="button" className="min-h-10 rounded-lg border border-line px-3" onClick={() => act({ hidden: !m.hidden })}>
                    {m.hidden ? t("一冊・映画に戻す") : t("一冊・映画に入れない")}
                  </button>
                )}
                <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-alert" onClick={() => void trashMedia(family.id, m.id).catch((e: Error) => setMsg(e.message))}>
                  {t("ゴミ箱へ")}
                </button>
              </div>
            </>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-alert">{msg}</p>}
    </li>
  );
}

function PlayIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M7 4.5v15l13-7.5z" />
    </svg>
  );
}
function PauseIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M6 4h4v16H6zM14 4h4v16h-4z" />
    </svg>
  );
}
