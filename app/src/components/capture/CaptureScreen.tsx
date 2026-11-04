"use client";

// ① 入力ゼロ: 話すだけ・撮るだけで、記録と予定になる。
// 開いた瞬間に出すのは「話す」「撮る」の2つだけ。記録の一覧は下に畳む。
import { ClaudeConsentLink } from "../settings/ClaudeConsentLink";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Notice, plainError, Why } from "@/components/ui";
import { KeepSheet } from "@/components/album/KeepSheet";
import { useMedia } from "@/components/album/useMedia";
import type { CaptureRecord, CaptureResult, RecordSource, TechoPhotoResult } from "@/lib/capture";
import { HoldToTalk } from "./HoldToTalk";
import { LetterKeeper } from "@/components/album/LetterKeeper";
import { VoiceKeeper } from "@/components/album/VoiceKeeper";
import { shrinkPhoto } from "./media";
import { PhotoChoice, type ReadKind } from "./PhotoChoice";
import { TechoCandidates } from "./TechoCandidates";
import { TypeSheet } from "./TypeSheet";
import { RecordItem, Timeline } from "./Timeline";
import { afterConsentReturn, consentWaitKey, isClaudeConsentError, mayTrySend, readConsentState, type ClaudeConsentState } from "@/lib/claude-consent-flow";

type Last = CaptureResult & { transcript?: string; source: RecordSource };

/** まだ答えていない聞き返し（サーバに残っている。開き直しても答える欄を出す） */
type Ask = { captureId: string; question: string; basis: string; source: RecordSource };

/** 仕組みの都合の知らせ（何が起きたか／書いた事は無事か／原文） */
type Fail = { title: string; safe?: string; detail?: string };

/**
 * 失敗の知らせを、何を送っていたかで言い分ける。「残っています」と書くのは、本当に残る時だけ:
 * - 書いた文・答え: 送れた時だけ欄を空にするので、欄に残る
 * - 話した: 聞き取れていれば書く欄に入れる（VoiceError）。聞き取る前に落ちた時は録音は残らない
 * - 撮った: 写真はこの画面に取っておかない
 */
type FailKind = "load" | "voice" | "photo" | "page" | "text" | "answer" | "skip" | "seed";
function failOf(kind: FailKind, e: unknown): Fail {
  const detail = plainError(e);
  switch (kind) {
    case "load":
      return { title: "記録を読み込めませんでした", safe: "手帳の記録は消えていません。電波のある所で開き直してください", detail };
    case "voice":
      return e instanceof VoiceError && e.transcript
        ? { title: "まだ送れていません", safe: "聞き取った言葉は、下の書く欄に残っています。そのまま送り直せます", detail }
        : { title: "まだ送れていません", safe: "録音は残っていません。もう一度話してください", detail };
    case "photo":
    case "page":
      return { title: "まだ読めていません", safe: "写真はこの画面に残っていません。もう一度撮ってください", detail };
    case "text":
      return { title: "まだ送れていません", safe: "書いた事は、この画面の下の欄に残っています。そのまま送り直せます", detail };
    case "answer":
      return { title: "まだ送れていません", safe: "答えは欄に残っています。そのまま送り直せます", detail };
    case "skip":
      return { title: "まだ手帳に届いていません", safe: "記録はそのままです", detail };
    case "seed":
      return { title: "デモの記録を入れられませんでした", detail };
  }
}

/** 文字起こしまではできたが、手帳に書けなかった時のエラー */
class VoiceError extends Error {
  transcript: string;
  constructor(message: string, transcript: string) {
    super(message);
    this.transcript = transcript;
  }
}

