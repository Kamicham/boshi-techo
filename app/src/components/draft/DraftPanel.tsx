"use client";

// ③ 下書きを、外のアプリへワンタップで渡せる形に。
// 宛名・メールアドレス・件名・本文はそれぞれコピーでき、メール・LINE・共有で開く。送るのは家族（手帳からは送らない）。
// 残った【 】は全部、欄として並べて埋める。会社名・部署・上司・人事・病院は「いつもの」として覚え、次の下書きから最初から入る。
// 「✓ 送った」などの印を付けると、その事も済みになる（印を外すと済みも外れる）。
// 札は画面の言葉に訳す。宛先・件名・本文（勤め先・役所あての日本語の文書）と、【 】の欄の名前（文書の言葉）は日本語のまま。
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { applyBlanks, jpDate, type Blank, type BlankKey } from "@/lib/blanks";
import { lineUrl } from "@/lib/handoff";
import { t } from "@/lib/i18n";
import { msWords } from "@/lib/i18n/milestone-words";
import { tr } from "@/lib/i18n/rich";
import { draftConsentWaitKey, draftWaitValue, isClaudeConsentError, readConsentState, type ClaudeConsentState } from "@/lib/claude-consent-flow";
import type { Draft, DraftKind, DraftView } from "@/lib/drafts";
import { api } from "../FamilyProvider";
import { ClaudeConsentLink } from "../settings/ClaudeConsentLink";
import { Btn, CopyField, HandoffRow, Pill, Why } from "../ui";
import { ErrorLine, Working } from "./Working";

/** 家族が付ける印の言葉（status "ok" の見せ方。仕組みは「OK」のまま）。画面の言葉で返す */
export function doneWord(kind: DraftKind): string {
  return t(kind === "メール" ? "送った" : kind === "記入メモ" ? "書いた" : kind === "質問リスト" ? "聞いた" : kind === "頼み文" ? "送った" : "使った");
}

function mdJst(iso: string): string {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return t("{m}月{d}日", { m: d.getUTCMonth() + 1, d: d.getUTCDate() });
}

/** サーバの宛先の一言（lib/drafts.ts の mailHint。町の名前入り）を画面の言葉に。形が違えば、そのまま出す */
function mailHintWords(s: string): string {
  const m = /^宛先は(.+)のページで（問い合わせのフォームやメールアドレス）$/.exec(s);
  return m ? t("宛先は{city}のページで（問い合わせのフォームやメールアドレス）", { city: m[1] }) : s;
}

/**
 * 開いた人が担当でない時の1行（見直し C09）: 下書きは担当の人の名前と職場で書いてある。担当の人に LINE で頼める。
 * 「◯◯の番です」は、やる事の札がすぐ上で言っているので重ねない。呼び方は今日の画面と同じ（名前に「さん」を付けない）
 */
function HandTo({ name, title }: { name: string; title: string }) {
  const text = t("「{title}」の下書きを、手帳に用意したよ。手帳で開いて、確かめてから使ってね。", { title: msWords(title) });
  return (
    <p className="text-sm">
      {t("{name}の名前と職場で書いています。", { name })}{" "}
      <a className="font-bold underline underline-offset-2" href={lineUrl(text)} target="_blank" rel="noreferrer">
        {t("{name}に LINE で頼む ›", { name })}
      </a>
    </p>
  );
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
  settled?: boolean;
  onView: (v: DraftView) => void;
  onRemake: () => void;
  onRetry: () => void;
};

