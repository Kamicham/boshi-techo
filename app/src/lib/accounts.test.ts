// 家族ごとのアカウントの土台の試験: 世帯をまたいだ読み取りが 404・暗号の往復・置き場（local）の往復・
// forHousehold がほかの世帯の行を返さない。DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。
// 作った人・作ったメールだけを使う（本物の家族の情報は入れない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-accounts-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;

type DB = typeof import("./db");
type Crypto = typeof import("./crypto");
type Storage = typeof import("./storage");
type HH = typeof import("./households");
type Access = typeof import("./access");
type AuthMod = typeof import("./auth");
let D: DB, C: Crypto, S: Storage, H: HH, A: Access, AU: AuthMod;

beforeAll(async () => {
  D = await import("./db");
  C = await import("./crypto");
  S = await import("./storage");
  H = await import("./households");
  A = await import("./access");
  AU = await import("./auth");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// ───────── 暗号 ─────────

describe("世帯の鍵の暗号（AES-256-GCM）", () => {
  it("暗号にして戻すと同じ中身。aad・鍵が違えば解けない", () => {
    const key = C.createDek();
    const plain = Buffer.from("作った家族の写真のつもりのバイト列 🌸");
    const s = C.encrypt(key, plain, "media-1");
    expect(s.ciphertext.equals(plain)).toBe(false);
    expect(C.decrypt(key, s, "media-1").equals(plain)).toBe(true);
    expect(() => C.decrypt(key, s, "media-2")).toThrow();
    expect(() => C.decrypt(C.createDek(), s, "media-1")).toThrow();
    const bad = { ...s, ciphertext: Buffer.from(s.ciphertext) };
    bad.ciphertext[0] ^= 1;
    expect(() => C.decrypt(key, bad, "media-1")).toThrow();
  });

  it("DEK を KEK で包んで戻せる。ほかの世帯の id では解けない", () => {
    const dek = C.createDek();
    const w = C.wrapDek(dek, "hh-a");
    expect(w.startsWith("v1:")).toBe(true);
    expect(w).not.toContain(dek.toString("base64"));
    expect(C.unwrapDek(w, "hh-a").equals(dek)).toBe(true);
    expect(() => C.unwrapDek(w, "hh-b")).toThrow();
  });

  it("世帯の鍵で暗号・復号し、鍵を消すと読めなくなる", () => {
    H.ensureHousehold("hh-crypto", "real");
    const s = C.sealForHousehold("hh-crypto", Buffer.from("abc"), "m1");
    expect(C.openForHousehold("hh-crypto", s, "m1").toString()).toBe("abc");
    // ほかの世帯の鍵では解けない
    H.ensureHousehold("hh-crypto-2", "real");
    expect(() => C.openForHousehold("hh-crypto-2", s, "m1")).toThrow();
    C.destroyHouseholdKey("hh-crypto");
    expect(C.householdKey("hh-crypto")).toBeNull();
    expect(() => C.openForHousehold("hh-crypto", s, "m1")).toThrow();
  });
});

// ───────── 置き場 ─────────

describe("置き場（local）", () => {
  it("鍵の形: households/<hid>/<subject>/<kind>/<yyyy>/<id>[/<variant>]", () => {
    expect(S.mediaKey({ householdId: "hh1", subjectId: "sub1", kind: "photo", id: "m1", date: "2027-05-10T09:00:00Z" })).toBe(
      "households/hh1/sub1/photo/2027/m1",
    );
    expect(S.mediaKey({ householdId: "hh1", subjectId: null, kind: "scan", id: "m2", date: "2026-11-03", variant: "thumb" })).toBe(
      "households/hh1/shared/scan/2026/m2/thumb",
    );
    expect(S.exportKey("hh1", "2027-05-10")).toBe("households/hh1/export/2027-05-10.zip");
    expect(() => S.mediaKey({ householdId: "../x", subjectId: null, kind: "photo", id: "m" })).toThrow();
    expect(() => S.mediaKey({ householdId: "hh1", subjectId: "a/b", kind: "photo", id: "m" })).toThrow();
    expect(() => S.assertKey("households/hh1/../hh2/x")).toThrow();
    expect(() => S.assertKey("/etc/passwd")).toThrow();
  });

  it("置いて・読んで・一覧・まとめて消す（世帯の下だけ）", async () => {
    const st = S.localStorageDriver(dir);
    const k1 = S.mediaKey({ householdId: "hhA", subjectId: "s1", kind: "photo", id: "p1", date: "2027-01-01" });
    const k2 = S.mediaKey({ householdId: "hhA", subjectId: "s2", kind: "photo", id: "p2", date: "2027-01-01" });
    const kB = S.mediaKey({ householdId: "hhB", subjectId: "s1", kind: "photo", id: "p1", date: "2027-01-01" });
    await st.put(k1, Buffer.from("one"));
    await st.put(k2, Buffer.from("two"));
    await st.put(kB, Buffer.from("b"));
    expect((await st.get(k1))?.toString()).toBe("one");
    expect(await st.get(`${k1}x`)).toBeNull();
    expect(await st.exists(k2)).toBe(true);
    expect(fs.existsSync(path.join(dir, k1))).toBe(true);
    expect(await st.list(S.householdPrefix("hhA"))).toEqual([k1, k2].sort());
    // 本人ごとに消す
    await st.delete(S.subjectPrefix("hhA", "s1"));
    expect(await st.get(k1)).toBeNull();
    expect((await st.get(k2))?.toString()).toBe("two");
    // 世帯ごとに消しても、ほかの世帯（hhA と hhB）は残る。前だけ同じ id（hhAB）も消えない
    await st.put(S.mediaKey({ householdId: "hhAB", subjectId: null, kind: "photo", id: "x" }), Buffer.from("x"));
    await st.delete(S.householdPrefix("hhA"));
    expect(await st.list(S.householdPrefix("hhA"))).toEqual([]);
    expect((await st.get(kB))?.toString()).toBe("b");
    expect((await st.list(S.householdPrefix("hhAB"))).length).toBe(1);
    await expect(st.put("households/../../escape", Buffer.from("x"))).rejects.toThrow();
  });

  it("期限つきの URL: 書き換え・期限切れを通さない", async () => {
    const st = S.localStorageDriver(dir);
    const key = S.mediaKey({ householdId: "hhA", subjectId: "s1", kind: "photo", id: "p9" });
    const url = await st.signedUrl(key, 300);
    expect(S.verifySignedPath(url)).toBe(true);
    expect(S.keyFromSignedUrl(url)).toBe(key);
    const other = url.replace(/k=[^&]+/, `k=${Buffer.from(S.mediaKey({ householdId: "hhB", subjectId: "s1", kind: "photo", id: "p9" })).toString("base64url")}`);
    expect(S.verifySignedPath(other)).toBe(false);
    expect(S.verifySignedPath(url, Date.now() + 301_000)).toBe(false);
    const p = S.signPath("/api/media/abc?v=thumb", 60);
    expect(S.verifySignedPath(p)).toBe(true);
    expect(S.verifySignedPath(p.replace("v=thumb", "v=orig"))).toBe(false);
  });

  it("s3 の署名つき URL が AWS の資料の見本と同じ署名になる（SigV4 の確かめ）", () => {
    // https://docs.aws.amazon.com/AmazonS3/latest/API/sigv4-query-string-auth.html の見本の値（公開の見本の鍵）
    const url = S.s3PresignGet(
      {
        endpoint: "https://s3.amazonaws.com",
        region: "us-east-1",
        bucket: "examplebucket",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        pathStyle: false,
      },
      "test.txt",
      86400,
      new Date("2013-05-24T00:00:00Z"),
    );
    expect(url.startsWith("https://examplebucket.s3.amazonaws.com/test.txt?")).toBe(true);
    expect(url).toContain("X-Amz-Signature=aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404");
  });
});

// ───────── forHousehold ─────────

describe("forHousehold はほかの世帯の行を返さない", () => {
  it("記録（docs）: 読む・一覧・書く・直す・消すのどれも、ほかの世帯には届かない", () => {
    const a = D.forHousehold("fam-a");
    const b = D.forHousehold("fam-b");
    const doc = a.put("record", { text: "A の記録" }, { id: "rec-1", date: "2027-01-01" });
    expect(doc.familyId).toBe("fam-a");
    expect(a.get("rec-1")?.data).toEqual({ text: "A の記録" });
    expect(b.get("rec-1")).toBeNull();
    expect(b.list("record")).toEqual([]);
    expect(b.patch("rec-1", { text: "書き換え" })).toBeNull();
    expect(b.remove("rec-1")).toBe(false);
    expect(() => b.put("record", { text: "乗っ取り" }, { id: "rec-1" })).toThrow(/見つかりません/);
    expect(a.get("rec-1")?.data).toEqual({ text: "A の記録" });
    expect(a.list("record").map((d) => d.id)).toEqual(["rec-1"]);
    expect(a.remove("rec-1")).toBe(true);
    expect(a.get("rec-1")).toBeNull();
  });

  it("本人で絞ると、見てよい本人と世帯全体の記録だけ", () => {
    const full = D.forHousehold("fam-c");
    full.put("record", { t: "母" }, { id: "c-m", subjectId: "sub-mother" });
    full.put("record", { t: "子" }, { id: "c-c", subjectId: "sub-child" });
    full.put("record", { t: "世帯" }, { id: "c-h" });
    const childOnly = D.forHousehold("fam-c", { visibleSubjects: ["sub-child"] });
    expect(childOnly.list("record").map((d) => d.id).sort()).toEqual(["c-c", "c-h"]);
    expect(childOnly.get("c-m")).toBeNull();
    expect(() => childOnly.put("record", { t: "x" }, { id: "c-m" })).toThrow();
    expect(full.list("record", { subjectId: "sub-mother" }).map((d) => d.id)).toEqual(["c-m"]);
    expect(full.list("record", { subjectId: null }).map((d) => d.id)).toEqual(["c-h"]);
  });

  it("写真の台帳（media）も、ほかの世帯からは見えない", () => {
    const a = D.forHousehold("fam-a");
    const b = D.forHousehold("fam-b");
    const key = S.mediaKey({ householdId: "fam-a", subjectId: "s1", kind: "photo", id: "md-1", date: "2027-02-01" });
    const m = a.media.insert({ id: "md-1", subjectId: "s1", kind: "photo", storageKey: key, mime: "image/jpeg", bytes: 3, sha256: "abc", data: { star: [] } });
    expect(m.householdId).toBe("fam-a");
    expect(b.media.get("md-1")).toBeNull();
    expect(b.media.list()).toEqual([]);
    expect(b.media.findBySha("abc")).toBeNull();
    expect(b.media.patch("md-1", { trashedAt: "2027-01-01" })).toBeNull();
    expect(b.media.remove("md-1")).toBe(false);
    expect(() => b.media.insert({ subjectId: null, kind: "photo", storageKey: key, mime: "image/jpeg", bytes: 1 })).toThrow();
    expect(a.media.findBySha("abc")?.id).toBe("md-1");
    // ゴミ箱に入れると一覧から消え、includeTrashed で見える
    a.media.patch("md-1", { trashedAt: new Date().toISOString(), data: { hidden: true } });
    expect(a.media.list()).toEqual([]);
    expect(a.media.get("md-1", { includeTrashed: true })?.data).toEqual({ star: [], hidden: true });
  });

  it("今の get/list（健診の録音が使う）は今のまま動く", () => {
    const doc = D.put("fam-old", "visit", { a: 1 }, { id: "visit-old" });
    expect(D.get("visit-old")?.data).toEqual({ a: 1 });
    expect(D.list("fam-old", "visit").length).toBe(1);
    expect(D.patch("visit-old", { a: 2 })?.data).toEqual({ a: 2 });
    D.remove(doc.id);
    expect(D.get("visit-old")).toBeNull();
  });
});

// ───────── 関所（Better Auth のログインから） ─────────

const BASE = "http://localhost:3000";
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");

async function call(p: string, body: unknown, cookie?: string): Promise<Response> {
  const auth = await AU.authReady();
  return auth.handler(
    new Request(`${BASE}/api/auth${p}`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    }),
  );
}

/** メールのコードで入って、クッキーを返す（コードは送り手の差し口で受け取る） */
async function signIn(email: string): Promise<string> {
  const sent: string[] = [];
  AU.setMailSender(async (m) => void sent.push(m.text));
  const r1 = await call("/email-otp/send-verification-otp", { email, type: "sign-in" });
  expect(r1.status).toBe(200);
  await new Promise((r) => setTimeout(r, 10));
  const otp = /コード: (\d{6})/.exec(sent.at(-1) ?? "")?.[1];
  expect(otp).toBeTruthy();
  const r2 = await call("/sign-in/email-otp", { email, otp });
  expect(r2.status).toBe(200);
  AU.setMailSender(null);
  return cookieOf(r2);
}

async function createHousehold(cookie: string, name: string, slug: string): Promise<string> {
  const r = await call("/organization/create", { name, slug }, cookie);
  expect(r.status).toBe(200);
  return ((await r.json()) as { id: string }).id;
}

const req = (cookie?: string) => new Request(`${BASE}/api/x`, { headers: cookie ? { cookie } : {} });

describe("withHousehold（セッション → 世帯 → 権限）", () => {
  let aliceCookie = "";
  let bobCookie = "";
  let hidA = "";
  let hidB = "";

  beforeAll(async () => {
    aliceCookie = await signIn("alice@example.com");
    bobCookie = await signIn("bob@example.com");
    hidA = await createHousehold(aliceCookie, "作った世帯A", "made-a");
    hidB = await createHousehold(bobCookie, "作った世帯B", "made-b");
  });

  it("世帯を作ると、世帯の行（real）と世帯の鍵ができる", () => {
    expect(H.getHousehold(hidA)?.kind).toBe("real");
    expect(C.householdKey(hidA)).not.toBeNull();
  });

  it("自分の世帯は通る。他人の世帯は 404、ログインなしは 401", async () => {
    const ctx = await A.withHousehold(req(aliceCookie), hidA, "record:write");
    expect(ctx.role).toBe("owner");
    expect(ctx.account?.email).toBe("alice@example.com");
    ctx.db.put("record", { t: "A の記録" }, { id: "a-rec" });

    await expect(A.withHousehold(req(aliceCookie), hidB, "record:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(bobCookie), hidA, "record:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(), hidA, "record:read")).rejects.toMatchObject({ status: 401 });
    await expect(A.withHousehold(req(aliceCookie), "no-such-household", "record:read")).rejects.toMatchObject({ status: 404 });
    await expect(A.withHousehold(req(aliceCookie), undefined, "record:read")).rejects.toMatchObject({ status: 404 });

    const ctxB = await A.withHousehold(req(bobCookie), hidB, "record:read");
    expect(ctxB.db.get("a-rec")).toBeNull();
    expect(ctxB.db.list("record")).toEqual([]);
  });

  it("見本の家族（demo-sato）はログインなしで通る。世帯を消す権限は無い", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", ["record:read", "record:write"]);
    expect(ctx.role).toBe("guest");
    expect(ctx.household.kind).toBe("demo");
    expect(ctx.family?.id).toBe("demo-sato");
    await expect(A.withHousehold(req(), "demo-sato", "household:delete")).rejects.toMatchObject({ status: 403 });
    // シミュレーションのサーバでない時、作った30家族は公開にならない
    expect(A.publicHouseholdKind("sim-01")).toBeNull();
  });

  it("member（読むだけ）は書けず、見える本人は自分・代理・子だけ", async () => {
    const mother = H.addSubject(hidA, { kind: "mother", name: "作った母" });
    const child = H.addSubject(hidA, { kind: "child", name: "作った子" });
    const ownerCtx = await A.withHousehold(req(aliceCookie), hidA, "record:write");
    ownerCtx.db.put("record", { t: "母の記録" }, { id: "a-mother", subjectId: mother.id });
    ownerCtx.db.put("record", { t: "子の記録" }, { id: "a-child", subjectId: child.id });

    // bob を世帯A に member として入れる（招待 → 受ける）
    const inv = await call("/organization/invite-member", { email: "bob@example.com", role: "member", organizationId: hidA }, aliceCookie);
    expect(inv.status).toBe(200);
    const invitationId = ((await inv.json()) as { id: string }).id;
    const acc = await call("/organization/accept-invitation", { invitationId }, bobCookie);
    // メールの確かめが済んだ人だけが受けられる（コードで入った人は確かめ済み）
    expect(acc.status).toBe(200);

    const ctx = await A.withHousehold(req(bobCookie), hidA, "record:read");
    expect(ctx.role).toBe("member");
    expect(ctx.subjects.map((s) => s.id)).toEqual([child.id]);
    expect(ctx.db.get("a-child")).not.toBeNull();
    expect(ctx.db.get("a-mother")).toBeNull();
    expect(ctx.db.get("a-rec")).not.toBeNull(); // 本人の無い記録は世帯全体の物
    await expect(A.withHousehold(req(bobCookie), hidA, "record:write")).rejects.toMatchObject({ status: 403 });

    // 母が任意代理を許すと、母の記録も見える
    H.setProxy(hidA, { accountId: ctx.account!.id, subjectId: mother.id, basis: "voluntary" });
    const ctx2 = await A.withHousehold(req(bobCookie), hidA, "record:read");
    expect(ctx2.db.get("a-mother")).not.toBeNull();

    expect(A.myHouseholds(ctx.account!.id).map((h) => h.id).sort()).toEqual([hidA, hidB].sort());
  });

  it("同意: 本人ごとに入れて・撤回でき、履歴が残る", () => {
    const s = H.addSubject(hidB, { kind: "mother", name: "作った母B" });
    expect(H.allConsented(hidB, [s.id], "claude_us")).toBe(false);
    H.grantConsent(hidB, s.id, "claude_us", "2026-11-03", null);
    expect(H.allConsented(hidB, [s.id], "claude_us")).toBe(true);
    expect(H.activeConsent(hidB, s.id, "claude_us", "2027-01-01")).toBeNull(); // 新しい版の同意が要る
    expect(H.revokeConsent(hidB, s.id, "claude_us")).toBe(1);
    expect(H.allConsented(hidB, [s.id], "claude_us")).toBe(false);
    expect(H.consentHistory(hidB, s.id).length).toBe(1);
    // ほかの世帯の本人には同意を入れられない
    expect(() => H.grantConsent(hidA, s.id, "record", "v1", null)).toThrow();
  });

  it("世帯を消すと、記録・ファイル・鍵がまとめて消える", async () => {
    const ctx = await A.withHousehold(req(bobCookie), hidB, "media:write");
    const key = S.mediaKey({ householdId: hidB, subjectId: null, kind: "photo", id: "pb" });
    const sealed = C.sealForHousehold(hidB, Buffer.from("photo"), "pb");
    await ctx.storage.put(key, sealed.ciphertext);
    ctx.db.media.insert({ id: "pb", subjectId: null, kind: "photo", storageKey: key, mime: "image/jpeg", bytes: 5, iv: sealed.iv, tag: sealed.tag });
    ctx.db.put("record", { t: "B" }, { id: "b-rec" });
    expect(C.openForHousehold(hidB, { ...sealed, ciphertext: (await ctx.storage.get(key))! }, "pb").toString()).toBe("photo");

    const r = await call("/organization/delete", { organizationId: hidB }, bobCookie);
    expect(r.status).toBe(200);
    expect(await ctx.storage.get(key)).toBeNull();
    expect(C.householdKey(hidB)).toBeNull();
    expect(H.getHousehold(hidB)).toBeNull();
    expect(D.get("b-rec")).toBeNull();
    await expect(A.withHousehold(req(bobCookie), hidB, "record:read")).rejects.toMatchObject({ status: 404 });
  });
});