export function CaptureScreen() {
  const { family, today, isDemo } = useFamily();
  const [records, setRecords] = useState<CaptureRecord[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const [error, setError] = useState<Fail | null>(null);
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(false);
  // 打つ（話す・撮ると同じ重さの3つ目の入れ方。Claude を通さない）
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  // 書きかけの文は、この端末のこのタブにだけ控える（同意の画面へ移って戻った時に消えないように）
  const DRAFT_KEY = `boshi.captureDraft:${family.id}`;
  useEffect(() => {
    try {
      const d = sessionStorage.getItem(DRAFT_KEY);
      if (d) {
        setText(d);
        setWriting(true);
      }
    } catch {}
  }, [DRAFT_KEY]);
  useEffect(() => {
    try {
      if (text) sessionStorage.setItem(DRAFT_KEY, text);
      else sessionStorage.removeItem(DRAFT_KEY);
    } catch {}
  }, [DRAFT_KEY, text]);
  // 米国の Claude に送る同意: 送る前に読む（読めない時は null。送ってみて 403 なら needed にする）
  const WAIT_KEY = consentWaitKey(family.id);
  const [consent, setConsent] = useState<ClaudeConsentState>(null);
  const [consentRead, setConsentRead] = useState(false);
  // 同意がまだで送らなかった時、何を送ろうとしていたか（青い案内の言い方を変える）
  const [held, setHeld] = useState<FailKind | null>(null);
  const resumed = useRef(false);
  useEffect(() => {
    let off = false;
    setConsentRead(false);
    api<unknown>(`/api/account/consent?familyId=${encodeURIComponent(family.id)}`)
      .then((j) => !off && setConsent(readConsentState(j)))
      .catch(() => !off && setConsent(null))
      .finally(() => !off && setConsentRead(true));
    return () => {
      off = true;
    };
  }, [family.id]);
  const [answer, setAnswer] = useState("");
  const [last, setLast] = useState<Last | null>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  // 手帳で OK を待っている候補の数（話す・撮るの画面を離れても見失わないように）
  const [pending, setPending] = useState(0);
  // 手帳の「撮って足す」「話して足す」から来た時（/capture?techo=photo|voice）
  const [from, setFrom] = useState<"photo" | "voice" | null>(null);
  // 今日の画面の節目の一言から来た時（/capture?keep=1）は「撮る」と、選ぶ時の「残す」を光らせる
  const [keepFrom, setKeepFrom] = useState(false);
  // 撮った（選んだ）写真。使い道（読み取る／残す）を選ぶまで、この電話の中だけに置く
  const [shot, setShot] = useState<File[] | null>(null);
  // 「残す」を選んだ写真（KeepSheet が /api/media へ送る。Claude には送らない）
  const [keeping, setKeeping] = useState<File[] | null>(null);
  const { unavailable: keepUnavailable } = useMedia();
  const photoInput = useRef<HTMLInputElement>(null);
  const shootButton = useRef<HTMLButtonElement>(null);
  const talkBox = useRef<HTMLDivElement>(null);

  const loadPending = useCallback(async () => {
    try {
      const j = await api<{ techo?: { data?: { pending?: boolean } }[] }>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`);
      setPending((j.techo ?? []).filter((d) => d.data?.pending).length);
    } catch {
      // 数が読めなくても、話す・撮るは使える
    }
  }, [family.id, today]);

  const load = useCallback(async () => {
    try {
      const j = await api<{ records: CaptureRecord[]; ask?: Ask | null }>(`/api/capture?familyId=${encodeURIComponent(family.id)}&today=${today}`);
      setRecords(j.records);
      setAsk(j.ask ?? null);
    } catch (e) {
      setError(failOf("load", e));
    }
    void loadPending();
  }, [family.id, today, loadPending]);

  useEffect(() => {
    setLast(null);
    void load();
  }, [load]);

  // 手帳から来た時: 撮るなら写真を選ぶ欄を開き（選んだ後は「紙の母子手帳のページ」を光らせる）、話すなら話すボタンを見せる
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("keep") === "1") {
      setKeepFrom(true);
      shootButton.current?.scrollIntoView({ block: "center" });
      return;
    }
    const t = sp.get("techo");
    if (t !== "photo" && t !== "voice") return;
    setFrom(t);
    if (t === "photo") {
      shootButton.current?.scrollIntoView({ block: "center" });
      // 端末によっては、押さずに写真を選ぶ欄は開けない（その時は光らせたボタンを押してもらう）
      try {
        photoInput.current?.click();
      } catch {}
    } else {
      talkBox.current?.scrollIntoView({ block: "center" });
    }
  }, []);

  useEffect(() => {
    if (!busy) return;
    setSecs(0);
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [busy]);

  /** 待ちの長い処理を、いま何をしているかを出しながら走らせる */
  const run = async (label: string, kind: FailKind, fn: () => Promise<Last>) => {
    setError(null);
    setHeld(null);
    setBusy(label);
    try {
      const r = await fn();
      setLast(r);
      setAnswer("");
      await load();
      return true;
    } catch (e) {
      if (e instanceof VoiceError) {
        // 聞き取った言葉は書く欄に入れて、送り直せるようにする
        setText((cur) => (cur.trim() ? `${cur.trim()}\n${e.transcript}` : e.transcript));
        setWriting(true);
      }
      // 同意がまだだった時は、失敗の知らせ（赤）を出さず、同意の案内（青）だけを出す
      if (isClaudeConsentError(plainError(e))) {
        setConsent((c) => (c === "mother" ? c : "needed"));
        setHeld(kind);
        return false;
      }
      setError(failOf(kind, e));
      return false;
    } finally {
      setBusy(null);
    }
  };

  /** 同意がまだと分かっている時は送らずに、同意の案内だけを出す */
  const holdForConsent = (kind: FailKind) => {
    if (mayTrySend(consent)) return false;
    setError(null);
    setHeld(kind);
    return true;
  };

  const sendVoice = (blob: Blob) =>
    holdForConsent("voice") ||
    run("聞き取っています", "voice", async () => {
      const r = await fetch(`/api/capture/voice?familyId=${encodeURIComponent(family.id)}&today=${today}`, {
        method: "POST",
        headers: { "content-type": blob.type || "application/octet-stream" },
        body: blob,
      });
      const j = (await r.json().catch(() => ({}))) as Last & { error?: string };
      if (!r.ok) {
        const msg = j.error ?? `うまくいきませんでした（${r.status}）`;
        if (j.transcript) throw new VoiceError(msg, j.transcript);
        throw new Error(msg);
      }
      return { ...j, source: "voice" };
    });

  const sendPhoto = async (file: File) => {
    if (holdForConsent("photo")) return;
    let image: string;
    try {
      image = await shrinkPhoto(file);
    } catch (e) {
      setError(failOf("photo", e));
      return;
    }
    await run("紙を読んでいます", "photo", async () => ({
      ...(await api<CaptureResult>("/api/capture/photo", { body: { familyId: family.id, today, image } })),
      source: "photo",
    }));
  };

  /** 紙の母子手帳のページを撮る → どのページか・行を読んで、手帳の候補にする */
  const sendPage = async (file: File) => {
    if (holdForConsent("page")) return;
    let image: string;
    try {
      image = await shrinkPhoto(file, 2000);
    } catch (e) {
      setError(failOf("page", e));
      return;
    }
    await run("手帳のページを読んでいます", "page", async () => {
      const r = await api<TechoPhotoResult>("/api/techo/photo", { body: { familyId: family.id, today, image } });
      return { captureId: r.captureId, records: [], deadlines: [], oneQuestion: null, reply: r.reply, basis: "", techo: r.techo, source: "photo" };
    });
  };

  /** 撮った写真の使い道を選んだ時。読み取る時だけ Claude に送る（残す道とは混ぜない） */
  const readShot = (kind: ReadKind) => {
    const f = shot?.[0];
    setShot(null);
    if (!f) return;
    void (kind === "page" ? sendPage(f) : sendPhoto(f));
  };
  const keepShot = () => {
    if (shot?.length) setKeeping(shot);
    setShot(null);
  };

  const sendText = async (given?: string, label = "手帳に書いています") => {
    const t = (given ?? text).trim();
    if (!t) return;
    if (holdForConsent("text")) return;
    const ok = await run(label, "text", async () => ({
      ...(await api<CaptureResult>("/api/capture", { body: { familyId: family.id, today, text: t } })),
      source: "text",
    }));
    if (ok) {
      setText("");
      setWriting(false);
    }
  };

  // 同意の画面から戻った時: 同意が済んでいれば、控えの文を1回だけ送る（送ったら控えと印を消す）
  useEffect(() => {
    if (!consentRead || resumed.current) return;
    resumed.current = true;
    let draft: string | null = null;
    let waiting = false;
    try {
      draft = sessionStorage.getItem(DRAFT_KEY);
      waiting = sessionStorage.getItem(WAIT_KEY) === "1";
    } catch {}
    const next = afterConsentReturn({ draft, waiting, state: consent });
    if (next === "send" && draft) {
      try {
        sessionStorage.removeItem(WAIT_KEY);
      } catch {}
      void sendText(draft, "同意できました。手帳に書いています");
    } else if (next === "ask") {
      setHeld("text");
    }
    // 戻った時の1回だけ（consentRead が立った時）に見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [consentRead]);

  const sendAnswer = async () => {
    if (!ask || !answer.trim()) return;
    const prev = ask;
    await run("書き直しています", "answer", async () => ({
      ...(await api<CaptureResult>("/api/capture/answer", {
        body: { familyId: family.id, today, captureId: prev.captureId, basis: prev.basis, question: prev.question, answer, source: prev.source },
      })),
      source: prev.source,
    }));
  };

  /** 聞き返しに答えない（残しておいた問いを消す。記録はそのまま） */
  const skipAsk = async () => {
    if (!ask) return;
    const id = ask.captureId;
    setAsk(null);
    setAnswer("");
    try {
      await api(`/api/capture?familyId=${encodeURIComponent(family.id)}&captureId=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch (e) {
      setError(failOf("skip", e));
    }
  };

  const seed = async () => {
    setError(null);
    try {
      await api("/api/capture/seed", { body: { familyId: family.id } });
      await load();
    } catch (e) {
      setError(failOf("seed", e));
    }
  };

  const hasSeed = records.some((r) => r.data.seed);

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="sr-only">話す・撮る</h1>
      <div className="flex flex-col gap-1">
        <p className="text-base text-muted">話す・撮る・打つ。楽な方で、手帳に入ります</p>
        <p className="text-sm text-muted">言われた事は話す、紙は撮る、体重や体温は打つ。どれで入れても同じ手帳になります</p>
      </div>

      {pending > 0 && (
        <Link href="/techo" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-sky/40 bg-sky-soft px-4 py-2">
          <span className="text-base font-semibold">OK 待ち {pending}件</span>
          <span className="shrink-0 text-base font-semibold text-sky">手帳で見る ›</span>
        </Link>
      )}

      {from === "voice" && <p className="rounded-xl bg-rose-soft px-3 py-2 text-base font-semibold">「話す」を押したまま話すと、手帳の候補になります</p>}
      {from === "photo" && <p className="rounded-xl bg-sky-soft px-3 py-2 text-base font-semibold">下の「撮る」で手帳のページを撮って、「読み取る」→「紙の母子手帳のページ」を選んでください</p>}

      <section aria-label="入れる" className="grid grid-cols-3 gap-2">
        <div ref={talkBox} className={from === "voice" ? "rounded-3xl ring-4 ring-rose/40" : undefined}>
          <HoldToTalk disabled={!!busy} onAudio={(b) => void sendVoice(b)} onError={(m) => setError({ title: m })} />
        </div>
        <button
          ref={shootButton}
          type="button"
          disabled={!!busy || !!shot}
          onClick={() => photoInput.current?.click()}
          className={`flex min-h-36 w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 border-sky bg-sky-soft px-1 text-sky disabled:opacity-50 ${from === "photo" || keepFrom ? "ring-4 ring-sky/40" : ""}`}
        >
          <CameraIcon />
          <span className="font-display text-xl font-bold">撮る</span>
          <span className="text-xs text-muted">紙も写真も</span>
        </button>
        <button
          type="button"
          aria-expanded={typing}
          onClick={() => {
            setTyped("");
            setTyping((v) => !v);
          }}
          className={`flex min-h-36 w-full flex-col items-center justify-center gap-1 rounded-3xl border-2 border-ink/40 bg-card px-1 text-ink ${typing ? "ring-4 ring-ink/20" : ""}`}
        >
          <KeyIcon />
          <span className="font-display text-xl font-bold">打つ</span>
          <span className="text-xs text-muted">数字・ひとこと</span>
        </button>
        {/* capture を付けるとカメラロールから選べなくなるので付けない（撮る・選ぶは端末が聞く。MDN 2025） */}
        <input
          ref={photoInput}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const xs = [...(e.target.files ?? [])].filter((f) => f.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)).slice(0, 50);
            e.target.value = "";
            if (xs.length) setShot(xs);
          }}
        />
      </section>

      {typing && (
        <TypeSheet
          onClose={() => setTyping(false)}
          onSaved={(m) => {
            setTyped(m);
            setTyping(false);
            void load();
          }}
        />
      )}
      {typed && !typing && (
        <p role="status" className="rounded-xl bg-card px-3 py-2 text-base font-semibold text-ok">
          {typed}
        </p>
      )}

      {/* 撮った後に使い道を選ぶ。読み取る道だけが Claude に送り、残す道（/api/media）は Claude に見せない */}
      {shot ? (
        <PhotoChoice
          files={shot}
          hint={from === "photo" ? "page" : keepFrom ? "keep" : null}
          keepUnavailable={keepUnavailable}
          onRead={readShot}
          onKeep={keepShot}
          onCancel={() => setShot(null)}
        />
      ) : typing ? null : (
        <p className="text-sm text-muted">撮った後に選べます: 「読み取る」＝文字を手帳に書き写す／「残す」＝写真のまま取っておく。読み取る時だけ、写真を手帳の中の AI（Claude）に送ります（その写真は手帳に残しません）</p>
      )}
      {keeping && <KeepSheet files={keeping} onClose={() => setKeeping(null)} />}

      <VoiceKeeper unavailable={keepUnavailable} />
      <LetterKeeper unavailable={keepUnavailable} />

      {busy && (
        <p role="status" className="flex items-center gap-2 rounded-2xl bg-sky-soft px-4 py-4 text-lg font-semibold text-sky">
          <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-sky" />
          {busy}…<span className="tabular text-sm font-normal text-muted">{secs}秒</span>
        </p>
      )}
      {error && <Notice title={error.title} safe={error.safe} detail={error.detail} />}
      {held && (
        <ClaudeConsentLink
          need
          back="/capture"
          waitMother={consent === "mother"}
          lead={consentLead(held)}
          onGo={() => {
            try {
              sessionStorage.setItem(WAIT_KEY, "1");
            } catch {}
          }}
        />
      )}

      {last && !busy && (
        <section aria-label="いま書いた事" className="flex flex-col gap-3 rounded-2xl bg-rose-soft p-5">
          <p className="font-display text-xl leading-relaxed font-bold">{last.reply}</p>
          {ask && ask.captureId === last.captureId && <AskBox ask={ask} answer={answer} setAnswer={setAnswer} onSend={() => void sendAnswer()} onSkip={() => void skipAsk()} />}
          {last.records.length > 0 && (
            <ul className="flex flex-col gap-2">
              {last.records.map((r) => (
                <RecordItem key={r.id} r={r} family={family} today={today} />
              ))}
            </ul>
          )}
          {last.techo?.length > 0 && <TechoCandidates key={last.captureId} familyId={family.id} items={last.techo} onChange={() => void loadPending()} />}
          {last.transcript && (
            <Why label="聞き取った言葉">
              <p>「{last.transcript}」</p>
            </Why>
          )}
        </section>
      )}

      {/* 開き直した時など、いま書いた事の下に無い聞き返し（前に聞いて、まだ答えていない問い） */}
      {ask && !busy && ask.captureId !== last?.captureId && (
        <section aria-label="まだ答えていない問い" className="flex flex-col gap-2 rounded-2xl bg-rose-soft p-4">
          <p className="text-sm text-muted">前に入れた事について、1つだけ聞かせてください</p>
          <AskBox ask={ask} answer={answer} setAnswer={setAnswer} onSend={() => void sendAnswer()} onSkip={() => void skipAsk()} />
        </section>
      )}

      <h2 className="font-display text-lg font-bold">記録と予定</h2>
      {writing ? (
        <section className="flex flex-col gap-2">
          <label htmlFor="capture-text" className="text-sm font-semibold text-muted">
            書いて入れる
          </label>
          <textarea
            id="capture-text"
            rows={3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: 来週の火曜に保育園の見学"
            className="w-full rounded-xl border border-line bg-card px-3 py-2 text-base"
          />
          <div className="flex justify-end gap-2">
            <Btn kind="quiet" onClick={() => setWriting(false)}>
              やめる
            </Btn>
            <Btn onClick={() => void sendText()} disabled={!!busy || !text.trim()}>
              手帳に書く
            </Btn>
          </div>
        </section>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Btn kind="secondary" onClick={() => setWriting(true)}>
            長めに書いて、手帳に分けてもらう
          </Btn>
          {isDemo && !hasSeed && (
            <Btn kind="quiet" onClick={() => void seed()}>
              デモの記録を入れる
            </Btn>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pb-6">
        <Timeline records={records} family={family} today={today} isDemo={isDemo} />
      </div>
    </main>
  );
}

/** 同意がまだで送らなかった時の、青い案内の文（何を送ろうとしていたかで言い分ける） */
function consentLead(kind: FailKind) {
  switch (kind) {
    case "voice":
      return "話した事を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。録音はまだ送っていません。同意の後に、もう一度話してください。";
    case "photo":
    case "page":
      return "撮った紙を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは、「読み取る」を選んだ1枚だけです）。写真はまだ送っていません。同意の後に、もう一度撮ってください。";
    case "answer":
      return "答えを手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。答えは欄に残っています。";
    default:
      return "この文を手帳の欄に分けるには、もう1つ同意が要ります（米国の Claude に送るのは文字だけです）。";
  }
}

/** 聞き返しの問いと、答える欄 */
function AskBox({ ask, answer, setAnswer, onSend, onSkip }: { ask: Ask; answer: string; setAnswer: (v: string) => void; onSend: () => void; onSkip: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
      <label htmlFor="capture-answer" className="text-base font-semibold">
        {ask.question}
      </label>
      <div className="flex gap-2">
        <input
          id="capture-answer"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && onSend()}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line px-3 text-base"
        />
        <Btn onClick={onSend} disabled={!answer.trim()}>
          答える
        </Btn>
      </div>
      <button type="button" onClick={onSkip} className="min-h-11 self-start px-1 text-sm text-muted underline underline-offset-2">
        答えない（記録はこのまま）
      </button>
    </div>
  );
}

function KeyIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M7 10h.01M11 10h.01M15 10h.01M7 14h10" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}
