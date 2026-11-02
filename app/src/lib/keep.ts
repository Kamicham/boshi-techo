// 「いつもの場所と人」: そう変わらない事は一度覚えて、次から自動で使う（社長の見直し 2026-11-02）。
// 先に設定で入れてもよいし、健診の日に撮った案内図や、下書きの空欄に入れた名前からも覚える。
import "server-only";
import { get, put } from "./db";
import type { GuideStep } from "./visit";
import { blankKey, type BlankKey } from "./blanks";

export interface Keep {
  /** 通う病院 */
  hospital?: {
    name?: string;
    /** 院内の回る順番（案内図・受付票から作った物） */
    guide?: { steps: GuideStep[]; unsure?: string | null; at: string; fromVisit?: string };
    phone?: string;
  };
  /** 職場（職場あての下書きの空欄を埋める） */
  work?: {
    company?: string;
    /** 部署名 */
    dept?: string;
    boss?: string;
    /** 上司のメールアドレス */
    email?: string;
    /** 人事の担当（名前） */
    hr?: string;
    /** 人事のメールアドレス */
    hrEmail?: string;
  };
  /** 手紙に書く名前（家族の id ごと。呼び名が「パパ」などの時に、空欄へ入れた名前を覚える） */
  names?: Record<string, string>;
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

/**
 * 浅く混ぜて覚える。
 * - undefined の欄は今の値のまま（触らない）
 * - 明示に空文字を送った欄は消す（設定で空にした時）
 */
export function remember(familyId: string, patch: Partial<Keep>): Keep {
  const cur = getKeep(familyId);
  const next: Keep = { ...cur, updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(patch) as [keyof Keep, unknown][]) {
    if (v === undefined) continue;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const merged: Record<string, unknown> = { ...((cur[k] as object) ?? {}) };
      for (const [f, x] of Object.entries(v)) {
        if (x === undefined) continue;
        if (x === "") delete merged[f];
        else merged[f] = x;
      }
      if (Object.keys(merged).length) (next as Record<string, unknown>)[k] = merged;
      else delete (next as Record<string, unknown>)[k];
    } else if (v === "") {
      delete (next as Record<string, unknown>)[k];
    } else {
      (next as Record<string, unknown>)[k] = v;
    }
  }
  put<Keep>(familyId, "profile", next, { id: keepId(familyId) });
  return next;
}

/** 空欄の種類ごとの「いつもの」の値 */
export function keepValue(key: BlankKey, keep: Keep, writer?: string | null): string | undefined {
  const w = keep.work ?? {};
  switch (key) {
    case "company":
      return w.company;
    case "dept":
      return w.dept;
    case "boss":
      return w.boss;
    case "email":
      return w.email;
    case "hr":
      return w.hr;
    case "hrEmail":
      return w.hrEmail;
    case "hospital":
      return keep.hospital?.name;
    case "myName":
      return writer ?? undefined;
  }
}

/**
 * 下書きの【 】を、覚えている事と書き手の名前で埋める。
 * 「【上司の名前】様」のように後ろに敬称がある時は、値の敬称を重ねない。
 */
export function fillBlanks(text: string, keep: Keep, opts: { writer?: string | null } = {}): string {
  return text.replace(/【([^】\n]{1,40})】/g, (m, inner: string, at: number, all: string) => {
    const key = blankKey(inner, all.slice(Math.max(0, at - 8), at));
    if (!key) return m;
    let v = keepValue(key, keep, opts.writer)?.trim();
    if (!v) return m;
    if (key === "boss" || key === "hr") {
      // 後ろに「様」が続くなら、値の敬称は外す（山田さん様 にしない）
      if (all.startsWith("様", at + m.length)) v = v.replace(/\s*(様|さん|殿)$/, "");
      // 「【人事のご担当者様】」の様は、値に敬称が無ければ付ける
      else if (/様$/.test(inner) && !/(様|さん|殿)$/.test(v)) v = `${v}様`;
    }
    return v;
  });
}
