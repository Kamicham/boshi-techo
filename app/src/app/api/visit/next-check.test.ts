// 結果の画面の1問（次の健診の日の確かめ）の口: PATCH /api/visit/[id] の nextCheck と、一覧の heard・canWrite・消す時の決まり。
// 作り手の方針「聞き違いは0にできない。最後の確かめと OK は本人」。日付はすべて作った日。Claude は呼ばない（整理の結果は記録に直接置く）。
// 関所の試験は api-household.test.ts・account-api.test.ts（読むだけの人は 403）。ここは移る前の通し方（わが家と同じ）で、家族の id で通す。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/app/api/_lib/household", async (orig) => {
  const real = await orig<typeof import("@/app/api/_lib/household")>();
  return {
    ...real,
    familyFor: async (_req: Request, familyId: unknown) => {
      const { getFamily } = await import("@/lib/family");
      const id = String(familyId);
      return {
        id,
        kind: "demo",
        family: getFamily(id),
        account: null,
        role: "owner",
        can: () => true,
        who: { householdId: id, kind: "demo", accountId: null, subjectIds: [], legacy: true },
        ctx: null,
        legacy: true,
      };
    },
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-next-check-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_PUBLIC;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const HEARD = { said: "1月12日の10時半", month: 1, day: 12, afterWeeks: null, afterDays: null, afterMonths: null, weekday: null, time: "10:30" };

/** 見本の家族の写し（健診を作る時も家族として引ける） */
async function family(n: number) {
  const { DEMO_FAMILY } = await import("@/lib/demo-family");
  return { ...DEMO_FAMILY, id: `try-${String(n).padStart(32, "0")}` };
}

/** 整理が済んだ健診（runPipeline が書く形: 聞こえた日を nextDate と plan.next に） */
async function organized(familyId: string, date: string, heardDate: string | null) {
  const { createVisit, getPlan, savePlan } = await import("./_lib/server");
  const { patch } = await import("@/lib/db");
  const v = createVisit(familyId, date);
  const result = { summary: ["a"], said: [], todo: [], nextAppointment: heardDate ? HEARD : null, numbers: [], terms: [], questions: [], answered: [] };
  patch(v.id, { result, nextDate: heardDate, status: "done" });
  if (heardDate) savePlan(familyId, { ...getPlan(familyId), next: { date: heardDate, time: "10:30", source: "visit", visitId: v.id, said: HEARD.said } });
  return v.id;
}

async function call(method: "GET" | "PATCH" | "DELETE", id: string, body?: unknown) {
  const route = await import("./[id]/route");
  const req = new Request(`http://localhost/api/visit/${id}`, {
    method,
    headers: body ? { "content-type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const res = await route[method](req, { params: Promise.resolve({ id }) });
  return { status: res.status, json: await res.json() };
}

/** 共有の1枚（健診で見せる記録）の「次の予約」 */
async function shared(familyId: string, today: string) {
  const { GET } = await import("@/app/api/techo/share/route");
  const res = await GET(new Request(`http://localhost/api/techo/share?familyId=${familyId}&today=${today}&bundles=next`));
  return ((await res.json()) as { sheet: { next?: unknown } }).sheet.next;
}

async function list(familyId: string, today: string) {
  const { GET } = await import("./route");
  const res = await GET(new Request(`http://localhost/api/visit?familyId=${familyId}&today=${today}`));
  return { status: res.status, json: await res.json() };
}

describe("次の健診の日の確かめ（結果の画面の1問）", () => {
  it("確かめる前: 一覧の予約に heard、送る文に日は入らない。直すと、予定・結果・送る文が本人の日にそろう", async () => {
    const { getPlan } = await import("./_lib/server");
    const { lineMessage } = await import("@/lib/visit");
    const f = await family(41);
    const id = await organized(f.id, "2027-10-20", "2028-01-12");

    const before = await list(f.id, "2027-10-21");
    expect(before.json.plan.next).toMatchObject({ date: "2028-01-12", heard: true, visitId: id });
    expect(before.json.canWrite).toBe(true);
    const one = await call("GET", id);
    expect(one.json.visit.canWrite).toBe(true);
    expect(lineMessage(one.json.visit)).not.toContain("次は");
    // 共有の1枚にも、確かめる前の日は出さない
    expect(await shared(f.id, "2027-10-21")).toBeNull();

    // 古い画面のまま「大丈夫」（別の日）は断る
    expect((await call("PATCH", id, { nextCheck: { state: "ok", date: "2027-11-17" } })).status).toBe(409);
    // 読めない答え・健診の日より前・無い日付は 400
    expect((await call("PATCH", id, { nextCheck: { state: "maybe" } })).status).toBe(400);
    expect((await call("PATCH", id, { nextCheck: { state: "fixed", date: "2027-10-19" } })).status).toBe(400);
    expect((await call("PATCH", id, { nextCheck: { state: "fixed", date: "2027-11-31" } })).status).toBe(400);

    const fixed = await call("PATCH", id, { nextCheck: { state: "fixed", date: "2027-11-17", time: "10:30", by: "ママ" } });
    expect(fixed.status).toBe(200);
    expect(fixed.json.visit).toMatchObject({ nextDate: "2027-11-17", nextCheck: { state: "fixed", date: "2027-11-17", time: "10:30", by: "ママ" } });
    // 聞こえた言葉は元のまま残す
    expect(fixed.json.visit.result.nextAppointment.said).toBe(HEARD.said);
    expect(getPlan(f.id).next).toEqual({ date: "2027-11-17", time: "10:30", source: "visit", visitId: id, said: HEARD.said });
    expect(lineMessage(fixed.json.visit)).toContain("次は 11/17 10:30");
    expect(await shared(f.id, "2027-10-21")).toEqual({ date: "2027-11-17", time: "10:30" });
    const after = await list(f.id, "2027-10-21");
    expect(after.json.plan.next.heard).toBeUndefined();
  });

  it("大丈夫: 聞こえた日のまま確かめる。後の健診の予約は、前の健診の答えで上書きしない", async () => {
    const { getPlan } = await import("./_lib/server");
    const f = await family(42);
    const first = await organized(f.id, "2027-10-20", "2027-11-17");
    const ok = await call("PATCH", first, { nextCheck: { state: "ok", date: "2027-11-17", by: "パパ" } });
    expect(ok.json.visit.nextCheck).toMatchObject({ state: "ok", date: "2027-11-17", time: "10:30", by: "パパ" });
    expect(getPlan(f.id).next).toMatchObject({ date: "2027-11-17", source: "visit", visitId: first });

    const second = await organized(f.id, "2027-11-17", "2027-12-15");
    expect(getPlan(f.id).next?.visitId).toBe(second);
    // 前の健診の日をもう一度直しても、後の健診の予約は残る
    await call("PATCH", first, { nextCheck: { state: "fixed", date: "2027-11-18", time: null } });
    expect(getPlan(f.id).next).toMatchObject({ date: "2027-12-15", visitId: second });
  });

  it("言われていない: 次の予約日を外し、この健診から入った予約も外す（古い健診の日は拾い直さない）", async () => {
    const { getPlan } = await import("./_lib/server");
    const f = await family(43);
    await organized(f.id, "2027-09-22", "2027-10-20");
    const id = await organized(f.id, "2027-10-20", "2028-01-12");
    const none = await call("PATCH", id, { nextCheck: { state: "none", by: "ママ" } });
    expect(none.json.visit).toMatchObject({ nextDate: null, nextCheck: { state: "none" } });
    expect(getPlan(f.id).next).toBeNull();
    expect((await list(f.id, "2027-10-21")).json.plan.next).toBeNull();
    // 言われていないの後は「大丈夫」できない（確かめる日が無い）
    expect((await call("PATCH", id, { nextCheck: { state: "ok" } })).status).toBe(409);
  });

  it("健診を消す: 確かめていない日は一緒に外し、確かめた日は手で入れた予定として残す", async () => {
    const { getPlan } = await import("./_lib/server");
    const f = await family(44);
    const heardOnly = await organized(f.id, "2027-10-20", "2028-01-12");
    expect((await call("DELETE", heardOnly)).status).toBe(200);
    expect(getPlan(f.id).next).toBeNull();

    const checked = await organized(f.id, "2027-10-20", "2027-11-17");
    await call("PATCH", checked, { nextCheck: { state: "ok", date: "2027-11-17" } });
    expect((await call("DELETE", checked)).status).toBe(200);
    expect(getPlan(f.id).next).toEqual({ date: "2027-11-17", time: "10:30", source: "manual" });
  });

  it("公開版（体験版）は健診の書く口が閉じているので、確かめのボタンを出さない（canWrite: false）", async () => {
    const f = await family(45);
    const id = await organized(f.id, "2027-10-20", "2027-11-17");
    process.env.BOSHI_PUBLIC = "1";
    try {
      expect((await call("GET", id)).json.visit.canWrite).toBe(false);
      expect((await list(f.id, "2027-10-21")).json.canWrite).toBe(false);
    } finally {
      delete process.env.BOSHI_PUBLIC;
    }
  });
});
