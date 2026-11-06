// 鍵が無い時の見本（2026-11-04 夜・見直し C01）: 見本の家族は、鍵が無くても事実どおりに動く。
// - 気づき: 予定表の決まりから文を作る（題・次にする事・職場の上司あての文）。「予定表に無い事に気づきました」の空の見本にしない
// - 下書き: 押したボタンと同じ種類（「職場へのメールを作る」で「書く事のメモ」が出ない）
// - 撮った紙: 写真は読まず、残してもいない事を、そのまま言う
// Claude には一度もつながない（SDK は偽物で、呼んだら落ちる）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const calls: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        parse: async (p: unknown) => {
          calls.push(p);
          throw new Error("鍵の無い見本では Claude を呼ばない");
        },
        create: async (p: unknown) => {
          calls.push(p);
          throw new Error("鍵の無い見本では Claude を呼ばない");
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-samples-rule-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_DAILY_USD;
delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const demo = { householdId: "demo-sato", kind: "demo" as const, accountId: null, subjectIds: [], legacy: true };

beforeEach(() => {
  calls.length = 0;
  delete process.env.ANTHROPIC_API_KEY;
});

async function adviceOn(family: import("./demo-family").Family, today: string) {
  const { detectTriggers } = await import("./advisor");
  const { writeAdvice } = await import("@/app/api/advisor/_lib/write");
  const { sendingAs } = await import("./claude");
  const input = { family, today, done: new Set<string>(), isDemo: true };
  const [t] = detectTriggers(input);
  expect(t).toBeDefined();
  return { t, a: await sendingAs(demo, () => writeAdvice(t, input, {})) };
}

/** カードの表に1行で出る理由の1文目（components/today/AdvisorCard.tsx と同じ切り方） */
const whyHead = (why: string) =>
  why
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .filter(Boolean)[0];

/** 表の1文目は「何が起きたか」（iPhone の幅で1行＝19字まで）。札は理由の後ろに残す（2026-11-05 UX: 表が札だけで、なぜが無かった） */
function headIsCause(why: string, head: string, mark: string) {
  expect(whyHead(why)).toBe(head);
  expect(head.length).toBeLessThanOrEqual(19);
  expect(why).toContain(mark);
  expect(why.startsWith(mark)).toBe(false);
}

/** 文字数の約束（題30字・次にする事40字・3つまで）と、脅さない言葉 */
function fair(a: { title: string; plan: string[] }) {
  expect(a.title.length).toBeLessThanOrEqual(24);
  expect(a.title).not.toMatch(/早く|遅く|このままだと|失う|もらえない|損|見本/);
  expect(a.plan.length).toBeGreaterThan(0);
  expect(a.plan.length).toBeLessThanOrEqual(3);
  for (const p of a.plan) expect(p.length).toBeLessThanOrEqual(40);
}

describe("気づき: 鍵が無い時は、予定表の決まりから書く", () => {
  it("予定日より前に生まれた: 育休の始まりの数え直し・パートナーの育休・職場の上司あての文", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const { RULE_MARK } = await import("./advisor");
    const { a, t } = await adviceOn({ ...DEMO_FAMILY, id: "demo-rule-early" }, "2027-04-27");
    expect(t.kind).toBe("birth-early");
    expect(a.title).toBe("美咲の育休の始まりを6月22日に数え直しました");
    fair(a);
    headIsCause(a.why, "予定日より14日早く生まれました。", RULE_MARK);
    expect(a.why).toContain("労働基準法第65条");
    expect(a.why).toContain("鍵を入れると");
    expect(a.plan[0]).toBe("美咲の職場に、育休の始まりを6月22日に直すと伝える");
    expect(a.plan.some((p) => p.startsWith("翔太の育休") && p.includes("職場に確かめる"))).toBe(true);
    expect(a.message).toMatchObject({ to: "職場の上司", via: "mail" });
    // 空欄は「いつもの」と送る人の名前で埋まる形（lib/blanks.ts の blankKey）
    expect(a.message!.body).toContain("【上司の名前】様");
    expect(a.message!.body).toContain("【名前】");
    // 名乗りは姓（分からないので【姓】）。【名前】は書き手の名で埋まるので名乗りに使わない。生まれた後に「産前休業」と書かない（デモの会話の見つけ ②）
    expect(a.message!.body).toContain("お疲れさまです。【姓】です。");
    expect(a.message!.body).not.toMatch(/【名前】です|産前休業/);
    const { fillFamilyBlanks } = await import("./blanks");
    const filled = fillFamilyBlanks(a.message!.body, DEMO_FAMILY, { writer: "美咲" });
    expect(filled).not.toContain("美咲です");
    expect(filled).toContain("【姓】美咲");
    expect(a.message!.body).toContain("6月22日から");
    expect(a.message!.body).toContain("4月26日に子どもが生まれました");
    expect(a.message!.body).not.toMatch(/早く|遅く/);
    // 機械で確かめた事は、今までどおり画面の「なぜ？」に出す
    expect(a.facts).toEqual(t.facts);
    expect(calls).toHaveLength(0);
  });

  it("予定日より後に生まれた: パートナーの育休の繰り上げは言わない", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const { a, t } = await adviceOn({ ...DEMO_FAMILY, id: "demo-rule-late", birthDate: "2027-05-20" }, "2027-05-21");
    expect(t.kind).toBe("birth-late");
    expect(a.title).toBe("美咲の育休の始まりを7月16日に数え直しました");
    fair(a);
    expect(a.plan.some((p) => p.includes("翔太"))).toBe(false);
    expect(a.why).toContain("遅くなります");
    expect(whyHead(a.why)).toBe("予定日より10日遅く生まれました。");
    expect(calls).toHaveLength(0);
  });

  it("パートナーに仕事が無い家族には、パートナーの育休の事を言わない", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const family = { ...DEMO_FAMILY, id: "demo-rule-nowork", situation: { ...DEMO_FAMILY.situation!, partnerWork: "仕事なし" as const, partnerLeave: undefined } };
    const { a } = await adviceOn(family, "2027-04-27");
    expect(a.plan.some((p) => p.includes("翔太"))).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("妊娠中に引っ越した: 転入の届けの締切（引っ越した日から14日以内）と健診の券の取り替え", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const { RULE_MARK } = await import("./advisor");
    const { a, t } = await adviceOn({ ...DEMO_FAMILY, id: "demo-rule-moved" }, "2027-01-19");
    expect(t.kind).toBe("moved");
    // カードの2行に収まるよう、24字を超える時は前の町を省く（前の町は文面と「機械で確かめた事」に残る）
    expect(a.title).toBe("さいたま市へ: 転入の届けと健診の券の取り替え");
    fair(a);
    // 題で省いた前の町は、表の1文目に出す
    headIsCause(a.why, "1月18日に横浜市から引っ越しました。", RULE_MARK);
    expect(a.why).toContain("住民基本台帳法第22条");
    // 1月18日に引っ越した → 初日を数えず14日 → 2月1日まで
    expect(a.plan[0]).toBe("転入の届け: 2月1日まで（引っ越した日から14日以内）");
    expect(a.plan.some((p) => p.includes("受診票"))).toBe(true);
    expect(a.message).toMatchObject({ to: "さいたま市の子育ての窓口", via: "mail" });
    expect(a.message!.body).toContain("横浜市でもらった妊婦健診の受診票");
    expect(a.sources).toBeUndefined();
    expect(calls).toHaveLength(0);
  });

  it("生まれた後に引っ越した: 医療証と予防接種。14日を過ぎていたら、済んだか確かめる言い方", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const { a } = await adviceOn({ ...DEMO_FAMILY, id: "demo-rule-moved-born", movedOn: "2027-06-01" }, "2027-06-20");
    expect(a.title).toBe("さいたま市へ: 転入の届けと医療証・予防接種");
    fair(a);
    expect(a.plan[0]).toBe("転入の届けが済んだか確かめる（引っ越した日から14日以内）");
    expect(a.plan.some((p) => p.includes("医療証") && p.includes("予診票"))).toBe(true);
    expect(a.plan.some((p) => p.includes("受診票"))).toBe(false);
    expect(calls).toHaveLength(0);
  });

  it("形の読めない事からは作らない（見本の札つきの文のまま）", async () => {
    const { ruleAdvice } = await import("./advisor");
    expect(ruleAdvice(["q"])).toBeNull();
    expect(ruleAdvice([])).toBeNull();
  });
});

