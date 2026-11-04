// 話した・打った気がかりを、次の健診の「先生に聞く事」へ（2026-11-04 夜・見直し C03 の記録の側）。
// - 記録はそのまま1つ。「先生に聞く事」には記録の id で1行だけ（二重に持たない・作り直したら前の行を外す）
// - 急ぎの記録は入れない（その日のうちに電話する物）。上の子の事・妊娠中の事を生まれた後に話した物も並べない
// - 妊娠中はママの健診。生まれた後は、子の呼び名なら子、分からなければ印なし（健診の画面の決まりで子の欄）。打つ時は家族が選ぶ
// Claude には一度もつながない（鍵の無い見本の家族＝公開版の写しの id で回す）。DB は一時フォルダ。
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

// 手帳に聞くの「健診で聞く事に足す」（/api/ask/act）を、ログインの関所なしで見本の家族の写しとして通す（関所の試験は api-household.test.ts）
vi.mock("@/app/api/_lib/household", async (orig) => {
  const real = await orig<typeof import("@/app/api/_lib/household")>();
  return {
    ...real,
    familyFor: async (_req: Request, familyId: unknown) => {
      const { getFamily } = await import("./family");
      const id = String(familyId);
      return { family: getFamily(id), who: { householdId: id, kind: "demo", accountId: null, subjectIds: [], legacy: true }, legacy: true };
    },
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-capture-agenda-test-"));
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

/** 見本の家族の写し（公開版と同じ id の形。健診を作る時も家族として引ける） */
async function family(n: number) {
  const { DEMO_FAMILY } = await import("./demo-family");
  return { ...DEMO_FAMILY, id: `try-${String(n).padStart(32, "0")}` };
}

async function say(f: import("./demo-family").Family, today: string, text: string) {
  const { sendingAs } = await import("./claude");
  const { capture } = await import("./capture");
  return sendingAs(demo, () => capture({ family: f, today, source: "voice", text }));
}

describe("話した気がかり → 次の健診の「先生に聞く事」", () => {
  it("妊娠中: 気がかりはママの健診に1行。返事の最後は決まった文。同じ文を送り直しても1行のまま", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const f = await family(1);
    const r = await say(f, "2027-02-20", "夜に足がつって目が覚める");
    const rec = r.records[0];
    expect(rec.data.kind).toBe("気がかり");
    expect(getPlan(f.id).concerns).toEqual([{ id: rec.id, text: rec.data.title, date: "2027-02-20", for: "mother" }]);
    expect(r.reply.endsWith("次の健診の『先生に聞く事』にも並べました。")).toBe(true);
    // 見本の一言の括弧を句点の後に浮かせない（UX 2026-11-05）
    expect(r.reply).not.toMatch(/。（/);
    expect(r.reply).toContain("いつ・誰の事・期限を読み分けて、ここを Claude が書きます。");
    const again = await say(f, "2027-02-20", "夜に足がつって目が覚める");
    expect(getPlan(f.id).concerns.map((c) => c.id)).toEqual([again.records[0].id]);
    expect(calls).toHaveLength(0);
  });

  it("急ぎに見える記録は並べない（その日のうちに電話する物）。「水も飲めない」も急ぎ", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const f = await family(2);
    const r = await say(f, "2027-02-20", "少し出血があった");
    expect(r.records[0].data).toMatchObject({ kind: "気がかり", urgent: true });
    const w = await say(f, "2027-02-20", "つわりで水も飲めない");
    expect(w.records[0].data.urgent).toBe(true);
    expect(getPlan(f.id).concerns).toHaveLength(0);
    expect(r.reply).not.toContain("先生に聞く事");
    expect(w.reply).not.toContain("先生に聞く事");
  });

  it("気がかりでない事（メモ・できごと）は並べない", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const f = await family(3);
    const r = await say(f, "2027-02-20", "健診で次は2週間後と言われた");
    expect(r.records[0].data.kind).toBe("メモ");
    expect(getPlan(f.id).concerns).toHaveLength(0);
    expect(r.reply).not.toContain("先生に聞く事");
  });

  it("生まれた後: だれの事か分からなければ印を付けず（健診の画面で子の欄）、返事は子の健診の言い方", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const f = await family(4);
    const r = await say(f, "2027-06-10", "夕方になるとよく泣く");
    expect(r.records[0].data.kind).toBe("気がかり");
    const [c] = getPlan(f.id).concerns;
    expect(c).toMatchObject({ id: r.records[0].id, date: "2027-06-10" });
    expect(c).not.toHaveProperty("for");
    expect(r.reply).toContain("ひなたの次の健診で聞く事にも並べました");
  });
});

