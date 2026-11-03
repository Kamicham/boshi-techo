// アカウントの画面の API の試験: 世帯を作る → 同意 → 撤回 → 招待 → 受ける（範囲どおりの代理の印）→ 書き出し（zip）→ 本人を消す → 世帯を消す。
// DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。作った人・作ったメールだけを使う。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { inflateRawSync, crc32 } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
// nextCookies は Next の処理の外では使えないので、試験では何もしない物に替える
vi.mock("better-auth/next-js", () => ({ nextCookies: () => ({ id: "next-cookies" }) }));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-account-api-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;

const BASE = "http://localhost:3000";
type AuthMod = typeof import("@/lib/auth");
let AU: AuthMod;
beforeAll(async () => {
  AU = await import("@/lib/auth");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

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
  expect((await authCall("/email-otp/send-verification-otp", { email, type: "sign-in" })).status).toBe(200);
  await new Promise((r) => setTimeout(r, 10));
  const otp = /コード: (\d{6})/.exec(sent.at(-1) ?? "")?.[1];
  const r = await authCall("/sign-in/email-otp", { email, otp });
  expect(r.status).toBe(200);
  AU.setMailSender(null);
  return cookieOf(r);
}

/** route の関数を、クッキーつきの Request で呼ぶ */
function rq(url: string, cookie: string | undefined, method = "GET", body?: unknown): Request {
  return new Request(`${BASE}${url}`, {
    method,
    headers: { origin: BASE, ...(cookie ? { cookie } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}) },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}
async function json<T = Record<string, unknown>>(p: Promise<Response>): Promise<{ status: number; body: T }> {
  const r = await p;
  return { status: r.status, body: (await r.json()) as T };
}

/** 試験の中だけの小さな zip の読み手（目次から名前と中身を取り出す） */
function unzip(buf: Buffer): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const n = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < n; i++) {
    const method = buf.readUInt16LE(p + 10);
    const crc = buf.readUInt32LE(p + 16);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30);
    const comment = buf.readUInt16LE(p + 32);
    const off = buf.readUInt32LE(p + 42);
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8");
    const lName = buf.readUInt16LE(off + 26);
    const lExtra = buf.readUInt16LE(off + 28);
    const data = buf.subarray(off + 30 + lName + lExtra, off + 30 + lName + lExtra + size);
    const plain = method === 8 ? inflateRawSync(data) : Buffer.from(data);
    expect(crc32(plain) >>> 0).toBe(crc);
    out.set(name, plain);
    p += 46 + nameLen + extra + comment;
  }
  return out;
}

describe("zip の書き手", () => {
  it("日本語の名前・縮む物・縮まない物を入れて、取り出すと同じ中身", async () => {
    const { zip } = await import("../export/zip");
    const rand = Buffer.from(Array.from({ length: 2000 }, (_, i) => (i * 7919) % 251));
    const z = zip([
      { name: "はじめに.txt", data: "母子手帳の書き出し\n".repeat(50) },
      { name: "写真と録音/photo/a.jpg", data: rand },
      { name: "はじめに.txt", data: "同じ名前" },
    ]);
    const m = unzip(z);
    expect(m.get("はじめに.txt")?.toString()).toBe("母子手帳の書き出し\n".repeat(50));
    expect(m.get("写真と録音/photo/a.jpg")?.equals(rand)).toBe(true);
    expect(m.get("はじめに-2.txt")?.toString()).toBe("同じ名前");
  });
  it("CSV の欄を囲む", async () => {
    const { csvCell } = await import("../export/zip");
    expect(csvCell('a,"b"')).toBe('"a,""b"""');
    expect(csvCell({ x: 1 })).toBe('"{""x"":1}"');
    expect(csvCell(null)).toBe("");
  });
});

