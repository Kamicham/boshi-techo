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

  it("子どもから見た呼び名を保存して読み直せる。入れていない人（11/4 までの画面から送った形）は今までの形のまま", async () => {
    const P = await import("./profile/route");
    const { getFamily } = await import("@/lib/family");
    const base = { familyId: hid, dueDate: "2027-03-01", city: "上牧町", prefecture: "奈良県" };
    const r = await json<{ family: { members: unknown[] } }>(
      P.POST(rq("/api/account/profile", mom, "POST", { ...base, members: [{ id: "m0", name: "はな", role: "母", callName: " かあちゃん " }, { id: "m1", name: "たろう", role: "パートナー" }] })),
    );
    expect(r.status).toBe(200);
    const want = [{ id: "m0", name: "はな", role: "母", callName: "かあちゃん" }, { id: "m1", name: "たろう", role: "パートナー" }];
    expect(r.body.family.members).toEqual(want);
    expect(getFamily(hid)!.members).toEqual(want);
    // 11/4 までの画面は呼び名の欄を送らない: そのまま保存でき、呼び名の欄は付かない
    const o = await json<{ family: { members: unknown[] } }>(P.POST(rq("/api/account/profile", mom, "POST", { ...base, members: [{ id: "m0", name: "はな", role: "母" }] })));
    expect(o.status).toBe(200);
    expect(o.body.family.members).toEqual([{ id: "m0", name: "はな", role: "母" }]);
    expect(getFamily(hid)!.members).toEqual([{ id: "m0", name: "はな", role: "母" }]);
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

  it("母の分の同意は母本人だけ: パートナーは押せず、ママを招くと母として入り、ママ本人が押す", async () => {
    const papa2 = await signIn("papa2@example.com");
    const H = await import("./household/route");
    const I = await import("./invite/route");
    const AC = await import("./invite/accept/route");
    const C = await import("./consent/route");
    const c = await json<{ householdId: string }>(H.POST(rq("/api/account/household", papa2, "POST", { me: "partner", partnerName: "たろう" })));
    const h2 = c.body.householdId;
    const d = await json<{ subjects: { id: string; kind: string; canConsent: boolean }[] }>(H.GET(rq(`/api/account/household?familyId=${h2}`, papa2)));
    const by = (k: string) => d.body.subjects.find((s) => s.kind === k)!;
    expect(by("mother").canConsent).toBe(false);
    expect(by("child").canConsent).toBe(true);
    expect((await C.POST(rq("/api/account/consent", papa2, "POST", { familyId: h2, kind: "claude_us", subjectIds: [by("mother").id] }))).status).toBe(403);
    expect((await C.POST(rq("/api/account/consent", papa2, "POST", { familyId: h2, kind: "claude_us", subjectIds: [by("partner").id, by("child").id] }))).status).toBe(200);
    // 母の分が空いているので、Claude に送る前の確かめは「ママを待っている」
    expect((await json<{ claude: string }>(C.GET(rq(`/api/account/consent?familyId=${h2}`, papa2)))).body.claude).toBe("mother");
    // ママを招く（共同の管理）。受けると母の本人に結びつき、ママ本人が押せる
    const inv = await json<{ id: string }>(I.POST(rq("/api/account/invite", papa2, "POST", { familyId: h2, email: "mama2@example.com", relation: "ママ" })));
    expect(inv.status).toBe(200);
    const mama2 = await signIn("mama2@example.com");
    expect((await AC.POST(rq("/api/account/invite/accept", mama2, "POST", { invitationId: inv.body.id }))).status).toBe(200);
    const m = await json<{ subjects: { id: string; kind: string; mine: boolean; canConsent: boolean }[] }>(H.GET(rq(`/api/account/household?familyId=${h2}`, mama2)));
    expect(m.body.subjects.find((s) => s.kind === "mother")).toMatchObject({ mine: true, canConsent: true });
    expect((await C.POST(rq("/api/account/consent", mama2, "POST", { familyId: h2, kind: "claude_us", subjectIds: [by("mother").id] }))).status).toBe(200);
    expect((await json<{ claude: string }>(C.GET(rq(`/api/account/consent?familyId=${h2}`, papa2)))).body.claude).toBe("ok");
    // ママがもう入っているので、2人目のママは招けない
    expect((await I.POST(rq("/api/account/invite", papa2, "POST", { familyId: h2, email: "x2@example.com", relation: "ママ" }))).status).toBe(400);
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

  it("書き出しに、写真・声・映画の原本が入る（画面と同じ置き場から読む。11/3 の版で置いた形の写真も）", async () => {
    const A = await import("@/lib/access");
    const M = await import("@/lib/media");
    const F = await import("@/lib/film-render");
    const { sealForHousehold } = await import("@/lib/crypto");
    const { mediaKey } = await import("@/lib/storage");
    const ctx = await A.withHousehold(rq(`/api/media?familyId=${hid}`, mom), hid, "media:write");
    // 作ったバイト列だけ（本物の写真・声ではない）。写真は位置の情報の無い小さな JPEG の形
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 30, 0, 40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0xff, 0xd9]);
    const photo = await M.saveUpload(ctx, { orig: jpeg, view: jpeg, thumb: jpeg });
    const wav = Buffer.alloc(44 + 4000, 128);
    wav.write("RIFF", 0);
    wav.writeUInt32LE(36 + 4000, 4);
    wav.write("WAVEfmt ", 8);
    wav.writeUInt32LE(16, 16);
    wav.writeUInt16LE(1, 20);
    wav.writeUInt16LE(1, 22);
    wav.writeUInt32LE(8000, 24);
    wav.writeUInt32LE(8000, 28);
    wav.writeUInt16LE(1, 32);
    wav.writeUInt16LE(8, 34);
    wav.write("data", 36);
    wav.writeUInt32LE(4000, 40);
    const voice = await M.saveAudio(ctx, { audio: wav, moment: "belly", who: "はな" });
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42 made-film-bytes-for-test")]);
    const film = await F.saveFilmVideo(ctx, mp4, { key: "export-test", title: "試しの映画", durationSec: 3, date: "2027-03-10" });
    // 11/3 の版の形: 原本だけ（画面用・一覧用・幅と高さ・from が無い）。置き場と印は今と同じ「鍵/orig」「id:orig」
    const oldId = "old-0000-photo";
    const oldPlain = Buffer.concat([jpeg.subarray(0, 4), Buffer.from("old-version-bytes"), jpeg.subarray(4)]);
    const oldKey = mediaKey({ householdId: hid, subjectId: null, kind: "photo", id: oldId, date: "2026-11-03" });
    const s = sealForHousehold(hid, oldPlain, `${oldId}:orig`);
    await ctx.storage.put(`${oldKey}/orig`, s.ciphertext, { contentType: "application/octet-stream" });
    ctx.db.media.insert({
      id: oldId, subjectId: null, kind: "photo", storageKey: oldKey, mime: "image/jpeg", bytes: oldPlain.length, iv: s.iv, tag: s.tag,
      takenAt: "2026-11-03T09:00:00", takenAtFrom: "upload", sha256: "old-sha",
      data: { links: {}, shareWithClaude: false, variants: { orig: { iv: s.iv, tag: s.tag, bytes: oldPlain.length, mime: "image/jpeg" } } },
    });

    const E = await import("../export/route");
    const r = await E.GET(rq(`/api/export?familyId=${hid}`, mom));
    expect(r.status).toBe(200);
    const m = unzip(Buffer.from(await r.arrayBuffer()));
    const file = (id: string) => [...m.keys()].find((k) => k.startsWith("写真と録音/") && k.includes(id));
    const origOf = async (row: Parameters<typeof M.readVariant>[1]) => (await M.readVariant(ctx, row, "orig"))!.buf;
    expect(m.get(file(photo.media.id)!)).toEqual(await origOf(photo.media));
    expect(file(photo.media.id)).toMatch(/\.jpg$/);
    expect(m.get(file(voice.media.id)!)).toEqual(wav);
    expect(file(voice.media.id)).toMatch(/^写真と録音\/audio\/.+\.wav$/);
    expect(m.get(file(film.id)!)).toEqual(mp4);
    expect(m.get(file(oldId)!)).toEqual(oldPlain);
    const readme = m.get("はじめに.txt")!.toString();
    expect(readme).not.toContain("読めなかった");
    expect(readme).toContain("原本（暗号を解いた物）4件");
    expect(readme).toContain("未来の手紙は、この書き出しに入りません");
    expect(JSON.parse(m.get("写真と録音/一覧.json")!.toString())).toHaveLength(4);
  });

  it("読むだけの人（祖父母）の手帳の一覧と書き出しに、ママの記録は出ない（代理の印でママが見えていても。子の手帳の記録と子の写真だけ）", async () => {
    const T = await import("../techo/route");
    const E = await import("../export/route");
    const H = await import("./household/route");
    const A = await import("@/lib/access");
    const M = await import("@/lib/media");
    const { addTecho } = await import("@/lib/techo-store");
    const today = "2027-06-01";
    // 作った記録（値は見本）。ママの頁・家で測った物・妊娠中の RS・お産のしかたと、子の記録
    const add = await json<{ techo: unknown[] }>(
      T.POST(
        rq("/api/techo", mom, "POST", {
          familyId: hid,
          today,
          action: "add",
          entries: [
            { page: "pregnancy-checkup", date: "2026-12-01", title: "妊婦健診", values: { weightKg: 55.2, bpHigh: 112 } },
            { page: "home", date: "2026-12-05", title: "家で測った", values: { weightKg: 56.4, tempC: 36.7 } },
            { page: "vaccine", date: "2026-12-20", title: "RS", values: { vaccine: "RSウイルス", dose: "妊娠30週2日" } },
            { page: "mother-health", date: "2026-11-01", title: "妊婦の健康状態", values: { allergy: "アレルギーの字" } },
            { page: "birth", date: "2027-02-25", title: "出産", values: { weightG: 3010, heightCm: 49, method: "お産のしかたの字" } },
            { page: "growth", date: "2027-03-25", title: "1か月", values: { weightKg: 4.3 } },
            { page: "vaccine", date: "2027-04-25", title: "ヒブ", values: { vaccine: "ヒブ", dose: "1回目" } },
          ],
        }),
      ),
    );
    expect(add.status).toBe(200);
    expect(add.body.techo).toHaveLength(7);
    // まだ OK していない候補（撮った直後）
    addTecho(hid, [{ page: "growth", date: "2027-05-01", title: "候補", values: { weightKg: 6.1 } }], { today, source: "photo", pending: true });

    type Item = { data: { page: string; values: Record<string, unknown>; pending?: boolean } };
    const momList = await json<{ techo: Item[] }>(T.GET(rq(`/api/techo?familyId=${hid}&today=${today}`, mom)));
    expect(momList.body.techo.map((d) => d.data.page).sort()).toEqual(["birth", "growth", "growth", "home", "mother-health", "pregnancy-checkup", "vaccine", "vaccine"]);
    const gList = await json<{ techo: Item[] }>(T.GET(rq(`/api/techo?familyId=${hid}&today=${today}`, grandma)));
    expect(gList.status).toBe(200);
    expect(gList.body.techo.map((d) => d.data.page).sort()).toEqual(["birth", "growth", "vaccine"]);
    expect(gList.body.techo.find((d) => d.data.page === "vaccine")!.data.values.vaccine).toBe("ヒブ");
    const gJson = JSON.stringify(gList.body);
    for (const bad of ["55.2", "56.4", "36.7", "妊娠30週", "アレルギーの字", "お産のしかたの字", "6.1"]) expect(gJson, bad).not.toContain(bad);

    // 写真: 子の写真・ママの写真・だれの物か決まっていない写真（作ったバイト列だけ）
    const ctx = await A.withHousehold(rq(`/api/media?familyId=${hid}`, mom), hid, "media:write");
    const jpegOf = (n: number) => Buffer.from([0xff, 0xd8, 0xff, 0xc0, 0, 17, 8, 0, 30, 0, 40, 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1, 0xff, 0xda, 0, 8, 1, 1, 0, 0, 0x3f, 0, 0x56, n, 0xff, 0xd9]);
    const d = await json<{ subjects: { id: string; kind: string }[] }>(H.GET(rq(`/api/account/household?familyId=${hid}`, mom)));
    const child = d.body.subjects.find((s) => s.kind === "child")!;
    const mother = d.body.subjects.find((s) => s.kind === "mother")!;
    const childPhoto = (await M.saveUpload(ctx, { orig: jpegOf(1), view: jpegOf(1), thumb: jpegOf(1) })).media;
    const momPhoto = (await M.saveUpload(ctx, { orig: jpegOf(2), view: jpegOf(2), thumb: jpegOf(2) })).media;
    ctx.db.media.patch(childPhoto.id, { subjectId: child.id });
    ctx.db.media.patch(momPhoto.id, { subjectId: mother.id });

    const g = await E.GET(rq(`/api/export?familyId=${hid}`, grandma));
    expect(g.status).toBe(200);
    const gz = unzip(Buffer.from(await g.arrayBuffer()));
    expect(gz.has("家族の設定.json")).toBe(false);
    const gDocs = JSON.parse(gz.get("記録/records.json")!.toString()) as { type: string; data: { page: string; pending?: boolean } }[];
    expect(new Set(gDocs.map((x) => x.type))).toEqual(new Set(["techo"]));
    expect(gDocs.map((x) => x.data.page).sort()).toEqual(["birth", "growth", "vaccine"]);
    const gAll = [...gz.entries()].filter(([k]) => !k.startsWith("写真と録音/") || k.endsWith(".json")).map(([, v]) => v.toString()).join("\n");
    // 家族の設定（町・家族の形）も入らない。ママの名前は、子に結ばれた声の「話した人」には残る（お腹の赤ちゃんへの声は子の物）
    for (const bad of ["55.2", "56.4", "36.7", "妊娠30週", "アレルギーの字", "お産のしかたの字", "上牧町"]) expect(gAll, bad).not.toContain(bad);
    expect((JSON.parse(gz.get("本人.json")!.toString()) as { kind: string }[]).map((s) => s.kind)).toEqual(["child"]);
    expect((JSON.parse(gz.get("同意の履歴.json")!.toString()) as { subjectId: string }[]).every((c) => c.subjectId === child.id)).toBe(true);
    const gMedia = JSON.parse(gz.get("写真と録音/一覧.json")!.toString()) as { id: string; subjectId: string | null }[];
    expect(gMedia.map((x) => x.id)).toContain(childPhoto.id);
    expect(gMedia.map((x) => x.id)).not.toContain(momPhoto.id);
    expect(gMedia.every((x) => x.subjectId === child.id)).toBe(true);
    expect([...gz.keys()].filter((k) => k.startsWith("写真と録音/") && !k.endsWith(".json"))).toHaveLength(gMedia.length);
    expect(gz.get("はじめに.txt")!.toString()).toContain("読むだけの方の書き出しには、子の手帳の記録と、子の写真・声だけ");

    // 持ち主（ママ）の書き出しは今までどおり全部
    const m = unzip(Buffer.from(await (await E.GET(rq(`/api/export?familyId=${hid}`, mom))).arrayBuffer()));
    expect(m.has("家族の設定.json")).toBe(true);
    const mDocs = JSON.parse(m.get("記録/records.json")!.toString()) as { type: string; data: { page?: string } }[];
    expect(mDocs.filter((x) => x.type === "techo").map((x) => x.data.page)).toEqual(expect.arrayContaining(["pregnancy-checkup", "home", "mother-health"]));
    const mIds = (JSON.parse(m.get("写真と録音/一覧.json")!.toString()) as { id: string }[]).map((x) => x.id);
    expect(mIds).toEqual(expect.arrayContaining([childPhoto.id, momPhoto.id]));
    expect(m.get("はじめに.txt")!.toString()).not.toContain("読むだけの方");
  });

  it("読むだけの人（祖父母）には、健診の口（一覧・1回分）を開かない（403）。書く口は前から閉じている。ママは今までどおり", async () => {
    const V = await import("../visit/route");
    const one = await import("../visit/[id]/route");
    const plan = await import("../visit/plan/route");
    const at = (id: string) => ({ params: Promise.resolve({ id }) });
    const made = await json<{ visit: { id: string } }>(V.POST(rq("/api/visit", mom, "POST", { familyId: hid, date: "2027-06-01" })));
    expect(made.status).toBe(200);
    const id = made.body.visit.id;
    expect((await V.GET(rq(`/api/visit?familyId=${hid}&today=2027-06-01`, mom))).status).toBe(200);
    expect((await one.GET(rq(`/api/visit/${id}`, mom), at(id))).status).toBe(200);

    const list = await json<{ error?: string; visits?: unknown }>(V.GET(rq(`/api/visit?familyId=${hid}&today=2027-06-01`, grandma)));
    expect(list.status).toBe(403);
    expect(list.body.visits).toBeUndefined();
    expect(JSON.stringify(list.body)).toContain("健診の記録は、ママと、記録を書ける家族だけが開けます");
    expect((await one.GET(rq(`/api/visit/${id}`, grandma), at(id))).status).toBe(403);
    expect((await one.PATCH(rq(`/api/visit/${id}`, grandma, "PATCH", { label: "x" }), at(id))).status).toBe(403);
    expect((await one.DELETE(rq(`/api/visit/${id}`, grandma, "DELETE"), at(id))).status).toBe(403);
    expect((await V.POST(rq("/api/visit", grandma, "POST", { familyId: hid, date: "2027-06-02" }))).status).toBe(403);
    expect((await plan.POST(rq("/api/visit/plan", grandma, "POST", { familyId: hid, concern: "x" }))).status).toBe(403);
    // よその人は、在るかどうかも見せない（404）
    expect((await one.GET(rq(`/api/visit/${id}`, stranger), at(id))).status).toBe(404);
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
