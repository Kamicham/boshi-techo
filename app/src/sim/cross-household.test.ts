// 世帯をまたぐ確かめ（シミュレーションの家族で）: 家族Aの札（sim:<A> のセッション）で、家族Bの記録・済んだ事・手帳・写真の id を叩くと、
// どれも「無い」（404 / null）になる。シミュレーションのログイン（src/sim/login.ts）が、本物と同じ関所（withHousehold）を通る事も見る。
// DB と置き場は一時フォルダ（わが家の app/data・シミュレーションの sim-data には触らない）。家族はすべて作った家族。
//
// BOSHI_SIM は入れない＝作った家族も公開の世帯にならない（サーバで BOSHI_SIM_LOGIN=1 にした時と同じ。ログインが要る）。
// 実際のサーバ（3100番）の API を通す確かめは src/sim/cross.mjs（なりきりの後に Workflow simulate が回す）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-sim-cross-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-sim-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "ffeeddccbbaa99887766554433221100ffeeddccbbaa99887766554433221100";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_SIM_LOGIN;

type Login = typeof import("./login");
type Access = typeof import("../lib/access");
type HH = typeof import("../lib/households");
type Storage = typeof import("../lib/storage");
type Kind = typeof import("./kind");
let L: Login, A: Access, H: HH, S: Storage, K: Kind;

const isSim = (id: string) => K.madeHouseholdKind(id) === "sim";
const cookieOf = (setCookies: string[]) => setCookies.map((c) => c.split(";")[0]).join("; ");
const req = (cookie?: string) => new Request("http://localhost:3100/api/x", { headers: cookie ? { cookie } : {} });

// 家族A（30家族の1つ）と家族B（1000組の1組）
const FA = "sim-04";
const FB = "pop-0007";
let cookieA = "";
let cookieB = "";
let accountA = "";

beforeAll(async () => {
  L = await import("./login");
  A = await import("../lib/access");
  H = await import("../lib/households");
  S = await import("../lib/storage");
  K = await import("./kind");
  vi.spyOn(console, "info").mockImplementation(() => {});
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

describe("シミュレーションのログイン（/api/sim/login の中身）", () => {
  it("作った家族ではない id・わが家の置き場では札を出さない", async () => {
    await expect(L.simLogin("mine", isSim)).rejects.toMatchObject({ status: 404 });
    await expect(L.simLogin("demo-sato", isSim)).rejects.toMatchObject({ status: 404 });
    await expect(L.simLogin("pop-9999", isSim)).rejects.toMatchObject({ status: 404 });
    await expect(L.simLogin(undefined, isSim)).rejects.toMatchObject({ status: 404 });
    const saved = process.env.BOSHI_DATA_DIR;
    delete process.env.BOSHI_DATA_DIR;
    try {
      await expect(L.simLogin(FA, isSim)).rejects.toMatchObject({ status: 404 });
    } finally {
      process.env.BOSHI_DATA_DIR = saved;
    }
  });

  it("仮のアカウント sim:<家族id> が、その世帯の owner になる（世帯は kind = sim）", async () => {
    const a = await L.simLogin(FA, isSim);
    const b = await L.simLogin(FB, isSim);
    cookieA = cookieOf(a.setCookies);
    cookieB = cookieOf(b.setCookies);
    accountA = a.accountId;
    expect(cookieA).toMatch(/boshi[._-]session_token=/);
    expect(a.email).toBe(`${FA}@sim.boshi.invalid`);
    expect(a.accountId).not.toBe(b.accountId);
    expect(H.getHousehold(FA)?.kind).toBe("sim");
    expect(H.getHousehold(FB)?.kind).toBe("sim");

    const ctx = await A.withHousehold(req(cookieA), FA, ["record:write", "media:write", "household:delete"]);
    expect(ctx.role).toBe("owner");
    expect(ctx.household.kind).toBe("sim");
    expect(ctx.account?.name).toBe(`sim:${FA}`);
    expect(A.myHouseholds(a.accountId).map((h) => h.id)).toEqual([FA]);
  });

  it("2回目は同じアカウントで札を出し直すだけ（仲間の行は増えない）", async () => {
    const again = await L.simLogin(FA, isSim);
    expect(again.accountId).toBe(accountA);
    expect(A.myHouseholds(accountA)).toHaveLength(1);
    // 前の札も使える（セッションは30日）
    await expect(A.withHousehold(req(cookieA), FA, "record:read")).resolves.toMatchObject({ role: "owner" });
  });

  it("同じ id の本物の世帯（kind = real）があれば、作った家族として扱わない", async () => {
    H.ensureHousehold("sim-09", "real");
    await expect(L.simLogin("sim-09", isSim)).rejects.toMatchObject({ status: 404 });
  });

  it("返事に札のクッキーが付く", async () => {
    const res = await L.simLoginResponse(new Request(`http://localhost:3100/api/sim/login?familyId=${FA}`), isSim);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, familyId: FA, role: "owner" });
    expect(res.headers.getSetCookie().some((c) => /session_token=/.test(c))).toBe(true);
    const bad = await L.simLoginResponse(new Request("http://localhost:3100/api/sim/login?familyId=mine"), isSim);
    expect(bad.status).toBe(404);
  });
});

