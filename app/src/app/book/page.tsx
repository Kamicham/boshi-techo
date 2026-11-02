"use client";

// ⑦ 子どもへの贈り物: 1000日の記録が、最後に一冊になる。
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, CopyButton, Fold, NextStep, Pill, ShareButton, Why } from "@/components/ui";
import type { Book } from "@/lib/book";

function jpDay(s: string) {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

type Page =
  | { kind: "cover" }
  | { kind: "dedication" }
  | { kind: "chapter"; index: number }
  | { kind: "closing" };

function pagesOf(book: Book): Page[] {
  return [{ kind: "cover" }, { kind: "dedication" }, ...book.chapters.map((_, index) => ({ kind: "chapter" as const, index })), { kind: "closing" }];
}

const WAIT_STEPS = [
  "記録を日付順に並べています",
  "おなかにいた日々から、時期に分けています",
  "家族の言葉を読み返しています",
  "章の題を考えています",
  "子どもに語りかける言葉を選んでいます",
  "ページを綴じています",
];

export default function BookPage() {
  const { family, today, isDemo } = useFamily();
  const [book, setBook] = useState<Book | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [making, setMaking] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState("");
  const [page, setPage] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const r = await api<{ book: Book | null; count: number | null }>(`/api/book?familyId=${encodeURIComponent(family.id)}&today=${today}`);
      setBook(r.book);
      setCount(r.count);
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [family.id, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const make = async () => {
    setMaking(true);
    setError("");
    try {
      const r = await api<{ book: Book }>("/api/book", { body: { familyId: family.id, today } });
      setBook(r.book);
      setPage(0);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setMaking(false);
    }
  };

  const seed = async () => {
    setSeeding(true);
    setError("");
    try {
      await api("/api/capture/seed", { body: { familyId: family.id, today } });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  const child = family.childName ?? "赤ちゃん";
  const n = count ?? 0;

  if (making) return <Binding child={child} />;

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="sr-only">{child}への一冊</h1>

      {loading ? (
        <p className="text-base text-muted">本棚を見ています…</p>
      ) : book ? (
        <>
          <Reader book={book} page={page} setPage={setPage} />
          <div className="flex flex-wrap items-center gap-2">
            <ShareButton title={book.title} text={bookText(book)} label="家族に渡す" />
            <CopyButton text={bookText(book)} label="全部コピー" />
          </div>
          <Fold title="作り直す">
            <p className="text-base">
              {jpDay(book.asOf)}までの記録 <b className="tabular">{book.sourceCount}</b> 件から作りました
              {count != null && count > book.sourceCount && (
                <>
                  {" "}
                  <Pill tone="rose">いま {count} 件</Pill>
                </>
              )}
            </p>
            <Btn kind="secondary" onClick={() => void make()}>
              今日までの記録で作り直す
            </Btn>
          </Fold>
        </>
      ) : n === 0 && !isDemo ? (
        <NextStep eyebrow={`${child}への一冊`} title="まず話す・撮る" sub="ふだんの記録が、そのまま本になります">
          <Btn href="/capture">話す・撮るへ</Btn>
          <BookWhy />
        </NextStep>
      ) : (
        <NextStep eyebrow={`${child}への一冊`} title="一冊を作る" sub={n > 0 ? `いまの記録 ${n} 件から` : "デモの記録を入れてから作れます"}>
          {isDemo && n === 0 ? (
            <Btn onClick={() => void seed()} disabled={seeding}>
              {seeding ? "入れています…" : "デモの記録を入れる"}
            </Btn>
          ) : (
            <Btn onClick={() => void make()}>作る</Btn>
          )}
          <BookWhy />
        </NextStep>
      )}

      {error && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}
      <div className="pb-6" />
    </main>
  );
}

/** 何が本になるか（表に出さず「なぜ？」の奥へ） */
function BookWhy() {
  return (
    <div className="w-full">
      <Why label="何が本になる？">
        <p>話す・撮る: 胎動を感じた日、はじめて笑った顔</p>
        <p>健診: 先生と話した事（体の良し悪しは書きません）</p>
        <p>済んだ手続き: 家族がした事の題だけ</p>
      </Why>
    </div>
  );
}

/** 一冊を、そのまま送れる文に */
function bookText(book: Book): string {
  const parts = [book.title, `${book.childName}へ`, "", book.dedication];
  book.chapters.forEach((ch, i) => parts.push("", `第${i + 1}章　${ch.title}（${ch.period}）`, "", ch.text.trim()));
  parts.push("", "おわりに", "", book.closing.trim(), "", jpDay(book.asOf));
  return parts.join("\n");
}

/** 作っている間: 本が綴じられていく様子 */
function Binding({ child }: { child: string }) {
  const [sec, setSec] = useState(0);
  const step = Math.min(WAIT_STEPS.length - 1, Math.floor(sec / 12));
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <main className="flex flex-col items-center gap-6 px-4 pt-16 text-center" aria-live="polite">
      <div className="relative h-48 w-36">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute inset-0 animate-pulse rounded-r-lg border border-line bg-card shadow-sm"
            style={{ transform: `translate(${i * 4}px, ${i * -4}px)`, animationDelay: `${i * 0.4}s` }}
          />
        ))}
        <div className="absolute inset-0 flex translate-x-2 -translate-y-2 flex-col items-center justify-center gap-2 rounded-r-lg border-l-4 border-rose bg-rose-soft">
          <span className="font-display text-lg font-bold text-rose">{child}へ</span>
          <span className="text-xs text-muted">1000日の記録</span>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-display text-lg font-bold">一冊を綴じています</p>
        <p className="text-base text-ink">{WAIT_STEPS[step]}…</p>
        <p className="tabular text-sm text-muted">{sec} 秒・数分かかります。この画面のままで</p>
      </div>
    </main>
  );
}

