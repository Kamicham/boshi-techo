"use client";

// 開いた時に、手帳が先に用意する（UX の見直し C07・2026-11-05）。
// 一番上の札（か届けの束の1行目）が用意する1件のほかに、14日以内に始まる事を、合わせて3件まで（選び方は prep.ts の prepAhead）。
// 町の調べ → 下書きの順に1件ずつ。前に作った物があれば作らない。同じ日に同じ事を2度は頼まない（この端末で覚える）。
// 本物の家族だけ（見本・なりきり・公開版の写しは、開く人ごとに費用が増えるので、今までどおり一番上の1件だけ）。
// 費用は世帯の1日の上限（BOSHI_HOUSEHOLD_DAILY_USD・lib/spend.ts の 429）で止まる。上限・同意がまだ・鍵が無い時は、今日はそこでやめる。
import { useEffect } from "react";
import type { LocalInfo } from "@/lib/local";
import type { DraftView } from "@/lib/drafts";
import type { Family, Member } from "@/lib/demo-family";
import { ApiError, api } from "../FamilyProvider";
import { DRAFTABLE, nounFor } from "../MilestoneActions";
import { jpShort } from "./dates";
import { canLocalFor, prepNoteOf, type Prepared } from "./prep";
import { notifyPrep } from "./usePrep";
import type { Task } from "./task";

/** 用意を走らせている家族（同じ画面を2回開いても、2本は走らせない） */
const running = new Set<string>();

/** 断られたら今日はやめる失敗（入れない・同意がまだ・上限・鍵が無い） */
const STOP = new Set([401, 403, 429, 503]);

/** この端末で今日もう頼んだ事か。まだなら頼んだ印を付けて true（同じ日に同じ事を2度は頼まない） */
function claim(familyId: string, today: string, id: string): boolean {
  const key = `boshi.prepAhead.${familyId}`;
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "null") as { day?: string; ids?: string[] } | null;
    const ids = raw?.day === today && Array.isArray(raw.ids) ? raw.ids : [];
    if (ids.includes(id)) return false;
    localStorage.setItem(key, JSON.stringify({ day: today, ids: [...ids, id] }));
  } catch {
    // 覚えられない端末（プライベートの窓など）でも、走っている間の重なりは running で防ぐ
  }
  return true;
}

/** 裏で用意する（画面には何も出さない。でき上がると boshi:prep で今日の画面が跡を読み直す） */
export function PrepAhead({ tasks, family, me, today, enabled }: { tasks: Task[]; family: Family; me: Member | null; today: string; enabled: boolean }) {
  const key = tasks.map((t) => t.id).join(",");
  useEffect(() => {
    if (!enabled || !key || running.has(family.id)) return;
    running.add(family.id);
    const body = (t: Task) => ({ familyId: family.id, milestoneId: t.id });
    // 1つ頼む。断られたら（STOP）投げて全体を止める。ほかの失敗はその1つだけ飛ばす
    const ask = async (f: () => Promise<unknown>) => {
      try {
        await f();
        notifyPrep();
      } catch (e) {
        if (e instanceof ApiError && (STOP.has(e.status) || e.status === 0)) throw e;
      }
    };
    const run = async () => {
      for (const t of tasks) {
        if (!claim(family.id, today, t.id)) continue;
        const q = new URLSearchParams({ familyId: family.id, milestoneId: t.id, ...(me ? { meId: me.id } : {}) });
        if (canLocalFor(t, family)) {
          const r = await api<{ local: LocalInfo | null }>(`/api/local?${q}`);
          if (!r.local) await ask(() => api("/api/local", { body: body(t) }));
        }
        if (t.id in DRAFTABLE) {
          const v = await api<DraftView>(`/api/draft?${q}`);
          if (!v.draft) await ask(() => api("/api/draft", { body: { ...body(t), today, meId: me?.id } }));
        }
      }
    };
    void run()
      .catch(() => {})
      .finally(() => running.delete(family.id));
    // 用意は画面を離れても続ける（でき上がった物は、次に開いた時に跡として出る）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, family.id, today, me?.id, key]);
  return null;
}

/**
 * 週数の帯の下の1行「手帳がしておいた事（11/5）: 窓口の調べ2件・下書き1件 ›」。押すと、何をしたかが開く。
 * 数えるのは、開いた時に手帳が用意する事（一番上を含めて3件まで）のうち、本当にできている物だけ（見本の答えは数えない）。
 */
export function PrepNote({ tasks, prepared, today }: { tasks: Task[]; prepared: Record<string, Prepared>; today: string }) {
  const note = prepNoteOf(
    tasks.map((t) => t.id),
    prepared,
  );
  if (!note) return null;
  const parts = [note.local.length > 0 && `窓口の調べ${note.local.length}件`, note.draft.length > 0 && `下書き${note.draft.length}件`].filter(Boolean);
  const done = tasks.filter((t) => prepared[t.id]?.local || prepared[t.id]?.draft);
  return (
    <details className="group -mt-2 text-sm text-muted">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1">
        <span className="min-w-0">
          <span className="font-semibold text-sky">手帳がしておいた事</span>
          {note.on && <span className="tabular">（{jpShort(note.on, today)}）</span>}: {parts.join("・")}
        </span>
        <span className="shrink-0 transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <ul className="flex flex-col gap-1 pb-1">
        {done.map((t) => {
          const p = prepared[t.id];
          const what = [p.local && "窓口を調べた", p.draft && `${nounFor(p.draft.kind ?? DRAFTABLE[t.id], t)}を作った`].filter(Boolean).join("・");
          return (
            <li key={t.id} className="flex items-baseline gap-2">
              <span aria-hidden className="w-4 shrink-0 text-center text-ok">
                ✓
              </span>
              <span className="min-w-0">
                {t.plain}: {what}
              </span>
            </li>
          );
        })}
      </ul>
    </details>
  );
}
