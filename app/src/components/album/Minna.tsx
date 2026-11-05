"use client";

// 一冊の後ろに付く2つ: みんなの章（祖父母など家族みんなが足した写真・声・一言）と、未来の手紙（封をした手紙の棚）。
// どちらも Claude を通さず、足された物をそのまま並べる（一冊の本文を Claude が書く時にも、手紙の中身は渡さない）。
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { useMedia } from "./useMedia";
import { VoiceItem } from "./VoiceItem";
import { LetterSheet } from "./LetterKeeper";
import { opensLine, type ClientLetter } from "@/lib/letters-shared";
import { childView } from "@/lib/call-name";
import { t } from "@/lib/i18n";
import type { ClientMedia } from "@/lib/media-shared";
import { dayLong as jpDay, dot } from "@/lib/memory-words";
import { tr } from "@/lib/i18n/rich";

/** みんなの章: 足した人ごとに、写真と声と一言 */
export function MinnaChapter() {
  const { family, households } = useFamily();
  const { media } = useMedia();
  const { media: voices } = useMedia({ kind: "audio" });
  const items = [...media, ...voices].filter((m) => m.from && !m.hidden);
  // 頼む入口は、今ある「家族を招く」（世帯の持ち主・共同の管理の人だけが招ける。招いた祖父母は写真・声・手紙を足せる）
  const h = households.find((x) => x.id === family.id);
  const canInvite = !!h && h.kind === "real" && (h.role === "owner" || h.role === "admin");
  const inviteHref = `/invite/new?familyId=${encodeURIComponent(family.id)}`;
  if (!items.length) {
    // 赤ちゃんを亡くした家族には、ひと言を頼む入口を出さない
    if (!canInvite || family.situation?.quiet === "loss") return null;
    return (
      <section aria-label={t("みんなの章")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-xs tracking-[0.4em] text-rose">{t("み ん な の 章")}</p>
        <p className="text-base">{t("家族や周りの人に、{child}へのひと言を頼めます。招いた人が足した写真・声・手紙が、ここに並びます。", { child: family.childName ?? t("赤ちゃん") })}</p>
        <div>
          <Btn kind="secondary" href={inviteHref}>
            {t("家族に頼む（招く）")}
          </Btn>
        </div>
      </section>
    );
  }
  const byName = new Map<string, ClientMedia[]>();
  for (const m of items.sort((a, b) => a.date.localeCompare(b.date))) byName.set(m.from!.name, [...(byName.get(m.from!.name) ?? []), m]);
  return (
    <section aria-label={t("みんなの章")} className="flex flex-col gap-4 rounded-2xl border border-line bg-card px-5 py-5">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs tracking-[0.4em] text-rose">{t("み ん な の 章")}</p>
        <h2 className="font-display text-xl font-bold">{t("{child}を待っていた人たち", { child: family.childName ?? t("あなた") })}</h2>
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
                <VoiceItem m={m} canWrite={!!m.mine} minna />
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
      {canInvite && (
        <Link href={inviteHref} className="self-center text-sm text-muted underline-offset-2 hover:underline">
          {t("ほかの家族にも頼む ›")}
        </Link>
      )}
    </section>
  );
}

/** 未来の手紙: 封をした手紙は「誰から・いつ開くか」だけ。開いた手紙は押すと読める */
export function FutureLetters() {
  const { family, today, me } = useFamily();
  const [letters, setLetters] = useState<ClientLetter[] | null>(null);
  const [error, setError] = useState("");
  const [writing, setWriting] = useState(false);
  // 書ける人（家族の記録を書ける人・みんなの章に足せる人）には、手紙が0通でも書く入口を出す（書く画面は「話す・撮る」と同じ LetterSheet）
  const { canWrite, canContribute, unavailable, loading } = useMedia();
  const canLetter = !loading && !unavailable && (canWrite || !!canContribute);
  const quiet = family.situation?.quiet === "loss";

  const load = useCallback(() => {
    const qs = new URLSearchParams({ familyId: family.id, today, ...(me?.name ? { by: me.name } : {}) });
    fetch(`/api/letters?${qs}`)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { letters?: ClientLetter[]; error?: string };
        if (!r.ok) throw new Error(j.error ?? t("手紙を読めませんでした（{status}）", { status: r.status }));
        setLetters(j.letters ?? []);
      })
      .catch((e: Error) => setError(e.message));
  }, [family.id, today, me?.name]);
  useEffect(load, [load]);

  if (error || letters === null) return null;
  const sheet = writing && (
    <LetterSheet
      onClose={() => {
        setWriting(false);
        load();
      }}
    />
  );
  const write = canLetter && (
    <Btn kind="secondary" full onClick={() => setWriting(true)}>
      {t("✉ 手紙を書く")}
    </Btn>
  );
  if (!letters.length) {
    if (!canLetter) return null;
    return (
      <section id="letters" aria-label={t("未来へ手紙")} className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border border-line bg-card px-5 py-4">
        <p className="text-xs tracking-[0.4em] text-rose">{t("未 来 へ 手 紙")}</p>
        <p className="text-base">
          {quiet
            ? t("伝えたい事がある時だけ、手紙にして残せます。封をせず、いつでも読める形にもできます。")
            : t("開く日を決めて封をする手紙です。例: {child}の1歳の誕生日に開く。開く日までは、書いた人も読めません。", { child: family.childName ?? t("赤ちゃん") })}
        </p>
        {write}
        {sheet}
      </section>
    );
  }
  const sealed = letters.filter((l) => !l.opened);
  const opened = letters.filter((l) => l.opened);
  return (
    <section id="letters" aria-label={t("未来の手紙")} className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card px-5 py-5">
      <div className="flex flex-col gap-1 text-center">
        <p className="text-xs tracking-[0.4em] text-rose">{t("未 来 の 手 紙")}</p>
        <p className="text-sm text-muted">
          {tr("封をした手紙 {n} 通", { n: <b className="tabular">{sealed.length}</b> })}
          {opened.length ? `${dot()}${t("開いた手紙 {n} 通", { n: opened.length })}` : ""}
        </p>
      </div>
      <ul className="flex flex-col gap-2">
        {[...opened, ...sealed].map((l) => (
          <LetterRow key={l.id} l={l} onRemoved={load} />
        ))}
      </ul>
      {write}
      {sheet}
      <p className="text-xs text-muted">{t("封をした手紙は、書いた人も開く日まで読めません。手紙の中身は AI（Claude）に渡していません。")}</p>
    </section>
  );
}

