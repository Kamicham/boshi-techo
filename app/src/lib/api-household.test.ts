// API の移し替えの試験: route が「セッション → 世帯 → 権限」を通ること、/api/family が自分と公開の世帯だけを返すこと、
// 世帯を作ると本人（母・子）と世帯の鍵ができること、本物の世帯は claude_us の同意が無いと Claude に送らないこと。
// DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。作った人・作ったメールだけを使う。
// Claude には一度もつながない（鍵は試験だけの物で、住所も届かない所にしてある）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { CONSENT_VERSION } from "@/components/settings/consent-texts";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-api-household-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
process.env.ANTHROPIC_API_KEY = "test-not-a-real-key";
process.env.ANTHROPIC_BASE_URL = "http://127.0.0.1:9";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;
delete process.env.BOSHI_ACCOUNTS;
delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;

type AuthMod = typeof import("./auth");
type HH = typeof import("./households");
type Cl = typeof import("./claude");
let AU: AuthMod, H: HH, CL: Cl;

beforeAll(async () => {
  AU = await import("./auth");
  H = await import("./households");
  CL = await import("./claude");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const BASE = "http://localhost:3000";
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function authCall(p: string, body: unknown, cookie?: string): Promise<Response> {
  const auth = await AU.authReady();
  return auth.handler(
    new Request(`${BASE}/api/auth${p}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

async function signIn(email: string): Promise<string> {
  const sent: string[] = [];
  AU.setMailSender(async (m) => void sent.push(m.text));
  await authCall("/email-otp/send-verification-otp", { email, type: "sign-in" });
  await new Promise((r) => setTimeout(r, 10));
  const otp = /コード: (\d{6})/.exec(sent.at(-1) ?? "")?.[1];
  const r = await authCall("/sign-in/email-otp", { email, otp });
  expect(r.status).toBe(200);
  AU.setMailSender(null);
  return cookieOf(r);
}

/** route の関数を呼ぶ（画面と同じ形の Request で） */
function req(url: string, o: { cookie?: string; method?: string; body?: unknown } = {}): Request {
  return new Request(`${BASE}${url}`, {
    method: o.method ?? (o.body ? "POST" : "GET"),
    headers: { "content-type": "application/json", origin: BASE, ...(o.cookie ? { cookie: o.cookie } : {}) },
    ...(o.body ? { body: JSON.stringify(o.body) } : {}),
  });
}

type Json = Record<string, unknown>;
async function json(res: Response): Promise<{ status: number; body: Json }> {
  return { status: res.status, body: (await res.json()) as Json };
}

const PROFILE = {
  city: "さいたま市浦和区",
  prefecture: "埼玉県",
  dueDate: "2027-05-10",
  members: [
    { id: "m1", name: "作った母", role: "母" },
    { id: "m2", name: "作ったパートナー", role: "パートナー" },
  ],
};

describe("アカウントの仕組みが動いている時（BOSHI_DATA_DIR を分けた所）", () => {
  let alice = "";
  let bob = "";
  let hidA = "";
  let hidB = "";

  beforeAll(async () => {
    alice = await signIn("alice-made@example.com");
    bob = await signIn("bob-made@example.com");
  });

  it("世帯を作ると owner になり、本人（母・子）と世帯の鍵ができる。ログインなしは 401", async () => {
    const { POST } = await import("@/app/api/household/route");
    expect((await POST(req("/api/household", { body: {} }))).status).toBe(401);

    const a = await json(await POST(req("/api/household", { cookie: alice, body: { name: "作った世帯A" } })));
    expect(a.status).toBe(200);
    const hh = a.body.household as { id: string; role: string };
    hidA = hh.id;
    expect(hh.role).toBe("owner");
    expect((a.body.subjects as { kind: string }[]).map((s) => s.kind).sort()).toEqual(["child", "mother"]);
    expect(H.getHousehold(hidA)?.kind).toBe("real");
    const { householdKey } = await import("./crypto");
    expect(householdKey(hidA)).not.toBeNull();
    // 作った人は本人「母」に結びつく
    expect(H.listSubjects(hidA).find((s) => s.kind === "mother")?.accountId).toBeTruthy();

    const b = await json(await POST(req("/api/household", { cookie: bob, body: { name: "作った世帯B", me: "partner" } })));
    hidB = (b.body.household as { id: string }).id;
    expect(H.listSubjects(hidB).map((s) => s.kind).sort()).toEqual(["child", "mother", "partner"]);
  });

  it("家族の設定: 世帯を送らなければ、管理できる1つの世帯に保存する。見本の家族・他人の世帯には保存できない", async () => {
    const { POST } = await import("@/app/api/family/route");
    const r = await json(await POST(req("/api/family", { cookie: alice, body: PROFILE })));
    expect(r.status).toBe(200);
    expect((r.body.family as { id: string }).id).toBe(hidA);

    expect((await POST(req("/api/family", { cookie: bob, body: { ...PROFILE, familyId: hidB } }))).status).toBe(200);
    // 他人の世帯は 404（有る・無いを漏らさない）、ログインなしは 401、見本の家族は 403
    expect((await POST(req("/api/family", { cookie: bob, body: { ...PROFILE, familyId: hidA } }))).status).toBe(404);
    expect((await POST(req("/api/family", { body: { ...PROFILE, familyId: hidA } }))).status).toBe(401);
    expect((await POST(req("/api/family", { body: { ...PROFILE, familyId: "demo-sato" } }))).status).toBe(403);
  });

  it("家族の設定（/api/family）も、子どもから見た呼び名を保つ。11/4 までの形（呼び名なし）はそのまま", async () => {
    const { POST } = await import("@/app/api/family/route");
    const { getFamily } = await import("./family");
    const withCall = { ...PROFILE, familyId: hidB, members: [{ ...PROFILE.members[0], callName: "おかん" }, PROFILE.members[1]] };
    const r = await json(await POST(req("/api/family", { cookie: bob, body: withCall })));
    expect(r.status).toBe(200);
    expect((r.body.family as { members: unknown[] }).members).toEqual([{ id: "m1", name: "作った母", role: "母", callName: "おかん" }, { id: "m2", name: "作ったパートナー", role: "パートナー" }]);
    expect(getFamily(hidB)!.members[0].callName).toBe("おかん");
    expect((await POST(req("/api/family", { cookie: bob, body: { ...PROFILE, familyId: hidB } }))).status).toBe(200);
    expect(getFamily(hidB)!.members).toEqual(PROFILE.members);
  });

  it("家族の一覧: 自分の世帯と見本の家族だけ。ログインなしは見本の家族だけ", async () => {
    const { GET } = await import("@/app/api/family/route");
    const ids = async (cookie?: string) => ((await json(await GET(req("/api/family", { cookie })))).body.families as { id: string }[]).map((f) => f.id);
    expect(await ids(alice)).toEqual([hidA, "demo-sato"]);
    expect(await ids(bob)).toEqual([hidB, "demo-sato"]);
    expect(await ids()).toEqual(["demo-sato"]);
    const a = await json(await GET(req("/api/family", { cookie: alice })));
    expect(a.body.households).toEqual([{ id: hidA, name: "作った世帯A", role: "owner", hasProfile: true }]);
  });

  it("記録の道: 自分の世帯は通る。他人の世帯は 404、ログインなしは 401。見本の家族はログインなしで通る", async () => {
    const done = await import("@/app/api/done/route");
    const ok = await done.POST(req("/api/done", { cookie: alice, body: { familyId: hidA, milestoneId: "birth-registration" } }));
    expect(ok.status).toBe(200);
    const mine = await json(await done.GET(req(`/api/done?familyId=${hidA}`, { cookie: alice })));
    expect(mine.body.done).toContain("birth-registration");

    expect((await done.GET(req(`/api/done?familyId=${hidA}`, { cookie: bob }))).status).toBe(404);
    expect((await done.GET(req(`/api/done?familyId=${hidA}`))).status).toBe(401);
    expect((await done.DELETE(req("/api/done", { cookie: bob, method: "DELETE", body: { familyId: hidA, milestoneId: "birth-registration" } }))).status).toBe(404);
    expect((await done.GET(req("/api/done?familyId=demo-sato"))).status).toBe(200);

    const keep = await import("@/app/api/keep/route");
    expect((await keep.GET(req(`/api/keep?familyId=${hidB}`, { cookie: alice }))).status).toBe(404);
    const techo = await import("@/app/api/techo/route");
    expect((await techo.GET(req(`/api/techo?familyId=${hidB}&today=2027-01-01`, { cookie: alice }))).status).toBe(404);
    expect((await techo.GET(req(`/api/techo?familyId=${hidB}&today=2027-01-01`, { cookie: bob }))).status).toBe(200);
  });

  it("健診の口（api/visit）: 自分の世帯の健診は通る。他人の世帯の健診は、見る・直す・消す・録音・終える・道案内のどれも 404、ログインなしは 401（監査 #2）", async () => {
    const V = await import("@/app/api/visit/_lib/server");
    const list = await import("@/app/api/visit/route");
    const plan = await import("@/app/api/visit/plan/route");
    const one = await import("@/app/api/visit/[id]/route");
    const chunk = await import("@/app/api/visit/[id]/chunk/route");
    const take = await import("@/app/api/visit/[id]/take/route");
    const finish = await import("@/app/api/visit/[id]/finish/route");
    const guide = await import("@/app/api/visit/[id]/guide/route");
    const at = (id: string) => ({ params: Promise.resolve({ id }) });

    // 自分の世帯（alice）で健診を始める
    const made = await json(await list.POST(req("/api/visit", { cookie: alice, body: { familyId: hidA, date: "2027-01-12" } })));
    expect(made.status).toBe(200);
    const id = (made.body.visit as { id: string }).id;
    const before = JSON.stringify(V.requireVisit(id).data);
    const audio = (cookie?: string, extra: Record<string, string> = {}) =>
      new Request(`${BASE}/api/visit/${id}/chunk?seq=0&take=0&ext=webm`, {
        method: "POST",
        headers: { "content-type": "audio/webm", ...(cookie ? { cookie } : {}), ...extra },
        body: new Uint8Array(2000),
      });

    // 他人の世帯（bob）からは、どの口も 404（有る・無いを漏らさない）
    expect((await one.GET(req(`/api/visit/${id}`, { cookie: bob }), at(id))).status).toBe(404);
    expect((await one.PATCH(req(`/api/visit/${id}`, { cookie: bob, method: "PATCH", body: { consent: true } }), at(id))).status).toBe(404);
    expect((await one.DELETE(req(`/api/visit/${id}`, { cookie: bob, method: "DELETE" }), at(id))).status).toBe(404);
    expect((await chunk.POST(audio(bob), at(id))).status).toBe(404);
    expect((await take.POST(req(`/api/visit/${id}/take`, { cookie: bob, method: "POST" }), at(id))).status).toBe(404);
    expect((await finish.POST(req(`/api/visit/${id}/finish`, { cookie: bob, body: { transcriptText: "横取りした文" } }), at(id))).status).toBe(404);
    expect((await guide.POST(req(`/api/visit/${id}/guide`, { cookie: bob, body: { images: [] } }), at(id))).status).toBe(404);
    // 世帯を家族の id で指す口（一覧・始める・予定と気がかり）も 404
    expect((await list.GET(req(`/api/visit?familyId=${hidA}`, { cookie: bob }))).status).toBe(404);
    expect((await list.POST(req("/api/visit", { cookie: bob, body: { familyId: hidA, date: "2027-01-13" } }))).status).toBe(404);
    expect((await plan.POST(req("/api/visit/plan", { cookie: bob, body: { familyId: hidA, concern: "横取りした気がかり" } }))).status).toBe(404);
    // ログインなしは 401
    expect((await one.GET(req(`/api/visit/${id}`), at(id))).status).toBe(401);
    expect((await chunk.POST(audio(), at(id))).status).toBe(401);
    // alice の健診は、そのまま
    expect(JSON.stringify(V.requireVisit(id).data)).toBe(before);
    expect(V.getPlan(hidA).concerns.map((c) => c.text)).not.toContain("横取りした気がかり");

    // 自分の世帯は通る
    const mine = await json(await one.GET(req(`/api/visit/${id}`, { cookie: alice }), at(id)));
    expect(mine.status).toBe(200);
    expect((mine.body.visit as { familyId: string }).familyId).toBe(hidA);
    expect((await list.GET(req(`/api/visit?familyId=${hidA}&today=2027-01-12`, { cookie: alice }))).status).toBe(200);
    expect((await chunk.POST(audio(alice), at(id))).status).toBe(200);
    expect(V.requireVisit(id).data.takes?.[0]?.chunks).toBe(1);
    // 録音は1回 32MB まで（中身を読まずに 413）
    expect((await chunk.POST(audio(alice, { "content-length": String(33 * 1024 * 1024) }), at(id))).status).toBe(413);
    // 書き起こしを Claude に送る口は、本物の世帯では claude_us の同意が要る（まだ無いので 403。整理は始まらない）
    const fin = await json(await finish.POST(req(`/api/visit/${id}/finish`, { cookie: alice, body: { transcriptText: "作った書き起こし" } }), at(id)));
    expect(fin.status).toBe(403);
    expect(String(fin.body.error)).toContain("同意");
    expect(V.requireVisit(id).data.status).toBe("recording");
  });

  it("済んだの「誰が」とありがとう: 11/4 までの形（by・thanks の無い済んだ）も読め、ありがとうは誰が済ませたか分かる物だけ・家族の一人から・自分以外へ", async () => {
    const done = await import("@/app/api/done/route");
    const { put } = await import("./db");
    // 11/4 までの版が書いた形（by も thanks も無い）
    put(hidA, "done", { milestoneId: "pregnancy-report", today: "2026-11-03", at: "2026-11-03T00:00:00.000Z" }, { id: `done:${hidA}:pregnancy-report`, date: "2026-11-03" });
    const read = async () => (await json(await done.GET(req(`/api/done?familyId=${hidA}&today=2027-05-01`, { cookie: alice })))).body;
    let r = await read();
    expect(r.done).toContain("pregnancy-report");
    expect(r.doneOn).toMatchObject({ "pregnancy-report": "2026-11-03" });
    expect(r.doneBy).not.toHaveProperty("pregnancy-report");
    expect(r.thanks).toEqual({});
    const thank = (milestoneId: string, by: string, cookie = alice) =>
      done.PATCH(req("/api/done", { cookie, method: "PATCH", body: { familyId: hidA, milestoneId, by, today: "2027-05-01" } }));
    expect((await thank("pregnancy-report", "m1")).status).toBe(400);

    // パートナー（m2）が済ませる → 母（m1）からありがとう
    expect((await done.POST(req("/api/done", { cookie: alice, body: { familyId: hidA, milestoneId: "birth-registration", today: "2027-04-28", by: "m2" } }))).status).toBe(200);
    r = await read();
    expect(r.doneBy).toMatchObject({ "birth-registration": "m2" });
    expect((await thank("birth-registration", "m2")).status).toBe(400); // 自分には送れない
    expect((await thank("birth-registration", "someone")).status).toBe(400); // 家族の外の人
    expect((await thank("birth-registration", "m1", bob)).status).toBe(404); // 他人の世帯
    expect((await thank("birth-registration", "m1", "")).status).toBe(401); // ログインなし
    expect((await thank("not-done-yet", "m1")).status).toBe(404);
    const ok = await json(await thank("birth-registration", "m1"));
    expect(ok.status).toBe(200);
    expect(ok.body.thanks).toMatchObject({ by: "m1", today: "2027-05-01" });
    expect((await read()).thanks).toMatchObject({ "birth-registration": { by: "m1", today: "2027-05-01" } });
    // 同じ人が押し直しても、届いたありがとうは残る。家族の外の by は記録しない
    await done.POST(req("/api/done", { cookie: alice, body: { familyId: hidA, milestoneId: "birth-registration", today: "2027-04-29", by: "m2" } }));
    expect((await read()).thanks).toHaveProperty("birth-registration");
    await done.POST(req("/api/done", { cookie: alice, body: { familyId: hidA, milestoneId: "health-insurance", by: "stranger" } }));
    expect((await read()).doneBy).not.toHaveProperty("health-insurance");
  });

  it("手帳が用意した物（/api/prep・UX の見直し C07）: 自分の世帯の下書きと残る空欄を返し、見本の答えは数えない。他人の世帯は 404、ログインなしは 401", async () => {
    const { GET } = await import("@/app/api/prep/route");
    const { put } = await import("./db");
    const { draftId } = await import("./drafts");
    const { SAMPLE_MARK } = await import("./samples");
    const base = { milestoneTitle: "", status: "draft", usedLocal: false, checklist: [] };
    put(hidA, "draft", { ...base, milestoneId: "tell-work", kind: "メール", title: "妊娠のご報告", to: "【上司の名前】様", body: "【上司の名前】様\nお疲れさまです。", today: "2027-01-05" }, { id: draftId(hidA, "tell-work"), date: "2027-01-05" });
    // 鍵が無い時の見本の答え（本物の世帯には出ない形だが、混ざっても「用意した」とは数えない）
    put(hidA, "draft", { ...base, milestoneId: "pregnancy-report", kind: "記入メモ", title: `${SAMPLE_MARK}妊娠の届出`, to: "【出す先】", body: "見本", today: "2027-01-05" }, { id: draftId(hidA, "pregnancy-report"), date: "2027-01-05" });
    const r = await json(await GET(req(`/api/prep?familyId=${hidA}&ids=tell-work,pregnancy-report,no-such-thing`, { cookie: alice })));
    expect(r.status).toBe(200);
    const items = r.body.items as Record<string, { draft?: { kind: string; on: string; blanks: string[] } }>;
    expect(items["tell-work"].draft).toMatchObject({ kind: "メール", on: "2027-01-05" });
    expect(items["tell-work"].draft!.blanks).toContain("上司の名前");
    expect(items).not.toHaveProperty("pregnancy-report");
    expect(items).not.toHaveProperty("no-such-thing");
    expect((await GET(req(`/api/prep?familyId=${hidA}&ids=tell-work`, { cookie: bob }))).status).toBe(404);
    expect((await GET(req(`/api/prep?familyId=${hidA}&ids=tell-work`))).status).toBe(401);
  });

  it("本物の世帯は、claude_us の同意が無いと Claude に送らない（分かる誤りを返す）", async () => {
    const cap = await import("@/app/api/capture/route");
    const r = await json(await cap.POST(req("/api/capture", { cookie: alice, body: { familyId: hidA, today: "2027-01-10", text: "健診に行った" } })));
    expect(r.status).toBe(403);
    expect(String(r.body.error)).toContain("同意");
    // 送らなかったので、記録も聞き返しも残らない
    const list = await json(await cap.GET(req(`/api/capture?familyId=${hidA}&today=2027-01-10`, { cookie: alice })));
    expect(list.body.records).toEqual([]);
  });

  it("米国の Claude に送る同意は、今の版でなければ送らない（前の版は、送る物の説明が実際と違っていた）。今の版で押し直すと送れる", () => {
    const subjects = H.listSubjects(hidA);
    const who = { householdId: hidA, kind: "real" as const, accountId: "acc-a", subjectIds: subjects.map((s) => s.id) };
    expect("2026-11-03" < CONSENT_VERSION.claude_us).toBe(true);
    for (const s of subjects) H.grantConsent(hidA, s.id, "claude_us", "2026-11-03", "acc-a");
    expect(() => CL.assertConsent(who)).toThrow(CL.ConsentRequiredError);
    expect(() => CL.guardSend("old-version", who)).toThrow(CL.ConsentRequiredError);
    expect(H.listAudit(hidA).some((a) => a.action === "claude.send" && a.target === "old-version")).toBe(false);
    for (const s of subjects) H.grantConsent(hidA, s.id, "claude_us", CONSENT_VERSION.claude_us, "acc-a");
    expect(() => CL.assertConsent(who)).not.toThrow();
    expect(CL.guardSend("new-version", who)?.householdId).toBe(hidA);
  });

  it("写真を1枚 Claude に見せる時（mediaForClaude）も、今の版の同意でなければ渡さない", async () => {
    const A = await import("./access");
    const M = await import("./media");
    const ctx = await A.withHousehold(req(`/api/media?familyId=${hidA}`, { cookie: alice }), hidA, ["media:write", "media:read", "claude:send"]);
    // 作ったバイト列だけの小さな JPEG（30×40・位置の情報なし）
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 30, 0, 40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x56, 9, 0xff, 0xd9]);
    const { media } = await M.saveUpload(ctx, { orig: jpeg, view: jpeg, thumb: jpeg });
    ctx.db.media.patch(media.id, { data: { shareWithClaude: { at: "2027-01-10T00:00:00.000Z", by: "test" } } });
    const subjects = H.listSubjects(hidA);
    for (const s of subjects) H.grantConsent(hidA, s.id, "claude_us", "2026-11-03", "acc-a");
    await expect(M.mediaForClaude(ctx, media.id)).rejects.toMatchObject({ status: 403 });
    for (const s of subjects) H.grantConsent(hidA, s.id, "claude_us", CONSENT_VERSION.claude_us, "acc-a");
    await expect(M.mediaForClaude(ctx, media.id)).resolves.toMatchObject({ type: "image" });
  });

  it("送る前の関所: 全員が同意すると通り、送った記録が残る。1人でも撤回すると止まる", async () => {
    const subjects = H.listSubjects(hidA);
    const who = { householdId: hidA, kind: "real" as const, accountId: "acc-a", subjectIds: subjects.map((s) => s.id) };
    for (const s of subjects) H.grantConsent(hidA, s.id, "claude_us", CONSENT_VERSION.claude_us, "acc-a");
    await CL.sendingAs(who, async () => {
      expect(CL.guardSend("test")?.householdId).toBe(hidA);
    });
    expect(H.listAudit(hidA).some((a) => a.action === "claude.send" && a.target === "test")).toBe(true);

    H.revokeConsent(hidA, subjects[1].id, "claude_us");
    expect(() => CL.guardSend("test", who)).toThrow(CL.ConsentRequiredError);
    // 町の名前だけで調べる時（家族の記録が入らない）は同意を見ない
    expect(CL.guardSend("local", { ...who, noPersonal: true })?.noPersonal).toBe(true);
    // 本人がいない本物の世帯は送らない
    expect(() => CL.guardSend("test", { ...who, subjectIds: [] })).toThrow(CL.ConsentRequiredError);
  });

  it("作った家族（見本・シミュレーション）と、移る前の通し方（legacy）は、同意の版を見るようにした後も、今までどおり同意を見ずに送る", () => {
    const demo = { householdId: "demo-sato", kind: "demo" as const, accountId: null, subjectIds: [] };
    const sim = { householdId: "sim-seed-1", kind: "sim" as const, accountId: null, subjectIds: [] };
    const legacy = { householdId: "mine", kind: "real" as const, accountId: null, subjectIds: [], legacy: true };
    for (const w of [demo, sim, legacy]) expect(() => CL.assertConsent(w)).not.toThrow();
    expect(CL.guardSend("demo", demo)?.kind).toBe("demo");
    expect(CL.guardSend("sim", sim)?.kind).toBe("sim");
    expect(CL.guardSend("legacy", legacy)?.legacy).toBe(true);
  });

  it("使った額の行に、世帯と送った人を書く（前の形の行と一緒に読める）", async () => {
    const { recordSpend } = await import("./spend");
    recordSpend("structured", "claude-haiku-5-5", { input_tokens: 10, output_tokens: 5 });
    recordSpend("structured", "claude-haiku-5-5", { input_tokens: 10, output_tokens: 5 }, { household: hidA, account: "acc-a" });
    const rows = fs
      .readFileSync(path.join(dir, "spend.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l) as Json);
    expect(rows.at(-2)?.household).toBeUndefined();
    expect(rows.at(-1)).toMatchObject({ household: hidA, account: "acc-a" });
  });

  it("世帯ごとの使い過ぎ止め（入れた時だけ）", async () => {
    const { checkHouseholdBudget, recordSpend } = await import("./spend");
    expect(() => checkHouseholdBudget(hidA)).not.toThrow();
    process.env.BOSHI_HOUSEHOLD_DAILY_USD = "0.000001";
    recordSpend("structured", "claude-opus-5-5", { input_tokens: 1000, output_tokens: 1000 }, { household: hidA });
    expect(() => checkHouseholdBudget(hidA)).toThrow(/上限/);
    // 家族に見せる文に額（ドル）は書かない（UX 2026-11-05）
    expect(() => checkHouseholdBudget(hidA)).toThrow(/^[^$]+$/);
    expect(() => checkHouseholdBudget(hidB)).not.toThrow();
    delete process.env.BOSHI_HOUSEHOLD_DAILY_USD;
  });

  it("世帯を消すと、健診の録音の置き場（files/<世帯>）も消える（監査 #2）", async () => {
    const carol = await signIn("carol-made@example.com");
    const hh = await import("@/app/api/household/route");
    const c = await json(await hh.POST(req("/api/household", { cookie: carol, body: { name: "作った世帯C" } })));
    const hidC = (c.body.household as { id: string }).id;
    const fam = await import("@/app/api/family/route");
    expect((await fam.POST(req("/api/family", { cookie: carol, body: { ...PROFILE, familyId: hidC } }))).status).toBe(200);
    const list = await import("@/app/api/visit/route");
    const chunk = await import("@/app/api/visit/[id]/chunk/route");
    const made = await json(await list.POST(req("/api/visit", { cookie: carol, body: { familyId: hidC, date: "2027-01-12" } })));
    const id = (made.body.visit as { id: string }).id;
    const up = new Request(`${BASE}/api/visit/${id}/chunk?seq=0&take=0&ext=webm`, {
      method: "POST",
      headers: { "content-type": "audio/webm", cookie: carol },
      body: new Uint8Array(2000),
    });
    expect((await chunk.POST(up, { params: Promise.resolve({ id }) })).status).toBe(200);
    const files = path.join(dir, "files", hidC.replace(/[^a-zA-Z0-9_-]/g, ""));
    expect(fs.existsSync(path.join(files, "visits", id))).toBe(true);
    await H.purgeHousehold(hidC, null);
    expect(fs.existsSync(files)).toBe(false);
  });
});

describe("アカウントの仕組みを動かす前（わが家の置き場・BOSHI_ACCOUNTS なし）は、今までどおり", () => {
  // DB の置き場（DATA_DIR）は読み込んだ時に決まるので、一時フォルダのまま「わが家の置き場」の扱いだけを試す
  let saved: string | undefined;
  beforeAll(() => {
    saved = process.env.BOSHI_DATA_DIR;
    delete process.env.BOSHI_DATA_DIR;
  });
  afterAll(() => {
    process.env.BOSHI_DATA_DIR = saved;
  });

  it("ログインなしで、見本の家族を今までどおり通す。世帯を作る道は 503", async () => {
    const { accountsOn } = await import("@/app/api/_lib/household");
    expect(accountsOn()).toBe(false);
    const done = await import("@/app/api/done/route");
    expect((await done.GET(req("/api/done?familyId=demo-sato"))).status).toBe(200);
    expect((await done.GET(req("/api/done?familyId=no-such"))).status).toBe(404);
    const fam = await import("@/app/api/family/route");
    const r = await json(await fam.GET(req("/api/family")));
    expect((r.body.families as { id: string }[]).map((f) => f.id)).toContain("demo-sato");
    expect(r.body.households).toBeUndefined();
    const hh = await import("@/app/api/household/route");
    expect((await hh.POST(req("/api/household", { body: {} }))).status).toBe(503);
  });
});
