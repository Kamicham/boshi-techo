"use client";

// 手帳に聞く: どの画面からでも右下の「聞く」で開く窓。書いても、押して話しても聞ける。
// 手帳はこの家族の今を見てから答え、返事の下に動き（画面へ行く・下書き・済みにする・健診で聞く・記録する・渡す文・電話）を添える。
// 書き込む動きは、家族が押すまで何も変えない。体・心・栄養は判断せず、記録・健診で聞く事・連絡先への橋だけ（lib/ask/agent.ts）。
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { telHref } from "@/lib/ask/bridge";
import type { AskAction, AskEvent, ChatTurn } from "@/lib/ask/types";
import { scheduleFor } from "@/lib/milestones";
import { api, useFamily } from "../FamilyProvider";
import { MilestoneActions } from "../MilestoneActions";
import { pickAudioType } from "../capture/media";
import { Btn, CopyField, HandoffRow, Why } from "../ui";

/** 窓を開いた時の、最初の問いの例（今いる画面に合わせる） */
function starters(path: string, pregnant: boolean): string[] {
  const common = ["次にやる事は何？", "この画面では何ができる？"];
  if (path.startsWith("/visit")) return [...common, "健診で何を聞けばいい？", "健診の日の録音はどうやるの？"];
  if (path.startsWith("/techo")) return [...common, "撮った紙はどこで OK するの？", "予防接種の控えはどこ？"];
  if (path.startsWith("/capture")) return [...common, "何を話せば記録になるの？", "役所の封筒を撮ったらどうなる？"];
  return pregnant ? [...common, "産休と育休はいつから？", "出産でもらえるお金は？"] : [...common, "出生届はいつまで？どこに？", "保育園の申し込みはいつ？"];
}

export function AskButton({ hidden }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  if (hidden && !open) return null;
  return (
    <>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 z-20 mx-auto max-w-md" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="pointer-events-auto absolute right-4 bottom-0 flex min-h-12 items-center gap-1 rounded-full bg-sky px-5 text-base font-bold text-white shadow-lg"
            aria-label="手帳に聞く（質問・アプリの使い方）"
          >
            <ChatIcon />
            聞く
          </button>
        </div>
      )}
      {open && <AskSheet onClose={() => setOpen(false)} />}
    </>
  );
}

