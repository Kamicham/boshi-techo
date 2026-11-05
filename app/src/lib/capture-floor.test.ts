// 話す・撮るの急ぎの床（2026-11-05 監査 llm-2）: 聞くと同じく、急ぎかどうかを Claude の urgent だけに任せない。
// - Claude が urgent:false を返しても「出血が少し」は急ぎ（次の健診の聞く事に並べず、返事の頭に聞くと同じ急ぎの1文）
// - 普段の言葉（少し眠い・足がつる・歯ぐきの出血・打ち消し・もしも）は急ぎにしない。当てるのは記録ごと。撮った案内の紙・ふり返りには当てない
// - 鍵の無い見本の答えも同じ表（ask/bridge.ts の sureUrgent）
// Claude には一度もつながない（SDK は偽物。鍵の値は claude() の確かめを通すだけの偽物）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

/** 偽の Claude が返す、話す・撮るの答え（structured → parse の parsed_output） */
let answer: unknown = null;
const calls: unknown[] = [];
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        parse: async (p: { model?: string }) => {
          calls.push(p);
          return { model: p.model, usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: "end_turn", parsed_output: answer };
        },
        create: async () => {
          throw new Error("話す・撮るでは使わない");
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-capture-floor-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_PUBLIC;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_SIM_BUDGET_USD;
delete process.env.BOSHI_SIM_HOUSEHOLD_USD;
delete process.env.BOSHI_DAILY_USD;
delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;
afterAll(() => {
  delete process.env.ANTHROPIC_API_KEY;
  fs.rmSync(dir, { recursive: true, force: true });
});

const sim = { householdId: "sim-floor-test", kind: "sim" as const, accountId: null, subjectIds: [], legacy: true };
const demo = { householdId: "demo-floor-test", kind: "demo" as const, accountId: null, subjectIds: [], legacy: true };
/** 妊娠中の日・生まれた後の日（見本の家族: 予定日 2027-05-10・生まれた日 2027-04-26） */
const PREG = "2027-02-20";
const BORN = "2027-06-10";

type Rec = { date: string; kind: "気がかり" | "できごと" | "予定" | "書類" | "メモ"; title: string; detail: string; urgent: boolean; who: string | null };
const rec = (o: Partial<Rec>): Rec => ({ date: PREG, kind: "気がかり", title: "", detail: "", urgent: false, who: null, ...o });
function claudeSays(records: Rec[], reply = "手帳に書いておきました。") {
  answer = { gist: "", records, deadlines: [], techo: [], oneQuestion: null, reply };
}

let n = 0;
async function family() {
  const { DEMO_FAMILY } = await import("./demo-family");
  return { ...DEMO_FAMILY, id: `floor-${++n}` };
}
async function say(today: string, text: string | undefined, opts: { source?: "voice" | "text" | "photo"; who?: typeof sim | typeof demo } = {}) {
  const { sendingAs } = await import("./claude");
  const { capture } = await import("./capture");
  const f = await family();
  const r = await sendingAs(opts.who ?? sim, () => capture({ family: f, today, source: opts.source ?? "voice", text }));
  return { f, r };
}

beforeEach(() => {
  calls.length = 0;
  answer = null;
  // SDK は偽物（どこにも送らない）。claude() の「鍵が無い」の確かめを通すだけの値
  process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
});

describe("Claude が急ぎと見なくても、床が急ぎにする", () => {
  it("「出血が少し」: 急ぎの印・健診の聞く事に並べない・返事の頭に産院への電話（聞くと同じ1文）", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const { urgentLead } = await import("./ask/bridge");
    claudeSays([rec({ title: "出血が少し", detail: "出血が少しある。次の健診で聞く" })]);
    const { f, r } = await say(PREG, "出血が少し");
    expect(calls).toHaveLength(1);
    expect(r.records[0].data.urgent).toBe(true);
    // 「次の健診で聞く」は外す（記録の下には急ぎの時の電話先の決まった文が出る）
    expect(r.records[0].data.detail).toBe("出血が少しある。");
    expect(getPlan(f.id).concerns).toHaveLength(0);
    expect(r.reply).toBe(`${urgentLead("pregnant")}手帳に書いておきました。`);
    expect(r.reply).toContain("かかりつけの産院へ電話");
    expect(r.reply).toContain("命が危ないと思ったら、迷わず119");
    expect(r.reply).not.toContain("先生に聞く事");
  });

  it("Claude が言い換えて記録から言葉が消えても、家族の言葉で急ぎにする", async () => {
    claudeSays([rec({ title: "おりものに少し色", detail: "少し色のついたおりもの。次の健診で聞く" })]);
    const { r } = await say(PREG, "出血が少し");
    expect(r.records[0].data.urgent).toBe(true);
  });

  it("生まれた後の子の事: 子ども向けの頭（#8000・119）", async () => {
    const { urgentLead } = await import("./ask/bridge");
    claudeSays([rec({ date: BORN, title: "けいれん", detail: "赤ちゃんがけいれんしている。次の健診で聞く", who: "ひなた" })]);
    const { r } = await say(BORN, "赤ちゃんがけいれんしている");
    expect(r.records[0].data.urgent).toBe(true);
    expect(r.reply.startsWith(urgentLead("child"))).toBe(true);
    expect(r.reply).toContain("#8000");
  });

  it("記録ごとに当てる: 出血の記録だけ急ぎ。同じ入力の眠れない（気がかり）・見学（予定）は急ぎにせず、眠れないは聞く事へ", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    claudeSays([
      rec({ title: "少し出血", detail: "少し出血があった。次の健診で聞く" }),
      rec({ title: "眠れない", detail: "最近よく眠れない。次の健診で聞く" }),
      rec({ kind: "予定", date: "2027-02-23", title: "保育園の見学", detail: "来週の火曜" }),
    ]);
    const { f, r } = await say(PREG, "少し出血があった。あと最近よく眠れない。来週の火曜に保育園の見学");
    expect(r.records.map((x) => !!x.data.urgent)).toEqual([true, false, false]);
    expect(getPlan(f.id).concerns.map((c) => c.text)).toEqual(["眠れない"]);
    expect(r.reply).toContain("先生に聞く事");
  });
});

