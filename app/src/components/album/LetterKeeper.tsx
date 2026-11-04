"use client";

// 未来へ手紙を書く。開く日を選んで封をする。封をしたら、書いた本人も開く日まで読めない（消すことはできる）。
// 中身は家族の鍵で守って置き、Claude には送らない。封をした手紙は一冊の「未来の手紙」に並ぶ。
import Link from "next/link";
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { LETTER_OPENS, letterOpenOn, MAX_LETTER_CHARS, openLine, type ClientLetter, type LetterOpen } from "@/lib/letters-shared";

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

function LetterSheet({ onClose }: { onClose: () => void }) {
  const { family, today, me } = useFamily();
  const quiet = family.situation?.quiet === "loss";
  const [to, setTo] = useState(family.childName ?? "");
  const [when, setWhen] = useState<LetterOpen>(quiet ? "now" : "20y");
  const [date, setDate] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<ClientLetter | null>(null);
  const preview = when === "date" ? (date || null) : letterOpenOn(when, family);

  const seal = async () => {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/letters", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId: family.id, today, body, to, open: when, date, from: me?.name }),
      });
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
    <div role="dialog" aria-modal="true" aria-label="手紙を書く" className="fixed inset-0 z-40 flex items-end justify-center bg-ink/40" onClick={busy ? undefined : onClose}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col gap-3 overflow-y-auto rounded-t-3xl bg-card px-5 pt-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display text-xl font-bold">{done ? "封をしました" : "未来へ手紙"}</h3>
        {done ? (
          <>
            <p className="text-base">
              {done.to}へ。{done.openOn ? `${openLine(done)}開きます。それまでは、書いたあなたも読めません。` : "いつでも読めます。"}
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
            {error && <p className="text-sm text-alert">{error}</p>}
            <Btn full onClick={() => void seal()} disabled={busy || !body.trim() || (when === "date" && !date)}>
              {busy ? "封をしています…" : when === "now" ? "残す" : "封をする"}
            </Btn>
            <p className="text-xs text-muted">
              {when === "now" ? "" : "封をすると、開く日まで書いたあなたも読めません。"}手紙は家族の鍵で守って、この手帳の中だけに残します。AI（Claude）には送りません。
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
