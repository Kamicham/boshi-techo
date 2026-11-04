"use client";

// 一冊の後ろに付く2つ: みんなの章（祖父母など家族みんなが足した写真・声・一言）と、未来の手紙（封をした手紙の棚）。
// どちらも Claude を通さず、足された物をそのまま並べる（一冊の本文を Claude が書く時にも、手紙の中身は渡さない）。
import { useCallback, useEffect, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { useMedia } from "./useMedia";
import { VoiceItem } from "./VoiceItem";
import { openLine, type ClientLetter } from "@/lib/letters-shared";
import type { ClientMedia } from "@/lib/media-shared";

function jpDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** みんなの章: 足した人ごとに、写真と声と一言 */
export function MinnaChapter() {
  const { family } = useFamily();
  const { media } = useMedia();
  const { media: voices } = useMedia({ kind: "audio" });
  const items = [...media, ...voices].filter((m) => m.from && !m.hidden);
  if (!items.length) return null;
  const byName = new Map<string, ClientMedia[]>();
  for (const m of items.sort((a, b) => a.date.localeCompare(b.date))) byName.set(m.from!.name, [...(byName.get(m.from!.name) ?? []), m]);
  return (
    <section aria-label="みんなの章" className="flex flex-col gap-4 rounded-2xl border border-line bg-card px-5 py-5">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs tracking-[0.4em] text-rose">み ん な の 章</p>
        <h2 className="font-display text-xl font-bold">{family.childName ?? "あなた"}を待っていた人たち</h2>
      </div>
      {[...byName].map(([name, xs]) => (
        <div key={name} className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="font-display text-base font-bold">
            {name}
            {xs[0].from?.relation && <span className="ml-2 text-xs font-normal text-muted">{xs[0].from.relation}</span>}
          </p>
          {xs.map((m) =>
            m.kind === "audio" ? (
              <ul key={m.id}>
                <VoiceItem m={m} canWrite={!!m.mine} />
              </ul>
            ) : (
              <figure key={m.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={m.urls.view} alt={m.caption ?? ""} className="w-full rounded-xl object-cover" loading="lazy" />
                <figcaption className="text-sm">
                  {m.caption}
                  <span className="ml-2 tabular text-xs text-muted">{jpDay(m.date)}</span>
                </figcaption>
              </figure>
            ),
          )}
        </div>
      ))}
    </section>
  );
}

/** 未来の手紙: 封をした手紙は「誰から・いつ開くか」だけ。開いた手紙は押すと読める */
export function FutureLetters() {
  const { family, today, me } = useFamily();
  const [letters, setLetters] = useState<ClientLetter[] | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams({ familyId: family.id, today, ...(me?.name ? { by: me.name } : {}) });
    fetch(`/api/letters?${qs}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { letters?: ClientLetter[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? `手紙を読めませんでした（${r.status}）`);
        setLetters(j.letters ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, [family.id, today, me?.name]);
  useEffect(load, [load]);

  if (error) return null;
  if (!letters?.length) return null;
  const sealed = letters.filter((l) => !l.opened);
  const opened = letters.filter((l) => l.opened);
  return (
    <section id="letters" aria-label="未来の手紙" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card px-5 py-5">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs tracking-[0.4em] text-rose">未 来 の 手 紙</p>
        <p className="text-sm text-muted">
          封をした手紙 <b className="tabular">{sealed.length}</b> 通{opened.length ? `・開いた手紙 ${opened.length} 通` : ""}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {[...opened, ...sealed].map((l) => (
          <LetterRow key={l.id} l={l} onRemoved={load} />
        ))}
      </ul>
      <p className="text-xs text-muted">封をした手紙は、書いた人も開く日まで読めません。手紙の中身は AI（Claude）に渡していません。</p>
    </section>
  );
}

function LetterRow({ l, onRemoved }: { l: ClientLetter; onRemoved: () => void }) {
  const { family, today, me } = useFamily();
  const [body, setBody] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [confirm, setConfirm] = useState(false);
  const qs = (extra: Record<string, string> = {}) => new URLSearchParams({ familyId: family.id, today, ...(me?.name ? { by: me.name } : {}), ...extra });

  const read = async () => {
    if (body !== null) return setBody(null);
    const r = await fetch(`/api/letters/${encodeURIComponent(l.id)}?${qs()}`);
    const j = (await r.json().catch(() => ({}))) as { letter?: ClientLetter; error?: string };
    if (!r.ok || !j.letter?.body) return setMsg(j.error ?? "読めませんでした");
    setBody(j.letter.body);
  };
  const remove = async () => {
    const r = await fetch(`/api/letters?${qs({ id: l.id })}`, { method: "DELETE" });
    if (!r.ok) return setMsg(((await r.json().catch(() => ({}))) as { error?: string }).error ?? "消せませんでした");
    onRemoved();
  };

  return (
    <li className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${l.opened ? "border-rose/50 bg-rose-soft" : "border-line bg-paper"}`}>
      <button type="button" onClick={() => (l.opened ? void read() : undefined)} disabled={!l.opened} className="flex items-center gap-3 text-left disabled:cursor-default">
        <span aria-hidden className="text-2xl">
          {l.opened ? "💌" : "✉️"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold">
            {l.from}から {l.to}へ
          </span>
          <span className="tabular text-xs text-muted">
            {l.opened ? (l.openOn ? `${jpDay(l.openOn)}に開きました` : "いつでも読めます") : `${openLine(l)}開きます`}・{jpDay(l.sealedOn)}に書いた
          </span>
        </span>
        {l.opened && <span className="text-sm font-bold text-rose">{body === null ? "読む" : "閉じる"}</span>}
      </button>
      {body !== null && <p className="whitespace-pre-wrap font-display text-base leading-loose">{body}</p>}
      {l.mine && (
        <div className="flex items-center gap-2 text-sm">
          {confirm ? (
            <>
              <span className="text-muted">この手紙を消しますか？（戻せません）</span>
              <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-alert" onClick={() => void remove()}>
                消す
              </button>
              <button type="button" className="min-h-10 px-2 text-muted" onClick={() => setConfirm(false)}>
                やめる
              </button>
            </>
          ) : (
            <button type="button" className="min-h-10 text-muted underline-offset-2 hover:underline" onClick={() => setConfirm(true)}>
              消す
            </button>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-alert">{msg}</p>}
    </li>
  );
}