describe("アカウントの画面の API", () => {
  let mom = "";
  let grandma = "";
  let stranger = "";
  let hid = "";

  it("ログインしていない人の /api/account は公開の家族（デモ）だけ", async () => {
    const A = await import("./route");
    const r = await json<{ enabled: boolean; account: null; families: { id: string }[]; households: unknown[] }>(A.GET(rq("/api/account", undefined)));
    expect(r.status).toBe(200);
    expect(r.body.enabled).toBe(true);
    expect(r.body.account).toBeNull();
    expect(r.body.households).toEqual([]);
    expect(r.body.families.map((f) => f.id)).toEqual(["demo-sato"]);
  });

  it("世帯を作ると、本人（母・子）ができ、一覧に出る。記録の同意はまだ", async () => {
    mom = await signIn("mom@example.com");
    const H = await import("./household/route");
    const c = await json<{ householdId: string }>(H.POST(rq("/api/account/household", mom, "POST", { name: "作った家", me: "mother", motherName: "はな", childName: "そら" })));
    expect(c.status).toBe(200);
    hid = c.body.householdId;
    const A = await import("./route");
    const l = await json<{ households: { id: string; role: string; needsRecordConsent: boolean; hasProfile: boolean }[] }>(A.GET(rq("/api/account", mom)));
    expect(l.body.households).toMatchObject([{ id: hid, role: "owner", needsRecordConsent: true, hasProfile: false }]);
    const d = await json<{ subjects: { kind: string; mine: boolean; canConsent: boolean }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    expect(d.body.subjects.map((s) => [s.kind, s.mine, s.canConsent])).toEqual([
      ["mother", true, true],
      ["child", false, true],
    ]);
  });

  it("家族の設定を保存すると、families に入る", async () => {
    const P = await import("./profile/route");
    const r = await json<{ family: { id: string; city: string } }>(
      P.POST(rq("/api/account/profile", mom, "POST", { familyId: hid, dueDate: "2027-03-01", city: "上牧町", prefecture: "奈良県", members: [{ id: "m0", name: "はな", role: "母" }] })),
    );
    expect(r.status).toBe(200);
    expect(r.body.family).toMatchObject({ id: hid, city: "上牧町" });
    const A = await import("./route");
    const l = await json<{ families: { id: string }[]; kinds: Record<string, string> }>(A.GET(rq("/api/account", mom)));
    expect(l.body.families.map((f) => f.id)).toEqual([hid, "demo-sato"]);
    expect(l.body.kinds[hid]).toBe("real");
  });

  it("同意して、撤回できる（履歴に残る）", async () => {
    const H = await import("./household/route");
    const C = await import("./consent/route");
    const d = await json<{ subjects: { id: string }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    const ids = d.body.subjects.map((s) => s.id);
    expect((await C.POST(rq("/api/account/consent", mom, "POST", { familyId: hid, kind: "record", subjectIds: ids }))).status).toBe(200);
    expect((await C.POST(rq("/api/account/consent", mom, "POST", { familyId: hid, kind: "claude_us", subjectIds: ids }))).status).toBe(200);
    expect((await C.DELETE(rq("/api/account/consent", mom, "DELETE", { familyId: hid, kind: "claude_us", subjectIds: [ids[0]] }))).status).toBe(200);
    const d2 = await json<{ subjects: { record: unknown; claude: unknown }[]; history: { revokedAt: string | null }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    expect(d2.body.subjects.map((s) => [!!s.record, !!s.claude])).toEqual([
      [true, false],
      [true, true],
    ]);
    expect(d2.body.history.length).toBe(4);
    expect(d2.body.history.filter((h) => h.revokedAt).length).toBe(1);
  });

  it("ほかの人は、この世帯を見る・同意する・書き出す・消すができない（404）", async () => {
    stranger = await signIn("stranger@example.com");
    const H = await import("./household/route");
    const C = await import("./consent/route");
    const E = await import("../export/route");
    expect((await H.GET(rq(`/api/account/household?familyId=${hid}`, stranger))).status).toBe(404);
    expect((await C.POST(rq("/api/account/consent", stranger, "POST", { familyId: hid, kind: "record", subjectIds: ["x"] }))).status).toBe(404);
    expect((await E.GET(rq(`/api/export?familyId=${hid}`, stranger))).status).toBe(404);
    expect((await H.DELETE(rq("/api/account/household", stranger, "DELETE", { familyId: hid, confirm: "消す" }))).status).toBe(404);
    expect((await H.GET(rq(`/api/account/household?familyId=${hid}`, undefined))).status).toBe(401);
  });

  it("祖父母を招いて受けると、読むだけの役になり、母が選んだ項目の代理の印が付く", async () => {
    const I = await import("./invite/route");
    const AC = await import("./invite/accept/route");
    const inv = await json<{ id: string; link: string }>(
      I.POST(rq("/api/account/invite", mom, "POST", { familyId: hid, email: "grandma@example.com", role: "member", relation: "祖父母", showMother: ["visit", "bogus"] })),
    );
    expect(inv.status).toBe(200);
    expect(inv.body.link).toBe(`/invite/${inv.body.id}`);
    // 別のメールの人は受けられない
    expect((await AC.POST(rq("/api/account/invite/accept", stranger, "POST", { invitationId: inv.body.id }))).status).toBeGreaterThanOrEqual(400);
    grandma = await signIn("grandma@example.com");
    const g = await json<{ relation: string; showMother: string[]; role: string }>(I.GET(rq(`/api/account/invite?id=${inv.body.id}`, grandma)));
    expect(g.body).toMatchObject({ relation: "祖父母", showMother: ["visit"], role: "member" });
    const a = await json<{ householdId: string }>(AC.POST(rq("/api/account/invite/accept", grandma, "POST", { invitationId: inv.body.id })));
    expect(a.status).toBe(200);
    expect(a.body.householdId).toBe(hid);
    const H = await import("./household/route");
    const d = await json<{ role: string; subjects: { kind: string; canConsent: boolean }[]; proxies: { scope: string[] }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, grandma)));
    expect(d.body.role).toBe("member");
    // 母の任意代理の印があるので、母も見える。同意は押せない（本人と管理の人だけ）
    expect(d.body.subjects.map((s) => [s.kind, s.canConsent])).toEqual([
      ["mother", false],
      ["child", false],
    ]);
    expect(d.body.proxies).toMatchObject([{ scope: ["visit"] }]);
    // 読むだけの人は招待できない・世帯を消せない
    expect((await I.POST(rq("/api/account/invite", grandma, "POST", { familyId: hid, email: "x@example.com" }))).status).toBe(403);
    expect((await H.DELETE(rq("/api/account/household", grandma, "DELETE", { familyId: hid, confirm: "消す" }))).status).toBe(403);
  });

  it("母でない人が招く時は、母の項目を見せられない", async () => {
    // 祖父母は管理の人ではないので 403。持ち主が母でない世帯を作って確かめる
    const papa = await signIn("papa@example.com");
    const H = await import("./household/route");
    const I = await import("./invite/route");
    const c = await json<{ householdId: string }>(H.POST(rq("/api/account/household", papa, "POST", { me: "partner", partnerName: "たろう" })));
    const r = await I.POST(rq("/api/account/invite", papa, "POST", { familyId: c.body.householdId, email: "gp@example.com", role: "member", relation: "祖父母", showMother: ["photo"] }));
    expect(r.status).toBe(403);
  });

  it("書き出しは zip で、記録と同意の履歴が入る", async () => {
    const E = await import("../export/route");
    const r = await E.GET(rq(`/api/export?familyId=${hid}`, mom));
    expect(r.status).toBe(200);
    expect(r.headers.get("content-type")).toBe("application/zip");
    const m = unzip(Buffer.from(await r.arrayBuffer()));
    expect([...m.keys()]).toEqual(expect.arrayContaining(["はじめに.txt", "記録/records.json", "記録/records.csv", "同意の履歴.json", "家族の設定.json", "本人.json"]));
    const docs = JSON.parse(m.get("記録/records.json")!.toString()) as { type: string }[];
    expect(docs.some((d) => d.type === "profile")).toBe(true);
    expect(JSON.parse(m.get("同意の履歴.json")!.toString()).length).toBe(4);
  });

  it("祖父母は、自分の分でない本人を消せない。持ち主は「消す」と入れれば本人の分を消せる", async () => {
    const H = await import("./household/route");
    const S = await import("./subject/route");
    const d = await json<{ subjects: { id: string; kind: string }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    const child = d.body.subjects.find((s) => s.kind === "child")!;
    expect((await S.DELETE(rq("/api/account/subject", grandma, "DELETE", { familyId: hid, subjectId: child.id, confirm: "消す" }))).status).toBe(403);
    expect((await S.DELETE(rq("/api/account/subject", mom, "DELETE", { familyId: hid, subjectId: child.id, confirm: "けす" }))).status).toBe(400);
    expect((await S.DELETE(rq("/api/account/subject", mom, "DELETE", { familyId: hid, subjectId: child.id, confirm: "消す" }))).status).toBe(200);
    const d2 = await json<{ subjects: { kind: string }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    expect(d2.body.subjects.map((s) => s.kind)).toEqual(["mother"]);
  });

  it("持ち主が世帯を消すと、一覧から消え、もう開けない", async () => {
    const H = await import("./household/route");
    const A = await import("./route");
    expect((await H.DELETE(rq("/api/account/household", mom, "DELETE", { familyId: hid, confirm: "消す" }))).status).toBe(200);
    const l = await json<{ households: unknown[]; families: { id: string }[] }>(A.GET(rq("/api/account", mom)));
    expect(l.body.households).toEqual([]);
    expect(l.body.families.map((f) => f.id)).toEqual(["demo-sato"]);
    expect((await H.GET(rq(`/api/account/household?familyId=${hid}`, mom))).status).toBe(404);
    expect((await H.GET(rq(`/api/account/household?familyId=${hid}`, grandma))).status).toBe(404);
  });

  it("デモの家族は、ログインなしで同意の画面を試せる（本人は家族の設定から作る）。消す・招くはできない", async () => {
    const H = await import("./household/route");
    const C = await import("./consent/route");
    const d = await json<{ role: string; subjects: { id: string; kind: string; canConsent: boolean }[] }>(H.GET(rq("/api/account/household?familyId=demo-sato", undefined)));
    expect(d.status).toBe(200);
    expect(d.body.role).toBe("guest");
    expect(d.body.subjects.some((s) => s.kind === "mother")).toBe(true);
    expect(d.body.subjects.every((s) => s.canConsent)).toBe(true);
    expect((await C.POST(rq("/api/account/consent", undefined, "POST", { familyId: "demo-sato", kind: "record", subjectIds: [d.body.subjects[0].id] }))).status).toBe(200);
    expect((await H.DELETE(rq("/api/account/household", undefined, "DELETE", { familyId: "demo-sato", confirm: "消す" }))).status).toBe(403);
  });
});
