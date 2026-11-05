// 公開版の体験用の家族の試験（BOSHI_PUBLIC=1・2026-11-04）:
// - 見本の家族を頼むと、その人の札の写しに置き換わる（2人の書き込みが混ざらない・共有の見本の家族には書かれない）
// - 写しの id を直に叩いても、札の持ち主でなければ 404
// - 7日たった写しは消える。1つの住所から作れる写しは1日10まで・総数は300まで・置き場の空きが20%を切ったら作らない（作れない人は見本を読むだけ）
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

  it("同じ札の最初の頼みが2つ同時に来ても落ちない（写しは1つ）", async () => {
    const { ensureTrial } = await import("./trial");
    const F = `try-${"f".repeat(32)}`;
    await expect(Promise.all([ensureTrial(F, "198.51.100.9"), ensureTrial(F, "198.51.100.9")])).resolves.toBeDefined();
    const { getHousehold } = await import("./households");
    expect(getHousehold(F)).not.toBeNull();
  });

  it("1つの写しに置ける写真と声は20件まで（作った見本の声は数えない）", async () => {
    const { withHousehold } = await import("./access");
    const { saveAudio } = await import("./media");
    const E = `try-${"e".repeat(32)}`;
    const ctx = await withHousehold(req("/api/capture?familyId=demo-sato", { trial: E }), "demo-sato", "media:write");
    expect(ctx.household.id).toBe(E);
    const ogg = (i: number) => Buffer.concat([Buffer.from("OggS"), Buffer.alloc(2000, i)]);
    // 見本の声（made）は数えない
    for (let i = 0; i < 3; i++) await saveAudio(ctx, { audio: ogg(200 + i), made: true, today: "2027-04-27" });
    for (let i = 0; i < 20; i++) await saveAudio(ctx, { audio: ogg(i), today: "2027-04-27" });
    await expect(saveAudio(ctx, { audio: ogg(99), today: "2027-04-27" })).rejects.toMatchObject({ status: 413 });
    // 同じ中身（もう置いてある声）は、数を見ずにその行を返す
    await expect(saveAudio(ctx, { audio: ogg(0), today: "2027-04-27" })).resolves.toMatchObject({ duplicate: true });
  });

  it("写しの上限は、体験の写しだけ・作った記録を除いて・声の手紙も合わせて数える（50MB）", async () => {
    const { checkTrialRoom, TRIAL_MAX_BYTES } = await import("./trial-room");
    const MB = 1024 * 1024;
    const fake = (id: string, media: { bytes: number; made?: boolean; kind?: string }[], letters: { bytes?: number; made?: boolean }[] = []) =>
      ({
        household: { id },
        db: {
          media: { list: () => media.map((m) => ({ kind: m.kind ?? "photo", bytes: m.bytes, data: { made: m.made } })) },
          list: () => letters.map((l) => ({ data: { made: l.made, voice: l.bytes ? { bytes: l.bytes } : undefined } })),
        },
      }) as unknown as Parameters<typeof checkTrialRoom>[0];
    expect(() => checkTrialRoom(fake(A, [{ bytes: 40 * MB }], [{ bytes: 5 * MB }]), 4 * MB)).not.toThrow();
    expect(() => checkTrialRoom(fake(A, [{ bytes: 40 * MB }], [{ bytes: 5 * MB }]), 6 * MB)).toThrow(/20件・50MB/);
    // 作った記録・動画は数えない
    expect(() => checkTrialRoom(fake(A, [{ bytes: 49 * MB, made: true }, { bytes: 49 * MB, kind: "video" }]), 10 * MB)).not.toThrow();
    // 写しでない世帯・作った物を置く時・体験版でない置き場には効かない
    expect(() => checkTrialRoom(fake("demo-sato", [{ bytes: TRIAL_MAX_BYTES }]), MB)).not.toThrow();
    expect(() => checkTrialRoom(fake(A, [{ bytes: TRIAL_MAX_BYTES }]), MB, true)).not.toThrow();
    process.env.BOSHI_PUBLIC = "0";
    expect(() => checkTrialRoom(fake(A, [{ bytes: TRIAL_MAX_BYTES }]), MB)).not.toThrow();
    process.env.BOSHI_PUBLIC = "1";
  });

  it("体験版では、映画の動画の書き出しを閉じる（画面には閉じている訳を返す）", async () => {
    const film = await import("@/app/api/book/film/route");
    const g = await film.GET(req("/api/book/film?familyId=demo-sato&today=2029-04-26", { trial: A }));
    expect(g.status).toBe(200);
    expect(await g.json()).toMatchObject({ video: null, canMake: false, closed: true });
    const p = await film.POST(req("/api/book/film", { trial: A, body: { familyId: "demo-sato", today: "2029-04-26" } }));
    expect(p.status).toBe(403);
    expect(((await p.json()) as { error?: string }).error).toContain("体験版では、動画（mp4）の書き出しは閉じています");
  });

  it("体験版の一冊: 見本の一冊が無い日は、中身の無い一冊を作らず（409）、保存もしない", async () => {
    const book = await import("@/app/api/book/route");
    const r = await book.POST(req("/api/book", { trial: A, body: { familyId: "demo-sato", today: "2026-12-01" } }));
    expect(r.status).toBe(409);
    expect(((await r.json()) as { error?: string }).error).toContain("妊娠30週・生後2か月・1歳・2歳の日で、前に Claude が書いた一冊を読めます");
    const { list } = await import("./db");
    expect(list(A, "book")).toHaveLength(0);
  });

  it("体験版では、話した気がかりの返事に「健診の聞く事にも並べました」を出さない", async () => {
    const cap = await import("@/app/api/capture/route");
    const r = await cap.POST(req("/api/capture", { trial: A, body: { familyId: "demo-sato", today: "2026-12-01", text: "足がつって眠れない" } }));
    expect(r.status).toBe(200);
    const j = (await r.json()) as { reply?: string; records?: { data?: { kind?: string } }[] };
    expect(j.records?.[0]?.data?.kind).toBe("気がかり");
    expect(j.reply).toContain("書いた文を、そのまま気がかりに残しました");
    expect(j.reply).toContain("この体験版では Claude を呼ばず");
    expect(j.reply).not.toMatch(/健診|聞く事/);
  });

  it("体験版の話す: 声は文字にせず見本の文が入り、返事は「話した事を…」（書いた文とは言わない）", async () => {
    const voice = await import("@/app/api/capture/voice/route");
    const ogg = Buffer.concat([Buffer.from("OggS"), Buffer.alloc(3000, 7)]);
    const r = await voice.POST(
      new Request(`${BASE}/api/capture/voice?familyId=demo-sato&today=2027-02-15`, {
        method: "POST",
        headers: { "content-type": "audio/ogg", origin: BASE, "fly-client-ip": "203.0.113.1", cookie: `boshi_try=${A}` },
        body: ogg,
      }),
    );
    expect(r.status).toBe(200);
    const j = (await r.json()) as { reply?: string; note?: string; transcript?: string };
    expect(j.note).toBe("体験版は声を文字にしません。決まった見本の文が入ります。");
    expect(j.reply).toContain("話した事を、そのまま");
  });

  it("写しの総数が上限に届いた時・置き場の空きが少ない時は、写しを作らず、共有の見本の家族を読むだけで見せる（技術監査 (5)②）", async () => {
    const done = await import("@/app/api/done/route");
    const { ensureTrial, dataFree } = await import("./trial");
    const C = `try-${"9".repeat(32)}`;
    const ip = "192.0.2.50";
    process.env.BOSHI_TRIALS_MAX = "1";
    try {
      expect(await ensureTrial(C, ip)).toBe(false);
      // 読める（見本の家族のまま）。書くと 403 で、読むだけの訳を返す
      expect((await done.GET(req("/api/done?familyId=demo-sato", { trial: C, ip }))).status).toBe(200);
      const w = await done.POST(req("/api/done", { trial: C, ip, body: { familyId: "demo-sato", milestoneId: "birth-registration" } }));
      expect(w.status).toBe(403);
      expect(((await w.json()) as { error: string }).error).toContain("読むだけ");
      // 共有の見本の家族には書かれていない
      const { get } = await import("./db");
      expect(get("done:demo-sato:birth-registration")).toBeNull();
    } finally {
      delete process.env.BOSHI_TRIALS_MAX;
    }
    // 置き場の空きが少ない時も作らない（空きは 0〜1 で測れる）
    expect(dataFree()).toBeGreaterThan(0);
    expect(dataFree()).toBeLessThanOrEqual(1);
    process.env.BOSHI_TRIAL_MIN_FREE = "1.01";
    try {
      expect(await ensureTrial(C, ip)).toBe(false);
    } finally {
      delete process.env.BOSHI_TRIAL_MIN_FREE;
    }
    // 空けば、次の頼みで自分の写しができる
    expect(await ensureTrial(C, ip)).toBe(true);
  });

  it("1つの住所から作れる写しは1日10まで（超えたら読むだけの見本）。7日たった写しは消える", async () => {
    const { ensureTrial, purgeExpiredTrials } = await import("./trial");
    for (let i = 0; i < 10; i++) expect(await ensureTrial(`try-${String(i).padStart(32, "c")}`, "198.51.100.7")).toBe(true);
    expect(await ensureTrial(`try-${"d".repeat(32)}`, "198.51.100.7")).toBe(false);
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

  it("見張りの口（/api/health）は札を配らず、写しも作らない（fly.toml の checks・15秒ごと）", async () => {
    const r = await mw("/api/health");
    expect(r.status).toBe(200);
    expect(r.cookies.get("boshi_try")).toBeUndefined();
    expect(r.headers.get("x-middleware-override-headers")).toBeNull();
    const { GET } = await import("@/app/api/health/route");
    const j = (await GET().json()) as { ok: boolean; free: number };
    expect(j.ok).toBe(true);
    expect(j.free).toBeGreaterThan(0);
    // 見張りの道を fly.toml に書いてある
    const toml = fs.readFileSync(path.join(process.cwd(), "fly.toml"), "utf8");
    expect(toml).toMatch(/\[\[http_service\.checks\]\][\s\S]*path = "\/api\/health"/);
  });

  it("送る中身が上限を超えたら、中身を読まずに 413（写真と声は 32MB・ほかは 1MB。技術監査 (5)①）", async () => {
    const { middleware } = await import("@/middleware");
    const send = (url: string, n: number) =>
      middleware(new NextRequest(`${BASE}${url}`, { method: "POST", headers: { cookie: `boshi_try=${A}`, "content-length": String(n) } }));
    expect((await send("/api/done", 1024 * 1024 + 1)).status).toBe(413);
    expect((await send("/api/done", 1024 * 1024)).status).toBe(200);
    expect((await send("/api/media", 32 * 1024 * 1024)).status).toBe(200);
    const r = await send("/api/media", 32 * 1024 * 1024 + 1);
    expect(r.status).toBe(413);
    expect(((await r.json()) as { error: string }).error).toContain("32MB");
  });

  it("写真と声の手紙は、関所を通ってから中身を読む（よその写しの id なら、中身が壊れていても 404）", async () => {
    const media = await import("@/app/api/media/route");
    const letters = await import("@/app/api/letters/route");
    const broken = (url: string) =>
      new Request(`${BASE}${url}`, {
        method: "POST",
        headers: { "content-type": "multipart/form-data; boundary=x", origin: BASE, "fly-client-ip": "203.0.113.1", cookie: `boshi_try=${A}` },
        body: "壊れた中身",
      });
    // 道に familyId があれば先に関所: 札の持ち主でない写しは 404（中身は読まない）
    expect((await media.POST(broken(`/api/media?familyId=${B}`))).status).toBe(404);
    expect((await letters.POST(broken(`/api/letters?familyId=${B}`))).status).toBe(404);
    // 自分の写し（見本の家族）なら、関所を通ってから中身を読む → 壊れた中身は 400
    expect((await media.POST(broken("/api/media?familyId=demo-sato"))).status).toBe(400);
    expect((await letters.POST(broken("/api/letters?familyId=demo-sato"))).status).toBe(400);
    // 道に familyId の無い古い画面は、今までどおり中身を読んでから関所へ
    expect((await media.POST(broken("/api/media"))).status).toBe(400);
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