describe("普段の言葉・急ぎでない形では、急ぎにしない", () => {
  it.each([
    "少し眠い",
    "夜に足がつって目が覚める",
    "歯みがきの時に歯ぐきから血が出る",
    "鼻から血が出た",
    "健診で出血はないと言われた",
    "破水したらすぐ電話するように言われた",
    "まぶたがけいれんする",
    "お腹が張る",
  ])("%s", async (t) => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    claudeSays([rec({ title: t.slice(0, 20), detail: `${t}。次の健診で聞く` })]);
    const { f, r } = await say(PREG, t);
    expect(r.records[0].data.urgent).toBeFalsy();
    expect(r.records[0].data.detail).toBe(`${t}。次の健診で聞く`);
    expect(getPlan(f.id).concerns).toHaveLength(1);
    expect(r.reply).not.toContain("今すぐ");
  });

  it("撮った案内の紙（書類）の注意書きには当てない", async () => {
    claudeSays([rec({ kind: "書類", title: "産院の案内", detail: "出血・破水の時はすぐ電話。夜間の番号あり" })], "案内の紙を記録しました。");
    const { r } = await say(PREG, undefined, { source: "photo" });
    expect(r.records[0].data.urgent).toBeFalsy();
    expect(r.reply).toBe("案内の紙を記録しました。");
  });

  it("できごと（お産の思い出など）には当てない", async () => {
    claudeSays([rec({ kind: "できごと", date: "2027-04-26", title: "ひなたが生まれた", detail: "夜中に破水から始まって、朝に生まれた" })], "おめでとうございます。手帳に残しました。");
    const { r } = await say("2027-04-27", "夜中に破水から始まって、朝に生まれた");
    expect(r.records[0].data.urgent).toBeFalsy();
    expect(r.reply).toBe("おめでとうございます。手帳に残しました。");
  });

  it("2日より前の事（ふり返り）には当てない", async () => {
    claudeSays([rec({ date: "2027-03-01", title: "妊娠中の出血", detail: "妊娠中に出血したことがあった" })]);
    const { r } = await say(BORN, "妊娠中に出血したことがあった");
    expect(r.records[0].data.urgent).toBeFalsy();
    expect(r.reply).not.toContain("今すぐ");
  });

  it("Claude がもう急ぎにした時は、返事を変えない（急ぎの1文を二重に言わない）", async () => {
    claudeSays([rec({ title: "出血", detail: "出血がある。その日のうちに産院へ電話", urgent: true })], "かかりつけの産院へ電話してください（夜間も）。");
    const { r } = await say(PREG, "出血がある");
    expect(r.records[0].data.urgent).toBe(true);
    expect(r.records[0].data.detail).toBe("出血がある。その日のうちに産院へ電話");
    expect(r.reply).toBe("かかりつけの産院へ電話してください（夜間も）。");
  });
});

describe("鍵の無い見本の答えも同じ表", () => {
  it("「出血が少し」は急ぎ、「出血はなかった」「少し眠い」は急ぎでない（Claude は呼ばない）", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const a = await say(PREG, "出血が少し", { who: demo });
    const b = await say(PREG, "健診で出血はなかった", { who: demo });
    const c = await say(PREG, "少し眠い", { who: demo });
    expect(calls).toHaveLength(0);
    expect(a.r.records[0].data.urgent).toBe(true);
    expect(b.r.records[0].data.urgent).toBeFalsy();
    expect(c.r.records[0].data.urgent).toBeFalsy();
  });
});
