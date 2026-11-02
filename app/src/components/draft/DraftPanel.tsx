"use client";

// ③ 下書きを、外のアプリへワンタップで渡せる形に。
// 宛先・件名・本文はそれぞれコピーでき、メール・LINE・共有で開く。送るのは家族（手帳からは送らない）。
// 【会社名】【上司の名前】などの空欄は一度入れれば「いつもの」として覚え、次の下書きから最初から入る。
import { useState } from "react";
import type { AskKey, Draft, DraftKind, DraftView } from "@/lib/drafts";
import { api } from "../FamilyProvider";
import { Btn, CopyField, HandoffRow, Pill, Why } from "../ui";
import { ErrorLine, Working } from "./Working";

/** 家族が付ける印の言葉（status "ok" の見せ方。仕組みは「OK」のまま） */
export function doneWord(kind: DraftKind): string {
  return kind === "メール" || kind === "連絡文" ? "送った" : kind === "持ち物" ? "そろえた" : kind === "記入メモ" ? "書いた" : "聞いた";
}

function mdJst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

export type DraftBusy = "" | "load" | "make";

export function DraftPanel(p: {
  familyId: string;
  milestoneId: string;
  view: DraftView | null;
  busy: DraftBusy;
  err: string;
  onView: (v: DraftView) => void;
  onRemake: () => void;
  onRetry: () => void;
}) {
  const draft = p.view?.draft ?? null;
  return (
    <section aria-label="下書き" className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      {p.busy === "load" && <Working steps={[{ at: 0, text: "前に作った下書きを開いています" }]} />}
      {p.busy === "make" && (
        <Working
          steps={[
            { at: 0, text: "下書きを書いています" },
            { at: 8, text: "期限と町の調べに合わせています" },
            { at: 25, text: "分からない所を【 】にしています（もう少し）" },
          ]}
          then="できたら、ここに宛先・件名・本文が出ます"
        />
      )}
      {p.err && <ErrorLine text={p.err} onRetry={p.onRetry} />}
      {draft && p.view && p.busy !== "make" && (
        <DraftBody key={`${draft.title}\n${draft.to}\n${draft.body}\n${draft.status}`} {...p} view={p.view} draft={draft} />
      )}
    </section>
  );
}

function DraftBody(p: {
  familyId: string;
  milestoneId: string;
  view: DraftView;
  draft: Draft;
  busy: DraftBusy;
  onView: (v: DraftView) => void;
  onRemake: () => void;
}) {
  const { draft, view } = p;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState<"" | "mark" | "save" | "fill">("");
  const [err, setErr] = useState("");
  const word = doneWord(draft.kind);
  const isMail = draft.kind === "メール";

  const send = async (method: "PUT" | "PATCH", extra: Partial<Draft> & { unmark?: boolean }, kind: "mark" | "save" | "fill") => {
    setErr("");
    setSaving(kind);
    try {
      const v = await api<DraftView>("/api/draft", {
        method,
        body: { familyId: p.familyId, milestoneId: p.milestoneId, title: draft.title, to: draft.to, body: draft.body, checklist: draft.checklist, ...extra },
      });
      p.onView(v);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving("");
    }
  };

  const fillBlanks = async (work: Partial<Record<AskKey, string>>) => {
    setErr("");
    setSaving("fill");
    try {
      await api("/api/keep", { body: { familyId: p.familyId, keep: { work } } });
    } catch (e) {
      setErr((e as Error).message);
      setSaving("");
      return;
    }
    await send("PATCH", {}, "fill");
  };

  // 外へ渡す文（種類ごと）
  const listText = `${draft.title}\n${draft.body}`;
  const handoff =
    draft.kind === "メール"
      ? { mail: { to: view.mailTo, subject: draft.title, body: draft.body }, share: { title: draft.title, text: draft.body } }
      : draft.kind === "連絡文"
        ? { line: draft.body, share: { title: draft.title, text: draft.body } }
        : { line: listText, share: { title: draft.title, text: listText } };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="sky">{draft.kind}</Pill>
        {draft.status === "ok" && (
          <Pill tone="ok">
            ✓ {word}
            {draft.okAt ? `・${mdJst(draft.okAt)}` : ""}
          </Pill>
        )}
      </div>

      {view.ask.length > 0 && !editing && <AskBlanks ask={view.ask} busy={saving === "fill"} onFill={(w) => void fillBlanks(w)} />}

      {editing ? (
        <EditFields draft={draft} isMail={isMail} busy={saving === "save"} onSave={(e) => void send("PATCH", e, "save")} onCancel={() => setEditing(false)} />
      ) : (
        <>
          <CopyField label={isMail ? "宛先" : "出す先"} value={draft.to} />
          <CopyField label={isMail ? "件名" : "見出し"} value={draft.title} />
          <CopyField label="本文" value={draft.body} long />
          <HandoffRow {...handoff} />
        </>
      )}

      {err && <p className="text-base text-alert">{err}</p>}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {draft.status === "ok" ? (
            <Btn kind="quiet" disabled={!!saving} onClick={() => void send("PATCH", { unmark: true }, "mark")}>
              「{word}」を外す
            </Btn>
          ) : (
            <Btn kind="secondary" disabled={!!saving || !!p.busy} onClick={() => void send("PUT", {}, "mark")}>
              {saving === "mark" ? "残しています…" : `✓ ${word}`}
            </Btn>
          )}
          <Btn kind="quiet" disabled={!!saving} onClick={() => setEditing(true)}>
            文を直す
          </Btn>
          <Btn kind="quiet" disabled={!!saving || !!p.busy} onClick={p.onRemake}>
            作り直す
          </Btn>
        </div>
      )}

      <Why label={draft.checklist.length ? "送る前に確かめる事" : "なぜ？"}>
        {draft.checklist.length > 0 && (
          <ul className="flex flex-col gap-1">
            {draft.checklist.map((c) => (
              <li key={c} className="flex gap-2">
                <span aria-hidden>□</span>
                <span className="min-w-0">{c}</span>
              </li>
            ))}
          </ul>
        )}
        <p>「{word}」は家族の印です。手帳からは何も送りません。</p>
        {draft.usedLocal && <p>町の調べに合わせて書きました。</p>}
      </Why>
    </>
  );
}

