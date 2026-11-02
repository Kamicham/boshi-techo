"use client";

// ③ 下書きを、外のアプリへワンタップで渡せる形に。
// 宛名・メールアドレス・件名・本文はそれぞれコピーでき、メール・LINE・共有で開く。送るのは家族（手帳からは送らない）。
// 残った【 】は全部、欄として並べて埋める。会社名・部署・上司・人事・病院は「いつもの」として覚え、次の下書きから最初から入る。
// 「✓ 送った」などの印を付けると、その事も済みになる（印を外すと済みも外れる）。
import { useState } from "react";
import { applyBlanks, jpDate, type Blank, type BlankKey } from "@/lib/blanks";
import type { Draft, DraftKind, DraftView } from "@/lib/drafts";
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

type PanelProps = {
  familyId: string;
  milestoneId: string;
  /** この手帳を使っている人（【自分の名前】を埋める） */
  meId: string | null;
  /** 押した時の「今日」（デモの時計を含む） */
  today: string;
  view: DraftView | null;
  busy: DraftBusy;
  err: string;
  onView: (v: DraftView) => void;
  onRemake: () => void;
  onRetry: () => void;
};

export function DraftPanel(p: PanelProps) {
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

function DraftBody(p: Omit<PanelProps, "view" | "err" | "onRetry"> & { view: DraftView; draft: Draft }) {
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
        body: {
          familyId: p.familyId,
          milestoneId: p.milestoneId,
          meId: p.meId,
          today: p.today,
          title: draft.title,
          to: draft.to,
          body: draft.body,
          checklist: draft.checklist,
          ...extra,
        },
      });
      p.onView(v);
      setEditing(false);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving("");
    }
  };

  /** 欄に入れた値で【 】を埋める。覚える物（会社名など）は keep へ、それ以外はこの下書きの文へ */
  const fillBlanks = async (values: { blank: Blank; value: string }[]) => {
    setErr("");
    setSaving("fill");
    const work: Partial<Record<BlankKey, string>> = {};
    const keep: { work?: typeof work; hospital?: { name: string }; names?: Record<string, string> } = {};
    for (const { blank, value } of values) {
      if (blank.key === "hospital") keep.hospital = { name: value };
      else if (blank.key === "myName") {
        if (view.writerId) keep.names = { [view.writerId]: value };
      } else if (blank.key) work[blank.key] = value;
    }
    if (Object.keys(work).length) keep.work = work;
    try {
      // 入れた物だけを送る（空の値を送ると、覚えている値が消える）
      if (Object.keys(keep).length) await api("/api/keep", { body: { familyId: p.familyId, keep } });
    } catch (e) {
      setErr((e as Error).message);
      setSaving("");
      return;
    }
    // 文にも入れて残す（覚えた物もここで入る。覚えない物はこの下書きだけ）
    const next = applyBlanks({ to: draft.to, title: draft.title, body: draft.body }, values);
    await send("PATCH", next, "fill");
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

      {view.blanks.length > 0 && !editing && <BlankFields blanks={view.blanks} keepName={!!view.writerId} busy={saving === "fill"} onFill={(v) => void fillBlanks(v)} />}

      {editing ? (
        <EditFields draft={draft} isMail={isMail} busy={saving === "save"} onSave={(e) => void send("PATCH", e, "save")} onCancel={() => setEditing(false)} />
      ) : (
        <>
          {view.fromName && (
            <p className="text-sm text-muted">
              {view.fromName}さんから{isMail || draft.kind === "連絡文" ? "送る文" : "使うメモ"}
            </p>
          )}
          {isMail ? (
            <>
              <CopyField label="宛名" value={view.toName} />
              {view.mailTo ? <CopyField label="メールアドレス" value={view.mailTo} /> : view.mailHint && <p className="text-sm text-muted">{view.mailHint}</p>}
              {view.cc && <p className="text-sm text-muted">CC: {view.cc}</p>}
            </>
          ) : (
            <CopyField label="出す先" value={draft.to} />
          )}
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
        <p>「{word}」は家族の印です。手帳からは何も送りません。印を付けると、この事も済みになります（外すと戻ります）。</p>
        {draft.usedLocal && <p>町の調べに合わせて書きました。</p>}
      </Why>
    </>
  );
}

const KEY_HINT: Partial<Record<BlankKey, string>> = {
  company: "例: ○○株式会社",
  dept: "例: 営業部",
  boss: "例: 山田",
  hr: "例: 人事部 佐藤",
  email: "name@example.com",
  hrEmail: "name@example.com",
  hospital: "例: ○○レディースクリニック",
  myName: "例: 佐藤 翔太",
};

/** 残った【 】を全部、欄として並べる。日付は日付の入力。覚える物は次から自動で入る */
function BlankFields({
  blanks,
  keepName,
  busy,
  onFill,
}: {
  blanks: Blank[];
  /** 【自分の名前】に入れた名前を覚えられるか（書き手が決まっている時） */
  keepName: boolean;
  busy: boolean;
  onFill: (v: { blank: Blank; value: string }[]) => void;
}) {
  const [v, setV] = useState<Record<string, string>>({});
  const id = (b: Blank) => (b.at ? `${b.at.field}:${b.at.index}` : b.raw);
  const filled = blanks.map((b) => ({ blank: b, value: (v[id(b)] ?? "").trim() })).filter((x) => x.value);
  const anyKeep = blanks.some((b) => b.key && (b.key !== "myName" || keepName));
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-warn/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (filled.length) onFill(filled.map((x) => ({ ...x, value: x.blank.input === "date" || x.blank.input === "datetime-local" ? jpDate(x.value) : x.value })));
      }}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-semibold">空欄を埋める（{blanks.length}か所）</p>
        {anyKeep && <p className="text-sm text-muted">会社名・名前などは、次の下書きから自動で入ります</p>}
      </div>
      {blanks.map((b) => (
        <label key={id(b)} className="flex flex-col gap-1 text-sm text-muted">
          <span>
            {b.label}
            {b.key && (b.key !== "myName" || keepName) && <span className="ml-2 text-xs text-ok">覚えます</span>}
          </span>
          <input
            type={b.input}
            value={v[id(b)] ?? ""}
            placeholder={b.input === "date" || b.input === "datetime-local" ? undefined : (b.key && KEY_HINT[b.key]) || ""}
            onChange={(e) => setV((s) => ({ ...s, [id(b)]: e.target.value }))}
            className="min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base text-ink"
            autoComplete={b.key === "company" ? "organization" : b.key === "myName" ? "name" : "off"}
            inputMode={b.input === "email" ? "email" : b.input === "tel" ? "tel" : b.numeric ? "numeric" : undefined}
          />
        </label>
      ))}
      <div>
        <button
          type="submit"
          disabled={!filled.length || busy}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-rose px-5 text-base font-semibold text-white disabled:opacity-50"
        >
          {busy ? "入れています…" : filled.length ? `${filled.length}か所を埋める` : "埋める"}
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
