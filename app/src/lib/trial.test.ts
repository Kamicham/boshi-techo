// 公開版の体験用の家族の試験（BOSHI_PUBLIC=1・2026-11-04）:
// - 見本の家族を頼むと、その人の札の写しに置き換わる（2人の書き込みが混ざらない・共有の見本の家族には書かれない）
// - 写しの id を直に叩いても、札の持ち主でなければ 404
// - 7日たった写しは消える。1つの住所から作れる写しは1日10まで
// - 門（middleware）が札を配り、アカウント・招待・書き出し・シミュレーションの口を閉じ、健診は読むだけ
// - 体験の写しは見本の家族と同じ扱い（時計の早送り・作った記録・上限の日は見本の答え）
// DB は一時フォルダに作る（わが家の app/data には触らない）。Claude には一度もつながない。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-trial-test-"));
process.env.BOSHI_DATA_DIR = dir;
process.env.BOSHI_PUBLIC = "1";
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_PASSCODE;
afterAll(() => {
  delete process.env.BOSHI_PUBLIC;
  fs.rmSync(dir, { recursive: true, force: true });
});

const BASE = "http://localhost:3000";
const A = `try-${"a".repeat(32)}`;
const B = `try-${"b".repeat(32)}`;
const req = (url: string, o: { trial?: string; method?: string; body?: unknown; ip?: string } = {}) =>
  new Request(`${BASE}${url}`, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", origin: BASE, "fly-client-ip": o.ip ?? "203.0.113.1", ...(o.trial ? { cookie: `boshi_try=${o.trial}` } : {}) },
    ...(o.body ? { body: JSON.stringify(o.body) } : {}),
  });

