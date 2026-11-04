// API の守りの試験（2026-11-04、上限の無い1本の鍵で API の残高が尽きた後に入れた）:
// - サーバ全体の1日の上限（BOSHI_DAILY_USD）で止まる
// - ふだんの仕事は Sonnet、呼び直し（fallbacks）は Opus の仕事だけ・調べ物には付けない
// - 鍵が無い時、見本の家族は「見本の答え」を返し（どれも答えの形に合う）、本物の世帯・シミュレーションは 503
// Claude には一度もつながない（SDK は偽物）。DB は一時フォルダに作る（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("server-only", () => ({}));

const calls: { kind: "parse" | "create"; params: Record<string, unknown> }[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        parse: async (params: Record<string, unknown>) => {
          calls.push({ kind: "parse", params });
          return { model: params.model, usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn", parsed_output: { ok: true } };
        },
        create: async (params: Record<string, unknown>) => {
          calls.push({ kind: "create", params });
          return { model: params.model, usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn", content: [{ type: "text", text: "調べた" }] };
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-claude-guard-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_SIM_BUDGET_USD;
delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;
delete process.env.BOSHI_DAILY_USD;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const demo = { householdId: "demo-test", kind: "demo" as const, accountId: null, subjectIds: [], legacy: true };
const sim = { householdId: "sim-test", kind: "sim" as const, accountId: null, subjectIds: [], legacy: true };
const Ok = z.object({ ok: z.boolean() });

beforeEach(() => {
  calls.length = 0;
  process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
});

describe("サーバ全体の1日の上限", () => {
  it("今日の合計が BOSHI_DAILY_USD を超えたら、Claude を呼ばずに 429", async () => {
    const { structured } = await import("./claude");
    const { recordSpend } = await import("./spend");
    await structured(Ok, "s", "q", { who: sim });
    expect(calls).toHaveLength(1);
    process.env.BOSHI_DAILY_USD = "0.5";
    recordSpend("structured", "claude-opus-5-5", { input_tokens: 200_000 }); // $0.8
    // 家族に見せる文に額（ドル）は書かない（UX 2026-11-05）
    await expect(structured(Ok, "s", "q", { who: sim })).rejects.toMatchObject({ status: 429, message: expect.not.stringContaining("$") });
    expect(calls).toHaveLength(1);
    delete process.env.BOSHI_DAILY_USD;
  });
});

describe("モデルと呼び直し", () => {
  it("Opus の仕事だけに fallbacks を付け、ふだんの仕事（Sonnet）と調べ物には付けない", async () => {
    const { structured, research, MODEL, EVERYDAY_MODEL, RESEARCH_MODEL } = await import("./claude");
    expect(EVERYDAY_MODEL).toMatch(/sonnet/);
    await structured(Ok, "s", "q", { who: sim });
    await structured(Ok, "s", "q", { who: sim, model: EVERYDAY_MODEL });
    await research("s", "q", { who: sim });
    const [deep, everyday, search] = calls.map((c) => c.params);
    expect(deep.model).toBe(MODEL);
    expect(deep.fallbacks).toBe("default");
    expect(everyday.model).toBe(EVERYDAY_MODEL);
    expect(everyday.fallbacks).toBeUndefined();
    expect(search.model).toBe(RESEARCH_MODEL);
    expect(search.fallbacks).toBeUndefined();
    expect(search.betas).toBeUndefined();
  });
});

describe("鍵が無くても動く床", () => {
  beforeEach(() => {
    delete process.env.ANTHROPIC_API_KEY;
  });

  it("見本の家族は、仕事ごとの見本の答えを返す（どれも答えの形に合い、「見本」と分かる）", async () => {
    const { structured, sampleMode } = await import("./claude");
    const { AdviceSchema, LookSchema } = await import("./advisor");
    const { BookSchema } = await import("./book");
    const { DraftSchema } = await import("./drafts");
    const { CaptureSchema, PageSchema } = await import("./capture");
    expect(sampleMode(demo)).toBe(true);
    const cap = await structured(CaptureSchema, "s", "今日: 2026-11-04（水）\n\n書いた事:\n健診で次は2週間後と言われた", { who: demo, task: "capture" });
    expect(cap.records[0]).toMatchObject({ date: "2026-11-04", kind: "メモ", urgent: false });
    expect(cap.records[0].detail).toContain("2週間後");
    expect(cap.reply).toContain("見本");
    const urgent = await structured(CaptureSchema, "s", "今日: 2026-11-04（水）\n\n書いた事:\n少し出血があった", { who: demo, task: "capture" });
    expect(urgent.records[0].urgent).toBe(true);
    expect((await structured(PageSchema, "s", "写真", { who: demo, task: "capture-page" })).page).toBe("unknown");
    expect((await structured(DraftSchema, "s", "事: 出生届（届出）\n根拠: 戸籍法", { who: demo, task: "draft" })).title).toContain("出生届");
    expect((await structured(AdviceSchema, "s", "q", { who: demo, task: "advice" })).title).toContain("見本");
    expect((await structured(LookSchema, "s", "q", { who: demo, task: "look" })).found).toBe(false);
    expect((await structured(BookSchema, "s", "q", { who: demo, task: "book" })).dedication).toContain("見本");
    expect(calls).toHaveLength(0);
  });

  it("見本の家族が同じ日に同じ文を送り直しても、見本の記録は増えない（置き換える）。違う文は足す", async () => {
    const { sendingAs } = await import("./claude");
    const { capture, listRecords } = await import("./capture");
    const { DEMO_FAMILY } = await import("./demo-family");
    const family = { ...DEMO_FAMILY, id: "demo-sample-once" };
    const send = (text: string) => sendingAs(demo, () => capture({ family, today: "2026-11-04", source: "text", text }));
    await send("健診で次は2週間後と言われた");
    await send("健診で次は2週間後と言われた");
    expect(listRecords(family.id).filter((r) => r.data.title.startsWith("健診で次は"))).toHaveLength(1);
    await send("区役所で受診票をもらった");
    expect(listRecords(family.id)).toHaveLength(2);
    expect(calls).toHaveLength(0);
  });

  it("見本の無い仕事・調べ物・本物とシミュレーションの世帯は、鍵がありませんの 503", async () => {
    const { structured, research, sampleMode } = await import("./claude");
    expect(sampleMode(sim)).toBe(false);
    await expect(structured(Ok, "s", "q", { who: demo, task: "nothing" })).rejects.toMatchObject({ status: 503 });
    await expect(research("s", "q", { who: demo })).rejects.toMatchObject({ status: 503 });
    await expect(structured(Ok, "s", "q", { who: sim, task: "capture" })).rejects.toMatchObject({ status: 503 });
    expect(calls).toHaveLength(0);
  });
});
