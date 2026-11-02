// 「いつもの場所と人」: そう変わらない事は一度覚えて、次から自動で使う（社長の見直し 2026-11-02）。
// 先に設定で入れてもよいし、健診の日に撮った案内図や、下書きの空欄に入れた名前からも覚える。
import "server-only";
import { get, put } from "./db";
import type { GuideStep } from "./visit";

export interface Keep {
  /** 通う病院 */
  hospital?: {
    name?: string;
    /** 院内の回る順番（案内図・受付票から作った物） */
    guide?: { steps: GuideStep[]; unsure?: string | null; at: string; fromVisit?: string };
    phone?: string;
  };
  /** 職場（職場あての下書きの空欄を埋める） */
  work?: { company?: string; boss?: string; email?: string };
  /** 役所の窓口（町の調べ・行ってみた話から） */
  office?: { name?: string; address?: string };
  /** 家族へ送る時に選んだアプリ（次から先頭に出す） */
  shareVia?: "line" | "mail" | "share";
  updatedAt?: string;
}

const keepId = (familyId: string) => `keep:${familyId}`;

export function getKeep(familyId: string): Keep {
  return get<Keep>(keepId(familyId))?.data ?? {};
}

/** 浅く混ぜて覚える（空の値は今の値を消さない） */
export function remember(familyId: string, patch: Partial<Keep>): Keep {
  const cur = getKeep(familyId);
  const next: Keep = { ...cur, updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch) as [keyof Keep, unknown][]) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const clean = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined && x !== ""));
      (next as Record<string, unknown>)[k] = { ...((cur[k] as object) ?? {}), ...clean };
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  put<Keep>(familyId, "profile", next, { id: keepId(familyId) });
  return next;
}

/** 下書きの【 】を、覚えている事で埋める */
export function fillBlanks(text: string, keep: Keep): string {
  const w = keep.work ?? {};
  return text
    .replace(/【(会社名|勤務先|職場名?)】/g, (m) => w.company || m)
    .replace(/【(上司の(お)?名前|上司名?|ご担当者様?の(お)?名前)】/g, (m) => w.boss || m)
    .replace(/【(上司の)?(メールアドレス|宛先)】/g, (m) => w.email || m)
    .replace(/【(病院名|産院名|かかりつけの(病院|産院)名?)】/g, (m) => keep.hospital?.name || m);
}