function AskSheet({ onClose }: { onClose: () => void }) {
  const { family, today, me, isDemo } = useFamily();
  const path = usePathname();
  const [turns, setTurns] = useState<ChatTurn[] | null>(null);
  const [text, setText] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    setTurns(null);
    api<{ turns: ChatTurn[] }>(`/api/ask?familyId=${encodeURIComponent(family.id)}`)
      .then((r) => alive && setTurns(r.turns))
      .catch(() => alive && setTurns([]));
    return () => {
      alive = false;
    };
  }, [family.id]);

  // 開いている間は後ろの画面を動かさない・Esc で閉じる
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns, status]);

  const send = useCallback(
    async (q: string) => {
      const question = q.trim();
      if (!question || sending) return;
      setSending(true);
      setError("");
      setStatus("考えています");
      setText("");
      const mine: ChatTurn = { role: "user", text: question, today, at: new Date().toISOString(), ...(me ? { who: me.name } : {}) };
      setTurns((t) => [...(t ?? []), mine]);
      try {
        const r = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ familyId: family.id, today, text: question, path, meId: me?.id }),
        });
        if (!r.ok || !r.body) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? `うまくいきませんでした（${r.status}）`);
        }
        const reader = r.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finished = false;
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i: number;
          while ((i = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, i).trim();
            buf = buf.slice(i + 1);
            if (!line) continue;
            const e = JSON.parse(line) as AskEvent;
            if (e.t === "status") setStatus(e.text);
            else if (e.t === "done") {
              finished = true;
              setTurns((t) => [...(t ?? []), e.turn]);
            } else if (e.t === "error") {
              finished = true;
              setError(e.error);
            }
          }
        }
        if (!finished) setError("答えが途中で切れました。もう一度聞いてください");
      } catch (e) {
        setError(e instanceof Error && !/fetch|Load failed/i.test(e.message) ? e.message : "通信できませんでした。電波を確かめて、もう一度聞いてください");
      } finally {
        setSending(false);
        setStatus("");
      }
    },
    [family.id, today, path, me, sending],
  );

  const restart = async () => {
    if (sending) return;
    try {
      await api(`/api/ask?familyId=${encodeURIComponent(family.id)}`, { method: "DELETE" });
      setTurns([]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "消せませんでした");
    }
  };

  const pregnant = !family.birthDate || family.birthDate > today;
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink/30" role="dialog" aria-modal="true" aria-label="手帳に聞く">
      <button type="button" className="h-10 shrink-0" onClick={onClose} aria-label="閉じる" tabIndex={-1} />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col rounded-t-3xl bg-paper" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold">手帳に聞く</h2>
            <p className="truncate text-xs text-muted">{isDemo ? "デモ（作った家族）の手帳" : "わが家の手帳"}・手続き・予定・使い方に答えて動きます</p>
          </div>
          <div className="flex shrink-0 items-center">
            {turns && turns.length > 0 && (
              <button type="button" onClick={() => void restart()} disabled={sending} className="min-h-11 px-2 text-sm text-muted underline underline-offset-2 disabled:opacity-50">
                新しく話す
              </button>
            )}
            <button type="button" onClick={onClose} className="min-h-11 min-w-11 px-2 text-base font-semibold text-ink" aria-label="閉じる">
              ✕
            </button>
          </div>
        </header>

        <div ref={list} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-live="polite">
          {turns === null && <p className="text-base text-muted">開いています…</p>}
          {turns && turns.length === 0 && (
            <div className="flex flex-col gap-3">
              <p className="text-base">この家族の予定と手帳を見て答えます。窓口調べ・下書き・画面の案内まで、そのままできます。</p>
              <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">体や心のこと、授乳や離乳食の量は、判断しません。日付つきで記録し、健診で聞く事と連絡先につなぎます。急ぐ時は赤い「急ぎの時」・119・#8000。</p>
              <ul className="flex flex-wrap gap-2">
                {starters(path, pregnant).map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => void send(s)} className="min-h-11 rounded-full border border-sky/40 bg-card px-3 text-sm text-sky">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {turns?.map((t, i) => (t.role === "user" ? <UserBubble key={i} turn={t} /> : <Answer key={i} turn={t} onNavigate={onClose} />))}
          {status && (
            <p className="flex items-center gap-2 self-start text-sm text-muted" role="status">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky" aria-hidden />
              {status}…
            </p>
          )}
          {error && <p className="rounded-xl bg-alert/10 px-3 py-2 text-base text-alert">{error}</p>}
        </div>

        <form
          className="flex items-end gap-2 border-t border-line px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <MicButton disabled={sending} familyId={family.id} onText={(t) => void send(t)} onError={setError} />
          <label htmlFor="ask-text" className="sr-only">
            聞きたい事
          </label>
          <textarea
            id="ask-text"
            ref={input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send(text);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder="聞きたい事を書く"
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-card px-3 py-2 text-base"
          />
          <button type="submit" disabled={sending || !text.trim()} className="min-h-11 shrink-0 rounded-full bg-rose px-4 text-base font-semibold text-white disabled:opacity-40">
            送る
          </button>
        </form>
      </div>
    </div>
  );
}

function UserBubble({ turn }: { turn: ChatTurn }) {
  return (
    <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-rose-soft px-3 py-2">
      {turn.who && <p className="text-xs text-muted">{turn.who}</p>}
      <p className="text-base whitespace-pre-wrap">{turn.text}</p>
    </div>
  );
}

function Answer({ turn, onNavigate }: { turn: ChatTurn; onNavigate: () => void }) {
  return (
    <div className="flex max-w-[95%] flex-col gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-card px-3 py-2">
      <p className="text-base whitespace-pre-wrap">{turn.text}</p>
      {turn.actions && turn.actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {turn.actions.map((a, i) => (
            <Action key={i} action={a} today={turn.today} onNavigate={onNavigate} />
          ))}
        </div>
      )}
      {turn.sources && turn.sources.length > 0 && (
        <Why label="調べたページ">
          {turn.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {s.title || s.url}
            </a>
          ))}
        </Why>
      )}
    </div>
  );
}

