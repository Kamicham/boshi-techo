"use client";

// 待ちが長い処理（Claude が考えている30秒ほど）の「いま何をしているか」と「終わったら何が出るか」。
// steps・then の言葉は、渡す側が t() で訳す
import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { Btn } from "../ui";

export function Working({ steps, then }: { steps: { at: number; text: string }[]; then?: string }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);
  const now = [...steps].reverse().find((s) => sec >= s.at) ?? steps[0];
  return (
    <div role="status" className="flex flex-col gap-1 rounded-xl bg-sky-soft px-4 py-3 text-sky">
      <p className="flex items-center gap-2 text-base font-semibold">
        <span className="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-sky" aria-hidden />
        <span className="min-w-0 flex-1">{now.text}</span>
        <span className="tabular shrink-0 text-sm font-normal">{t("{n}秒", { n: sec })}</span>
      </p>
      {then && <p className="text-sm text-ink/70">{then}</p>}
    </div>
  );
}

/** 失敗の一文（サーバの文は route() が訳して返す）。押し直しても変わらない失敗（settled）は赤にせず、「もう一度」も出さない */
export function ErrorLine({ text, onRetry, settled }: { text: string; onRetry: () => void; settled?: boolean }) {
  if (settled) return <p className="rounded-xl bg-paper px-4 py-2 text-base text-muted">{text}</p>;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-alert/10 px-4 py-2 text-base text-alert">
      <span className="min-w-0 flex-1">{text}</span>
      <Btn kind="secondary" onClick={onRetry}>
        {/* 「もう一度」だけの鍵は一冊の映画（もう一度見る）の訳。やり直すの訳は、空の {retry} を付けた鍵で引く（日本語は同じ） */}
        {t("もう一度{retry}", { retry: "" })}
      </Btn>
    </div>
  );
}
