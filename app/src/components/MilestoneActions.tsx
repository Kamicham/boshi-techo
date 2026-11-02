"use client";

// 「今やる事」のカードに付く動き。
// ② その町ではどうする？（町の公式サイトを調べに行く）
// ③ 下書きを作る（家族は最後に「OK」するだけ。何も外へ送らない）
import { useEffect, useState } from "react";
import type { Milestone } from "@/lib/milestones";
import type { LocalInfo } from "@/lib/local";
import type { Draft } from "@/lib/drafts";
import { api, useFamily } from "./FamilyProvider";

/** 下書きが意味を持つ事 */
const DRAFTABLE = new Set([
  "pregnancy-report",
  "tell-work",
  "partner-leave",
  "direct-payment",
  "hospital-bag",
  "birth-registration",
  "child-allowance",
  "health-insurance",
  "medical-subsidy",
  "birth-notice",
  "tell-work-birth",
  "daycare-research",
  "vaccines-start",
  "checkup-3-4m",
  "checkup-18m",
]);

/** 役所のページ（.lg.jp・.go.jp など）か */
function isOfficial(url: string): boolean {
  try {
    const h = new URL(url).hostname;
    return /\.(lg|go)\.jp$/.test(h) || /^(www\.)?(city|town|vill|pref)\./.test(h);
  } catch {
    return false;
  }
}

type Open = "local" | "draft" | null;

function mdDate(s: string) {
  const [, m, d] = s.slice(0, 10).split("-").map(Number);
  return `${m}月${d}日`;
}

export function MilestoneActions(props: { milestone: Milestone; today: string }) {
  const { family } = useFamily();
  // 家族を切り替えたら、開いていた結果を捨てる
  return <Actions key={family.id} {...props} />;
}

function Actions({ milestone, today }: { milestone: Milestone; today: string }) {
  const { family } = useFamily();
  const [open, setOpen] = useState<Open>(null);

  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftBusy, setDraftBusy] = useState<"" | "load" | "make" | "ok">("");
  const [draftErr, setDraftErr] = useState("");

  const canLocal = milestone.needsLocal && !!family.city;
  const canDraft = DRAFTABLE.has(milestone.id);
  if (!canLocal && !canDraft) return null;

  const loadLocal = async (force = false) => {
    setLocalErr("");
    setLocalBusy(true);
    try {
      const r = await api<{ local: LocalInfo }>("/api/local", { body: { familyId: family.id, milestoneId: milestone.id, force } });
      setLocal(r.local);
    } catch (e) {
      setLocalErr((e as Error).message);
    } finally {
      setLocalBusy(false);
    }
  };

  const makeDraft = async () => {
    setDraftErr("");
    setDraftBusy("make");
    try {
      const r = await api<{ draft: Draft }>("/api/draft", { body: { familyId: family.id, milestoneId: milestone.id, today } });
      setDraft(r.draft);
    } catch (e) {
      setDraftErr((e as Error).message);
    } finally {
      setDraftBusy("");
    }
  };

  const openDraft = async () => {
    setDraftErr("");
    setDraftBusy("load");
    try {
      const q = new URLSearchParams({ familyId: family.id, milestoneId: milestone.id });
      const r = await api<{ draft: Draft | null }>(`/api/draft?${q}`);
      if (r.draft) {
        setDraft(r.draft);
        setDraftBusy("");
      } else {
        await makeDraft();
      }
    } catch (e) {
      setDraftErr((e as Error).message);
      setDraftBusy("");
    }
  };

  const toggle = (which: Exclude<Open, null>) => {
    if (open === which) return setOpen(null);
    setOpen(which);
    if (which === "local" && !local && !localBusy) void loadLocal();
    if (which === "draft" && !draft && !draftBusy) void openDraft();
  };

  const tab = (on: boolean) =>
    `rounded-full border px-3 py-1 text-sm font-semibold ${on ? "border-rose bg-rose-soft text-rose" : "border-line text-ink hover:border-rose hover:text-rose"}`;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canLocal && (
          <button onClick={() => toggle("local")} className={tab(open === "local")} aria-expanded={open === "local"}>
            {family.city}ではどうする？
          </button>
        )}
        {canDraft && (
          <button onClick={() => toggle("draft")} className={tab(open === "draft")} aria-expanded={open === "draft"}>
            {draft?.status === "ok" ? "下書き（確かめ済み）" : "下書きを作る"}
          </button>
        )}
      </div>

      {open === "local" && (
        <LocalPanel
          city={family.city}
          local={local}
          busy={localBusy}
          err={localErr}
          onRetry={() => void loadLocal(!!local)}
          onRefresh={() => void loadLocal(true)}
        />
      )}
      {open === "draft" && (
        <DraftPanel
          draft={draft}
          busy={draftBusy}
          err={draftErr}
          onChange={setDraft}
          onRemake={() => void makeDraft()}
          onRetry={() => void (draft ? makeDraft() : openDraft())}
          onOk={async () => {
            if (!draft) return;
            setDraftErr("");
            setDraftBusy("ok");
            try {
              const r = await api<{ draft: Draft }>("/api/draft", {
                method: "PUT",
                body: { familyId: family.id, milestoneId: milestone.id, title: draft.title, to: draft.to, body: draft.body, checklist: draft.checklist },
              });
              setDraft(r.draft);
            } catch (e) {
              setDraftErr((e as Error).message);
            } finally {
              setDraftBusy("");
            }
          }}
        />
      )}
    </div>
  );
}