export function DraftPanel(p: PanelProps) {
  const draft = p.view?.draft ?? null;
  return (
    <section aria-label={t("下書き")} className="flex flex-col gap-3 rounded-2xl border border-line bg-paper p-4">
      {p.busy === "load" && <Working steps={[{ at: 0, text: t("前に作った下書きを開いています") }]} />}
      {p.busy === "make" && (
        <Working
          steps={[
            { at: 0, text: t("下書きを書いています") },
            { at: 8, text: t("期限と町の調べに合わせています") },
            { at: 25, text: t("分からない所を【 】にしています（もう少し）") },
          ]}
          then={t("できたら、ここに宛先・件名・本文が出ます")}
        />
      )}
      {p.err &&
        (isClaudeConsentError(p.err) ? (
          <DraftConsent familyId={p.familyId} milestoneId={p.milestoneId} err={p.err} />
        ) : (
          <ErrorLine text={p.err} settled={p.settled} onRetry={p.onRetry} />
        ))}
      {draft && p.view && p.busy !== "make" && (
        <DraftBody key={`${draft.title}\n${draft.to}\n${draft.body}\n${draft.status}`} {...p} view={p.view} draft={draft} />
      )}
    </section>
  );
}

/**
 * 下書きが同意の前で止まった時（見直し C38 ①）: 灰色の止まった文にせず、同意の案内を出す。
 * 「読んで決める」の前に、どの事の下書きかを控える。戻ってこの事の動きが開くと、同意が済んでいればそのまま作る（MilestoneActions）。
 * まだ手帳に入っていないママの分が要る時は、押しても進めないので「ママを手帳に入れる」へ（母の分は母本人だけ）。
 */
function DraftConsent({ familyId, milestoneId, err }: { familyId: string; milestoneId: string; err: string }) {
  const here = usePathname();
  const [state, setState] = useState<ClaudeConsentState>(null);
  useEffect(() => {
    let off = false;
    api<unknown>(`/api/account/consent?familyId=${encodeURIComponent(familyId)}`).then(
      (j) => !off && setState(readConsentState(j)),
      () => {},
    );
    return () => {
      off = true;
    };
  }, [familyId]);
  return (
    <ClaudeConsentLink
      error={err}
      back={here || "/"}
      waitMother={state === "mother"}
      lead={tr("下書きを書くには、{consent}が要ります。読んで決めて戻ると、そのまま書きます。", { consent: <b>{t("米国の Claude に送る同意")}</b> })}
      onGo={() => {
        try {
          sessionStorage.setItem(draftConsentWaitKey(familyId), draftWaitValue(milestoneId, Date.now()));
        } catch {}
      }}
    />
  );
}

