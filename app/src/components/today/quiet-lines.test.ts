// 「いま」の画面を静かにする（家族の声①への直し A・2026-11-05 統括が承認した (a)〜(d)）の、画面を持たない所の試験。
// - ようこその札: 届けの束がすぐ下にある日は、出生届の期限と担当を束に任せる（産んだ人には、休む事だけ）
// - 予定のボタン: 「どこへ行くか見る」「◯を作る」があるかを、描く前に決める（前は描いた後に数えていて、主ボタンが一瞬ちがって見えた）
import { describe, expect, it } from "vitest";
import { DRAFTABLE } from "@/lib/draft-kinds";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { withLang, type Lang } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dicts";
import { scheduleFor } from "@/lib/milestones";
import { actionsOf } from "../actions-of";
import { registrationLine, tripBelowLine } from "./welcome";

const at = <T,>(lang: Lang, fn: () => T): T => withLang(lang, fn, DICTS[lang]);
const mother = DEMO_FAMILY.members.find((m) => m.role === "母")!;
const partner = DEMO_FAMILY.members.find((m) => m.role === "パートナー")!;

describe("ようこその札の届けの一言（束がすぐ下にある日）", () => {
  it("産んだ人には休む事だけ。ほかの家族には何も足さない（束が言う事を繰り返さない）", () => {
    expect(tripBelowLine(mother)).toBe("届けは下の1枚に。あなたは、休む事を一番に。");
    expect(tripBelowLine(partner)).toBe("");
    expect(tripBelowLine(null)).toBe("");
  });
  it("中文・English でも、かなを残さない", () => {
    expect(at("en", () => tripBelowLine(mother))).toBe("The paperwork is in the card below. Put your rest first.");
    expect(at("zh", () => tripBelowLine(mother))).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}]/u);
  });
  it("束が無い日の一言（registrationLine）は前のまま", () => {
    const reg = scheduleFor(DEMO_FAMILY).find((m) => m.id === "birth-registration")!;
    const line = registrationLine(DEMO_FAMILY, mother, { ...reg, status: "今やる" as const });
    expect(line).toMatch(/^出生届は/);
    expect(line).toContain("あなたは、休む事を一番に。");
  });
});

describe("予定のボタンがあるかを、描く前に決める（actionsOf）", () => {
  const ms = scheduleFor(DEMO_FAMILY);
  it("役所に出す手続きで町が分かる時だけ、窓口を調べる。産院・職場に出す物と仕事の事は調べない", () => {
    for (const m of ms) {
      const { canLocal, canDraft } = actionsOf(m, DEMO_FAMILY.city);
      // 前の MilestoneActions の中の判定と同じ
      expect(canLocal, m.id).toBe(!!m.needsLocal && !!DEMO_FAMILY.city && !(m.kind === "仕事" || /産院|職場/.test(`${m.title}${m.plain}`)));
      expect(canDraft, m.id).toBe(m.id in DRAFTABLE);
    }
    const reg = ms.find((m) => m.id === "birth-registration")!;
    expect(actionsOf(reg, DEMO_FAMILY.city).canLocal).toBe(true);
    // 町が分からない家族では、窓口を調べない
    expect(actionsOf(reg, "").canLocal).toBe(false);
  });
});
