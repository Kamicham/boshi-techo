"use client";

// 「今やる事」のカードに付く動き（答えずに、動く）。
// ② その町の窓口を調べる → 一番上に「どこへ・何を持って」、地図で開く
// ③ 下書きを作る → 宛先・件名・本文をワンタップでコピー、メール・LINE・共有で開く（送るのは家族）
import { useEffect, useState } from "react";
import { DRAFTABLE } from "@/lib/draft-kinds";
import type { Milestone } from "@/lib/milestones";
import type { LocalInfo } from "@/lib/local";
import type { DraftKind, DraftView } from "@/lib/drafts";
import { api, settledError, useFamily } from "./FamilyProvider";
import { Btn } from "./ui";
import { DraftPanel, doneWord, type DraftBusy } from "./draft/DraftPanel";
import { LocalPanel } from "./draft/LocalPanel";

// 下書きが意味を持つ事の表は lib/draft-kinds.ts（鍵の無い見本の下書きも同じ表で種類を決める）
export { DRAFTABLE };

/** 下書きの呼び名（種類ごと） */
export const NOUN: Record<DraftKind, string> = {
  メール: "職場へのメール",
  記入メモ: "書く事のメモ",
  質問リスト: "聞く事の一覧",
  頼み文: "家族への頼み文",
};

/** 下書きの呼び名（町の窓口あてのメールは「町への問い合わせ」） */
export function nounFor(kind: DraftKind, m: { kind: string; id?: string }): string {
  if (kind === "メール" && m.id === "older-daycare-continue") return "園か町への問い合わせ";
  if (kind === "メール" && m.id === "satogaeri-return") return "保健センターへの連絡";
  if (kind === "メール" && m.id?.startsWith("paid-")) return "届かない時の問い合わせ";
  if (kind === "メール" && m.kind !== "仕事") return "町への問い合わせ";
  return NOUN[kind] ?? "下書き";
}

type Open = "local" | "draft" | null;

type Props = {
  milestone: Milestone;
  today: string;
  /** 一番上の動きを主ボタンの見た目にする（残りは小さな文字のリンク） */
  primary?: boolean;
  /** すべて小さな文字のリンクにする（2つ目からの事） */
  compact?: boolean;
  /** 下書きの印で、その事の済みが変わった時（今日の画面が済んだ事を読み直す） */
  onDoneChange?: (done: boolean) => void;
};

export function MilestoneActions(props: Props) {
  const { family } = useFamily();
  // 家族を切り替えたら、開いていた結果を捨てる
  return <Actions key={family.id} {...props} />;
}

/** 小さな文字のリンク（押せる所は 44px 以上） */
function SmallLink({ children, onClick, ariaLabel }: { children: React.ReactNode; onClick: () => void; ariaLabel?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={ariaLabel} className="inline-flex min-h-11 items-center px-1 text-sm text-muted underline underline-offset-2">
      {children}
    </button>
  );
}

