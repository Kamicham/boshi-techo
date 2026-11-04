// みんなの章と未来の手紙の試験: 開く日より前は中身が返らない（書いた本人でも）・本物の家族は画面の「今日」を信じない・
// 祖父母など（member）は足せるが、自分が足した物だけ直せる・消せる・世帯をまたぐと 404・小学校に入る春の計算。
// DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。作った人・作ったメールだけを使う。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-letters-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;

type Access = typeof import("./access");
type AuthMod = typeof import("./auth");
type Letters = typeof import("./letters");
type LS = typeof import("./letters-shared");
type Media = typeof import("./media");
let A: Access, AU: AuthMod, L: Letters, LSH: LS, M: Media;

beforeAll(async () => {
  A = await import("./access");
  AU = await import("./auth");
  L = await import("./letters");
  LSH = await import("./letters-shared");
  M = await import("./media");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

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

async function signIn(email: string): Promise<string> {
  const sent: string[] = [];
  AU.setMailSender(async (m) => void sent.push(m.text));
  await call("/email-otp/send-verification-otp", { email, type: "sign-in" });
  await new Promise((r) => setTimeout(r, 10));
  const otp = /コード: (\d{6})/.exec(sent.at(-1) ?? "")?.[1];
  const r2 = await call("/sign-in/email-otp", { email, otp });
  expect(r2.status).toBe(200);
  AU.setMailSender(null);
  return cookieOf(r2);
}

const req = (cookie?: string) => new Request(`${BASE}/api/x`, { headers: cookie ? { cookie } : {} });

/** 作った WAV（無音）。本物の声は使わない */
function wav(tone = 0): Buffer {
  const n = 8000;
  const b = Buffer.alloc(44 + n);
  b.write("RIFF", 0);
  b.writeUInt32LE(36 + n, 4);
  b.write("WAVE", 8);
  b.write("fmt ", 12);
  b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20);
  b.writeUInt16LE(1, 22);
  b.writeUInt32LE(8000, 24);
  b.writeUInt32LE(8000, 28);
  b.writeUInt16LE(1, 32);
  b.writeUInt16LE(8, 34);
  b.write("data", 36);
  b.writeUInt32LE(n, 40);
  b.fill(128 + tone, 44);
  return b;
}

describe("開いた知らせの一言", () => {
  it("生まれる前に書いた手紙は「おなかにいた頃」。生まれた後は満年（11か月・1年2か月を取り違えない）", () => {
    const f = { birthDate: "2027-04-26" };
    expect(LSH.openedNewsLine({ sealedOn: "2027-03-01", openOn: "2028-04-26" }, f)).toBe("おなかにいた頃の手紙が開きました");
    expect(LSH.openedNewsLine({ sealedOn: "2027-12-31", openOn: "2028-11-30" }, f)).toBe("封をした手紙が開きました");
    expect(LSH.openedNewsLine({ sealedOn: "2027-04-29", openOn: "2028-06-30" }, f)).toBe("1年前の手紙が開きました");
    expect(LSH.openedNewsLine({ sealedOn: "2028-04-26", openOn: "2037-04-26" }, f)).toBe("9年前の手紙が開きました");
    // 生まれる前の家族（日を選んだ手紙）は満年で
    expect(LSH.openedNewsLine({ sealedOn: "2026-10-01", openOn: "2027-01-01" }, {})).toBe("封をした手紙が開きました");
  });
});

describe("開く日の計算", () => {
  it("誕生日・小学校に入る春（早生まれは1年早い）・うるう日", () => {
    const f = { birthDate: "2027-04-20", dueDate: "2027-04-27" };
    expect(LSH.letterOpenOn("1y", f)).toBe("2028-04-20");
    expect(LSH.letterOpenOn("20y", f)).toBe("2047-04-20");
    expect(LSH.letterOpenOn("school", f)).toBe("2034-04-01");
    expect(LSH.schoolEntry("2027-04-01")).toBe("2033-04-01"); // 4月1日生まれは前の学年
    expect(LSH.schoolEntry("2027-04-02")).toBe("2034-04-01");
    expect(LSH.schoolEntry("2028-01-15")).toBe("2034-04-01");
    expect(LSH.letterOpenOn("1y", { birthDate: "2028-02-29" })).toBe("2029-02-28");
    expect(LSH.letterOpenOn("now", f)).toBeNull();
    // 生まれる前は予定日から
    expect(LSH.letterOpenOn("10y", { dueDate: "2027-04-27" })).toBe("2037-04-27");
  });
});

describe("未来の手紙（見本の家族）", () => {
  it("封をしたら開く日まで中身が返らない。一覧にも中身は無い。時期を進めると開く", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:contribute");
    const birth = ctx.family!.birthDate!;
    const l = L.writeLetter(ctx, { body: "1歳のあなたへ。生まれてきてくれてありがとう。", open: "1y", from: "美咲", today: "2027-01-10" });
    expect(l.opened).toBe(false);
    expect(l.body).toBeUndefined();
    expect(l.mine).toBe(true);
    const list = L.listLetters(ctx, "2027-02-01", "美咲");
    expect(list.find((x) => x.id === l.id)?.mine).toBe(true);
    expect(JSON.stringify(list)).not.toMatch(/ありがとう|"ct"|"iv"|"tag"/);
    // 書いた本人でも、開く日の前は読めない
    expect(() => L.readLetter(ctx, l.id, "2027-02-01", "美咲")).toThrow(expect.objectContaining({ status: 403 }));
    // 書いた日より前の「今日」には出さない
    expect(L.listLetters(ctx, "2026-12-31").some((x) => x.id === l.id)).toBe(false);
    // 1歳の誕生日に開く
    const open = LSH.letterOpenOn("1y", ctx.family!);
    expect(open! > birth).toBe(true);
    const r = L.readLetter(ctx, l.id, open, "美咲");
    expect(r.body).toBe("1歳のあなたへ。生まれてきてくれてありがとう。");
    // 置いた中身は暗号（平文が DB に無い）
    const doc = ctx.db.get<{ ct: string }>(l.id)!;
    expect(Buffer.from(doc.data.ct, "base64").toString("utf8")).not.toMatch(/ありがとう/);
    // 消すのは書いた人だけ（公開の世帯では呼び名で）
    await expect(L.removeLetter(ctx, l.id, "翔太")).rejects.toMatchObject({ status: 403 });
    await L.removeLetter(ctx, l.id, "美咲");
    expect(L.listLetters(ctx, open).some((x) => x.id === l.id)).toBe(false);
  });

  it("封をしない手紙はいつでも読める。開く日を選ぶ時は明日より後だけ", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:contribute");
    const l = L.writeLetter(ctx, { body: "いつでも読んでね", open: "now", from: "翔太", today: "2027-03-01" });
    expect(L.readLetter(ctx, l.id, "2027-03-01").body).toBe("いつでも読んでね");
    expect(() => L.writeLetter(ctx, { body: "x", open: "date", date: "2027-03-01", today: "2027-03-01" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => L.writeLetter(ctx, { body: "", open: "now" })).toThrow(expect.objectContaining({ status: 400 }));
    expect(() => L.writeLetter(ctx, { body: "x", open: "someday" })).toThrow(expect.objectContaining({ status: 400 }));
  });
});

describe("手紙に添えた声（見本の家族）", () => {
  it("封の間は書いた本人にも声が流れない。開いた後は同じ声。アルバムに混ざらない。声だけの手紙も残せる。消すと置き場から消える", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:contribute");
    const voice = wav(7);
    const l = await L.writeVoiceLetter(ctx, { body: "", open: "1y", from: "美咲", today: "2027-01-12" }, { audio: voice, sec: 42 });
    expect(l.voiceSec).toBe(42);
    expect(l.body).toBeUndefined();
    const listed = L.listLetters(ctx, "2027-02-01", "美咲").find((x) => x.id === l.id)!;
    expect(listed.voiceSec).toBe(42);
    expect(JSON.stringify(listed)).not.toMatch(/"key"|"iv"|"tag"|letters\//);
    // 封の間は 403（書いた本人でも）
    await expect(L.readLetterVoice(ctx, l.id, "2027-02-01")).rejects.toMatchObject({ status: 403 });
    // 置き場の中身は暗号で、アルバムの台帳（media の表）には無い
    const doc = ctx.db.get<import("./letters").LetterData>(l.id)!;
    const ct = await ctx.storage.get(doc.data.voice!.key);
    expect(ct!.equals(voice)).toBe(false);
    expect(ctx.db.media.list({ kind: "audio" }).some((x) => x.storageKey === doc.data.voice!.key || x.id === l.id)).toBe(false);
    // 1歳の誕生日に開くと、同じ声が戻る
    const open = LSH.letterOpenOn("1y", ctx.family!)!;
    const got = await L.readLetterVoice(ctx, l.id, open);
    expect(got.buf.equals(voice)).toBe(true);
    expect(got.mime).toBe("audio/wav");
    expect(L.readLetter(ctx, l.id, open).body).toBe("");
    // 声の無い手紙は 404
    const t = L.writeLetter(ctx, { body: "文字だけ", open: "now", from: "翔太", today: "2027-01-12" });
    await expect(L.readLetterVoice(ctx, t.id, "2027-01-12")).rejects.toMatchObject({ status: 404 });
    await L.removeLetter(ctx, t.id, "翔太");
    // 消すと声も消える
    await L.removeLetter(ctx, l.id, "美咲");
    expect(await ctx.storage.exists(doc.data.voice!.key)).toBe(false);
  });

  it("声の形が読めない・短すぎる・開く日が悪い時は、声を置かずに断る", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:contribute");
    await expect(L.writeVoiceLetter(ctx, { body: "", open: "now" }, { audio: Buffer.alloc(5000, 1) })).rejects.toMatchObject({ status: 415 });
    await expect(L.writeVoiceLetter(ctx, { body: "", open: "now" }, { audio: Buffer.alloc(10) })).rejects.toMatchObject({ status: 400 });
    const before = (await ctx.storage.list(`households/${ctx.household.id}/letters`)).length;
    await expect(L.writeVoiceLetter(ctx, { body: "", open: "date", date: "2027-01-01", today: "2027-01-12" }, { audio: wav(3) })).rejects.toMatchObject({ status: 400 });
    expect((await ctx.storage.list(`households/${ctx.household.id}/letters`)).length).toBe(before);
  });
});

