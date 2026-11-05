"use client";

// 合言葉の画面。家族だけが手帳を開けるように。
// 言葉（2026-11-05 多言語化）: 画面の字は useT() で訳す（辞書は lib/i18n/dict/emergency.ts）。合言葉が違う時などの断りは /api/unlock が頼みの言葉で返す
import Link from "next/link";
import { useState } from "react";
import { useT } from "@/components/LocaleProvider";
import { plainError } from "@/components/ui";

export default function Unlock() {
  const t = useT();
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/unlock", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: code }) });
      const j = (await r.json().catch(() => ({}))) as { error?: string };
      if (!r.ok) throw new Error(j.error ?? t("うまくいきませんでした"));
      // 家族の一覧を読み直すため、ページごと開き直す
      window.location.href = "/";
    } catch (e) {
      const m = plainError(e);
      // plainError は訳した文を返すので、訳した文と比べる
      setErr(m === t("通信できませんでした") ? t("通信できませんでした。電波のある所でもう一度押してください") : m);
      setBusy(false);
    }
  };
  return (
    <main className="flex flex-col gap-4 px-4 pt-6">
      <Link href="/" className="inline-flex min-h-11 items-center self-start text-sm text-muted underline-offset-2 hover:underline">
        {t("‹ 戻る")}
      </Link>
      <h1 className="font-display text-2xl font-bold">{t("家族の合言葉")}</h1>
      <p className="text-sm text-muted">{t("この手帳は家族だけが開けます。教えてもらった合言葉を入れてください（この端末では1年間聞きません）。")}</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          id="passcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          // 合言葉は英字も入る（iPhone で数字だけのキーボードにしない）。頭の字を大文字にしない・直さない
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          className="rounded-lg border border-line bg-card px-3 py-3 text-base tracking-widest"
          aria-label={t("合言葉")}
        />
        <button disabled={busy || !code.trim()} className="rounded-xl bg-rose py-3 font-display text-lg font-bold text-white disabled:opacity-60">
          {busy ? t("確かめています…") : t("開く")}
        </button>
      </form>
      {err && <p role="alert" className="rounded-lg border-l-[3px] border-muted bg-paper px-3 py-2 text-base">{err}</p>}
    </main>
  );
}