describe("世帯をまたぐと、どれも 404（家族Aの札で家族Bを叩く）", () => {
  it("関所: 他人の世帯は 404、札なしは 401", async () => {
    await expect(A.withHousehold(req(cookieA), FB, "record:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(cookieA), FB, "media:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(cookieB), FA, "record:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(), FB, "record:read")).rejects.toMatchObject({ status: 401 });
    // 見本の家族（demo-sato）は、だれの札でも読める（公開の世帯）
    await expect(A.withHousehold(req(cookieA), "demo-sato", "record:read")).resolves.toMatchObject({ role: "guest" });
  });

  it("記録・済んだ事・手帳・写真の id を、家族Aの道具で引いても無い・直せない・消せない", async () => {
    const ctxA = await A.withHousehold(req(cookieA), FA, ["record:write", "media:write"]);
    const ctxB = await A.withHousehold(req(cookieB), FB, ["record:write", "media:write"]);

    // 家族Bの物（中身は作った物）
    const rec = ctxB.db.put("record", { text: "作った記録: 今日寝返りした" }, { date: "2026-11-03" });
    const done = ctxB.db.put("done", { milestoneId: "birth-registration", today: "2026-11-03" }, { id: `done:${FB}:birth-registration`, date: "2026-11-03" });
    const techo = ctxB.db.put("techo", { page: "growth", values: { weightG: 6200 } }, { id: `techo:${FB}:growth:1`, date: "2026-11-03" });
    const key = S.mediaKey({ householdId: FB, subjectId: null, kind: "photo", id: "md-b1", date: "2026-11-03" });
    await ctxB.storage.put(key, Buffer.from("作った写真のつもり"), { contentType: "image/jpeg" });
    const md = ctxB.db.media.insert({ id: "md-b1", subjectId: null, kind: "photo", storageKey: key, mime: "image/jpeg", bytes: 9, sha256: "sha-b1" });

    for (const id of [rec.id, done.id, techo.id]) {
      expect(ctxA.db.get(id), id).toBeNull();
      expect(ctxA.db.patch(id, { text: "上書き" }), id).toBeNull();
      expect(ctxA.db.remove(id), id).toBe(false);
      expect(() => ctxA.db.put("record", { text: "横取り" }, { id }), id).toThrow();
    }
    expect(ctxA.db.list("record")).toEqual([]);
    expect(ctxA.db.list("done")).toEqual([]);
    expect(ctxA.db.list("techo")).toEqual([]);

    expect(ctxA.db.media.get(md.id)).toBeNull();
    expect(ctxA.db.media.get(md.id, { includeTrashed: true })).toBeNull();
    expect(ctxA.db.media.list()).toEqual([]);
    expect(ctxA.db.media.findBySha("sha-b1")).toBeNull();
    expect(ctxA.db.media.patch(md.id, { trashedAt: new Date().toISOString() })).toBeNull();
    expect(ctxA.db.media.remove(md.id)).toBe(false);
    // 家族Bの置き場の鍵を、家族Aの台帳に入れることもできない
    expect(() => ctxA.db.media.insert({ subjectId: null, kind: "photo", storageKey: key, mime: "image/jpeg", bytes: 1 })).toThrow();

    // 家族Bからは、どれも今のまま見える（横取りで壊れていない）
    expect(ctxB.db.get<{ text: string }>(rec.id)?.data.text).toBe("作った記録: 今日寝返りした");
    expect(ctxB.db.get(done.id)).not.toBeNull();
    expect(ctxB.db.get(techo.id)).not.toBeNull();
    expect(ctxB.db.media.get(md.id)?.trashedAt).toBeNull();
    expect((await ctxB.storage.get(key))?.toString()).toBe("作った写真のつもり");
  });
});