function Reader({ book, page, setPage }: { book: Book; page: number; setPage: (n: number) => void }) {
  const pages = pagesOf(book);
  const p = Math.min(page, pages.length - 1);
  const go = (n: number) => setPage(Math.max(0, Math.min(pages.length - 1, n)));
  const touchX = useRef<number | null>(null);
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    top.current?.scrollTo({ top: 0 });
  }, [p]);

  return (
    <section className="flex flex-col gap-3">
      <div
        ref={top}
        className="min-h-[28rem] overflow-hidden rounded-r-2xl rounded-l-md border border-line border-l-4 border-l-rose/40 bg-card px-5 py-8 shadow-[0_2px_12px_rgba(43,42,51,0.08)]"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) go(dx < 0 ? p + 1 : p - 1);
        }}
      >
        <PageBody book={book} page={pages[p]} />
        {p > 0 && <p className="tabular mt-8 text-center text-sm text-muted">— {p} —</p>}
      </div>
      <nav className="flex items-center justify-between" aria-label="ページをめくる">
        <button onClick={() => go(p - 1)} disabled={p === 0} className="min-h-11 rounded-full border border-line bg-card px-5 text-base font-semibold disabled:opacity-30">
          ← 前へ
        </button>
        <span className="tabular text-sm text-muted">
          {p + 1} / {pages.length}
        </span>
        <button onClick={() => go(p + 1)} disabled={p === pages.length - 1} className="min-h-11 rounded-full border border-line bg-card px-5 text-base font-semibold disabled:opacity-30">
          次へ →
        </button>
      </nav>
    </section>
  );
}

function Paragraphs({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-5 text-[17px] leading-[2.05] tracking-wide">
      {text
        .split(/\n{2,}|\n/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s, i) => (
          <p key={i} className="indent-[1em]">
            {s}
          </p>
        ))}
    </div>
  );
}

function PageBody({ book, page }: { book: Book; page: Page }) {
  if (page.kind === "cover") {
    return (
      <div className="flex min-h-[24rem] flex-col items-center justify-center gap-6 text-center">
        <p className="text-xs tracking-[0.4em] text-rose">1000 日 の 記 録</p>
        <h2 className="font-display text-3xl font-bold leading-snug">{book.title}</h2>
        <div className="h-px w-16 bg-rose/40" />
        <p className="font-display text-lg">{book.childName}へ</p>
        <p className="tabular text-xs text-muted">
          {jpDay(book.range.start)} — {jpDay(book.range.end)}
        </p>
      </div>
    );
  }
  if (page.kind === "dedication") {
    return (
      <div className="flex min-h-[24rem] flex-col justify-center gap-6">
        <p className="text-center text-xs tracking-[0.3em] text-muted">はじめに</p>
        <p className="font-display text-xl leading-[2.2]">{book.dedication}</p>
      </div>
    );
  }
  if (page.kind === "closing") {
    return (
      <div className="flex min-h-[24rem] flex-col justify-center gap-6">
        <p className="text-center text-xs tracking-[0.3em] text-muted">おわりに</p>
        <Paragraphs text={book.closing} />
        <p className="text-right text-sm text-muted">{jpDay(book.asOf)}</p>
      </div>
    );
  }
  const ch = book.chapters[page.index];
  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-2 border-b border-line pb-4">
        <p className="text-xs tracking-[0.3em] text-rose">
          第{page.index + 1}章・{ch.period}
        </p>
        <h2 className="font-display text-2xl font-bold leading-snug">{ch.title}</h2>
      </header>
      <Paragraphs text={ch.text} />
      {ch.moments.length > 0 && (
        <ol className="flex flex-col gap-2 border-t border-dashed border-line pt-4 text-base">
          {ch.moments.map((m, i) => (
            <li key={i} className="grid grid-cols-[7.5rem_1fr] gap-2 leading-relaxed">
              <span className="tabular text-sm text-sky">{/^\d{4}-\d{2}-\d{2}$/.test(m.date) ? jpDay(m.date) : m.date}</span>
              <span>{m.text}</span>
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
