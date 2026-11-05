"use client";

// 映画: 一冊を作る時に Claude が書いた台本（book.film）を、写真と家族の声で流す。
// 写真はゆっくり寄り・字幕・重ねて切り替え。声のある写真では、その声を流し、音楽を小さくする。
// 終わりの前に、開く日を過ぎた声の手紙を流す（封の間の手紙は出さない。手紙の文字は映画に出さない）。
// 音楽は端末の中で鳴らす自作のオルゴール（Web Audio。外の曲・管理曲は使わない）。写真も声も外に送らない。
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { useMedia } from "@/components/album/useMedia";
import { voiceUrl } from "@/components/album/VoiceItem";
import { useThanksLog } from "@/components/album/ThanksChapter";
import type { Book } from "@/lib/book";
import { childView } from "@/lib/call-name";
import { t } from "@/lib/i18n";
import { voiceTitleShown, type ClientMedia } from "@/lib/media-shared";
import { MusicBox } from "./music";
import { dayLine, filmShots, firstSentences, letterLine, type FilmLetter, type Shot as FilmShot } from "@/lib/film-plan";

type Shot = FilmShot<ClientMedia>;

export default function FilmPage() {
  const { family, today } = useFamily();
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState("");
  const { media: photos, loading: lp } = useMedia();
  const { media: voices, loading: lv } = useMedia({ kind: "audio" });
  const [letters, setLetters] = useState<FilmLetter[] | null>(null);

  useEffect(() => {
    api<{ book: Book | null }>(`/api/book?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => setBook(r.book))
      .catch((e: Error) => setError(e.message));
    // 開いた声の手紙（読めなくても映画は流す）
    api<{ letters: FilmLetter[] }>(`/api/letters?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((r) => setLetters(r.letters.filter((l) => l.opened && l.voiceSec !== undefined)))
      .catch(() => setLetters([]));
  }, [family.id, today]);

  const shots = useMemo<Shot[]>(() => (book ? filmShots(book.film, [...photos, ...voices], letters ?? []) : []), [book, photos, voices, letters]);

  if (error) return <Frame><p className="text-paper">{error}</p></Frame>;
  if (!book || lp || lv || !letters) return <Frame><p className="text-paper/70">{t("映画を用意しています…")}</p></Frame>;
  if (!shots.length)
    return (
      <Frame>
        <p className="text-paper">{t("映画にする写真がまだありません。アルバムに写真を残して、一冊を作り直すと映画になります。")}</p>
        <Link href="/book" className="text-paper underline">{t("一冊へ戻る")}</Link>
      </Frame>
    );
  return <Player book={book} shots={shots} />;
}

function Frame({ children }: { children: React.ReactNode }) {
  return <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-ink px-6 text-center">{children}</main>;
}

/** 声の取り出し口（アルバムの声と、開いた手紙の声） */
function voiceKey(s: Shot): string | null {
  return s.kind === "photo" && s.voice ? s.voice.id : s.kind === "letter" ? `letter:${s.letter.id}` : null;
}

function Player({ book, shots }: { book: Book; shots: Shot[] }) {
  const { family, today } = useFamily();
  const thanks = useThanksLog();
  const [i, setI] = useState(-1); // -1 = 始める前
  const [paused, setPaused] = useState(false);
  const music = useRef<MusicBox | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef(new Map<string, string>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const total = useMemo(() => shots.reduce((n, s) => n + s.sec, 0), [shots]);

  const load = useCallback(
    async (s: Shot): Promise<string | null> => {
      if (s.kind === "photo" && s.voice) return voiceUrl(s.voice);
      if (s.kind === "letter") {
        const r = await fetch(`/api/letters/${encodeURIComponent(s.letter.id)}/voice?familyId=${encodeURIComponent(family.id)}&today=${today}`);
        return r.ok ? URL.createObjectURL(await r.blob()) : null;
      }
      return null;
    },
    [family.id, today],
  );
  // 声は先に読んでおく（切り替えの時に待たない）
  useEffect(() => {
    const map = urls.current;
    for (const s of shots) {
      const k = voiceKey(s);
      if (k && !map.has(k))
        load(s)
          .then((u) => u && map.set(k, u))
          .catch(() => {});
    }
    return () => {
      for (const u of map.values()) URL.revokeObjectURL(u);
      map.clear();
    };
  }, [shots, load]);
  useEffect(
    () => () => {
      music.current?.stop();
      audio.current?.pause();
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const playVoice = useCallback(async (s: Shot) => {
    audio.current?.pause();
    audio.current = null;
    const k = voiceKey(s);
    if (!k) {
      music.current?.duck(false);
      return;
    }
    try {
      const u = urls.current.get(k) ?? (await load(s));
      if (!u) return music.current?.duck(false);
      urls.current.set(k, u);
      const a = new Audio(u);
      a.onended = () => music.current?.duck(false);
      audio.current = a;
      music.current?.duck(true);
      // 写真が映ってから少し置いて話し始める
      setTimeout(() => void a.play().catch(() => music.current?.duck(false)), 600);
    } catch {
      music.current?.duck(false);
    }
  }, [load]);

  useEffect(() => {
    if (i < 0 || paused) return;
    if (i >= shots.length) {
      music.current?.fadeOut(3);
      return;
    }
    void playVoice(shots[i]);
    timer.current = setTimeout(() => setI((n) => n + 1), shots[i].sec * 1000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [i, paused, shots, playVoice]);

  const start = () => {
    music.current = new MusicBox();
    music.current.start();
    setPaused(false);
    setI(0);
  };
  const togglePause = () => {
    if (paused) {
      music.current?.resume();
      void audio.current?.play().catch(() => {});
      setPaused(false);
    } else {
      music.current?.pause();
      audio.current?.pause();
      setPaused(true);
    }
  };

  const cur = i >= 0 && i < shots.length ? shots[i] : null;
  const done = i >= shots.length;
  const elapsed = shots.slice(0, Math.max(0, i)).reduce((n, s) => n + s.sec, 0);

  return (
    <main className="relative flex h-dvh w-full flex-col overflow-hidden bg-[#0d0c10] text-[#f4f1ea]" onClick={i >= 0 && !done ? togglePause : undefined}>
      {/* 写真は前後の2枚を重ねて置き、今の1枚だけを見せる（重ねて切り替える） */}
      {shots.map((s, n) =>
        s.kind === "photo" && Math.abs(n - i) <= 1 ? (
          <div
            key={n}
            className="absolute inset-0 transition-opacity duration-[1400ms] ease-in-out"
            style={{ opacity: n === i ? 1 : 0 }}
            aria-hidden={n !== i}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.photo.urls.view}
              alt=""
              className="h-full w-full object-cover"
              style={{
                // 止めた時も寄りの途中で止まるよう、再生の状態を1つの書き方に入れる
                animation: n === i ? `kb${n % 4} ${s.sec + 1.4}s linear both ${paused ? "paused" : "running"}` : undefined,
              }}
            />
            <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          </div>
        ) : null,
      )}

      {cur?.kind === "photo" && (
        <div key={`cap${i}`} className="film-cap absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-6 pb-[max(3rem,env(safe-area-inset-bottom))] text-center">
          <p className="font-display text-2xl font-bold leading-snug drop-shadow-[0_1px_8px_rgba(0,0,0,0.6)]">{cur.caption}</p>
          <p className="tabular text-sm opacity-80">{dayLine(cur.photo.date)}</p>
          {cur.voice && <p className="mt-1 rounded-full bg-black/40 px-3 py-1 text-xs">♪ {voiceTitleShown(cur.voice)}</p>}
        </div>
      )}

      {cur?.kind === "letter" && (
        <div key={`letter${i}`} className="film-cap absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#1f1812] px-8 text-center">
          <span aria-hidden className="text-5xl opacity-80">✉</span>
          <p className="text-xs tracking-[0.5em] opacity-70">{t("未 来 の 手 紙")}</p>
          <p className="font-display text-3xl font-bold">
            {t("{from}から {to}へ", { from: childView(family, cur.letter.from), to: cur.letter.to })}
          </p>
          <p className="tabular text-sm opacity-85 [text-wrap:balance]">{letterLine(cur.letter)}</p>
          <p className="mt-2 rounded-full bg-black/40 px-3 py-1 text-xs">{t("♪ 声の手紙")}</p>
        </div>
      )}

      {(cur?.kind === "title" || i < 0) && (
        <div className="film-cap absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
          <p className="text-xs tracking-[0.5em] opacity-70">{t("1000 日 の 記 録")}</p>
          <h1 className="font-display text-3xl font-bold leading-snug">{book.title}</h1>
          <p className="font-display text-lg opacity-90">{t("{name}へ", { name: book.childName })}</p>
          {i < 0 && (
            <>
              <button type="button" onClick={start} className="mt-6 min-h-14 rounded-full bg-[#f4f1ea] px-8 font-display text-lg font-bold text-[#0d0c10]">
                {t("▶ 再生する")}
              </button>
              <p className="text-xs opacity-60">
                {t("約{n}分・音が出ます。画面を押すと止まります", { n: Math.round(total / 60) || 1 })}
              </p>
            </>
          )}
        </div>
      )}

      {(cur?.kind === "end" || done) && (
        <div className="film-cap absolute inset-0 flex flex-col items-center justify-center gap-5 bg-[#0d0c10]/80 px-8 text-center">
          <p className="max-w-md font-display text-xl leading-loose">{firstSentences(book.closing)}</p>
          <p className="tabular text-sm opacity-70">{dayLine(book.asOf)}</p>
          {/* 手帳の中で家族が交わしたありがとう（数と、新しい2つ） */}
          {thanks.length > 0 && (
            <div className="flex flex-col items-center gap-1 text-sm opacity-85">
              <p>{t("家族が交わしたありがとう {n}", { n: thanks.length })}</p>
              {thanks.slice(-2).map((x) => (
                <p key={x.id} className="opacity-80">
                  {t("{from}から {to}へ", { from: childView(family, x.from.name), to: childView(family, x.to.name) })}
                  {x.title ? t("（{x}）", { x: t(x.title) }) : ""}
                </p>
              ))}
            </div>
          )}
          {done && (
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={start} className="min-h-12 rounded-full border border-[#f4f1ea]/60 px-6">
                {t("もう一度")}
              </button>
              <Link href="/book" className="inline-flex min-h-12 items-center rounded-full bg-[#f4f1ea] px-6 font-bold text-[#0d0c10]">
                {t("一冊へ")}
              </Link>
            </div>
          )}
        </div>
      )}

      <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <Link href="/book" onClick={(e) => e.stopPropagation()} className="min-h-11 rounded-full bg-black/40 px-4 py-2 text-sm">
          {t("✕ 閉じる")}
        </Link>
        {i >= 0 && !done && paused && <span className="rounded-full bg-black/40 px-3 py-1 text-xs">{t("止めています・押すと続き")}</span>}
      </div>
      {i >= 0 && !done && (
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/10">
          <div className="h-full bg-[#f4f1ea]/70 transition-[width] duration-1000" style={{ width: `${Math.min(100, (elapsed / total) * 100)}%` }} />
        </div>
      )}

      <style>{`
        @keyframes kb0 { from { transform: scale(1.02) translate(0,0) } to { transform: scale(1.14) translate(-2%,-1.5%) } }
        @keyframes kb1 { from { transform: scale(1.14) translate(2%,1%) } to { transform: scale(1.03) translate(0,0) } }
        @keyframes kb2 { from { transform: scale(1.05) translate(-2%,0) } to { transform: scale(1.15) translate(2%,-1%) } }
        @keyframes kb3 { from { transform: scale(1.12) translate(0,2%) } to { transform: scale(1.02) translate(0,-1%) } }
        .film-cap { animation: capIn 1.6s ease-out both }
        @keyframes capIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: none } }
        @media (prefers-reduced-motion: reduce) { .film-cap, img { animation: none !important } }
      `}</style>
    </main>
  );
}