describe("下書き: 押したボタンと同じ種類で見本を出す", () => {
  it("下書きの表のどの事でも、見本の下書きの種類は表の種類と同じ", async () => {
    const { DEMO_FAMILY } = await import("./demo-family");
    const { DRAFTABLE } = await import("./draft-kinds");
    const { findMilestone } = await import("./local");
    const { makeDraft } = await import("./drafts");
    const { sendingAs } = await import("./claude");
    const family = { ...DEMO_FAMILY, id: "demo-rule-draft" };
    const ids = Object.keys(DRAFTABLE);
    expect(ids.length).toBeGreaterThan(20);
    for (const id of ids) {
      const v = await sendingAs(demo, () => makeDraft(family, findMilestone(id), "2027-05-01"));
      expect([id, v.draft?.kind]).toEqual([id, DRAFTABLE[id]]);
      expect(v.draft?.title).toContain("見本");
    }
    // 職場あての事は、宛名が会社と上司の空欄（「いつもの」で埋まる）
    const work = await sendingAs(demo, () => makeDraft(family, findMilestone("tell-work"), "2027-05-01"));
    expect(work.draft?.to).toContain("【上司の名前】");
    expect(calls).toHaveLength(0);
  });
});

describe("撮った紙: 見本の返事は事実どおり", () => {
  it("写真は読まず、残してもいない事を言う（「写真は残しました」と言わない）", async () => {
    const { structured } = await import("./claude");
    const { PageSchema } = await import("./capture");
    const r = await structured(PageSchema, "s", "写真", { who: demo, task: "capture-page" });
    expect(r.reply).toContain("写真は読まず、残してもいません");
    expect(r.reply).not.toContain("写真は残しました");
    expect(r.reply).toContain("鍵を入れると");
    expect(calls).toHaveLength(0);
  });

  it("撮った写真を読む頼みも、写真は読まず、記録を作らない（「（文字なし）」をメモにしない）", async () => {
    const { structured } = await import("./claude");
    const { CaptureSchema } = await import("./capture");
    const parts = [
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: "AAAA" } },
      { type: "text", text: "今日: 2027-04-27\n\n撮った写真:\n（文字なし）" },
    ];
    const r = await structured(CaptureSchema, "s", parts as never, { who: demo, task: "capture" });
    expect(r.records).toHaveLength(0);
    expect(r.reply).toContain("写真は読まず、残してもいません");
    expect(r.reply).toContain("鍵を入れると");
    expect(calls).toHaveLength(0);
  });
});