function DraftBody(p: Omit<PanelProps, "view" | "err" | "settled" | "onRetry"> & { view: DraftView; draft: Draft }) {
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
    const keep: { work?: typeof work; workBy?: Record<string, typeof work>; hospital?: { name: string }; names?: Record<string, string> } = {};
    for (const { blank, value } of values) {
      if (blank.key === "hospital") keep.hospital = { name: value };
      else if (blank.key === "myName") {
        if (view.writerId) keep.names = { [view.writerId]: value };
      } else if (blank.key) work[blank.key] = value;
    }
    // 職場の欄は、書き手（その事の担当の人）の職場として覚える（見直し C09: 家族のほかの人の職場を上書きしない）
    if (Object.keys(work).length) {
      if (view.writerId) keep.workBy = { [view.writerId]: work };
      else keep.work = work;
    }
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
      : { line: listText, share: { title: draft.title, text: listText } };

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="sky">{t(draft.kind)}</Pill>
        {draft.status === "ok" && <Pill tone="ok">{draft.okAt ? t("✓ {word}・{date}", { word, date: mdJst(draft.okAt) }) : `✓ ${word}`}</Pill>}
      </div>

      {view.handTo && <HandTo name={view.handTo.name} title={draft.milestoneTitle} />}

      {view.blanks.length > 0 && !editing && <BlankFields blanks={view.blanks} keepName={!!view.writerId} busy={saving === "fill"} onFill={(v) => void fillBlanks(v)} />}

      {editing ? (
        <EditFields draft={draft} isMail={isMail} busy={saving === "save"} onSave={(e) => void send("PATCH", e, "save")} onCancel={() => setEditing(false)} />
      ) : (
        <>
          {view.fromName && (
            <p className="text-sm text-muted">{t(isMail ? "{name}さんから送る文" : "{name}さんから使うメモ", { name: view.fromName })}</p>
          )}
          {isMail ? (
            <>
              <CopyField label={t("宛名")} value={view.toName} />
              {view.mailTo ? <CopyField label={t("メールアドレス")} value={view.mailTo} /> : view.mailHint && <p className="text-sm text-muted">{mailHintWords(view.mailHint)}</p>}
              {view.cc && <p className="text-sm text-muted">CC: {view.cc}</p>}
            </>
          ) : (
            <CopyField label={t("出す先")} value={draft.to} />
          )}
          <CopyField label={t(isMail ? "件名" : "見出し")} value={draft.title} />
          <CopyField label={t("本文")} value={draft.body} long />
          <HandoffRow {...handoff} />
        </>
      )}

      {err && <p className="text-base text-alert">{err}</p>}

      {!editing && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          {draft.status === "ok" ? (
            <Btn kind="quiet" disabled={!!saving} onClick={() => void send("PATCH", { unmark: true }, "mark")}>
              {t("「{word}」を外す", { word })}
            </Btn>
          ) : (
            <Btn kind="secondary" disabled={!!saving || !!p.busy} onClick={() => void send("PUT", {}, "mark")}>
              {saving === "mark" ? t("残しています…") : `✓ ${word}`}
            </Btn>
          )}
          <Btn kind="quiet" disabled={!!saving} onClick={() => setEditing(true)}>
            {t("文を直す")}
          </Btn>
          <Btn kind="quiet" disabled={!!saving || !!p.busy} onClick={p.onRemake}>
            {t("作り直す")}
          </Btn>
        </div>
      )}

      <Why label={t(draft.checklist.length ? "送る前に確かめる事" : "なぜ？")}>
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
        <p>{t("「{word}」は家族の印です。手帳からは何も送りません。印を付けると、この事も済みになります（外すと戻ります）。", { word })}</p>
        {draft.usedLocal && <p>{t("町の調べに合わせて書きました。")}</p>}
      </Why>
    </>
  );
}

/** 欄の入れ方の例（辞書の鍵。描く時に t() で訳す） */
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
  const hint = (key?: BlankKey) => {
    const h = key && KEY_HINT[key];
    return h ? t(h) : "";
  };
  return (
    <form
      className="flex flex-col gap-3 rounded-xl bg-warn/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (filled.length) onFill(filled.map((x) => ({ ...x, value: x.blank.input === "date" || x.blank.input === "datetime-local" ? jpDate(x.value) : x.value })));
      }}
    >
      <div className="flex flex-col gap-0.5">
        <p className="text-base font-semibold">{t("空欄を埋める（{n}か所）", { n: blanks.length })}</p>
        {anyKeep && <p className="text-sm text-muted">{t("会社名・名前などは、次の下書きから自動で入ります")}</p>}
      </div>
      {blanks.map((b) => (
        <label key={id(b)} className="flex flex-col gap-1 text-sm text-muted">
          <span>
            {b.label}
            {b.key && (b.key !== "myName" || keepName) && <span className="ml-2 text-xs text-ok">{t("覚えます")}</span>}
          </span>
          <input
            type={b.input}
            value={v[id(b)] ?? ""}
            placeholder={b.input === "date" || b.input === "datetime-local" ? undefined : hint(b.key)}
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
          {busy ? t("入れています…") : filled.length ? t("{n}か所を埋める", { n: filled.length }) : t("埋める")}
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
        {t(isMail ? "宛先" : "出す先")}
        <input className={`${cls} min-h-11`} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {t(isMail ? "件名" : "見出し")}
        <input className={`${cls} min-h-11`} value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold text-muted">
        {t("本文")}
        <textarea className={`${cls} min-h-64 leading-relaxed`} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} />
      </label>
      <div className="flex flex-wrap gap-2">
        <Btn disabled={busy} onClick={() => onSave(f)}>
          {busy ? t("残しています…") : t("直した文を残す")}
        </Btn>
        <Btn kind="quiet" disabled={busy} onClick={onCancel}>
          {t("やめる")}
        </Btn>
      </div>
    </div>
  );
}
