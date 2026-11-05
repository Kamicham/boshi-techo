// 手帳に聞くの道具（Claude を呼ばない所）: 予定の見方が今日の画面と同じか、動きの道具が何も書き込まず、変な行き先や id を通さないか。
// DB は一時フォルダに作る（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-ask-test-"));
process.env.BOSHI_DATA_DIR = dir;

const { DEMO_FAMILY } = await import("../demo-family");
const { planSnapshot, notebookSnapshot, runTool, pickSources } = await import("./tools");
const { fixButtonNames, getChat, saveChat, setPending, getPending, markActionUsed } = await import("./agent");
const { list } = await import("../db");
type Ctx = Parameters<typeof runTool>[2];

afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const ctx = (today: string): Ctx => ({ family: DEMO_FAMILY, today, actions: [], sources: [], onStatus: () => {} });

describe("予定を見る", () => {
  it("生まれた翌日のデモの家族: 出生届が今やる事に入り、期限が出る", () => {
    const s = planSnapshot(DEMO_FAMILY, "2027-04-27");
    const birth = s.今やる事.find((r) => r.id === "birth-registration");
    expect(birth).toBeTruthy();
    expect(JSON.stringify(birth)).toMatch(/期限/);
    // デモは通り過ぎた期限を済みにする（今日の画面と同じ）
    expect(s.今やる事.every((r) => r.状態 !== "期限切れ")).toBe(true);
  });

  it("手帳を見る: 作った家族の記録が今日までだけ入る", () => {
    const n = notebookSnapshot(DEMO_FAMILY, "2027-04-27");
    expect(n.次の健診の予約).toBeTruthy();
    expect(JSON.stringify(n.手帳のページ)).not.toMatch(/2027-0[5-9]/);
  });
});

describe("動きの道具", () => {
  it("書き込まず、ボタンを積むだけ", async () => {
    const c = ctx("2027-04-27");
    await runTool("add_checkup_question", { text: "便の色が白っぽく見えた日がある" }, c);
    await runTool("add_record", { text: "今日、初めて笑った" }, c);
    await runTool("propose_done", { milestoneId: "birth-registration" }, c);
    await runTool("offer_paperwork", { milestoneId: "birth-registration" }, c);
    await runTool("write_message", { to: "翔太さん", via: "line", body: "見学は【日にち】でどう？" }, c);
    await runTool("open_screen", { href: "/techo#page-stool", label: "便色カード" }, c);
    expect(c.actions.map((a) => a.type)).toEqual(["concern", "record", "done", "milestone", "message", "open"]);
    expect(list(DEMO_FAMILY.id, "record")).toHaveLength(0);
    expect(list(DEMO_FAMILY.id, "done")).toHaveLength(0);
  });

  it("地図に無い行き先・予定に無い id は通さない", async () => {
    const c = ctx("2027-04-27");
    expect(await runTool("open_screen", { href: "https://example.com", label: "外" }, c)).toMatch(/地図にありません/);
    expect(await runTool("propose_done", { milestoneId: "no-such" }, c)).toMatch(/ありません/);
    expect(await runTool("offer_paperwork", { milestoneId: 3 }, c)).toMatch(/ありません/);
    expect(c.actions).toEqual([]);
  });

  it("メールの件名は mail の時だけ", async () => {
    const c = ctx("2027-04-27");
    await runTool("write_message", { to: "妻", via: "line", subject: "件名", body: "本文" }, c);
    expect(c.actions[0]).not.toHaveProperty("subject");
  });
});

