"use client";

// 手帳に聞く: どの画面からでも右下の「聞く」で開く窓。書いても、押して話しても聞ける。
// 手帳はこの家族の今を見てから答え、返事の下に動き（画面へ行く・下書き・済みにする・健診で聞く・記録する・渡す文・電話）を添える。
// 書き込む動きは、家族が押すまで何も変えない。体・心・栄養は判断せず、記録・健診で聞く事・連絡先への橋だけ（lib/ask/agent.ts）。
import { ClaudeConsentLink } from "../settings/ClaudeConsentLink";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { telHref } from "@/lib/ask/bridge";
import type { AskAction, AskEvent, ChatTurn } from "@/lib/ask/types";
import { t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { msWords } from "@/lib/i18n/milestone-words";
import { scheduleFor } from "@/lib/milestones";
import { api, useFamily } from "../FamilyProvider";
import { MilestoneActions } from "../MilestoneActions";
import { pickAudioType } from "../capture/media";
import { Btn, CopyField, HandoffRow, Why } from "../ui";
import { askConsentWaitKey, isClaudeConsentError, readConsentState, type ClaudeConsentState } from "@/lib/claude-consent-flow";

/**
 * 窓を開いた時の、最初の問いの例（今いる画面と、子の時期に合わせる。1歳の子に「出生届」を出さない）。
 * 押すと、訳した問いがそのままサーバへ送られる（中文・English でも、人が打つ形の問いにしてある）
 */
function starters(path: string, pregnant: boolean, ageDays: number): string[] {
  const common = [t("次にやる事は何？"), t("この画面では何ができる？")];
  if (path.startsWith("/visit")) return [...common, t("健診で何を聞けばいい？"), t("健診の日の録音はどうやるの？")];
  if (path.startsWith("/techo")) return [...common, t("撮った紙はどこで OK するの？"), t("予防接種の控えはどこ？")];
  if (path.startsWith("/capture")) return [...common, t("何を話せば記録になるの？"), t("役所の封筒を撮ったらどうなる？")];
  if (pregnant) return [...common, t("産休と育休はいつから？"), t("出産でもらえるお金は？")];
  if (ageDays < 45) return [...common, t("出生届はいつまで？どこに？"), t("児童手当は誰が申し込むの？")];
  if (ageDays < 730) return [...common, t("次の予防接種と健診はいつ？"), t("保育園の申し込みはいつ？")];
  return [...common, t("次の健診はいつ？"), t("これまでの記録を一冊にするには？")];
}

/** 訳した文の **…** を太字にして描く（t() は文字だけを返すので、太字の位置は訳の文の側に書く） */
function withBold(s: string): ReactNode[] {
  return s.split("**").map((part, i) => (i % 2 === 1 ? <b key={i}>{part}</b> : part));
}

/** 開き直した時、作っている途中の答えを待って拾う間隔 */
const POLL_MS = 4000;

export function AskButton({ hidden }: { hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const { family } = useFamily();
  const here = usePathname();
  // 同意の画面から戻った時は、窓を開き直して、答えの付かなかった問いを続ける（AskSheet が控えを読んで送る）。同意の画面の上では開かない
  useEffect(() => {
    if (here.startsWith("/account")) return;
    try {
      if (sessionStorage.getItem(askConsentWaitKey(family.id))) setOpen(true);
    } catch {}
  }, [family.id, here]);
  // 一覧の行の右端（日付・医療機関の文字）に重ならないよう、スクロールしている間は消し、止まって少ししたら出す。
  // 下へ読み進めている間は丸いアイコンだけに縮める（なりきりで「聞く」が行の日付に重なると繰り返し指摘された）
  const [scrolling, setScrolling] = useState(false);
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setScrolling(true);
      setCompact(window.scrollY > 80);
      clearTimeout(t);
      t = setTimeout(() => setScrolling(false), 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      clearTimeout(t);
    };
  }, []);
  if (hidden && !open) return null;
  return (
    <>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 z-20 mx-auto max-w-md" style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 4.25rem)" }}>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className={`absolute right-4 bottom-0 flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-full bg-sky text-base font-bold text-white shadow-lg transition-opacity duration-200 motion-reduce:transition-none ${compact ? "px-3" : "px-5"} ${scrolling ? "pointer-events-none opacity-0" : "pointer-events-auto opacity-100"}`}
            aria-label={t("手帳に聞く（質問・アプリの使い方）")}
          >
            <ChatIcon />
            {!compact && t("手帳に聞く")}
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

  // 作っている途中の問い（窓を閉じた後・二度押しの後）。答えができるまで GET で待つ
  const [waiting, setWaiting] = useState<ChatTurn | null>(null);
  // 米国の Claude に送る同意（まだの時は、予定表で答えられる問いだけ答え、ほかは先に同意を案内する。UX 2026-11-04）
  const [consent, setConsent] = useState<ClaudeConsentState>(null);
  const [consentRead, setConsentRead] = useState(false);
  useEffect(() => {
    let off = false;
    api<unknown>(`/api/account/consent?familyId=${encodeURIComponent(family.id)}`)
      .then((j) => !off && setConsent(readConsentState(j)))
      .catch(() => !off && setConsent(null))
      .finally(() => !off && setConsentRead(true));
    return () => {
      off = true;
    };
  }, [family.id]);
  useEffect(() => {
    let alive = true;
    setTurns(null);
    api<{ turns: ChatTurn[]; pending?: ChatTurn | null }>(`/api/ask?familyId=${encodeURIComponent(family.id)}`)
      .then((r) => {
        if (!alive) return;
        setTurns(r.turns);
        setWaiting(r.pending ?? null);
      })
      .catch(() => alive && setTurns([]));
    return () => {
      alive = false;
    };
  }, [family.id]);
  useEffect(() => {
    if (!waiting) return;
    let alive = true;
    const t = setInterval(() => {
      api<{ turns: ChatTurn[]; pending?: ChatTurn | null }>(`/api/ask?familyId=${encodeURIComponent(family.id)}`)
        .then((r) => {
          if (!alive || r.pending) return;
          setTurns(r.turns);
          setWaiting(null);
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [waiting, family.id]);

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
    async (q: string, retry = false) => {
      const question = q.trim();
      if (!question || sending || waiting) return;
      setSending(true);
      setError("");
      setStatus(t("考えています"));
      setText("");
      const mine: ChatTurn = { role: "user", text: question, today, at: new Date().toISOString(), ...(me ? { who: me.name } : {}) };
      // 聞き直しは、答えの無い最後の問いを置き換える
      setTurns((t) => [...(retry ? (t ?? []).slice(0, -1) : (t ?? [])), mine]);
      try {
        const r = await fetch("/api/ask", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ familyId: family.id, today, text: question, path, meId: me?.id, ...(retry ? { retry: true } : {}) }),
        });
        if (r.status === 409) {
          // 前の問いの答えを作っている（窓を閉じて開き直した時など）。二度目は作らず、前の答えを待つ
          setTurns((t) => (t ?? []).filter((x) => x !== mine));
          setWaiting(mine);
          return;
        }
        if (!r.ok || !r.body) {
          const j = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? t("うまくいきませんでした（{status}）", { status: r.status }));
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
        // 途中で切れても、サーバは答えを最後まで作って残す。待って拾う
        if (!finished) {
          setTurns((t) => (t ?? []).filter((x) => x !== mine));
          setWaiting(mine);
        }
      } catch (e) {
        setError(e instanceof Error && !/fetch|Load failed/i.test(e.message) ? e.message : t("通信できませんでした。電波を確かめて、もう一度聞いてください"));
      } finally {
        setSending(false);
        setStatus("");
      }
    },
    [family.id, today, path, me, sending, waiting],
  );

  // 同意の画面から戻った時: 同意が済んでいれば、答えの付かなかった最後の問いを1回だけ聞き直す
  const resumed = useRef(false);
  useEffect(() => {
    if (resumed.current || !consentRead || turns === null) return;
    resumed.current = true;
    let q: string | null = null;
    try {
      q = sessionStorage.getItem(askConsentWaitKey(family.id));
      sessionStorage.removeItem(askConsentWaitKey(family.id));
    } catch {}
    const last = turns[turns.length - 1];
    if (q && consent === "ok" && last?.role === "user" && last.text === q) void send(q, true);
  }, [consentRead, turns, consent, family.id, send]);

  const restart = async () => {
    if (sending) return;
    try {
      await api(`/api/ask?familyId=${encodeURIComponent(family.id)}`, { method: "DELETE" });
      setTurns([]);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("消せませんでした"));
    }
  };

  const markUsed = useCallback(
    (at: string, index: number) => {
      setTurns((ts) => (ts ?? []).map((t) => (t.at === at && t.role === "assistant" ? { ...t, used: [...new Set([...(t.used ?? []), index])] } : t)));
    },
    [],
  );

  const pregnant = !family.birthDate || family.birthDate > today;
  const ageDays = family.birthDate && !pregnant ? Math.round((Date.parse(today) - Date.parse(family.birthDate)) / 86_400_000) : 0;
  // 30日より前の話は畳む（日をまたいで長く並ばないように）
  const recentFrom = (turns ?? []).findIndex((t) => !t.today || Date.parse(today) - Date.parse(t.today) <= 30 * 86_400_000);
  const oldTurns = turns && recentFrom > 0 ? turns.slice(0, recentFrom) : turns && recentFrom < 0 ? turns : [];
  const newTurns = turns ? turns.slice(oldTurns.length) : [];
  const lastAsk = newTurns.length > 0 && newTurns[newTurns.length - 1].role === "user" ? newTurns[newTurns.length - 1] : null;
  const consentBlocked = isClaudeConsentError(error) || (!error && (consent === "needed" || consent === "mother"));
  const renderTurn = (t: ChatTurn, i: number) =>
    t.role === "user" ? <UserBubble key={t.at + i} turn={t} /> : <Answer key={t.at + i} turn={t} onNavigate={onClose} onUsed={markUsed} />;
  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-ink/30" role="dialog" aria-modal="true" aria-label={t("手帳に聞く")}>
      <button type="button" className="h-10 shrink-0" onClick={onClose} aria-label={t("閉じる")} tabIndex={-1} />
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col rounded-t-3xl bg-paper" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold">{t("手帳に聞く")}</h2>
            <p className="truncate text-xs text-muted">
              {isDemo ? t("見本の家族の手帳・手続き・予定・使い方に答えて動きます") : t("あなたの手帳・手続き・予定・使い方に答えて動きます")}
            </p>
          </div>
          <div className="flex shrink-0 items-center">
            {turns && turns.length > 0 && (
              <button type="button" onClick={() => void restart()} disabled={sending} className="min-h-11 px-2 text-sm text-muted underline underline-offset-2 disabled:opacity-50">
                {t("新しく話す")}
              </button>
            )}
            <button type="button" onClick={onClose} className="min-h-11 min-w-11 px-2 text-base font-semibold text-ink" aria-label={t("閉じる")}>
              ✕
            </button>
          </div>
        </header>

        <div ref={list} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-3" aria-live="polite">
          {turns === null && <p className="text-base text-muted">{t("開いています…")}</p>}
          {turns && turns.length === 0 && !waiting && (
            <div className="flex flex-col gap-3">
              <p className="text-base">{t("この家族の予定と手帳を見て答えます。窓口調べ・下書き・画面の案内まで、そのままできます。")}</p>
              {(consent === "needed" || consent === "mother") && (
                <p className="text-sm text-muted">
                  {consent === "mother"
                    ? t("次にやる事・健診と予防接種の日など、予定表で分かる事はすぐ答えます。ほかの問いは、ママが手帳に入って同意した後に答えます。")
                    : t("次にやる事・健診と予防接種の日など、予定表で分かる事はすぐ答えます。ほかの問いは、米国の Claude に送る同意の後に答えます。")}
                </p>
              )}
              <p className="rounded-xl bg-sky-soft px-3 py-2 text-sm">
                {t("体や心のこと、授乳や離乳食の量は、判断しません。日付つきで記録し、健診で聞く事と連絡先につなぎます。急ぐ時は赤い「急ぎの時」・119・#8000。")}
              </p>
              <ul className="flex flex-wrap gap-2">
                {starters(path, pregnant, ageDays).map((s) => (
                  <li key={s}>
                    <button type="button" onClick={() => void send(s)} className="min-h-11 rounded-full border border-sky/40 bg-card px-3 text-sm text-sky">
                      {s}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {oldTurns.length > 0 && (
            <details className="rounded-xl border border-line px-3 py-1">
              <summary className="min-h-11 cursor-pointer py-2 text-sm text-muted">{t("前の話（{n}件）", { n: oldTurns.filter((x) => x.role === "user").length })}</summary>
              <div className="flex flex-col gap-3 pb-2">{oldTurns.map(renderTurn)}</div>
            </details>
          )}
          {newTurns.map(renderTurn)}
          {/* 答えの付かなかった問い（前に失敗した・止まった）。聞き直せるようにする */}
          {/* 失敗の文は1つにまとめ、体の事で困った時の先（急ぎの時・#8000）をいつも添える（第31回: 答えが出ないまま、頼れる先が1つも無かった） */}
          {/* 同意がまだで答えられなかった問い: 赤い失敗や「急ぎの時」は出さず、同意の案内だけ。戻ったら続けて答える */}
          {!sending && !waiting && !status && lastAsk && consentBlocked && (
            <div className="self-stretch">
              <ClaudeConsentLink
                need
                back={path}
                waitMother={consent === "mother"}
                lead={<>{withBold(t("この問いに答えるには、**米国の Claude に送る同意**が要ります（問いと一緒に、最近の記録と会話も送ります）。同意の後に、続けて答えます。"))}</>}
                onGo={() => {
                  try {
                    sessionStorage.setItem(askConsentWaitKey(family.id), lastAsk.text);
                  } catch {}
                  // 同意の画面の上に窓を残さない（戻ったら AskButton が開き直す）
                  onClose();
                }}
              />
            </div>
          )}
          {!sending && !waiting && !status && lastAsk && !consentBlocked && (
            <div className="flex flex-col items-start gap-2 self-start">
              <p className="text-sm text-muted">{t(error || "この問いには、答えを作れませんでした。")}</p>
              <Btn kind="secondary" onClick={() => void send(newTurns[newTurns.length - 1].text, true)}>
                {t("もう一度聞く")}
              </Btn>
              <p className="text-sm text-muted">{t("体の事で急ぐ時は、答えを待たずに:")}</p>
              <div className="flex flex-wrap gap-2">
                <a
                  href={pregnant ? "/emergency#mama" : "/emergency"}
                  className="inline-flex min-h-11 items-center rounded-xl border border-alert/40 bg-alert/5 px-3 text-base font-semibold text-alert"
                >
                  {t("急ぎの時を開く")}
                </a>
                {!pregnant && (
                  <a href={telHref("#8000")} className="inline-flex min-h-11 items-center rounded-xl border border-alert/40 bg-alert/5 px-3 text-base font-semibold text-alert">
                    {t("迷ったら #8000")}
                  </a>
                )}
              </div>
            </div>
          )}
          {waiting && <UserBubble turn={waiting} />}
          {(status || waiting) && (
            <p className="flex items-center gap-2 self-start text-sm text-muted" role="status">
              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky" aria-hidden />
              {/* status はサーバの文（日本語）か、ここで訳した文。辞書に鍵があれば訳す */}
              {t("{status}…（閉じても、答えはここに残ります）", { status: t(status || "答えを作っています") })}
            </p>
          )}
          {error && !(newTurns.length > 0 && newTurns[newTurns.length - 1].role === "user") && <p className="rounded-xl bg-alert/10 px-3 py-2 text-base text-alert">{t(error)}</p>}
          {!lastAsk && <ClaudeConsentLink error={error} back={path} />}
        </div>

        <form
          className="flex items-end gap-2 border-t border-line px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(text);
          }}
        >
          <MicButton disabled={sending || !!waiting} familyId={family.id} onText={(t) => void send(t)} onError={setError} />
          <label htmlFor="ask-text" className="sr-only">
            {t("聞きたい事")}
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
            placeholder={t("聞きたい事を書く")}
            className="max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-line bg-card px-3 py-2 text-base"
          />
          <button type="submit" disabled={sending || !!waiting || !text.trim()} className="min-h-11 shrink-0 rounded-full bg-rose px-4 text-base font-semibold text-white disabled:opacity-40">
            {t("送る")}
          </button>
        </form>
      </div>
    </div>
  );
}

function UserBubble({ turn }: { turn: ChatTurn }) {
  return (
    <div className="max-w-[85%] self-end rounded-2xl rounded-br-md bg-rose-soft px-3 py-2">
      {turn.who && <p className="text-xs text-muted">{nameIn(turn.who)}</p>}
      <p className="text-base whitespace-pre-wrap">{turn.text}</p>
    </div>
  );
}

function Answer({ turn, onNavigate, onUsed }: { turn: ChatTurn; onNavigate: () => void; onUsed: (at: string, index: number) => void }) {
  return (
    <div className="flex max-w-[95%] flex-col gap-2 self-start rounded-2xl rounded-bl-md border border-line bg-card px-3 py-2">
      <p className="text-base whitespace-pre-wrap">{turn.text}</p>
      {turn.actions && turn.actions.length > 0 && (
        <div className="flex flex-col gap-2">
          {turn.actions.map((a, i) => (
            <Action key={i} action={a} at={turn.at} index={i} today={turn.today} onNavigate={onNavigate} used={turn.used?.includes(i) ?? false} onUsed={() => onUsed(turn.at, i)} />
          ))}
        </div>
      )}
      {turn.sources && turn.sources.length > 0 && (
        <Why label={t("調べたページ")}>
          {turn.sources.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
              {s.title || hostOf(s.url)}
            </a>
          ))}
        </Why>
      )}
    </div>
  );
}

