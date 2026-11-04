// 「いつもの場所と人」: そう変わらない事は一度覚えて、次から自動で使う（作り手の見直し 2026-11-02）。
// 先に設定で入れてもよいし、健診の日に撮った案内図や、下書きの空欄に入れた名前からも覚える。
import "server-only";
import { get, put } from "./db";
import type { GuideStep } from "./visit";
import { blankKey, type BlankKey } from "./blanks";
import type { Work } from "./whose";
import type { Office } from "./move";

export interface Keep {
  /** 通う病院 */
  hospital?: {
    name?: string;
    /** 院内の回る順番（案内図・受付票から作った物） */
    guide?: { steps: GuideStep[]; unsure?: string | null; at: string; fromVisit?: string };
    phone?: string;
  };
  /**
   * 職場（職場あての下書きの空欄を埋める）。11/3 から家族に1つだった欄で、今は「母（いなければ家族の最初の人）」の職場として読む。
   * 人ごとの職場は workBy。読むのは lib/whose.ts の workOf（だれの職場かを決める所を1つにする）
   */
  work?: Work;
  /** 人ごとの職場（家族の id → 職場。2026-11-05 から。母の分は work に書く） */
  workBy?: Record<string, Work>;
  /** 手紙に書く名前（家族の id ごと。呼び名が「パパ」などの時に、空欄へ入れた名前を覚える） */
  names?: Record<string, string>;
  /**
   * 役所の窓口（町の調べ・行ってみた話から）。
   * staleFrom: 町を変えた時に付ける「前の町の窓口」の印（前の町の名前）。印のある窓口は下書きと予定の場所に使わない（lib/move.ts の officeOf）。
   * 新しい町の調べで覚え直す時・家族が設定で窓口を直した時に外す（見直し C10①）
   */
  office?: Office;
  /** 家族へ送る時に選んだアプリ（次から先頭に出す） */
  shareVia?: "line" | "mail" | "share";
  /** 子の性別（発育曲線の帯を男女どちらで描くか。帯を選ぶためだけに使う。一度選べば次から聞かない） */
  childSex?: "boy" | "girl";
  /** 家族みんなの事を、誰がやるか（milestone id → 家族の id。"together" は2人で）。今日の画面の「誰がやる？」で決める */
  assign?: Record<string, string>;
  /** 生まれた届けを出しに役所へ行く日（第1波②の1枚で決める） */
  birthTrip?: { date?: string };
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
    if (k === "workBy" && v && typeof v === "object") {
      // 人ごとの職場は、人ごとに1つ下の欄まで混ぜる（ほかの人の職場・同じ人のほかの欄を消さない）
      const all: Record<string, Work> = { ...(cur.workBy ?? {}) };
      for (const [id, w] of Object.entries(v as Record<string, Work>)) {
        const merged: Record<string, unknown> = { ...(all[id] ?? {}) };
        for (const [f, x] of Object.entries(w ?? {})) {
          if (x === undefined) continue;
          if (x === "") delete merged[f];
          else merged[f] = x;
        }
        if (Object.keys(merged).length) all[id] = merged as Work;
        else delete all[id];
      }
      if (Object.keys(all).length) next.workBy = all;
      else delete next.workBy;
      continue;
    }
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

/** 町を変えた時: 覚えていた役所の窓口に「前の町の窓口」の印を付ける（窓口を覚えていなければ何もしない） */
export function markOfficeMoved(familyId: string, fromTown: string): void {
  const o = getKeep(familyId).office;
  if (!o?.name && !o?.address) return;
  remember(familyId, { office: { staleFrom: fromTown || "前の町" } });
}

/**
 * 空欄の種類ごとの「いつもの」の値。職場の欄は、渡した職場（書き手の職場＝lib/whose.ts の workOf）だけで埋める。
 * 職場を渡さない時は職場の欄を埋めない（家族のほかの人の会社・上司を入れない＝見直し C09）
 */
export function keepValue(key: BlankKey, keep: Keep, writer?: string | null, work?: Work): string | undefined {
  const w = work ?? {};
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
 * 下書きの【 】を、覚えている事と書き手の名前・書き手の職場で埋める。
 * 「【上司の名前】様」のように後ろに敬称がある時は、値の敬称を重ねない。
 */
export function fillBlanks(text: string, keep: Keep, opts: { writer?: string | null; work?: Work } = {}): string {
  return text.replace(/【([^】\n]{1,40})】/g, (m, inner: string, at: number, all: string) => {
    const key = blankKey(inner, all.slice(Math.max(0, at - 8), at));
    if (!key) return m;
    let v = keepValue(key, keep, opts.writer, opts.work)?.trim();
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
