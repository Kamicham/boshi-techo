import { route } from "@/lib/api";
import { getDraft, viewDraft } from "@/lib/drafts";
import { findMilestone, getLocal } from "@/lib/local";
import { SAMPLE_MARK } from "@/lib/samples";
import type { Prepared } from "@/components/today/prep";
import { familyFor } from "../_lib/household";

/** 一度に聞ける事の数（今日の画面の行は多くても数十） */
const MAX_IDS = 60;

/**
 * 手帳が前に用意した物（下書き・調べた町の窓口）を、まとめて読む（UX の見直し C07: 行の札「下書きあり」「窓口 ✓」と、帯の下の「手帳がしておいた事」）。
 * ?familyId=&ids=a,b,c[&meId=] … { items: { [milestoneId]: { draft?: { kind, on, blanks }, local?: { on } } } }
 * 読むだけ。作り・調べには行かない（Claude を呼ばない）。鍵が無い時の見本の答えは、用意した物に数えない。
 * blanks は「いつもの」と書き手の名前で埋めた後に残る空欄の名前（画面の「あと上司の名前だけ」）。
 */
export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const { family } = await familyFor(req, q.get("familyId"), "record:read");
  const meId = q.get("meId") || null;
  const ids = [
    ...new Set(
      (q.get("ids") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_IDS);
  const items: Record<string, Prepared> = {};
  for (const id of ids) {
    let mid: string;
    try {
      mid = findMilestone(id).id;
    } catch {
      continue; // 知らない事は飛ばす（古い画面が消えた事を聞いても、ほかの答えは返す）
    }
    const out: Prepared = {};
    const d = getDraft(family.id, mid);
    if (d && !d.title.startsWith(SAMPLE_MARK)) {
      const v = viewDraft(family, d, meId);
      out.draft = { kind: d.kind, on: d.today, blanks: v.blanks.map((b) => b.label) };
    }
    const l = getLocal(family, mid);
    if (l) out.local = { on: l.researchedAt };
    if (out.draft || out.local) items[mid] = out;
  }
  return { items };
});