/** 待ちが長い処理の「いま何をしているか」 */
function Working({ steps }: { steps: { at: number; text: string }[] }) {
  const [sec, setSec] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const now = [...steps].reverse().find((s) => sec >= s.at) ?? steps[0];
  return (
    <div role="status" className="flex items-center gap-2 rounded-lg bg-sky-soft px-3 py-2 text-sm text-sky">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-sky" aria-hidden />
      <span className="min-w-0 flex-1">{now.text}</span>
      <span className="tabular shrink-0 text-xs">{sec}秒</span>
    </div>
  );
}

function ErrorLine({ text, onRetry }: { text: string; onRetry: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">
      <span className="min-w-0 flex-1">{text}</span>
      <button onClick={onRetry} className="shrink-0 rounded-md border border-alert px-2 py-0.5 text-xs font-semibold">
        もう一度
      </button>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr] gap-2 text-sm">
      <dt className="text-xs font-semibold text-muted">{label}</dt>
      <dd className="min-w-0 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

function LocalPanel(p: { city: string; local: LocalInfo | null; busy: boolean; err: string; onRetry: () => void; onRefresh: () => void }) {
  const { local } = p;
  return (
    <section aria-label={`${p.city}での手続き`} className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-3">
      {p.busy && (
        <Working
          steps={[
            { at: 0, text: `${p.city}の公式サイトを探しています` },
            { at: 15, text: "見つけたページを読み比べています" },
            { at: 45, text: "窓口・持ち物・期限を拾い出しています" },
            { at: 75, text: "家族が読める形に整えています（もう少し）" },
          ]}
        />
      )}
      {p.err && <ErrorLine text={p.err} onRetry={p.onRetry} />}
      {local && (
        <>
          <p className="text-sm leading-relaxed">{local.summary}</p>
          <dl className="flex flex-col gap-2">
            <Row label="窓口">{local.where}</Row>
            {local.bring.length > 0 && (
              <Row label="持ち物">
                <ul className="list-disc pl-4">
                  {local.bring.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Row>
            )}
            <Row label="オンライン">{local.online}</Row>
            <Row label="期限">{local.deadline}</Row>
            <Row label={`${local.city}独自`}>{local.extras}</Row>
          </dl>
          {local.caution && <p className="rounded-md bg-warn/10 px-3 py-2 text-xs text-warn">{local.caution}</p>}
          <div className="flex flex-col gap-1">
            <p className="text-xs font-semibold text-muted">出典（{local.city}などのページ）</p>
            {local.sources.length === 0 && <p className="text-xs text-muted">出典のページが取れませんでした。調べ直すか、窓口で確かめてください。</p>}
            <ul className="flex flex-col gap-1">
              {local.sources.map((s) => (
                <li key={s.url} className="min-w-0 text-xs">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="break-all text-sky underline underline-offset-2">
                    {s.title || s.url}
                  </a>
                  {isOfficial(s.url) && <span className="ml-1 rounded bg-ok/10 px-1 text-[10px] font-semibold text-ok">役所のページ</span>}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
            <p className="tabular text-xs text-muted">{mdDate(local.researchedAt)}に調べた・制度は変わる事があります</p>
            <button onClick={p.onRefresh} disabled={p.busy} className="rounded-md border border-line px-3 py-1 text-xs font-semibold disabled:opacity-50">
              調べ直す
            </button>
          </div>
        </>
      )}
    </section>
  );
}

function DraftPanel(p: {
  draft: Draft | null;
  busy: "" | "load" | "make" | "ok";
  err: string;
  onChange: (d: Draft) => void;
  onRemake: () => void;
  onRetry: () => void;
  onOk: () => void;
}) {
  const { draft } = p;
  const [copied, setCopied] = useState("");
  const edit = (patch: Partial<Draft>) => draft && p.onChange({ ...draft, ...patch, status: "draft", okAt: undefined });

  const copy = async () => {
    if (!draft) return;
    const text = [draft.to && `宛先: ${draft.to}`, draft.kind === "メール" && `件名: ${draft.title}`, "", draft.body].filter((x) => x !== false && x !== undefined).join("\n");
    try {
      await navigator.clipboard.writeText(text.trim());
      setCopied("コピーしました");
    } catch {
      setCopied("コピーできませんでした。文を長押しして選んでください");
    }
    setTimeout(() => setCopied(""), 2500);
  };

  const field = "w-full rounded-md border border-line bg-card px-2 py-1.5 text-sm";
  return (
    <section aria-label="下書き" className="flex flex-col gap-3 rounded-lg border border-line bg-paper p-3">
      {p.busy === "load" && <Working steps={[{ at: 0, text: "前に作った下書きを探しています" }]} />}
      {p.busy === "make" && (
        <Working
          steps={[
            { at: 0, text: "家族の呼び名と期限を確かめています" },
            { at: 5, text: "調べてある町の情報と合わせて、下書きを書いています" },
            { at: 25, text: "分からない所を【 】の空欄にしています（もう少し）" },
          ]}
        />
      )}
      {p.err && <ErrorLine text={p.err} onRetry={p.onRetry} />}
      {draft && p.busy !== "make" && (
        <>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full bg-sky-soft px-2 py-0.5 font-semibold text-sky">{draft.kind}</span>
            {draft.usedLocal && <span className="text-muted">町の調べ結果を使いました</span>}
          </div>
          <label className="flex flex-col gap-1 text-xs text-muted">
            {draft.kind === "メール" ? "件名" : "見出し"}
            <input className={field} value={draft.title} onChange={(e) => edit({ title: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            宛先・出す先
            <input className={field} value={draft.to} onChange={(e) => edit({ to: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted">
            本文（【 】の所は自分の言葉で埋める）
            <textarea className={`${field} min-h-56 leading-relaxed`} value={draft.body} onChange={(e) => edit({ body: e.target.value })} />
          </label>
          {draft.checklist.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold text-muted">出す前に確かめる事</p>
              <ul className="flex flex-col gap-1 text-sm">
                {draft.checklist.map((c) => (
                  <li key={c} className="flex gap-2">
                    <span className="text-rose" aria-hidden>□</span>
                    <span className="min-w-0">{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {draft.status === "ok" ? (
            <p className="rounded-md bg-ok/10 px-3 py-2 text-sm text-ok">
              家族が確かめました{draft.okAt ? `（${mdDate(new Date(Date.parse(draft.okAt) + 9 * 3600_000).toISOString())}）` : ""}。手帳からは何も送っていません。
            </p>
          ) : (
            <p className="text-xs text-muted">「OK」は送信ではありません。家族が確かめた印として手帳に残します。</p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={p.onOk}
              disabled={!!p.busy || draft.status === "ok"}
              className="rounded-lg bg-rose px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              {p.busy === "ok" ? "残しています…" : draft.status === "ok" ? "OK 済み" : "OK（これで確定）"}
            </button>
            <button onClick={p.onRemake} disabled={!!p.busy} className="rounded-lg border border-line px-3 py-1.5 text-sm disabled:opacity-50">
              作り直す
            </button>
            <button onClick={copy} className="rounded-lg border border-line px-3 py-1.5 text-sm">
              コピー
            </button>
            {copied && <span className="text-xs text-muted" role="status">{copied}</span>}
          </div>
        </>
      )}
    </section>
  );
}
