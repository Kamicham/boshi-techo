"use client";

// 一冊の映画を動画（mp4）にする・保存する・家族に渡す。組むのは手帳のサーバの中だけ（Claude にも外にも送らない）。
// 動画は家族の鍵で守って置き、開く時だけ解く。祖父母など読む人は見る・保存するだけ、作るのは記録を書ける人。
import { useCallback, useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { t } from "@/lib/i18n";
import { tr } from "@/lib/i18n/rich";
import { nameOf } from "@/lib/memory-words";
import { TRIAL_FILM_CLOSED } from "@/lib/trial-words";

type Video = { id: string; url: string; download: string; bytes: number; durationSec: number | null; createdAt: string };

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)}MB`;
const minSec = (s: number) => t("{m}分{s}秒", { m: Math.floor(s / 60), s: String(Math.round(s % 60)).padStart(2, "0") });

export function FilmExport({ bookKey }: { bookKey: string }) {
  const { family, today } = useFamily();
  const [video, setVideo] = useState<Video | null>(null);
  const [canMake, setCanMake] = useState(false);
  // 体験版は書き出しを閉じている（api/book/film）。押せないボタンの代わりに一言
  const [closed, setClosed] = useState(false);
  const [making, setMaking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const blob = useRef<{ url: string; file: File } | null>(null);
  const qs = `familyId=${encodeURIComponent(family.id)}&today=${today}`;

  const load = useCallback(async () => {
    const r = await fetch(`/api/book/film?${qs}`);
    if (!r.ok) return;
    const j = (await r.json()) as { video: Video | null; canMake: boolean; making: boolean; closed?: boolean };
    setVideo(j.video);
    setCanMake(j.canMake);
    setClosed(!!j.closed);
    if (j.making) setMaking(true);
  }, [qs]);
  useEffect(() => {
    void load();
  }, [load, bookKey]);
  useEffect(() => {
    if (!making) return;
    const t0 = Date.now();
    const timer = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(timer);
  }, [making]);
  useEffect(
    () => () => {
      if (blob.current) URL.revokeObjectURL(blob.current.url);
    },
    [],
  );

  const make = async () => {
    setError("");
    setMaking(true);
    try {
      const r = await fetch("/api/book/film", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ familyId: family.id, today }) });
      const j = (await r.json().catch(() => ({}))) as { video?: Video; error?: string };
      if (!r.ok || !j.video) throw new Error(j.error ?? t("作れませんでした（{status}）", { status: r.status }));
      setVideo(j.video);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMaking(false);
    }
  };

  /** 動画を端末の中だけに読み出す（家族に渡す・保存する時） */
  const file = async (v: Video) => {
    if (blob.current) return blob.current;
    const r = await fetch(v.url);
    if (!r.ok) throw new Error(t("読めませんでした（{status}）", { status: r.status }));
    const b = await r.blob();
    const name = `${family.childName ?? "family"}-film-${v.createdAt.slice(0, 10)}.mp4`;
    blob.current = { url: URL.createObjectURL(b), file: new File([b], name, { type: "video/mp4" }) };
    return blob.current;
  };

  const share = async (v: Video) => {
    setMsg("");
    try {
      const f = await file(v);
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
      if (nav.share && nav.canShare?.({ files: [f.file] })) await nav.share({ files: [f.file], title: t("{child}への一冊", { child: nameOf(family, family.childName) ?? "" }) });
      else window.location.href = v.download;
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg((e as Error).message);
    }
  };

  if (!video && !canMake) return closed ? <p className="text-sm text-muted">{t(TRIAL_FILM_CLOSED)}</p> : null;
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      {video ? (
        <>
          <p className="text-sm">{t("🎞 動画にしました（{dur}・{size}・横長）。LINE やテレビでそのまま流せます。", { dur: video.durationSec ? minSec(video.durationSec) : "", size: mb(video.bytes) })}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void share(video)} className="inline-flex min-h-11 items-center rounded-full bg-rose px-5 text-base font-semibold text-white">
              {t("家族に渡す")}
            </button>
            <a href={video.download} className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-5 text-base font-semibold text-ink">
              {t("保存する")}
            </a>
          </div>
        </>
      ) : making ? (
        <p role="status" className="text-sm">
          {tr("動画を組んでいます…（{n}秒）写真の多い一冊は1〜2分かかります。この画面のままお待ちください。", { n: <span className="tabular">{elapsed}</span> })}
        </p>
      ) : (
        <>
          <button type="button" onClick={() => void make()} className="inline-flex min-h-11 items-center justify-center rounded-full border border-ink/20 bg-card px-5 text-base font-semibold text-ink">
            {t("🎞 動画にする（mp4）")}
          </button>
          <p className="text-xs text-muted">{t("映画を1本の動画にして、家族に送ったりテレビで流したりできるようにします。組むのは手帳の中だけで、AI（Claude）にも外のサービスにも送りません。")}</p>
        </>
      )}
      {(error || msg) && <p className="text-sm text-alert">{error || msg}</p>}
    </div>
  );
}
