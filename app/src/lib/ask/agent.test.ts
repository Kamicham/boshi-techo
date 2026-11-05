// 手帳に聞くのループと thinking 塊（2026-11-05 監査 llm-5）。
// Sonnet 5.5 は、道具を呼ぶ手に書いた1〜2文より長い文を、進み具合の thinking 塊で返す（既定の omitted では中身が空）。
// text の塊だけを拾うと、動きの道具と同じ手に書いた本文（連絡先を含む）が消え、道具の後の短い一言だけが返事になる（第31回と同じ形）。
// 見る事: display "updates" と beta を付けて呼ぶ／空の thinking 塊の後でも本文が消えない（1回だけ頼み直す）／
// 空でない thinking 塊の文は本文に残る／中断の決まった文は残らない／頼み直しは1回まで・要らない時はしない。
// Claude には一度もつながない（SDK は偽物。鍵の値は claude() の確かめを通すだけの偽物）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

type Block = Record<string, unknown>;
type Reply = { stop_reason: string; content: Block[] };
/** 偽の Claude が順に返す手（尽きたら落とす＝頼み直しが多すぎると試験が落ちる） */
const script: Reply[] = [];
/** 偽の Claude に渡った頼み（呼んだ時の形の写し。ループは同じ messages の配列に足していくので、その時点で写す） */
const sent: Record<string, unknown>[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        // 見張り（structured → parse）は「問題なし」
        parse: async (params: Record<string, unknown>) => ({
          model: params.model,
          usage: { input_tokens: 1, output_tokens: 1 },
          stop_reason: "end_turn",
          parsed_output: { ok: true, problems: [] },
        }),
        create: async (params: Record<string, unknown>) => {
          sent.push(JSON.parse(JSON.stringify(params)) as Record<string, unknown>);
          const next = script.shift();
          if (!next) throw new Error("偽の Claude の台本が尽きました（頼み直しが多すぎる）");
          return { model: params.model, usage: { input_tokens: 10, output_tokens: 10 }, ...next };
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-ask-agent-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_PUBLIC;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_SIM_BUDGET_USD;
delete process.env.BOSHI_DAILY_USD;
delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;
afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  fs.rmSync(dir, { recursive: true, force: true });
});

const INTERRUPTED = "This part of the response was interrupted before it finished.";
const BETA = "thinking-display-updates-2026-08-18";
/** 体の問い（急ぎの言葉は無い＝床の頭の1文は付かない）。妊娠中の日 */
const Q = "夜に足がつるのが気になります";
const TODAY = "2027-02-20";
const tool = (id: string, name = "add_checkup_question") => ({ type: "tool_use", id, name, input: { text: "夜に足がつる" } });
const think = (thinking: string, signature = "sig") => ({ type: "thinking", thinking, signature });
const text = (t: string) => ({ type: "text", text: t });
const msgs = (i: number) => sent[i].messages as { role: string; content: unknown }[];

beforeEach(() => {
  script.length = 0;
  sent.length = 0;
  // SDK は偽物（どこにも送らない）。claude() の「鍵が無い」の確かめを通すだけの値
  process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
});

async function askNow() {
  const { DEMO_FAMILY } = await import("../demo-family");
  const { ask } = await import("./agent");
  return ask({ family: DEMO_FAMILY, today: TODAY, text: Q, history: [] });
}

describe("本文の候補（saidOf）", () => {
  it("text と中身のある thinking 塊を並びのまま。空の thinking・中断の決まった文は入れない。続く text はつなぐ", async () => {
    const { saidOf } = await import("./agent");
    const res = { content: [text("前半"), text("後半。"), think(""), think("進み具合の文。"), tool("t1"), text("最後。"), think(INTERRUPTED)] };
    expect(saidOf(res as never)).toBe("前半後半。\n進み具合の文。\n最後。");
    expect(saidOf({ content: [think(""), think(INTERRUPTED)] } as never)).toBe("");
  });
});

