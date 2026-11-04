"use client";

// 「いま」の一番上の1枚（UI/UX 見直し A案・2026-11-03）。
// 主語を家族から手帳に移す: 開いた時に手帳が窓口を調べ、書く事のメモを作っておき、「用意しておいた事」として報告する。
// 家族がするのは中を見て「済んだ」を押す事だけ。用意する物が無い事（健診のお知らせなど）は、今までどおりの1枚。
// 調べ・下書きは一番上の1件だけ先に作る（2件目からは押した時）。前に作った物があればそれを使い、作り直さない。
import { useEffect, useState } from "react";
import type { LocalInfo } from "@/lib/local";
import type { DraftView } from "@/lib/drafts";
import { api, useFamily } from "../FamilyProvider";
import { DRAFTABLE, NOUN } from "../MilestoneActions";
import { TopTask, type ShownTask } from "./TaskCard";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";

type Prep = "idle" | "busy" | "ok" | "fail";

export function NowCard(p: {
  task: ShownTask;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  soon?: boolean;
  onDone: () => void;
  onAssign?: (milestoneId: string, who: string) => void;
}) {
  const { task: t, today } = p;
  const { family, me } = useFamily();
  // 先に調べるのは、役所に出す手続きだけ（産院・職場に出す物を役所の窓口で調べると、違う行き先が出る＝sim-14 の直接支払制度）
  const canLocal = t.needsLocal && !!family.city && t.kind === "手続き" && !/産院|職場/.test(`${t.title}${t.plain}`);
  const canDraft = t.id in DRAFTABLE;
  const [local, setLocal] = useState<LocalInfo | null>(null);
  const [localState, setLocalState] = useState<Prep>("idle");
  const [draft, setDraft] = useState<DraftView["draft"]>(null);
  const [draftState, setDraftState] = useState<Prep>("idle");
  // 用意が終わったら、中のボタン（MilestoneActions）を読み直させる
  const [ver, setVer] = useState(0);

  useEffect(() => {
    let alive = true;
    const q = new URLSearchParams({ familyId: family.id, milestoneId: t.id, ...(me ? { meId: me.id } : {}) });
    if (canLocal) {
      setLocalState("busy");
      api<{ local: LocalInfo | null }>(`/api/local?${q}`)
        .then((r) => r.local ?? api<{ local: LocalInfo }>("/api/local", { body: { familyId: family.id, milestoneId: t.id } }).then((x) => x.local))
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
        .then((v) => (v.draft ? v : api<DraftView>("/api/draft", { body: { familyId: family.id, milestoneId: t.id, today, meId: me?.id } })))
        .then((v) => {
          if (!alive) return;
          setDraft(v.draft);
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
  }, [family.id, t.id, canLocal, canDraft, me?.id]);

  const preps = canLocal || canDraft;
  const busy = localState === "busy" || draftState === "busy";
  const lines: { key: string; state: Prep; text: string }[] = [];
  if (canLocal && localState !== "fail") {
    const where = local?.where && local.where !== "確かめる" ? local.where : local?.office;
    lines.push({
      key: "where",
      state: localState,
      text: localState === "ok" && where ? `行き先: ${where}` : `${family.city}の窓口を調べています`,
    });
    if (localState === "ok" && local?.bring?.length) lines.push({ key: "bring", state: "ok", text: `持ち物 ${local.bring.length}つ: ${local.bring.slice(0, 3).join("・")}${local.bring.length > 3 ? " ほか" : ""}` });
  }
  if (canDraft && draftState !== "fail") {
    const noun = NOUN[draft?.kind ?? DRAFTABLE[t.id]];
    lines.push({
      key: "draft",
      state: draftState,
      text: draftState === "ok" ? `${noun}、できています` : `${noun}を作っています`,
    });
  }

  const eyebrow = !preps ? undefined : busy ? "手帳が用意しています" : lines.some((l) => l.state === "ok") ? "手帳が用意しておいた事" : undefined;

  return (
    <TopTask {...p} key={ver} eyebrowOverride={eyebrow}>
      {lines.length > 0 && (
        <ul className="flex w-full flex-col gap-1 rounded-xl bg-card/70 px-3 py-2" aria-live="polite">
          {lines.map((l) => (
            <li key={l.key} className="flex items-baseline gap-2 text-base">
              <span aria-hidden className={`w-4 shrink-0 text-center ${l.state === "ok" ? "text-ok" : "text-muted"}`}>
                {l.state === "ok" ? "✓" : l.state === "busy" ? "…" : "・"}
              </span>
              <span className={`min-w-0 ${l.state === "ok" ? "" : "text-muted"}`}>{l.text}</span>
            </li>
          ))}
        </ul>
      )}
    </TopTask>
  );
}