const ASK_LABEL: Record<AskKey, { label: string; type: string; placeholder: string }> = {
  company: { label: "会社名", type: "text", placeholder: "例: ○○株式会社" },
  boss: { label: "上司の名前", type: "text", placeholder: "例: 山田さん" },
  email: { label: "上司のメール", type: "email", placeholder: "name@example.com" },
};

/** 「いつもの」の空欄を埋める小さな入力。入れたら覚えて、次から最初から入る */
function AskBlanks({ ask, busy, onFill }: { ask: AskKey[]; busy: boolean; onFill: (w: Partial<Record<AskKey, string>>) => void }) {
  const [v, setV] = useState<Partial<Record<AskKey, string>>>({});
  const any = ask.some((k) => v[k]?.trim());
  return (
    <form
      className="flex flex-col gap-2 rounded-xl bg-warn/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (any) onFill(Object.fromEntries(ask.map((k) => [k, v[k]?.trim() ?? ""]).filter(([, x]) => x)));
      }}
    >
      <p className="text-base font-semibold">空欄を埋める</p>
      <p className="text-sm text-muted">一度入れると、次の下書きから自動で入ります</p>
      {ask.map((k) => (
        <label key={k} className="flex flex-col gap-1 text-sm text-muted">
          {ASK_LABEL[k].label}
          <input
            type={ASK_LABEL[k].type}
            value={v[k] ?? ""}
            placeholder={ASK_LABEL[k].placeholder}
            onChange={(e) => setV((s) => ({ ...s, [k]: e.target.value }))}
            className="min-h-11 rounded-lg border border-line bg-card px-3 text-base text-ink"
            autoComplete={k === "company" ? "organization" : "off"}
          />
        </label>
      ))}
      <div>
        <button
          type="submit"
          disabled={!any || busy}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "入れています…" : "埋める"}
        </button>
      </div>
    </form>
  );
}

function EditFields({
  draft,
  isMail,
  busy,
  onSave,
  onCancel,
}: {
  draft: Draft;
  isMail: boolean;
  busy: boolean;
  onSave: (e: Pick<Draft, "title" | "to" | "body">) => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({ title: draft.title, to: draft.to, body: draft.body });
  const cls = "w-full rounded-lg border border-line bg-card px-3 py-2 text-base";
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {isMail ? "宛先" : "出す先"}
        <input className={`${cls} min-h-11`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {isMail ? "件名" : "見出し"}
        <input className={`${cls} min-h-11`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        本文
        <textarea className={`${cls} min-h-64 leading-relaxed`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Btn disabled={busy} onClick={() => onSave(f)}>
          {busy ? "残しています…" : "直した文を残す"}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={onCancel}>
          やめる
        </Btn>
      </div>
    </div>
  );
}
