"use client";

// 「今やる事」のカードに付く動き（答えずに、動く）。
// ② その町の窓口を調べる → 一番上に「どこへ・何を持って」、地図で開く
// ③ 下書きを作る → 宛先・件名・本文をワンタップでコピー、メール・LINE・共有で開く（送るのは家族）
import { useEffect, useState } from "react";
import type { Milestone } from "@/lib/milestones";
import type { LocalInfo } from "@/lib/local";
import type { DraftView } from "@/lib/drafts";
import { api, useFamily } from "./FamilyProvider";
import { Btn } from "./ui";
import { DraftPanel, doneWord, type DraftBusy } from "./draft/DraftPanel";
import { LocalPanel } from "./draft/LocalPanel";

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

type Open = "local" | "draft" | null;

export function MilestoneActions(props: { milestone: Milestone; today: string }) {
  const { family } = useFamily();
  // 家族を切り替えたら、開いていた結果を捨てる
  return <Actions key={family.id} {...props} />;
}

function Actions({ milestone, today }: { milestone: Milestone; today: string }) {
  const { family, me } = useFamily();
  const [open, setOpen] = useState<Open>(null);

  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [localBusy, setLocalBusy] = useState(false);
  const [localErr, setLocalErr] = useState("");

  const [view, setView] = useState<DraftView | null>(null);
  const [draftBusy, setDraftBusy] = useState<DraftBusy>("");
  const [draftErr, setDraftErr] = useState("");

  const canLocal = milestone.needsLocal && !!family.city;
  const canDraft = DRAFTABLE.has(milestone.id);
  const title = milestone.plain || milestone.title;

  // 前に作った下書き・調べた結果があるかだけ先に見る（作り・調べには行かない）
  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ familyId: family.id, milestoneId: milestone.id });
    if (canDraft) void api<DraftView>(`/api/draft?${q}`).then((v) => alive && v.draft && setView((cur) => cur ?? v), () => {});
    if (canLocal) void api<{ local: LocalInfo | null }>(`/api/local?${q}`).then((r) => alive && r.local && setLocal((cur) => cur ?? r.local), () => {});
    return () => {
      alive = false;
    };
  }, [family.id, milestone.id, canDraft, canLocal]);

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
      setView(await api<DraftView>("/api/draft", { body: { familyId: family.id, milestoneId: milestone.id, today, meId: me?.id } }));
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
      const v = await api<DraftView>(`/api/draft?${q}`);
      if (v.draft) {
        setView(v);
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
    if (which === "draft" && !view?.draft && !draftBusy) void openDraft();
  };

  const draft = view?.draft ?? null;
  const draftLabel =
    open === "draft" ? "下書きを閉じる" : draft ? (draft.status === "ok" ? `下書きを見る（✓ ${doneWord(draft.kind)}）` : "下書きを見る") : "下書きを作る";
  const localLabel = open === "local" ? "閉じる" : local ? `${family.city}の窓口を見る` : `${family.city}の窓口を調べる`;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {canDraft && (
          <Btn kind="secondary" onClick={() => toggle("draft")} ariaLabel={`${title}の${draftLabel}`}>
            {draftLabel}
          </Btn>
        )}
        {canLocal && (
          <Btn kind="secondary" onClick={() => toggle("local")} ariaLabel={`${title}: ${localLabel}`}>
            {localLabel}
          </Btn>
        )}
      </div>

      {open === "draft" && (
        <DraftPanel
          familyId={family.id}
          milestoneId={milestone.id}
          view={view}
          busy={draftBusy}
          err={draftErr}
          onView={setView}
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
          onRetry={() => void loadLocal(!!local)}
          onRefresh={() => void loadLocal(true)}
        />
      )}
    </div>
  );
}
