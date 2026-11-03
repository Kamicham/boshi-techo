"use client";

// 合言葉の画面。家族だけが手帳を開けるように。
import { useState } from "react";
import { plainError } from "@/components/ui";

export default function Unlock() {
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
      if (!r.ok) throw new Error(j.error ?? "うまくいきませんでした");
      // 家族の一覧を読み直すため、ページごと開き直す
      window.location.href = "/";
    } catch (e) {
      const m = plainError(e);
      setErr(m === "通信できませんでした" ? "通信できませんでした。電波のある所でもう一度押してください" : m);
      setBusy(false);
    }
  };
  return (
    <main className="flex flex-col gap-4 px-4 pt-10">
      <h1 className="font-display text-2xl font-bold">家族の合言葉</h1>
      <p className="text-sm text-muted">この手帳は家族だけが開けます。教えてもらった合言葉を入れてください（この端末では1年間聞きません）。</p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          id="passcode"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="off"
          className="rounded-lg border border-line bg-card px-3 py-3 text-base tracking-widest"
          aria-label="合言葉"
        />
        <button disabled={busy || !code.trim()} className="rounded-xl bg-rose py-3 font-display text-lg font-bold text-white disabled:opacity-60">
          {busy ? "確かめています…" : "開く"}
        </button>
      </form>
      {err && <p role="alert" className="rounded-lg border-l-[3px] border-muted bg-paper px-3 py-2 text-base">{err}</p>}
    </main>
  );
}
