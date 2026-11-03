"use client";

// 全画面で使う共通の部品（画面の決まり: 次の一手が1つ・あと◯日・根拠は「なぜ？」の奥・ワンタップで外へ）。
// 新しい見た目を各画面で作らず、ここの部品を使う。
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { countdownLook } from "./countdown";
import { canShare, googleCalendarUrl, icsText, isAppleDevice, lineUrl, mailtoUrl, mapUrl } from "@/lib/handoff";

const noop = () => () => {};
const SERVER_DEVICE = { apple: false, share: false };
let clientDevice: { apple: boolean; share: boolean } | null = null;
/** 端末の違い（Apple か・共有シートがあるか）。サーバと描画の初めは false、開いてから本当の値に変わる（Hydration の食い違いを出さない） */
export function useDevice(): { apple: boolean; share: boolean } {
  return useSyncExternalStore(
    noop,
    () => (clientDevice ??= { apple: isAppleDevice(), share: canShare() }),
    () => SERVER_DEVICE,
  );
}

/** 開いた瞬間に一番上へ出す「今やる1つ」 */
export function NextStep({
  eyebrow,
  title,
  sub,
  days,
  dateLabel,
  tone = "rose",
  daysKind = "deadline",
  children,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  /** あと何日（0=今日、負=過ぎた）。無ければ出さない */
  days?: number | null;
  dateLabel?: string;
  tone?: "rose" | "sky" | "ok";
  /** days が期限か、始まりの日か */
  daysKind?: "deadline" | "start";
  children?: React.ReactNode;
}) {
  const bg = tone === "sky" ? "bg-sky-soft" : tone === "ok" ? "bg-ok/10" : "bg-rose-soft";
  return (
    <section className={`flex flex-col gap-3 rounded-2xl ${bg} p-5`}>
      {eyebrow && <p className="text-sm font-semibold text-muted">{eyebrow}</p>}
      <h2 className="font-display text-2xl leading-snug font-bold text-balance">{title}</h2>
      {days != null && <Countdown days={days} dateLabel={dateLabel} kind={daysKind} />}
      {sub && <p className="text-base">{sub}</p>}
      {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
    </section>
  );
}

/**
 * あと◯日。赤は「法で決まった期限で、残り1日以下」だけ（安心のデザイン: 赤は命の橋と本当の期限に取っておく）。
 * kind="start" は始まりの日（「◯日後から」）で、色を付けない。過ぎた物は責めずに「今からでも」と次の一手で言う。
 */
export function Countdown({
  days,
  dateLabel,
  size = "lg",
  kind = "deadline",
}: {
  days: number;
  dateLabel?: string;
  size?: "lg" | "sm";
  kind?: "deadline" | "start";
}) {
  const { color, text } = countdownLook(days, kind);
  const big = size === "lg" && !(kind === "deadline" && days < 0) ? "text-4xl" : size === "lg" ? "text-2xl" : "text-lg";
  return (
    <p className="flex flex-wrap items-baseline gap-x-2">
      <span className={`font-display font-bold ${color} ${big}`}>{text}</span>
      {dateLabel && <span className="text-sm text-muted">{kind === "deadline" && days < 0 ? `期限は${dateLabel}でした` : dateLabel}</span>}
    </p>
  );
}

/**
 * 仕組みの都合の知らせ（通信の失敗・保存の失敗）。体の警告と見分けるため、赤を使わない。
 * 文は3段: 何が起きたか（title）／記録は無事か（safe）／次の一手（children のボタン）。エラーの原文は「なぜ？」の奥。
 */
export function Notice({ title, safe, detail, children }: { title: string; safe?: string; detail?: string; children?: React.ReactNode }) {
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl border-l-[3px] border-muted bg-paper px-4 py-3">
      <p className="font-semibold">{title}</p>
      {safe && <p className="text-base">{safe}</p>}
      {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
      {detail && (
        <Why label="くわしく">
          <p>{detail}</p>
        </Why>
      )}
    </div>
  );
}

/** エラーの原文を、家族に分かる言葉に（Safari の「Load failed」・Chrome の「Failed to fetch」など） */
export function plainError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e ?? "");
  if (e instanceof TypeError || /load failed|failed to fetch|networkerror|network request failed/i.test(m)) return "通信できませんでした";
  return m || "うまくいきませんでした";
}