function Actions({ milestone, today, primary, compact, onDoneChange }: Props) {
  const { family, me } = useFamily();
  const [open, setOpen] = useState<Open>(null);

  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");
  const [localSettled, setLocalSettled] = useState(false);

  const [view, setView] = useState<DraftView | null>(null);
  const [draftBusy, setDraftBusy] = useState<DraftBusy>("");
  const [draftErr, setDraftErr] = useState("");
  const [draftSettled, setDraftSettled] = useState(false);

  // 役所の窓口を調べるのは、役所に出す手続きだけ（産院・職場に出す物を役所で調べると、違う行き先が出る＝sim-14 の直接支払制度）
  const canLocal = milestone.needsLocal && !!family.city && !(milestone.kind === "仕事" || /産院|職場/.test(`${milestone.title}${milestone.plain}`));
  const canDraft = milestone.id in DRAFTABLE;
  const title = milestone.plain || milestone.title;

  // 前に作った下書き・調べた結果があるかだけ先に見る（作り・調べには行かない）
  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ familyId: family.id, milestoneId: milestone.id, ...(me ? { meId: me.id } : {}) });
    if (canDraft) void api<DraftView>(`/api/draft?${q}`).then((v) => alive && v.draft && setView((cur) => cur ?? v), () => {});
    if (canLocal) void api<{ local: LocalInfo | null }>(`/api/local?${q}`).then((r) => alive && r.local && setLocal((cur) => cur ?? r.local), () => {});
    return () => {
      alive = false;
    };
  }, [family.id, milestone.id, canDraft, canLocal, me]);

  if (!canLocal && !canDraft) return null;

  const loadLocal = async (force = false) => {
    setLocalErr("");
    setLocalBusy(true);
    try {
      const r = await api<{ local: LocalInfo }>("/api/local", { body: { familyId: family.id, milestoneId: milestone.id, force } });
      setLocal(r.local);
    } catch (e) {
      setLocalErr((e as Error).message);
      setLocalSettled(settledError(e));
    } finally {
      setLocalBusy(false);
    }
  };

  const makeDraft = async () => {
    setDraftErr("");
    setDraftBusy("make");
    try {
      const was = view?.draft?.status === "ok";
      setView(await api<DraftView>("/api/draft", { body: { familyId: family.id, milestoneId: milestone.id, today, meId: me?.id } }));
      // 作り直すと「送った」の印と、そこから付いた済みが外れる
      if (was) onDoneChange?.(false);
    } catch (e) {
      setDraftErr((e as Error).message);
      setDraftSettled(settledError(e));
    } finally {
      setDraftBusy("");
    }
  };

  const openDraft = async () => {
    setDraftErr("");
    setDraftBusy("load");
    try {
      const q = new URLSearchParams({ familyId: family.id, milestoneId: milestone.id, ...(me ? { meId: me.id } : {}) });
      const v = await api<DraftView>(`/api/draft?${q}`);
      if (v.draft) {
        setView(v);
        setDraftBusy("");
      } else {
        await makeDraft();
      }
    } catch (e) {
      setDraftErr((e as Error).message);
      setDraftSettled(settledError(e));
      setDraftBusy("");
    }
  };

  const toggle = (which: Exclude<Open, null>) => {
    if (open === which) return setOpen(null);
    setOpen(which);
    if (which === "local" && !local && !localBusy) void loadLocal();
    if (which === "draft" && !view?.draft && !draftBusy) void openDraft();
  };

  const draft = view?.draft ?? null;
  // ボタンの言葉は、押す前と同じ種類で呼ぶ（表に無い事だけ、作った下書きの種類で呼ぶ）
  const noun = nounFor(DRAFTABLE[milestone.id] ?? draft?.kind ?? "記入メモ", milestone);
  const draftLabel =
    open === "draft" ? `${noun}を閉じる` : draft ? (draft.status === "ok" ? `${noun}を見る（✓ ${doneWord(draft.kind)}）` : `${noun}を見る`) : `${noun}を作る`;
  const localLabel = open === "local" ? "行き先を閉じる" : "どこへ行くか見る";

  // 窓口が要る事は「どこへ行くか見る」を先（主）に。下書きはその次
  const buttons = [
    canLocal && { id: "local" as const, label: localLabel, aria: `${title}: ${localLabel}` },
    canDraft && { id: "draft" as const, label: draftLabel, aria: `${title}の${draftLabel}` },
  ].filter((x): x is { id: Exclude<Open, null>; label: string; aria: string } => !!x);

  return (
    <div className="flex flex-col gap-3">
      <div className={`flex flex-wrap items-center ${compact ? "gap-x-2" : "gap-2"}`}>
        {buttons.map((b, i) =>
          compact || (primary && i > 0) ? (
            <SmallLink key={b.id} onClick={() => toggle(b.id)} ariaLabel={b.aria}>
              {b.label}
            </SmallLink>
          ) : (
            <Btn key={b.id} kind={primary ? "primary" : "secondary"} onClick={() => toggle(b.id)} ariaLabel={b.aria}>
              {b.label}
            </Btn>
          ),
        )}
      </div>

      {open === "draft" && (
        <DraftPanel
          familyId={family.id}
          milestoneId={milestone.id}
          meId={me?.id ?? null}
          today={today}
          view={view}
          busy={draftBusy}
          err={draftErr}
          settled={draftSettled}
          onView={(v) => {
            const was = view?.draft?.status === "ok";
            setView(v);
            const now = v.draft?.status === "ok";
            if (was !== now) onDoneChange?.(now);
          }}
          onRemake={() => void makeDraft()}
          onRetry={() => void (draft ? makeDraft() : openDraft())}
        />
      )}
      {open === "local" && (
        <LocalPanel
          city={family.city}
          title={title}
          local={local}
          busy={localBusy}
          err={localErr}
          settled={localSettled}
          onRetry={() => void loadLocal(!!local)}
          onRefresh={() => void loadLocal(true)}
        />
      )}
    </div>
  );
}