describe("第29回の直し", () => {
  it("年の違う日には年が付き、担当は呼び名つき・まだ先の事にもあと◯日", () => {
    const s = planSnapshot(DEMO_FAMILY, "2027-04-27");
    // 年をまたぐ日（秋に見ると、まだ先の事に翌年の日が入る）
    expect(JSON.stringify(planSnapshot(DEMO_FAMILY, "2027-11-15"))).toMatch(/2028年/);
    // 出生届は誰が行くかを家族で選ぶ（担当は「家族」）。パートナーの事は呼び名つき
    expect(s.今やる事.find((r) => r.id === "birth-registration")?.担当).toBe("家族");
    expect(s.今やる事.find((r) => r.id === "partner-tell-work-birth")?.担当).toBe("パートナー（翔太）");
    expect(s.まだ先の事.some((r) => /あと\d+日/.test(r.始まり))).toBe(true);
  });

  it("調べたページはこの町と国の物だけ。題が無ければ所の名前", () => {
    const f = { ...DEMO_FAMILY, city: "松本市" };
    const out = pickSources(f, [
      { title: "名古屋市 保育所の入所", url: "https://www.city.nagoya.jp/a" },
      { title: "松本市 出生届", url: "https://www.city.matsumoto.nagano.jp/b" },
      { title: "", url: "https://www.cfa.go.jp/c" },
    ]);
    expect(out.map((s) => s.url)).toEqual(["https://www.city.matsumoto.nagano.jp/b", "https://www.cfa.go.jp/c"]);
    expect(out[1].title).toBe("www.cfa.go.jp");
  });

  it("文に書いたボタンの名前が無ければ言い換える", () => {
    const acts = [{ type: "open" as const, href: "/visit", label: "健診のタブへ" }];
    expect(fixButtonNames("「記入メモを作る」を押すと、書き方が出ます。", acts)).toBe("ボタンを押すと、書き方が出ます。");
    expect(fixButtonNames("「健診のタブへ」を押すと開きます。", acts)).toBe("「健診のタブへ」を押すと開きます。");
  });

  it("作っている途中の問いを残し、押した動きに印を付ける", () => {
    const id = "ask-test-family";
    const q = { role: "user" as const, text: "出生届は？", today: "2027-04-27", at: new Date().toISOString() };
    setPending(id, q);
    expect(getPending(id)?.text).toBe("出生届は？");
    const a = { role: "assistant" as const, text: "答え", today: "2027-04-27", at: "2027-04-27T00:00:00.000Z", actions: [{ type: "record" as const, text: "笑った" }] };
    saveChat(id, [q, a]);
    expect(getPending(id)).toBeNull();
    expect(markActionUsed(id, a.at, 0)).toBe(true);
    expect(getChat(id)[1].used).toEqual([0]);
  });
});

describe("第30回の直し", () => {
  it("押した印は付けたり外したりでき、作っている途中の問いを消さない", () => {
    const id = "ask-test-family-2";
    const a = { role: "assistant" as const, text: "答え", today: "2027-04-27", at: "2027-04-27T01:00:00.000Z", actions: [{ type: "record" as const, text: "笑った" }] };
    saveChat(id, [a]);
    setPending(id, { role: "user", text: "次の問い", today: "2027-04-27", at: new Date().toISOString() });
    expect(markActionUsed(id, a.at, 0, true)).toBe(true);
    expect(getPending(id)?.text).toBe("次の問い");
    markActionUsed(id, a.at, 0, false);
    expect(getChat(id)[0].used).toEqual([]);
  });

  it("ボタンが1つしか無いのに「もう一つは」と書いた文は消す", () => {
    const one = [{ type: "milestone" as const, milestoneId: "x", label: "日本脳炎" }];
    expect(fixButtonNames("押すと窓口が出ます。もう一つは、押すと記録が開きます。", one)).toBe("押すと窓口が出ます。");
    const two = [...one, { type: "open" as const, href: "/techo", label: "手帳へ" }];
    expect(fixButtonNames("押すと窓口が出ます。もう一つは、押すと記録が開きます。", two)).toMatch(/もう一つ/);
  });

  it("子の気がかりは子の健診へ（ママの健診の聞く事に入らない）", async () => {
    const c = ctx("2027-05-10");
    await runTool("add_checkup_question", { text: "首がまだすわらない", for: "child" }, c);
    expect(c.actions[0]).toMatchObject({ type: "concern", for: "child" });
    const { nextAgenda } = await import("../visit");
    const r = nextAgenda([], { concerns: [{ id: "1", text: "子の事", date: "2027-05-10", for: "child" }, { id: "2", text: "ママの事", date: "2027-05-10" }] });
    expect(r.items.map((i) => i.text)).toEqual(["ママの事"]);
  });

  it("妊娠中はママの健診へ", async () => {
    const c = ctx("2027-01-20");
    await runTool("add_checkup_question", { text: "張りが気になる", for: "child" }, c);
    expect(c.actions[0]).toMatchObject({ type: "concern", for: "mother" });
  });
});

describe("手帳に聞くの次の健診（録音から聞こえた日）", () => {
  it("まだ家族が確かめていない日は、そう添える。確かめた後は添えない", async () => {
    const { createVisit, getPlan, savePlan } = await import("@/app/api/visit/_lib/server");
    const { patch } = await import("../db");
    const fam = { ...DEMO_FAMILY, id: `try-${"7".padStart(32, "0")}` };
    const v = createVisit(fam.id, "2027-10-20");
    patch(v.id, { status: "done", nextDate: "2027-11-17" });
    savePlan(fam.id, { ...getPlan(fam.id), next: { date: "2027-11-17", time: "10:30", source: "visit", visitId: v.id } });
    expect(notebookSnapshot(fam, "2027-10-21").次の健診の予約).toBe("2027-11-17 10:30（録音から聞こえた日。まだ家族が確かめていない）");
    patch(v.id, { nextCheck: { state: "ok", date: "2027-11-17", time: "10:30", at: "2027-10-20T03:00:00.000Z" } });
    expect(notebookSnapshot(fam, "2027-10-21").次の健診の予約).toBe("2027-11-17 10:30");
  });
});