/** 大きなボタン（主）・枠だけのボタン（副）。押せる所は 44px 以上 */
export function Btn({
  children,
  onClick,
  href,
  kind = "primary",
  disabled,
  full,
  ariaLabel,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  kind?: "primary" | "secondary" | "quiet";
  disabled?: boolean;
  full?: boolean;
  ariaLabel?: string;
}) {
  const cls = `inline-flex min-h-11 items-center justify-center gap-1 rounded-full px-5 text-base font-semibold disabled:opacity-50 ${
    kind === "primary" ? "bg-rose text-white" : kind === "secondary" ? "border border-ink/20 bg-card text-ink" : "text-muted underline-offset-2 hover:underline"
  } ${full ? "w-full" : ""}`;
  if (href) {
    const external = /^(https?:|mailto:|tel:)/.test(href);
    return external ? (
      <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noreferrer" className={cls} aria-label={ariaLabel}>
        {children}
      </a>
    ) : (
      <Link href={href} className={cls} aria-label={ariaLabel}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={cls} aria-label={ariaLabel}>
      {children}
    </button>
  );
}

/** 「なぜ？」: 根拠・出典は表に出さず、押すと開く */
export function Why({ children, label = "なぜ？" }: { children: React.ReactNode; label?: string }) {
  return (
    <details className="group text-sm">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1 text-muted">
        <span className="underline underline-offset-2">{label}</span>
        <span className="transition-transform group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="mt-1 flex flex-col gap-1 rounded-lg bg-paper px-3 py-2 text-muted">{children}</div>
    </details>
  );
}

/** 2つ目以降を畳んでおく箱 */
export function Fold({ title, count, children, open, note }: { title: string; count?: number; children: React.ReactNode; open?: boolean; note?: string }) {
  return (
    <details className="group rounded-2xl border border-line bg-card" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-display text-lg font-bold">
        <span>
          {title}
          {count != null && <span className="ml-2 text-sm font-normal text-muted">{count}件</span>}
          {note && <span className="block text-sm font-normal text-muted">{note}</span>}
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>›</span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>
    </details>
  );
}

/** 一行の小さな札（状態・種類） */
export function Pill({ children, tone = "muted" }: { children: React.ReactNode; tone?: "muted" | "rose" | "sky" | "warn" | "alert" | "ok" }) {
  const c = {
    muted: "bg-line/60 text-muted",
    rose: "bg-rose-soft text-rose",
    sky: "bg-sky-soft text-sky",
    warn: "bg-warn/15 text-warn",
    alert: "bg-alert/10 text-alert",
    ok: "bg-ok/10 text-ok",
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${c}`}>{children}</span>;
}

/** ワンタップでコピー。押したら「コピーしました」 */
export function CopyButton({ text, label = "コピー" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 古い端末: 選んでコピーする
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <button type="button" onClick={() => void copy()} className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/20 bg-card px-4 text-sm font-semibold">
      {done ? "コピーしました" : label}
    </button>
  );
}

/** 1つの欄（宛先・件名・本文）と、そのコピー */
export function CopyField({ label, value, long }: { label: string; value: string; long?: boolean }) {
  const [all, setAll] = useState(!long);
  if (!value) return null;
  const blanks = (value.match(/【[^】]*】/g) ?? []).length;
  // 畳む時は行で切る（改行の多い本文でも、5行目がのぞいたり「…」だけの行が出たりしない）
  const lines = value.replace(/\n{3,}/g, "\n\n").split("\n");
  let head = lines.slice(0, 4).join("\n");
  if (head.length > 160) head = head.slice(0, 160);
  const cut = head.length < value.length;
  if (cut) head = head.replace(/\s+$/, "") + "…";
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted">
          {label}
          {blanks > 0 && <span className="ml-2 text-xs text-warn">【 】が{blanks}か所</span>}
        </span>
        <CopyButton text={value} />
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-base">{highlightBlanks(all ? value : head)}</p>
      {long && !all && cut && (
        <button type="button" onClick={() => setAll(true)} className="self-start text-sm text-muted underline">
          全部見る
        </button>
      )}
    </div>
  );
}

function highlightBlanks(text: string): React.ReactNode {
  const parts = text.split(/(【[^】]*】)/);
  return parts.map((p, i) => (p.startsWith("【") ? <mark key={i} className="rounded bg-warn/20 px-0.5 text-ink">{p}</mark> : p));
}

/** 共有シート（iPhone のメール・LINE・メモ・Slack などへ） */
export function ShareButton({ title, text, url, label = "共有…", kind = "secondary" }: { title?: string; text: string; url?: string; label?: string; kind?: "primary" | "secondary" }) {
  const [msg, setMsg] = useState("");
  const { share: can } = useDevice();
  if (!can) return <CopyButton text={text} label="全部コピー" />;
  const share = async () => {
    try {
      await navigator.share({ title, text, url });
    } catch (e) {
      if ((e as Error).name !== "AbortError") setMsg("共有できませんでした");
    }
  };
  return (
    <>
      <Btn kind={kind} onClick={() => void share()}>
        {label}
      </Btn>
      {msg && <span className="text-xs text-alert">{msg}</span>}
    </>
  );
}

/** 作った物を外へ渡すボタンの並び。必要な物だけ渡す */
export function HandoffRow({
  mail,
  line,
  share,
  calendar,
  place,
}: {
  mail?: { to?: string; subject?: string; body: string };
  line?: string;
  share?: { title?: string; text: string };
  calendar?: { title: string; date: string; time?: string | null; minutes?: number; details?: string; place?: string };
  place?: string;
}) {
  const openIcs = () => {
    if (!calendar) return;
    const blob = new Blob([icsText(calendar)], { type: "text/calendar" });
    window.location.href = URL.createObjectURL(blob);
  };
  const { apple: isApple } = useDevice();
  return (
    <div className="flex flex-wrap gap-2">
      {mail && (
        <Btn href={mailtoUrl(mail)} kind="primary">
          メールで開く
        </Btn>
      )}
      {line && (
        <Btn href={lineUrl(line)} kind={mail ? "secondary" : "primary"}>
          LINE で送る
        </Btn>
      )}
      {calendar &&
        (isApple ? (
          <Btn onClick={openIcs} kind="secondary">
            カレンダーに入れる
          </Btn>
        ) : (
          <Btn href={googleCalendarUrl(calendar)} kind="secondary">
            カレンダーに入れる
          </Btn>
        ))}
      {place && (
        <Btn href={mapUrl(place, isApple)} kind="secondary">
          地図で開く
        </Btn>
      )}
      {share && <ShareButton title={share.title} text={share.text} />}
    </div>
  );
}

/** 日付から「あと何日」（日本時間の暦日どうし） */
export function daysUntil(today: string, date: string): number {
  return Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000);
}
