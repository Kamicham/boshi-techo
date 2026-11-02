"use client";

// 院内の道案内: 案内図・受付票を撮ると、今日回る順番のチェックリストを作る。
import { useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { VisitView } from "@/lib/visit";

type GuideData = NonNullable<VisitView["guide"]>;

/** 長い辺 1600px の JPEG に縮める（送る量と Claude の読み込みを軽くする） */
async function shrink(file: File, max = 1600): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.round(img.naturalWidth * scale);
    const h = Math.round(img.naturalHeight * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function Guide({ visit, onChange }: { visit: VisitView; onChange: (g: GuideData) => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const g = visit.guide;

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    try {
      setBusy("写真を小さくしています…");
      const images = await Promise.all([...files].slice(0, 6).map((f) => shrink(f)));
      setBusy("Claude が写真を読んで、回る順番を作っています…（30秒ほど）");
      const r = await api<{ guide: GuideData }>(`/api/visit/${visit.id}/guide`, { body: { images } });
      onChange(r.guide);
    } catch (e) {
      setErr((e as Error).message || "写真を読めませんでした");
    } finally {
      setBusy("");
    }
  };

  const toggle = async (i: number) => {
    if (!g) return;
    const done = g.done.includes(i) ? g.done.filter((n) => n !== i) : [...g.done, i];
    onChange({ ...g, done });
    try {
      await api(`/api/visit/${visit.id}`, { method: "PATCH", body: { guideDone: done } });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const nextIdx = g ? g.steps.findIndex((_, i) => !g.done.includes(i)) : -1;
  const pick = (label: string, capture: boolean) => (
    <label className={`flex-1 cursor-pointer rounded-lg px-3 py-2 text-center text-sm font-semibold ${capture ? "bg-ink text-paper" : "border border-line"}`}>
      {label}
      <input
        type="file"
        accept="image/*"
        {...(capture ? { capture: "environment" as const } : { multiple: true })}
        className="sr-only"
        disabled={!!busy}
        onChange={(e) => {
          void send(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  return (
    <section aria-label="院内の道案内" className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <div>
        <h2 className="font-display text-lg font-bold">院内の道案内</h2>
        {!g && <p className="text-sm text-muted">受付票や院内の案内図を撮ると、今日回る順番を作ります。</p>}
      </div>

      {g && (
        <ol className="flex flex-col gap-2">
          {g.steps.map((s, i) => {
            const done = g.done.includes(i);
            const isNext = i === nextIdx;
            return (
              <li key={i}>
                <button
                  onClick={() => void toggle(i)}
                  aria-pressed={done}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left ${
                    isNext ? "border-2 border-rose bg-rose-soft" : done ? "border-line opacity-60" : "border-line"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-ok text-white" : isNext ? "bg-rose text-white" : "bg-line text-muted"
                    }`}
                  >
                    {done ? "✓" : i + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    {isNext && <span className="block text-xs font-semibold text-rose">次はここ</span>}
                    <span className={`block font-semibold ${done ? "line-through" : ""}`}>
                      {s.place}
                      {s.floor && <span className="ml-2 text-xs font-normal text-sky">{s.floor}</span>}
                    </span>
                    <span className="block text-sm">{s.what}</span>
                    {s.note && <span className="block text-xs text-muted">{s.note}</span>}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
      {g && nextIdx === -1 && <p className="text-sm font-semibold text-ok">今日の順番は全部済みました。おつかれさまでした。</p>}
      {g?.unsure && <p className="rounded-lg bg-warn/15 px-3 py-2 text-xs text-warn">受付で確かめる事: {g.unsure}</p>}

      {busy ? (
        <p className="text-sm text-muted">{busy}</p>
      ) : (
        <div className="flex gap-2">
          {pick(g ? "撮り直す" : "撮る", true)}
          {pick("写真から選ぶ", false)}
        </div>
      )}
      {err && <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{err}</p>}
    </section>
  );
}
