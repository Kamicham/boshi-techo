"use client";

// 全画面で使う共通の部品（画面の決まり: 次の一手が1つ・あと◯日・根拠は「なぜ？」の奥・ワンタップで外へ）。
// 新しい見た目を各画面で作らず、ここの部品を使う。
import Link from "next/link";
import { useState } from "react";
import { canShare, googleCalendarUrl, icsText, lineUrl, mailtoUrl, mapUrl } from "@/lib/handoff";

/** 開いた瞬間に一番上へ出す「今やる1つ」 */
export function NextStep({
  eyebrow,
  title,
  sub,
  days,
  dateLabel,
  tone = "rose",
  children,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  /** あと何日（0=今日、負=過ぎた）。無ければ出さない */
  days?: number | null;
  dateLabel?: string;
  tone?: "rose" | "sky" | "ok";
  children?: React.ReactNode;
}) {
  const bg = tone === "sky" ? "bg-sky-soft" : tone === "ok" ? "bg-ok/10" : "bg-rose-soft";
  return (
    <section className={`flex flex-col gap-3 rounded-2xl ${bg} p-5`}>
      {eyebrow && <p className="text-sm font-semibold text-muted">{eyebrow}</p>}
      <h2 className="font-display text-2xl leading-snug font-bold text-balance">{title}</h2>
      {days != null && <Countdown days={days} dateLabel={dateLabel} />}
      {sub && <p className="text-base">{sub}</p>}
      {children && <div className="flex flex-wrap gap-2 pt-1">{children}</div>}
    </section>
  );
}

/** あと◯日を大きく。近いほど強い色 */
export function Countdown({ days, dateLabel, size = "lg" }: { days: number; dateLabel?: string; size?: "lg" | "sm" }) {
  const color = days < 0 ? "text-alert" : days <= 3 ? "text-alert" : days <= 14 ? "text-warn" : "text-ink";
  const text = days < 0 ? `${-days}日過ぎています` : days === 0 ? "今日まで" : days === 1 ? "あした" : `あと${days}日`;
  return (
    <p className="flex items-baseline gap-2">
      <span className={`font-display font-bold ${color} ${size === "lg" ? "text-4xl" : "text-lg"}`}>{text}</span>
      {dateLabel && <span className="text-sm text-muted">{dateLabel}</span>}
    </p>
  );
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
export function Fold({ title, count, children, open }: { title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="group rounded-2xl border border-line bg-card" open={open}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4 font-display text-lg font-bold">
        <span>
          {title}
          {count != null && <span className="ml-2 text-sm font-normal text-muted">{count}件</span>}
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
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-muted">
          {label}
          {blanks > 0 && <span className="ml-2 text-xs text-warn">【 】が{blanks}か所</span>}
        </span>
        <CopyButton text={value} />
      </div>
      <p className={`whitespace-pre-wrap rounded-lg bg-paper px-3 py-2 text-base ${all ? "" : "line-clamp-4"}`}>{highlightBlanks(value)}</p>
      {long && !all && (
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
  if (!canShare()) return <CopyButton text={text} label="全部コピー" />;
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
  const isApple = typeof navigator !== "undefined" && /iPhone|iPad|Macintosh/.test(navigator.userAgent);
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
        <Btn href={mapUrl(place)} kind="secondary">
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