function Action({ action: a, today, onNavigate }: { action: AskAction; today: string; onNavigate: () => void }) {
  const { family } = useFamily();
  const router = useRouter();
  const path = usePathname();
  const [state, setState] = useState<"" | "busy" | "ok">("");
  const [note, setNote] = useState("");
  const milestone = useMemo(() => (a.type === "milestone" ? scheduleFor(family, today).find((m) => m.id === a.milestoneId) : undefined), [a, family, today]);

  const run = async (fn: () => Promise<string>) => {
    setState("busy");
    setNote("");
    try {
      setNote(await fn());
      setState("ok");
    } catch (e) {
      setNote(e instanceof Error ? e.message : "うまくいきませんでした");
      setState("");
    }
  };
  const doneNote = note && <p className={`text-sm ${state === "ok" ? "text-ok" : "text-alert"}`}>{note}</p>;

  switch (a.type) {
    case "open": {
      const go = () => {
        onNavigate();
        const [base, hash] = a.href.split("#");
        if (hash && (base || "/") === path) {
          const el = document.getElementById(hash);
          const fold = el?.closest("details");
          if (fold && !fold.open) fold.open = true;
          window.history.replaceState(null, "", a.href);
          requestAnimationFrame(() => el?.scrollIntoView({ block: "start" }));
          return;
        }
        // 急ぎの時は通信が無くても開けるよう、ふつうのリンクで開く（sw.js が取っておく）
        if (a.href === "/emergency") window.location.href = a.href;
        else router.push(a.href);
      };
      return (
        <Btn kind={a.href === "/emergency" ? "primary" : "secondary"} onClick={go}>
          {a.label} ›
        </Btn>
      );
    }
    case "call":
      return (
        <a href={telHref(a.tel)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-alert/40 bg-alert/5 px-3 text-base font-semibold text-alert">
          <span>{a.label}</span>
          <span className="tabular select-all">{a.tel}</span>
        </a>
      );
    case "concern":
      return (
        <div className="flex flex-col gap-1 rounded-xl bg-sky-soft p-3">
          <p className="text-sm text-muted">次の健診で先生に聞く事</p>
          <p className="text-base">{a.text}</p>
          {state !== "ok" && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(async () => {
                  await api("/api/visit/plan", { body: { familyId: family.id, concern: a.text, today } });
                  return "✓ 健診で聞く事に足しました（健診のタブに並びます）";
                })
              }
            >
              健診で聞く事に足す
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "record":
      return (
        <div className="flex flex-col gap-1 rounded-xl bg-rose-soft/60 p-3">
          <p className="text-sm text-muted">手帳に記録する事</p>
          <p className="text-base whitespace-pre-wrap">{a.text}</p>
          {state !== "ok" && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(async () => {
                  const r = await api<{ reply: string; techo?: unknown[] }>("/api/capture", { body: { familyId: family.id, today, text: a.text } });
                  return `✓ ${r.reply}${r.techo && r.techo.length > 0 ? "（手帳のタブで OK を待っています）" : ""}`;
                })
              }
            >
              {state === "busy" ? "記録しています…" : "手帳に記録する"}
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "done":
      return (
        <div className="flex flex-col gap-1">
          {state !== "ok" && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(async () => {
                  await api("/api/done", { body: { familyId: family.id, milestoneId: a.milestoneId, today } });
                  window.dispatchEvent(new Event("boshi:done"));
                  return `✓ 「${a.label}」を済みにしました（今日の画面の「済んだ事」から戻せます）`;
                })
              }
            >
              「{a.label}」を済みにする
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "milestone":
      if (!milestone) return null;
      return (
        <div className="flex flex-col gap-1 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">{a.label}</p>
          <MilestoneActions milestone={milestone} today={today} primary />
        </div>
      );
    case "message":
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
          <p className="text-sm font-semibold text-muted">{a.to}へ渡す文（送るのはあなた）</p>
          {a.subject && <CopyField label="件名" value={a.subject} />}
          <CopyField label="本文" value={a.body} long />
          <HandoffRow mail={a.via === "mail" ? { subject: a.subject, body: a.body } : undefined} line={a.via === "line" ? a.body : undefined} />
        </div>
      );
  }
}

/** 押している間だけ録音し、文字にして聞く小さなボタン */
function MicButton({ disabled, familyId, onText, onError }: { disabled: boolean; familyId: string; onText: (t: string) => void; onError: (m: string) => void }) {
  const [phase, setPhase] = useState<"idle" | "starting" | "recording" | "reading">("idle");
  const rec = useRef<MediaRecorder | null>(null);
  const holding = useRef(false);
  const startedAt = useRef(0);

  const start = async () => {
    if (disabled || phase !== "idle") return;
    holding.current = true;
    setPhase("starting");
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setPhase("idle");
      return onError("この機械では録音が使えません。書いて聞いてください");
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("idle");
      return onError("マイクが使えませんでした。ブラウザの設定でマイクを許可してください");
    }
    if (!holding.current) {
      stream.getTracks().forEach((t) => t.stop());
      setPhase("idle");
      return onError("押している間だけ録音します。押したまま話してください");
    }
    const type = pickAudioType();
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (Date.now() - startedAt.current < 700) {
        setPhase("idle");
        return onError("短すぎました。押したまま話してください");
      }
      setPhase("reading");
      try {
        const res = await fetch(`/api/ask/voice?familyId=${encodeURIComponent(familyId)}`, { method: "POST", body: new Blob(chunks, { type: r.mimeType || type || "audio/webm" }) });
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !j.text) throw new Error(j.error ?? "声を文字にできませんでした");
        onText(j.text);
      } catch (e) {
        onError(e instanceof Error ? e.message : "声を文字にできませんでした");
      } finally {
        setPhase("idle");
      }
    };
    rec.current = r;
    startedAt.current = Date.now();
    r.start();
    setPhase("recording");
  };
  const stop = () => {
    holding.current = false;
    if (rec.current?.state === "recording") rec.current.stop();
    rec.current = null;
  };
  const on = phase === "recording";
  return (
    <button
      type="button"
      disabled={disabled || phase === "reading"}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        void start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
      aria-pressed={on}
      aria-label="押している間だけ話して聞く"
      className={`flex min-h-11 shrink-0 touch-none select-none items-center rounded-full border-2 px-3 text-sm font-semibold disabled:opacity-50 ${on ? "border-rose bg-rose text-white" : "border-rose bg-rose-soft text-rose"}`}
    >
      {on ? "話しています" : phase === "reading" ? "聞き取り中" : "押して話す"}
    </button>
  );
}

function ChatIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.4A8 8 0 1 1 21 12z" />
    </svg>
  );
}
