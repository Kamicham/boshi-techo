"use client";

// 院内の道案内: 「いつもの病院」の順番があれば撮らずに出す。無ければ案内図・受付票を撮って作り、次からのために覚える。
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import { Btn, Fold, NextStep, Pill, Why } from "@/components/ui";
import type { GuideStep, VisitView } from "@/lib/visit";

type GuideData = NonNullable<VisitView["guide"]>;
interface KeptHospital {
  name?: string;
  guide?: { steps: GuideStep[]; unsure?: string | null; at: string; fromVisit?: string };
}

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

const PICK = "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full px-5 text-base font-semibold";

export function Guide({ visit, onChange, onDone }: { visit: VisitView; onChange: (g: GuideData) => void; onDone: () => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [kept, setKept] = useState<KeptHospital | null>(null);

  // いつもの病院（覚えている順番）
  useEffect(() => {
    let on = true;
    api<{ keep: { hospital?: KeptHospital } }>(`/api/keep?familyId=${encodeURIComponent(visit.familyId)}`)
      .then((r) => on && setKept(r.keep.hospital ?? {}))
      .catch(() => on && setKept({}));
    return () => {
      on = false;
    };
  }, [visit.familyId]);

  // 今日の健診の順番が無ければ、いつもの順番をそのまま出す（押した時にこの健診へ写す）
  const usual = !visit.guide && kept?.guide?.steps?.length ? kept.guide : null;
  const g: GuideData | null = visit.guide ?? (usual ? { steps: usual.steps, done: [], at: usual.at, unsure: usual.unsure ?? null } : null);
  const isUsual = !!usual || (!!visit.guide && !!kept?.guide && kept.guide.fromVisit !== visit.id && sameSteps(visit.guide.steps, kept.guide.steps));

  const send = async (files: FileList | null) => {
    if (!files?.length) return;
    setErr("");
    try {
      setBusy("写真を小さくしています…");
      const images = await Promise.all([...files].slice(0, 6).map((f) => shrink(f)));
      setBusy("順番を作っています…（30秒ほど）");
      const r = await api<{ guide: GuideData }>(`/api/visit/${visit.id}/guide`, { body: { images } });
      onChange(r.guide);
      setKept((k) => ({ ...k, guide: { steps: r.guide.steps, unsure: r.guide.unsure, at: r.guide.at, fromVisit: visit.id } }));
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
      await api(`/api/visit/${visit.id}`, { method: "PATCH", body: { guideDone: done, ...(visit.guide ? {} : { useKeptGuide: true }) } });
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const pick = (label: string, capture: boolean) => (
    <label className={`${PICK} ${capture ? "bg-rose text-white" : "border border-ink/20 bg-card text-ink"}`}>
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

  const nextIdx = g ? g.steps.findIndex((_, i) => !g.done.includes(i)) : -1;
  const next = g && nextIdx >= 0 ? g.steps[nextIdx] : null;
  const hospitalName = kept?.name;

  return (
    <section aria-label="院内の道案内" className="flex flex-col gap-3">
      {busy ? (
        <NextStep eyebrow="院内の道案内" title={busy} tone="sky" />
      ) : !g ? (
        kept === null ? (
          <p className="text-base text-muted">読み込んでいます…</p>
        ) : (
          <NextStep eyebrow="受付・院内の道案内" title="案内図か受付票を撮る" sub="回る順番を作ります。次からは撮らずに出します。">
            {pick("撮る", true)}
            {pick("写真から選ぶ", false)}
            <Btn kind="quiet" onClick={onDone}>
              とばす
            </Btn>
          </NextStep>
        )
      ) : next ? (
        <NextStep eyebrow={`次はここ（${nextIdx + 1}/${g.steps.length}）`} title={`${next.place}${next.floor ? `（${next.floor}）` : ""}`} sub={next.what}>
          <Btn onClick={() => void toggle(nextIdx)}>済んだ</Btn>
          <Btn kind="quiet" onClick={onDone}>
            診察に呼ばれた
          </Btn>
        </NextStep>
      ) : (
        <NextStep eyebrow="受付・院内の道案内" title="順番は全部済みました" tone="ok">
          <Btn onClick={onDone}>録音へ</Btn>
        </NextStep>
      )}

      {next?.note && <p className="text-base text-muted">{next.note}</p>}

      {g && (
        <Fold title={isUsual ? "いつもの順番" : "今日の順番"} count={g.steps.length}>
          {(isUsual || hospitalName) && (
            <div className="flex flex-wrap gap-2">
              {isUsual && <Pill tone="sky">いつもの病院</Pill>}
              {hospitalName && <Pill>{hospitalName}</Pill>}
            </div>
          )}
          <ol className="flex flex-col gap-2">
            {g.steps.map((s, i) => {
              const done = g.done.includes(i);
              const isNext = i === nextIdx;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => void toggle(i)}
                    aria-pressed={done}
                    className={`flex min-h-11 w-full items-start gap-3 rounded-lg border p-3 text-left text-base ${
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
                      <span className={`block font-semibold ${done ? "line-through" : ""}`}>
                        {s.place}
                        {s.floor && <span className="ml-2 text-sm font-normal text-sky">{s.floor}</span>}
                      </span>
                      <span className="block">{s.what}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {!busy && <div className="flex flex-wrap gap-2">{pick("撮り直す", true)}</div>}
        </Fold>
      )}

      {g?.unsure && (
        <Why label="受付で確かめる事">
          <p>{g.unsure}</p>
        </Why>
      )}
      {err && (
        <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-base text-alert">
          {err}
        </p>
      )}
    </section>
  );
}

function sameSteps(a: GuideStep[], b: GuideStep[]): boolean {
  return a.length === b.length && a.every((s, i) => s.place === b[i].place && s.what === b[i].what);
}