describe("打った気がかり（家族が選ぶ）と、並べ方の決まり", () => {
  it("生まれた後に選んだ欄へ並べる。できごとは並べない。同じ記録は2回足さない", async () => {
    const { addConcernsToAgenda, addManualRecord } = await import("./capture");
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const f = await family(5);
    const mom = addManualRecord(f.id, { kind: "気がかり", title: "腰が痛い", date: "2027-05-10", who: "美咲" }, "2027-05-10");
    expect(addConcernsToAgenda(f, [mom], "2027-05-10", "mother")).toEqual(["mother"]);
    const baby = addManualRecord(f.id, { kind: "気がかり", title: "おへそがじくじくしている", date: "2027-05-10", who: "美咲" }, "2027-05-10");
    expect(addConcernsToAgenda(f, [baby], "2027-05-10", "child")).toEqual(["child"]);
    const happy = addManualRecord(f.id, { kind: "できごと", title: "初めて笑った", date: "2027-05-10" }, "2027-05-10");
    expect(addConcernsToAgenda(f, [happy], "2027-05-10")).toEqual([]);
    expect(addConcernsToAgenda(f, [mom], "2027-05-10", "mother")).toEqual([]);
    expect(getPlan(f.id).concerns).toEqual([
      { id: mom.id, text: "腰が痛い", date: "2027-05-10", for: "mother" },
      { id: baby.id, text: "おへそがじくじくしている", date: "2027-05-10", for: "child" },
    ]);
  });

  it("今日の健診がもう始まっていれば、ママの事はその健診の「今日聞く事」へ（手帳に聞く・健診の画面と同じ）", async () => {
    const { addConcernsToAgenda, addManualRecord } = await import("./capture");
    const { createVisit, getPlan, requireVisit } = await import("@/app/api/visit/_lib/server");
    const f = await family(6);
    const v = createVisit(f.id, "2027-02-20");
    const rec = addManualRecord(f.id, { kind: "気がかり", title: "お腹がよく張る", date: "2027-02-20" }, "2027-02-20");
    expect(addConcernsToAgenda(f, [rec], "2027-02-20")).toEqual(["mother"]);
    const now = requireVisit(v.id).data;
    expect(now.agenda?.some((a) => a.id === rec.id && a.from === "気がかり")).toBe(true);
    expect(now.carried?.concerns.some((c) => c.id === rec.id)).toBe(true);
    expect(getPlan(f.id).concerns.some((c) => c.id === rec.id)).toBe(false);
  });

  it("上の子の事・妊娠中の事を生まれた後に話した物は並べない", async () => {
    const { addConcernsToAgenda, addManualRecord } = await import("./capture");
    const base = await family(7);
    const f = { ...base, situation: { ...base.situation!, olderChildren: true, olderKids: [{ name: "けんた", birthDate: "2024-04-01" }] } };
    const older = addManualRecord(f.id, { kind: "気がかり", title: "咳が続いている", date: "2027-02-20", who: "けんた" }, "2027-02-20");
    expect(addConcernsToAgenda(f, [older], "2027-02-20")).toEqual([]);
    const past = addManualRecord(f.id, { kind: "気がかり", title: "足のむくみ", date: "2027-03-01" }, "2027-06-01");
    expect(addConcernsToAgenda(f, [past], "2027-06-01")).toEqual([]);
  });

  it("手帳に聞くの「健診で聞く事に足す」と記録は同じ決まり: どちらの順でも同じ文は1行。行の id は別々で、作り直しで外れるのは記録の行だけ", async () => {
    const { getPlan } = await import("@/app/api/visit/_lib/server");
    const { saveChat } = await import("./ask/agent");
    const act = await import("@/app/api/ask/act/route");
    const press = async (familyId: string, text: string, forWho: "child" | "mother", today: string) => {
      const at = `${today}T01:00:00.000Z`;
      saveChat(familyId, [{ role: "assistant", text: "次の健診で聞いてみましょう", today, at, actions: [{ type: "concern", text, for: forWho }] }]);
      const res = await act.POST(
        new Request("http://localhost:3000/api/ask/act", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ familyId, at, index: 0 }) }),
      );
      expect(res.status).toBe(200);
      return ((await res.json()) as { note: string }).note;
    };
    const today = "2027-02-20";

    // 記録が先 → 手帳に聞くで同じ文を押しても足さない（「もう並んでいます」）
    const a = await family(9);
    const rec = (await say(a, today, "夜に足がつって目が覚める")).records[0];
    const title = rec.data.title;
    expect(await press(a.id, title, "mother", today)).toContain("もうママの健診で聞く事に並んでいます");
    expect(getPlan(a.id).concerns.map((c) => c.id)).toEqual([rec.id]);

    // 手帳に聞くが先 → 同じ文を話しても足さない。返事にも「並べました」を書かない
    const b = await family(10);
    expect(await press(b.id, title, "mother", today)).toContain("ママの次の健診で聞く事に足しました");
    const [asked] = getPlan(b.id).concerns;
    expect(asked).toMatchObject({ text: title, date: today, for: "mother" });
    const spoken = await say(b, today, "夜に足がつって目が覚める");
    expect(spoken.reply).not.toContain("並べました");
    // 手帳に聞くの行の id は記録の id と別（どちらも randomUUID）
    expect(asked.id).not.toBe(spoken.records[0].id);
    expect(asked.id).toMatch(/^[0-9a-f-]{36}$/);
    // 同じ文を送り直す（見本は前の記録を作り直す）と、記録の行だけが外れる。手帳に聞くの行は残り、1行のまま
    await say(b, today, "夜に足がつって目が覚める");
    expect(getPlan(b.id).concerns).toEqual([asked]);

    // 生まれた後の子の事も同じ（家族が選んで打った気がかりと、手帳に聞くの子の健診）
    const { addConcernsToAgenda, addManualRecord } = await import("./capture");
    const c = await family(11);
    const baby = addManualRecord(c.id, { kind: "気がかり", title: "おへそがじくじくしている", date: "2027-06-01" }, "2027-06-01");
    expect(addConcernsToAgenda(c, [baby], "2027-06-01", "child")).toEqual(["child"]);
    expect(await press(c.id, "おへそがじくじくしている", "child", "2027-06-01")).toContain("もうひなたの次の健診で聞く事に並んでいます");
    expect(getPlan(c.id).concerns.map((x) => x.id)).toEqual([baby.id]);
    expect(calls).toHaveLength(0);
  });

  it("だれの健診か: 妊娠中はママ・生まれた後は子の呼び名なら子・分からなければ印なし・選んだ物が先", async () => {
    const { concernOwner } = await import("./capture");
    const f = await family(8);
    expect(concernOwner(f, "2027-02-20", "美咲")).toBe("mother");
    expect(concernOwner(f, "2027-02-20", null)).toBe("mother");
    expect(concernOwner(f, "2027-06-01", "ひなた")).toBe("child");
    expect(concernOwner(f, "2027-06-01", "赤ちゃん")).toBe("child");
    expect(concernOwner(f, "2027-06-01", "美咲")).toBeUndefined();
    expect(concernOwner(f, "2027-06-01", "美咲", "mother")).toBe("mother");
    expect(concernOwner(f, "2027-06-01", "上の子")).toBe("older");
  });
});