describe("道具を呼ぶ手の文が thinking 塊で返る時（Sonnet 5.5）", () => {
  it("呼ぶ時に display: updates と beta を付ける。thinking 塊は手を加えずに会話へ返す", async () => {
    const long = "夜に足がつるのは、眠りが途切れてつらいですね。次の健診で先生に聞けるよう、聞く事に足すボタンを出しました。押すと健診で聞く事に並びます。急に強く痛む時は、かかりつけの産院へ電話してください（夜間も）。";
    script.push({ stop_reason: "tool_use", content: [think("", "sig-a"), tool("t1")] }, { stop_reason: "end_turn", content: [text(long)] });
    const r = await askNow();
    expect(r.turn.text).toBe(long);
    expect(sent).toHaveLength(2);
    for (const s of sent) {
      expect(s.thinking).toEqual({ type: "adaptive", display: "updates" });
      expect(s.betas).toEqual([BETA]);
    }
    // 2回目の頼みに、1回目の手（空の thinking 塊・署名つき）がそのまま入っている
    expect(msgs(1).at(-2)).toEqual({ role: "assistant", content: [think("", "sig-a"), tool("t1")] });
  });

  it("［空の thinking 塊＋道具］→［短い一言］: 1回だけ頼み直し、本文（連絡先）が消えない", async () => {
    const body =
      "夜に足がつるのは、眠りが途切れてつらいですね。日付つきで残し、次の健診で先生に聞けるよう、聞く事に足すボタンを出しました。押すと健診で聞く事に並びます。急に強く痛む時や気になる時は、かかりつけの産院へ電話してください（夜間も）。";
    expect(body.length).toBeGreaterThanOrEqual(80);
    script.push(
      { stop_reason: "tool_use", content: [think(""), tool("t1")] },
      { stop_reason: "end_turn", content: [think(""), text("ボタンはまだ押されていません。")] },
      { stop_reason: "end_turn", content: [text(body)] },
    );
    const r = await askNow();
    expect(r.turn.text).toBe(body);
    expect(r.turn.text).toContain("かかりつけの産院");
    expect(r.turn.actions?.some((a) => a.type === "concern")).toBe(true);
    expect(sent).toHaveLength(3);
    // 頼み直しは、短い一言の手をそのまま返し、その後に「まとめて本文を」
    expect(msgs(2).at(-2)).toEqual({ role: "assistant", content: [think(""), text("ボタンはまだ押されていません。")] });
    expect(msgs(2).at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("ここまでをまとめて、家族への返事の本文を書いてください") });
  });

  it("［中身のある thinking 塊＋道具］→［短い一言］: その文は本文に残る（頼み直しても短い時も、消さない）", async () => {
    const note = "足がつるのは、つらいですね。次の健診で先生に聞けるようにします。急に強く痛む時は、かかりつけの産院へ電話を（夜間も）。";
    script.push(
      { stop_reason: "tool_use", content: [think(""), think(note), tool("t1")] },
      { stop_reason: "end_turn", content: [text("ボタンはまだ押されていません。")] },
      { stop_reason: "end_turn", content: [text("押すと、健診で聞く事に並びます。")] },
    );
    const r = await askNow();
    expect(r.turn.text).toContain(note);
    expect(r.turn.text).toContain("押すと、健診で聞く事に並びます。");
    expect(sent).toHaveLength(3);
  });

  it("中断の決まった文は本文に残らない。止まった手に残った道具の呼び出しには、動かしていない事を返してから頼み直す", async () => {
    script.push(
      { stop_reason: "tool_use", content: [think(""), tool("t1")] },
      { stop_reason: "max_tokens", content: [text("健診で聞く事に足すボタンを出しました。"), tool("t2", "add_record"), think(INTERRUPTED)] },
      { stop_reason: "max_tokens", content: [think(INTERRUPTED)] },
    );
    const r = await askNow();
    expect(r.turn.text).toBe("健診で聞く事に足すボタンを出しました。");
    expect(r.turn.text).not.toMatch(/interrupted/i);
    // 止まった手の道具（t2）は動かしていない
    expect(r.tools).toEqual(["add_checkup_question"]);
    expect(sent).toHaveLength(3);
    expect(msgs(2).at(-1)).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t2", content: "途中で止まったので、この道具は動かしていません", is_error: true },
        { type: "text", text: expect.stringContaining("ここまでをまとめて") },
      ],
    });
  });

  it("頼み直しで前の一言を言い直して足した時は、前の一言を二重にしない", async () => {
    const first = "押すと、健診で聞く事に並びます。";
    const again = `${first}急に強く痛む時は、かかりつけの産院へ電話を（夜間も）。`;
    script.push({ stop_reason: "tool_use", content: [think(""), tool("t1")] }, { stop_reason: "end_turn", content: [text(first)] }, { stop_reason: "end_turn", content: [text(again)] });
    const r = await askNow();
    expect(again.length).toBeLessThan(80);
    expect(r.turn.text).toBe(again);
  });

  it("道具の手に thinking 塊が無ければ、短い一言でも頼み直さない（要らない呼び出しをしない）", async () => {
    script.push({ stop_reason: "tool_use", content: [tool("t1")] }, { stop_reason: "end_turn", content: [text("押すと、健診で聞く事に並びます。")] });
    const r = await askNow();
    expect(r.turn.text).toBe("押すと、健診で聞く事に並びます。");
    expect(sent).toHaveLength(2);
  });

  it("文が無いまま終わった時の頼み直しも、今までどおり1回だけ", async () => {
    const body = "夜に足がつるのはつらいですね。次の健診で先生に聞けるよう、聞く事に足すボタンを出しました。押すと健診で聞く事に並びます。急に強く痛む時は、かかりつけの産院へ電話してください（夜間も）。";
    script.push({ stop_reason: "tool_use", content: [tool("t1")] }, { stop_reason: "end_turn", content: [think("")] }, { stop_reason: "end_turn", content: [text(body)] });
    const r = await askNow();
    expect(r.turn.text).toBe(body);
    expect(sent).toHaveLength(3);
    expect(msgs(2).at(-1)).toMatchObject({ role: "user", content: expect.stringContaining("返事の文がまだありません") });
  });
});

describe("会話の決まり", () => {
  it("家族への返事の文は、道具を使い終えた最後の一手にまとめて書く", async () => {
    const { ASK_RULES } = await import("./agent");
    expect(ASK_RULES).toContain("家族への返事の文は、道具を使い終えた最後の一手にまとめて書く。道具を呼ぶ手では返事を書かない");
  });
});