describe("本物の家族: みんなの章と手紙", () => {
  let alice = "";
  let bob = "";
  let carol = "";
  let hid = "";

  beforeAll(async () => {
    alice = await signIn("alice-l@example.com");
    bob = await signIn("bob-l@example.com");
    carol = await signIn("carol-l@example.com");
    const r = await call("/organization/create", { name: "作った世帯", slug: "made-letters" }, alice);
    hid = ((await r.json()) as { id: string }).id;
    const inv = await call("/organization/invite-member", { email: "bob-l@example.com", role: "member", organizationId: hid }, alice);
    const invitationId = ((await inv.json()) as { id: string }).id;
    expect((await call("/organization/accept-invitation", { invitationId }, bob)).status).toBe(200);
  });

  it("本物の家族は画面の「今日」を信じない（サーバの日付で開く）", async () => {
    const ctx = await A.withHousehold(req(alice), hid, "media:contribute");
    const l = L.writeLetter(ctx, { body: "未来のあなたへ", open: "date", date: "2099-01-01", today: "2100-01-01" });
    expect(l.opened).toBe(false);
    expect(() => L.readLetter(ctx, l.id, "2100-01-01")).toThrow(expect.objectContaining({ status: 403 }));
    // 世帯をまたぐと 404（carol は世帯の外）
    await expect(A.withHousehold(req(carol), hid, "media:read")).rejects.toMatchObject({ status: 404 });
    const own = await (async () => {
      const r = await call("/organization/create", { name: "carol の世帯", slug: "made-carol" }, carol);
      return ((await r.json()) as { id: string }).id;
    })();
    const cctx = await A.withHousehold(req(carol), own, "media:read");
    expect(() => L.readLetter(cctx, l.id)).toThrow(expect.objectContaining({ status: 404 }));
    // 声も、世帯をまたぐと 404・本物の家族は画面の「今日」で開かない
    const v = await L.writeVoiceLetter(ctx, { body: "", open: "date", date: "2099-01-01" }, { audio: wav(5), sec: 3 });
    await expect(L.readLetterVoice(ctx, v.id, "2100-01-01")).rejects.toMatchObject({ status: 403 });
    await expect(L.readLetterVoice(cctx, v.id, "2100-01-01")).rejects.toMatchObject({ status: 404 });
    await expect(L.removeLetter(cctx, l.id)).rejects.toMatchObject({ status: 404 });
  });

  it("祖父母（member）はみんなの章に足せる。名乗りは本人のアカウント。自分が足した物だけ消せる", async () => {
    const owner = await A.withHousehold(req(alice), hid, "media:write");
    const mine = await M.saveAudio(owner, { audio: wav(1), moment: "bedtime", who: "母" });
    expect(M.contributorFrom(owner)).toBeNull();

    const g = await A.withHousehold(req(bob), hid, "media:contribute");
    expect(g.role).toBe("member");
    expect(g.can("media:write")).toBe(false);
    const from = M.contributorFrom(g, "母方の祖母");
    expect(from?.account).toBe(g.account!.id);
    const r = await M.saveAudio(g, { audio: wav(2), moment: "message", who: "偽の名", from });
    const c = M.toClient(hid, r.media, g.account!.id);
    expect(c.from?.relation).toBe("母方の祖母");
    expect(c.mine).toBe(true);
    expect(M.canEditMedia(g, r.media)).toBe(true);
    expect(M.canEditMedia(g, mine.media)).toBe(false);
    expect(M.canEditMedia(owner, r.media)).toBe(true);

    // 祖父母の手紙。家族の管理の人は消せる、ほかの人の手紙を祖父母は消せない
    const gl = L.writeLetter(g, { body: "ばあばより", open: "now" });
    expect(gl.from).toBe(g.account!.name || "家族");
    const ol = L.writeLetter(owner, { body: "ママより", open: "date", date: "2099-01-01" });
    await expect(L.removeLetter(g, ol.id)).rejects.toMatchObject({ status: 403 });
    await L.removeLetter(owner, gl.id);
    expect(L.listLetters(owner).some((x) => x.id === gl.id)).toBe(false);
    // 祖父母も一覧（中身なし）は見える
    expect(L.listLetters(g).some((x) => x.id === ol.id)).toBe(true);
  });
});