function LetterRow({ l, onRemoved }: { l: ClientLetter; onRemoved: () => void }) {
  const { family, today, me } = useFamily();
  const [body, setBody] = useState<string | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(
    () => () => {
      if (voiceUrl) URL.revokeObjectURL(voiceUrl);
    },
    [voiceUrl],
  );
  const [confirm, setConfirm] = useState(false);
  const qs = (extra: Record<string, string> = {}) => new URLSearchParams({ familyId: family.id, today, ...(me?.name ? { by: me.name } : {}), ...extra });

  const read = async () => {
    if (body !== null) return setBody(null);
    const r = await fetch(`/api/letters/${encodeURIComponent(l.id)}?${qs()}`);
    const j = (await r.json().catch(() => ({}))) as { letter?: ClientLetter; error?: string };
    if (!r.ok || !j.letter || typeof j.letter.body !== "string") return setMsg(j.error ?? t("読めませんでした"));
    setBody(j.letter.body);
    // 添えた声は、開いた後だけ届く（封の間は 403）。端末の中だけで流す
    if (l.voiceSec !== undefined && !voiceUrl) {
      const v = await fetch(`/api/letters/${encodeURIComponent(l.id)}/voice?${qs()}`);
      if (v.ok) setVoiceUrl(URL.createObjectURL(await v.blob()));
      else setMsg(t("声を開けませんでした"));
    }
  };
  const remove = async () => {
    const r = await fetch(`/api/letters?${qs({ id: l.id })}`, { method: "DELETE" });
    if (!r.ok) return setMsg(((await r.json().catch(() => ({}))) as { error?: string }).error ?? t("消せませんでした"));
    onRemoved();
  };

  return (
    <li className={`flex flex-col gap-2 rounded-xl border px-4 py-3 ${l.opened ? "border-rose/50 bg-rose-soft" : "border-line bg-paper"}`}>
      <button type="button" onClick={() => (l.opened ? void read() : undefined)} disabled={!l.opened} className="flex items-center gap-3 text-left disabled:cursor-default">
        <span aria-hidden className="text-2xl">
          {l.opened ? "💌" : "✉️"}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-base font-semibold">{t("{from}から {to}へ", { from: childView(family, l.from), to: l.to })}</span>
          <span className="tabular text-xs text-muted">
            {l.opened ? (l.openOn ? t("{date}に開きました", { date: jpDay(l.openOn) }) : t("いつでも読めます")) : opensLine(l)}
            {dot()}
            {t("{date}に書いた", { date: jpDay(l.sealedOn) })}
            {l.voiceSec !== undefined && `${dot()}${t("🎙 声つき")}${l.voiceSec ? ` ${Math.floor(l.voiceSec / 60)}:${String(Math.floor(l.voiceSec % 60)).padStart(2, "0")}` : ""}`}
          </span>
        </span>
        {l.opened && <span className="text-sm font-bold text-rose">{body === null ? t("読む") : t("閉じる")}</span>}
      </button>
      {body !== null && voiceUrl && <audio controls autoPlay src={voiceUrl} aria-label={t("{name}の声", { name: childView(family, l.from) })} className="w-full" />}
      {body !== null && body && <p className="whitespace-pre-wrap font-display text-base leading-loose">{body}</p>}
      {l.mine && (
        <div className="flex items-center gap-2 text-sm">
          {confirm ? (
            <>
              <span className="text-muted">{t("この手紙を消しますか？（戻せません）")}</span>
              <button type="button" className="min-h-10 rounded-lg border border-line px-3 text-alert" onClick={() => void remove()}>
                {t("消す")}
              </button>
              <button type="button" className="min-h-10 px-2 text-muted" onClick={() => setConfirm(false)}>
                {t("やめる")}
              </button>
            </>
          ) : (
            <button type="button" className="min-h-10 text-muted underline-offset-2 hover:underline" onClick={() => setConfirm(true)}>
              {t("消す")}
            </button>
          )}
        </div>
      )}
      {msg && <p className="text-sm text-alert">{msg}</p>}
    </li>
  );
}