describe("公開版の体験用の家族", () => {
  it("見本の家族を頼むと、その人の写しに置き換わり、2人の記録が混ざらない", async () => {
    const done = await import("@/app/api/done/route");
    expect((await done.POST(req("/api/done", { trial: A, body: { familyId: "demo-sato", milestoneId: "birth-registration" } }))).status).toBe(200);
    const doneOf = async (trial?: string) => ((await (await done.GET(req("/api/done?familyId=demo-sato", { trial }))).json()) as { done: string[] }).done;
    expect(await doneOf(A)).toContain("birth-registration");
    // 別の人（B）の写しには入っていない
    const b = await doneOf(B);
    expect(b).not.toContain("birth-registration");
    // 共有の見本の家族には書かれていない
    const { get } = await import("./db");
    expect(get("done:demo-sato:birth-registration")).toBeNull();
    expect(get(`done:${A}:birth-registration`)).not.toBeNull();
  });

  it("写しの id を直に叩いても、札の持ち主でなければ（札が無くても）404。見本の家族を札なしで頼むと 400", async () => {
    const done = await import("@/app/api/done/route");
    expect((await done.GET(req(`/api/done?familyId=${A}`, { trial: A }))).status).toBe(200);
    expect((await done.GET(req(`/api/done?familyId=${A}`, { trial: B }))).status).toBe(404);
    expect((await done.GET(req(`/api/done?familyId=${A}`))).status).toBe(404);
    expect((await done.GET(req("/api/done?familyId=demo-sato"))).status).toBe(400);
  });

  it("体験の写しは見本の家族と同じ扱い（作った記録・見本の答えの対象）", async () => {
    const { madeFamilyKind, getFamily } = await import("./family");
    const { isMadeFamily } = await import("./techo-seed");
    const { publicHouseholdKind } = await import("./access");
    expect(madeFamilyKind(A)).toBe("demo");
    expect(isMadeFamily(A)).toBe(true);
    expect(getFamily(A)).toMatchObject({ id: A, dueDate: getFamily("demo-sato")!.dueDate });
    expect(publicHouseholdKind(A)).toBeNull();
    // 体験版は、鍵がうっかり入っていても Claude を呼ばない（2026-11-05 作り手の決め「ハッカソンの間は API を使わない」）。
    // この試験は鍵（偽物）を入れたまま動かす: 見本の判定はいつも見本、Claude を呼ぶ1か所は 503
    const { claude, sampleMode } = await import("./claude");
    const who = { householdId: A, kind: "demo" as const, accountId: null, subjectIds: [] };
    expect(process.env.ANTHROPIC_API_KEY).toBeTruthy();
    expect(sampleMode(who)).toBe(true);
    expect(sampleMode({ ...who, kind: "real" })).toBe(true);
    expect(sampleMode(null)).toBe(true);
    let err: unknown = null;
    try {
      claude();
    } catch (e) {
      err = e;
    }
    expect(err).toMatchObject({ status: 503 });
    expect((err as Error).message).toContain("この体験版では AI（Claude）を呼びません");
    // 体験版でない置き場では、今までどおり（鍵がある見本の家族は Claude を呼ぶ）
    process.env.BOSHI_PUBLIC = "0";
    expect(sampleMode(who)).toBe(false);
    process.env.BOSHI_PUBLIC = "1";
  });

  it("体験版の頼みは、Claude につながず見本の答えで返る（下書き）", async () => {
    const draft = await import("@/app/api/draft/route");
    const r = await draft.POST(req("/api/draft", { trial: A, body: { familyId: "demo-sato", milestoneId: "birth-registration", today: "2027-04-27" } }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { draft?: { title?: string; body?: string } };
    expect(j.draft?.title).toContain("（見本の答え）");
    // 断り書きは体験版の言葉（作り手向けの「鍵を入れると…」は出さない）
    expect(j.draft?.body).toContain("この体験版では Claude を呼ばず、見本の答えを出しています");
    expect(j.draft?.body).not.toContain("鍵");
  });

  it("1つの住所から作れる写しは1日10まで。7日たった写しは消える", async () => {
    const { ensureTrial, purgeExpiredTrials } = await import("./trial");
    for (let i = 0; i < 10; i++) await ensureTrial(`try-${String(i).padStart(32, "c")}`, "198.51.100.7");
    await expect(ensureTrial(`try-${"d".repeat(32)}`, "198.51.100.7")).rejects.toMatchObject({ status: 429 });
    const { getHousehold } = await import("./households");
    expect(getHousehold(A)).not.toBeNull();
    expect(await purgeExpiredTrials(Date.now() + 8 * 86_400_000)).toBeGreaterThanOrEqual(12);
    expect(getHousehold(A)).toBeNull();
    const { get } = await import("./db");
    expect(get(`done:${A}:birth-registration`)).toBeNull();
  });
});

describe("公開版の門", () => {
  const mw = async (url: string, o: { method?: string; cookie?: string } = {}) => {
    const { middleware } = await import("@/middleware");
    return middleware(new NextRequest(`${BASE}${url}`, { method: o.method ?? "GET", headers: o.cookie ? { cookie: o.cookie } : {} }));
  };

  it("札が無ければ配る（同じ頼みにも付けて通す）", async () => {
    const r = await mw("/");
    const set = r.cookies.get("boshi_try");
    expect(set?.value).toMatch(/^try-[0-9a-f]{32}$/);
    expect(set?.httpOnly).toBe(true);
    expect(r.headers.get("x-middleware-request-cookie") ?? r.headers.get("x-middleware-override-headers")).toBeTruthy();
    const again = await mw("/", { cookie: `boshi_try=${A}` });
    expect(again.cookies.get("boshi_try")).toBeUndefined();
  });

  it("アカウント・招待・書き出し・シミュレーションの口は閉じ、健診は読むだけ", async () => {
    for (const p of ["/api/auth/sign-in/email-otp", "/api/account/consent", "/api/household", "/api/export", "/api/sim/login"]) expect((await mw(p, { method: "POST", cookie: `boshi_try=${A}` })).status).toBe(404);
    expect((await mw("/api/auth/get-session", { cookie: `boshi_try=${A}` })).status).toBe(200);
    expect((await mw("/api/visit", { method: "POST", cookie: `boshi_try=${A}` })).status).toBe(403);
    expect((await mw("/api/visit?familyId=demo-sato", { cookie: `boshi_try=${A}` })).status).toBe(200);
    const login = await mw("/login", { cookie: `boshi_try=${A}` });
    expect(login.status).toBe(307);
    expect(new URL(login.headers.get("location")!).pathname).toBe("/");
  });
});
