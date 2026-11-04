"use client";

// 手帳が先に用意する（窓口を調べ、書く事のメモを作る）。一番上の札（NowCard）と、生まれた届けの束の1行目（BirthTripCard）が使う。
// 前に作った物があればそれを使い、作り直さない。できた物は「✓」の行で残す（UX の見直し C07: 済むと跡が消えていた）。
// 鍵が無い時の見本の答えは、用意したと数えない（「下書きしました」と言わない＝現実に即す）。
import { useEffect, useState } from "react";
import type { LocalInfo } from "@/lib/local";
import type { DraftView } from "@/lib/drafts";
import type { Family, Member } from "@/lib/demo-family";
import { api } from "../FamilyProvider";
import { DRAFTABLE, nounFor } from "../MilestoneActions";
import { canLocalFor, isSample, madeLine } from "./prep";
import type { Task } from "./task";

export type PrepState = "idle" | "busy" | "ok" | "fail";
export type PrepLine = { key: string; state: PrepState; text: string };

/** 用意ができた・変わった時に今日の画面へ知らせる（行の札と帯の下の1行を読み直す） */
export const notifyPrep = () => window.dispatchEvent(new Event("boshi:prep"));

export function usePrep(t: Task, today: string, family: Family, me: Member | null, tries: number) {
  const canLocal = canLocalFor(t, family);
  const canDraft = t.id in DRAFTABLE;
  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [localState, setLocalState] = useState<PrepState>("idle");
  const [view, setView] = useState<DraftView | null>(null);
  const [draftState, setDraftState] = useState<PrepState>("idle");
  // 用意が終わったら、中のボタン（MilestoneActions）を読み直させる
  const [ver, setVer] = useState(0);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ familyId: family.id, milestoneId: t.id, ...(me ? { meId: me.id } : {}) });
    if (canLocal) {
      setLocalState("busy");
      api<{ local: LocalInfo | null }>(`/api/local?${q}`)
        .then((r) => r.local ?? api<{ local: LocalInfo }>("/api/local", { body: { familyId: family.id, milestoneId: t.id } }).then((x) => (notifyPrep(), x.local)))
        .then((l) => {
          if (!alive) return;
          setLocal(l);
          setLocalState("ok");
          setVer((v) => v + 1);
        })
        .catch(() => alive && setLocalState("fail"));
    }
    if (canDraft) {
      setDraftState("busy");
      api<DraftView>(`/api/draft?${q}`)
        .then((v) => (v.draft ? v : api<DraftView>("/api/draft", { body: { familyId: family.id, milestoneId: t.id, today, meId: me?.id } }).then((x) => (notifyPrep(), x))))
        .then((v) => {
          if (!alive) return;
          setView(v);
          setDraftState(v.draft ? "ok" : "fail");
          setVer((x) => x + 1);
        })
        .catch(() => alive && setDraftState("fail"));
    }
    return () => {
      alive = false;
    };
    // 今日が変わっても、同じ事の用意は作り直さない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, t.id, canLocal, canDraft, me?.id, tries]);

  const preps = canLocal || canDraft;
  const busy = localState === "busy" || draftState === "busy";
  const draft = view?.draft ?? null;
  const sample = isSample(draft);
  const lines: PrepLine[] = [];
  if (canLocal && localState !== "fail") {
    const where = local?.where && local.where !== "確かめる" ? local.where : local?.office;
    lines.push({
      key: "where",
      state: localState,
      text: localState === "ok" && where ? `行き先: ${where}` : `${family.city}の窓口を調べています`,
    });
    if (localState === "ok" && local?.bring?.length) lines.push({ key: "bring", state: "ok", text: `持ち物 ${local.bring.length}つ: ${local.bring.slice(0, 3).join("・")}${local.bring.length > 3 ? " ほか" : ""}` });
  }
  if (canDraft && draftState === "busy") {
    lines.push({ key: "draft", state: "busy", text: `${nounFor(DRAFTABLE[t.id], t)}を作っています` });
  }
  // できた下書きは消さずに、手帳がした事として残す。残る空欄は下書きから数える（見本の答えは数えない）
  if (canDraft && draftState === "ok" && draft && !sample) {
    lines.push({ key: "draft", state: "ok", text: madeLine(nounFor(draft.kind ?? DRAFTABLE[t.id], t), draft.kind ?? DRAFTABLE[t.id], (view?.blanks ?? []).map((b) => b.label)) });
  }

  /** 手帳が本当に用意した物がある（調べた窓口か、見本でない下書き） */
  const made = (localState === "ok" && !!local) || (draftState === "ok" && !!draft && !sample);
  /** 用意がひと通り終わった（できた・できなかった・見本だった） */
  const settled = preps && !busy && (localState === "ok" || localState === "fail" || draftState === "ok" || draftState === "fail");
  // 用意がすべてつまずいた時（見本の下書きは除く）: 黙って「次にやる事」に戻さず、手帳が作れる事を1つのボタンで出す（最初の1分 2026-11-04）
  const failed = preps && !busy && lines.length === 0 && draftState !== "ok" && (localState === "fail" || draftState === "fail");

  return { canLocal, canDraft, preps, busy, made, settled, failed, lines, ver };
}
