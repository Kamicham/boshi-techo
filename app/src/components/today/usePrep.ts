"use client";

// 手帳が先に用意する（窓口を調べ、書く事のメモを作る）。一番上の札（NowCard）と、生まれた届けの束の1行目（BirthTripCard）が使う。
// 前に作った物があればそれを使い、作り直さない。できた物は「✓」の行で残す（UX の見直し C07: 済むと跡が消えていた）。
// 鍵が無い時の見本の答えは、用意したと数えない（「下書きしました」と言わない＝現実に即す）。
import { useEffect, useState } from "react";
import { draftConsentWaitKey, isClaudeConsentError, waitingDraftFor } from "@/lib/claude-consent-flow";
import type { LocalInfo } from "@/lib/local";
import type { DraftView } from "@/lib/drafts";
import type { Family, Member } from "@/lib/demo-family";
import { api } from "../FamilyProvider";
import { DRAFTABLE, nounFor } from "../MilestoneActions";
import { canLocalFor, draftKindFor, isSample, madeLine } from "./prep";
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
  // 下書きが「米国の Claude に送る同意」の前で断られた（行を黙って消さず、同意への1行を出す。見直し C38 の「いま」の分）
  const [draftConsent, setDraftConsent] = useState(false);
  // 用意が終わったら、中のボタン（MilestoneActions）を読み直させる
  const [ver, setVer] = useState(0);
  // 下の「◯を作る」（MilestoneActions）から同意の画面へ行って戻った時は、そちらが窓を開いて作るので、ここでは作らず、中も組み直さない
  // （組み直すと、そちらの開いた窓と作りかけが消え、ここでも作って2回になる）。控えはそちらが開いた時に消すので、最初の描画で読んでおく
  const [below] = useState(() => {
    try {
      return waitingDraftFor(sessionStorage.getItem(draftConsentWaitKey(family.id)), t.id, Date.now()) ? t.id : null;
    } catch {
      return null;
    }
  });

  useEffect(() => {
    let alive = true;
    const wait = below === t.id && tries === 0;
    const bump = () => !wait && setVer((v) => v + 1);
    const q = new URLSearchParams({ familyId: family.id, milestoneId: t.id, ...(me ? { meId: me.id } : {}) });
    if (canLocal) {
      setLocalState("busy");
      api<{ local: LocalInfo | null }>(`/api/local?${q}`)
        .then((r) => r.local ?? api<{ local: LocalInfo }>("/api/local", { body: { familyId: family.id, milestoneId: t.id } }).then((x) => (notifyPrep(), x.local)))
        .then((l) => {
          if (!alive) return;
          setLocal(l);
          setLocalState("ok");
          bump();
        })
        .catch(() => alive && setLocalState("fail"));
    }
    if (canDraft) {
      setDraftState("busy");
      setDraftConsent(false);
      // 同意して戻ると、開き直したこの画面でそのまま作る（作るのは今までどおり POST /api/draft だけ。サーバが同意を確かめる）
      api<DraftView>(`/api/draft?${q}`)
        .then((v) => (v.draft || wait ? v : api<DraftView>("/api/draft", { body: { familyId: family.id, milestoneId: t.id, today, meId: me?.id } }).then((x) => (notifyPrep(), x))))
        .then((v) => {
          if (!alive) return;
          setView(v);
          setDraftState(v.draft ? "ok" : wait ? "idle" : "fail");
          bump();
        })
        .catch((e) => {
          if (!alive) return;
          setDraftState("fail");
          setDraftConsent(isClaudeConsentError(e instanceof Error ? e.message : null));
        });
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
    const kind = draftKindFor(t.id, draft.kind);
    lines.push({ key: "draft", state: "ok", text: madeLine(nounFor(kind, t), kind, (view?.blanks ?? []).map((b) => b.label)) });
  }

  /** 手帳が本当に用意した物がある（調べた窓口か、見本でない下書き） */
  const made = (localState === "ok" && !!local) || (draftState === "ok" && !!draft && !sample);
  /** 用意がひと通り終わった（できた・できなかった・見本だった） */
  const settled = preps && !busy && (localState === "ok" || localState === "fail" || draftState === "ok" || draftState === "fail");
  // 用意がすべてつまずいた時（見本の下書きは除く）: 黙って「次にやる事」に戻さず、手帳が作れる事を1つのボタンで出す（最初の1分 2026-11-04）
  const failed = preps && !busy && lines.length === 0 && draftState !== "ok" && (localState === "fail" || draftState === "fail");
  /** 同意がまだで下書きを作れなかった時の、作る物の呼び名（それ以外は null）。PrepBox が同意への1行を出す */
  const consent = canDraft && draftState === "fail" && draftConsent ? nounFor(draftKindFor(t.id), t) : null;

  return { canLocal, canDraft, preps, busy, made, settled, failed, consent, lines, ver };
}
