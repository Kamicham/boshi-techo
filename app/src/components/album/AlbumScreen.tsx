"use client";

// アルバム: 一冊と同じ4つの時期を、月ごとに並べる。各月の「この1枚」（★が一番強い。無ければアプリが仮に選ぶ）を大きく出す。
// 何もしなくても形になる: 選ぶ・並べるはアプリが引き受け、家族は★で選び直すだけ。Claude は使わない。
// 根拠: 子どもの写真を「整理したいが後回し」54.7%、アルバムやフォトブックにしている 23.8%（ヨメルバ／KADOKAWA 2026）。
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { useTecho } from "@/components/techo/useTecho";
import { bytesLabel, groupForAlbum, milestoneById, TRASH_DAYS, type ClientMedia } from "@/lib/media-shared";
import { KeepButtons } from "./KeepButtons";
import { PhotoSheet } from "./PhotoSheet";
import { trashMedia, patchMedia, useMedia } from "./useMedia";

export function AlbumScreen() {
  const { family } = useFamily();
  const { media, usage, canWrite, loading, unavailable, error } = useMedia();
  // 準備中の時は、仕組みの言葉（エラーの文）を家族に見せない
  const { items: techo } = useTecho();
  const [open, setOpen] = useState<string | null>(null);
  const child = family.childName ?? "赤ちゃん";

  // 手帳の写真の枠から来た時（/album?photo=<id>）は、その1枚を開く
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("photo");
    if (id) setOpen(id);
  }, []);

  const groups = useMemo(() => groupForAlbum(family, media), [family, media]);
  const titles = useMemo(() => new Map(techo.map((t) => [t.id, t.title])), [techo]);
  const shown = media.find((m) => m.id === open) ?? null;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <div className="flex items-center justify-between">
        <Link href="/techo" className="inline-flex min-h-11 items-center text-sm text-muted underline-offset-2 hover:underline">
          ‹ 手帳へ
        </Link>
        <Link href="/book" className="inline-flex min-h-11 items-center text-sm font-semibold text-rose underline-offset-2 hover:underline">
          一冊へ ›
        </Link>
      </div>
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-bold">{child}のアルバム</h1>
        <p className="text-base text-muted">月ごとの「この1枚」は、アプリが仮に選んでおきます。★で選び直せます。</p>
      </header>

      {loading ? (
        <p className="text-base text-muted">アルバムを開いています…</p>
      ) : unavailable ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-sky-soft p-4">
          <p className="text-base font-semibold">この手帳では、まだ写真を残せません</p>
          <p className="text-sm text-muted">写真は家族のアカウント（ログイン）で守って残します。いまは準備中です。</p>
        </div>
      ) : (
        <>
          {canWrite && <KeepButtons />}
          {usage && (
            <p className="text-sm text-muted">
              写真 <b className="tabular text-ink">{usage.count}</b> 枚・<span className="tabular">{bytesLabel(usage.bytes)}</span>（この家族の置き場だけ・鍵つき）
            </p>
          )}
          {error && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}
          {media.length === 0 ? (
            <p className="rounded-2xl bg-card px-4 py-6 text-center text-base text-muted">まだ写真がありません。「🌸 残す」から足すと、月ごとに並びます。</p>
          ) : (
            groups.map((g) => (
              <section key={g.period} className="flex flex-col gap-3">
                <h2 className="font-display text-xl font-bold text-rose">{g.period}</h2>
                {g.months.map((mo) => (
                  <article key={mo.key} id={`m-${mo.key}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-3">
                    <h3 className="font-display text-lg font-bold">{mo.label}</h3>
                    {mo.pick && <Pick m={mo.pick} titles={titles} onOpen={() => setOpen(mo.pick!.id)} />}
                    {mo.items.length > 1 && (
                      <ul className="grid grid-cols-4 gap-1">
                        {mo.items
                          .filter((m) => m.id !== mo.pick?.id)
                          .map((m) => (
                            <li key={m.id}>
                              <button type="button" onClick={() => setOpen(m.id)} className="relative block aspect-square w-full overflow-hidden rounded-md bg-paper" aria-label={`${m.date} の写真`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={m.urls.thumb} alt="" loading="lazy" className={`h-full w-full object-cover ${m.hidden ? "opacity-40" : ""}`} />
                                {m.star > 0 && <span className="absolute top-0.5 right-1 text-sm text-warn">★</span>}
                              </button>
                            </li>
                          ))}
                      </ul>
                    )}
                  </article>
                ))}
              </section>
            ))
          )}
          {canWrite && <Trash />}
          <p className="pb-4 text-sm text-muted">Claude には見せていません。一冊を作る時も、Claude に渡すのは写真の日付・一言・結んだ記録の文字だけです。</p>
        </>
      )}
      {shown && <PhotoSheet photo={shown} techo={techo} canWrite={canWrite} onClose={() => setOpen(null)} />}
    </main>
  );
}

function Pick({ m, titles, onOpen }: { m: ClientMedia; titles: Map<string, string>; onOpen: () => void }) {
  const ms = milestoneById(m.milestone);
  const linked = m.techoIds.map((id) => titles.get(id)).filter(Boolean);
  return (
    <button type="button" onClick={onOpen} className="flex flex-col gap-1 text-left">
      <span className="relative block overflow-hidden rounded-xl bg-paper">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={m.urls.view} alt={m.caption ?? ""} loading="lazy" className="max-h-96 w-full object-cover" />
        <span className="absolute top-2 left-2 rounded-full bg-card/90 px-2 py-0.5 text-xs font-semibold text-warn">{m.star > 0 ? "★ この1枚" : "この1枚（仮）"}</span>
      </span>
      <span className="text-sm text-muted">
        {Number(m.date.slice(5, 7))}/{Number(m.date.slice(8, 10))}
        {ms ? `・${ms.label}` : ""}
        {linked.length ? `・手帳「${linked.join("・")}」` : ""}
      </span>
      {m.caption && <span className="text-base">{m.caption}</span>}
    </button>
  );
}

/** ゴミ箱（30日で消える。それまでは戻せる） */
function Trash() {
  const [opened, setOpened] = useState(false);
  return (
    <details className="group rounded-2xl border border-line bg-card" onToggle={(e) => setOpened(e.currentTarget.open)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-display text-lg font-bold">
        <span>ゴミ箱</span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{opened ? <TrashList /> : null}</div>
    </details>
  );
}

function TrashList() {
  const { family } = useFamily();
  const { media, loading, error } = useMedia({ trash: true });
  const [msg, setMsg] = useState("");
  if (loading) return <p className="text-sm text-muted">読んでいます…</p>;
  if (error) return <p className="text-sm text-alert">{error}</p>;
  if (!media.length) return <p className="text-sm text-muted">ゴミ箱は空です。入れた写真は{TRASH_DAYS}日たつと消えます。</p>;
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted">{TRASH_DAYS}日たつと、写真のファイルごと消えます。それまでは戻せます。</p>
      <ul className="flex flex-col gap-2">
        {media.map((m) => (
          <li key={m.id} className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.urls.thumb} alt="" loading="lazy" className="h-14 w-14 rounded-md object-cover" />
            <span className="flex-1 text-sm text-muted">{m.date}</span>
            <Btn kind="secondary" onClick={() => void patchMedia(family.id, m.id, { restore: true }).catch((e: Error) => setMsg(e.message))}>
              戻す
            </Btn>
            <Btn
              kind="quiet"
              onClick={() => {
                if (window.confirm("今すぐ消しますか？（戻せません）")) void trashMedia(family.id, m.id, true).catch((e: Error) => setMsg(e.message));
              }}
            >
              今すぐ消す
            </Btn>
          </li>
        ))}
      </ul>
      {msg && <p className="text-sm text-alert">{msg}</p>}
    </div>
  );
}
