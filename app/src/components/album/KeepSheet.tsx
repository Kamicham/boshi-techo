"use client";

// 「残す」で写真を選んだ後の1画面（Claude は使わない）。
// 1枚ずつ送り、「残しました。11月3日・生後3か月・お食い初めのころ」と出す。一言・★・結ぶ先は任意（押さなくても残る）。
import { useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn } from "@/components/ui";
import { keepPhoto, type KeepResult } from "@/components/capture/media";
import { keptLine } from "@/lib/media-shared";
import { invalidateMedia, patchMedia } from "./useMedia";

type Item = { file: File; preview: string; state: "wait" | "send" | "done" | "error"; result?: KeepResult; error?: string };

export function KeepSheet({ files, techoId, onClose }: { files: File[]; techoId?: string; onClose: () => void }) {
  const { family, today, me } = useFamily();
  const [items, setItems] = useState<Item[]>(() => files.map((file) => ({ file, preview: "", state: "wait" })));
  const started = useRef(false);

  // 見本の URL は効果の中で作って片付ける（開発の二度呼びでも、片付けた URL を見せない）
  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setItems((xs) => xs.map((x, i) => ({ ...x, preview: urls[i] ?? "" })));
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      for (let i = 0; i < files.length; i++) {
        setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "send" } : x)));
        try {
          const result = await keepPhoto(files[i], { familyId: family.id, today, techoId, by: me?.name });
          setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "done", result } : x)));
        } catch (e) {
          setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "error", error: (e as Error).message } : x)));
        }
      }
      invalidateMedia();
    })();
  }, [files, family.id, today, techoId, me?.name]);

  const done = items.filter((x) => x.state === "done").length;
  const sending = items.some((x) => x.state === "wait" || x.state === "send");
  const retry = async (i: number) => {
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "send", error: undefined } : x)));
    try {
      const result = await keepPhoto(items[i].file, { familyId: family.id, today, techoId, by: me?.name });
      setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "done", result } : x)));
      invalidateMedia();
    } catch (e) {
      setItems((xs) => xs.map((x, j) => (j === i ? { ...x, state: "error", error: (e as Error).message } : x)));
    }
  };

  return (
    <div role="dialog" aria-modal="true" aria-label="写真を残す" className="fixed inset-0 z-30 flex flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-3 overflow-y-auto px-4 pt-4 pb-6">
        <header className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-ok">🌸 残す</h2>
          <span className="tabular text-sm text-muted">
            {items.length}枚中 {done}枚
          </span>
        </header>
        {sending && (
          <p role="status" className="flex items-center gap-2 rounded-2xl bg-ok/10 px-4 py-3 text-base font-semibold text-ok">
            <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-ok" />
            Mac に置いています…
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {items.map((it, i) => (
            <li key={i}>
              <KeptRow
                item={it}
                familyId={family.id}
                line={it.result ? keptLine(family, it.result.media) : null}
                by={me?.name}
                today={today}
                onRetry={() => void retry(i)}
              />
            </li>
          ))}
        </ul>
        <p className="rounded-xl bg-card px-3 py-2 text-sm text-muted">Claude には見せていません。写真はこの手帳の置き場（Mac）にだけ置き、鍵をかけてあります。</p>
      </div>
      <div className="border-t border-line bg-card px-4 py-3" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
        <div className="mx-auto flex max-w-md gap-2">
          <Btn href="/album" kind="secondary">
            アルバムで見る
          </Btn>
          <Btn onClick={onClose} disabled={sending} full>
            {sending ? "置いています…" : "閉じる"}
          </Btn>
        </div>
      </div>
    </div>
  );
}

function KeptRow({
  item,
  familyId,
  line,
  by,
  today,
  onRetry,
}: {
  item: Item;
  familyId: string;
  line: string | null;
  by?: string;
  today: string;
  onRetry: () => void;
}) {
  const m = item.result?.media;
  const [caption, setCaption] = useState("");
  const [starred, setStarred] = useState(false);
  const [linked, setLinked] = useState<string[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!m) return;
    setCaption(m.caption ?? "");
    setStarred(m.starredByMe);
    setLinked(m.techoIds);
  }, [m]);

  const save = async (p: Record<string, unknown>) => {
    if (!m) return;
    setError("");
    try {
      await patchMedia(familyId, m.id, { by, today, ...p });
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {item.preview ? <img src={item.preview} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover" /> : <span className="h-24 w-24 shrink-0 rounded-xl bg-paper" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {item.state === "error" ? (
          <>
            <p className="text-base text-alert">{item.error}</p>
            <Btn kind="secondary" onClick={onRetry}>
              もう一度送る
            </Btn>
          </>
        ) : !m ? (
          <p className="text-base text-muted">{item.state === "send" ? "置いています…" : "待っています"}</p>
        ) : (
          <>
            <p className="text-base font-semibold">
              {item.result?.duplicate ? "もう残してありました。" : "残しました。"}
              <span className="font-normal">{line}</span>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={starred}
                onClick={() => {
                  setStarred(!starred);
                  void save({ star: !starred });
                }}
                className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${starred ? "border-warn bg-warn/10 text-warn" : "border-line"}`}
              >
                {starred ? "★ この1枚" : "☆ この1枚"}
              </button>
            </div>
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              onBlur={() => caption !== (m.caption ?? "") && void save({ caption })}
              placeholder="一言（任意）"
              aria-label="一言"
              className="min-h-11 w-full rounded-lg border border-line bg-paper px-3 text-base"
            />
            {(item.result?.candidates.length ?? 0) > 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted">この日の手帳の記録に結ぶ</p>
                <div className="flex flex-wrap gap-2">
                  {item.result!.candidates.map((c) => {
                    const on = linked.includes(c.id);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const next = on ? linked.filter((x) => x !== c.id) : [...linked, c.id];
                          setLinked(next);
                          void save({ techoIds: next });
                        }}
                        className={`min-h-11 rounded-full border px-3 text-sm ${on ? "border-rose bg-rose-soft font-semibold text-rose" : "border-line"}`}
                      >
                        {on ? "✓ " : ""}
                        {c.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {error && <p className="text-sm text-alert">{error}</p>}
          </>
        )}
      </div>
    </div>
  );
}