function hostOf(u: string): string {
  try {
    return new URL(u).hostname;
  } catch {
    return u;
  }
}

function Action({
  action: a,
  at,
  index,
  today,
  onNavigate,
  used,
  onUsed,
}: {
  action: AskAction;
  /** 会話の中のどの動きか（サーバが読み直して行う） */
  at: string;
  index: number;
  today: string;
  onNavigate: () => void;
  /** もう押して済んだ（開き直しても同じ記録を2回入れない） */
  used: boolean;
  onUsed: () => void;
}) {
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
      onUsed();
    } catch (e) {
      setNote(e instanceof Error ? e.message : t("うまくいきませんでした"));
      setState("");
    }
  };
  const act = async () => {
    const r = await api<{ note: string; done?: boolean }>("/api/ask/act", { body: { familyId: family.id, at, index } });
    if (r.done) window.dispatchEvent(new Event("boshi:done"));
    return r.note;
  };
  // note は押した後のサーバの一言（日本語）か失敗の文。辞書に鍵があれば訳す
  const doneNote = note ? (
    <p className={`text-sm ${state === "ok" ? "text-ok" : "text-alert"}`}>{t(note)}</p>
  ) : used ? (
    <p className="text-sm text-ok">{t("✓ 済みました")}</p>
  ) : null;
  const can = state !== "ok" && !used;

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
        if (a.href.startsWith("/emergency")) window.location.href = a.href;
        else router.push(a.href);
      };
      return (
        <Btn kind={a.href.startsWith("/emergency") ? "primary" : "secondary"} onClick={go}>
          {t(a.label)} ›
        </Btn>
      );
    }
    case "call":
      return (
        <a href={telHref(a.tel)} className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-alert/40 bg-alert/5 px-3 text-base font-semibold text-alert">
          <span>{t(a.label)}</span>
          <span className="tabular select-all">{a.tel}</span>
        </a>
      );
    case "concern":
      return (
        <div className="flex flex-col gap-1 rounded-xl bg-sky-soft p-3">
          <p className="text-sm text-muted">
            {a.for === "mother"
              ? t("ママの次の健診で先生に聞く事")
              : family.childName
                ? t("{name}の次の健診で先生に聞く事", { name: nameIn(family.childName) })
                : t("次の健診で先生に聞く事")}
          </p>
          <p className="text-base">{a.text}</p>
          {can && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(act)
              }
            >
              {t("健診で聞く事に足す")}
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "record":
      return (
        <div className="flex flex-col gap-1 rounded-xl bg-rose-soft/60 p-3">
          <p className="text-sm text-muted">{t("記録に残す事（話す・撮るの「これまでの記録」に日付つきで。一冊には入りません）")}</p>
          <p className="text-base whitespace-pre-wrap">{a.text}</p>
          {can && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(act)
              }
            >
              {state === "busy" ? t("記録しています…") : t("記録に残す")}
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "done":
      // 札は予定の見出し（lib/milestones.ts の plain）。予定の言葉は msWords で訳す
      return (
        <div className="flex flex-col gap-1">
          {can && (
            <Btn
              kind="secondary"
              disabled={state === "busy"}
              onClick={() =>
                void run(act)
              }
            >
              {t("「{label}」を済みにする", { label: msWords(a.label) })}
            </Btn>
          )}
          {doneNote}
        </div>
      );
    case "milestone":
      if (!milestone) return null;
      return (
        <div className="flex flex-col gap-1 rounded-xl border border-line p-3">
          <p className="text-sm font-semibold">{msWords(a.label)}</p>
          <MilestoneActions milestone={milestone} today={today} primary />
        </div>
      );
    case "message":
      // 渡す文の件名・本文は、相手（勤め先・役所など）に合わせてサーバが書いた文のまま
      return (
        <div className="flex flex-col gap-2 rounded-xl bg-paper p-3">
          <p className="text-sm font-semibold text-muted">{t("{to}へ渡す文（送るのはあなた）", { to: t(a.to) })}</p>
          {a.subject && <CopyField label={t("件名")} value={a.subject} />}
          <CopyField label={t("本文")} value={a.body} long />
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
      return onError(t("この機械では録音が使えません。書いて聞いてください"));
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase("idle");
      return onError(t("マイクが使えませんでした。ブラウザの設定でマイクを許可してください"));
    }
    if (!holding.current) {
      stream.getTracks().forEach((x) => x.stop());
      setPhase("idle");
      return onError(t("押している間だけ録音します。押したまま話してください"));
    }
    const type = pickAudioType();
    const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = async () => {
      stream.getTracks().forEach((x) => x.stop());
      if (Date.now() - startedAt.current < 700) {
        setPhase("idle");
        return onError(t("短すぎました。押したまま話してください"));
      }
      setPhase("reading");
      try {
        const res = await fetch(`/api/ask/voice?familyId=${encodeURIComponent(familyId)}`, { method: "POST", body: new Blob(chunks, { type: r.mimeType || type || "audio/webm" }) });
        const j = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (!res.ok || !j.text) throw new Error(j.error ?? t("声を文字にできませんでした"));
        onText(j.text);
      } catch (e) {
        onError(e instanceof Error ? e.message : t("声を文字にできませんでした"));
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
      aria-label={t("押している間だけ話して聞く")}
      className={`flex min-h-11 shrink-0 touch-none select-none items-center rounded-full border-2 px-3 text-sm font-semibold disabled:opacity-50 ${on ? "border-rose bg-rose text-white" : "border-rose bg-rose-soft text-rose"}`}
    >
      {on ? t("話しています") : phase === "reading" ? t("聞き取り中") : t("押して話す")}
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
