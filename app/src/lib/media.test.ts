// 写真を残すの試験: GPS が残らない・撮った日が読める・節目と「この1枚」・ゴミ箱・写真0枚でも一冊が壊れない・
// Claude への入力に画像が入らない（mediaForClaude 以外から imageBlock を呼ばない grep の試験）。
// DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。写真は試験の中で作ったバイト列だけ（本物の写真は使わない）。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

// Claude は呼ばない（渡された中身だけを覚える）
const calls: { system: string; content: unknown }[] = [];
let fakeBook: Record<string, unknown> = {};
vi.mock("./claude", async () => {
  const actual = await vi.importActual<typeof import("./claude")>("./claude");
  return {
    ...actual,
    structured: vi.fn(async (_schema: unknown, system: string, content: unknown) => {
      calls.push({ system, content });
      return fakeBook;
    }),
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-media-test-"));
process.env.BOSHI_DATA_DIR = dir;
// 試験だけの鍵（本物の鍵ではない）
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;

type Shared = typeof import("./media-shared");
type Media = typeof import("./media");
type Access = typeof import("./access");
type BookMod = typeof import("./book");
let S: Shared, M: Media, A: Access, B: BookMod;

beforeAll(async () => {
  S = await import("./media-shared");
  M = await import("./media");
  A = await import("./access");
  B = await import("./book");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

// ───────── 作った写真（EXIF に撮った日と GPS を入れた JPEG） ─────────

function be16(n: number) {
  return [(n >> 8) & 0xff, n & 0xff];
}
function be32(n: number) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}
const bytes = (s: string) => [...s].map((c) => c.charCodeAt(0));

/** 撮った日と GPS（北緯35度）を持つ TIFF（大きい方から並べる MM） */
function tiffWithGps(date: string): number[] {
  const t: number[] = [...bytes("MM"), ...be16(42), ...be32(8)];
  // IFD0 @8: Exif の入口・GPS の入口
  t.push(...be16(2), ...be16(0x8769), ...be16(4), ...be32(1), ...be32(38), ...be16(0x8825), ...be16(4), ...be32(1), ...be32(56), ...be32(0));
  // Exif IFD @38: DateTimeOriginal（ASCII 20 → @86）
  t.push(...be16(1), ...be16(0x9003), ...be16(2), ...be32(20), ...be32(86), ...be32(0));
  // GPS IFD @56: 北・緯度（RATIONAL 3 → @106）
  t.push(...be16(2), ...be16(0x0001), ...be16(2), ...be32(2), ...bytes("N\0\0\0"), ...be16(0x0002), ...be16(5), ...be32(3), ...be32(106), ...be32(0));
  t.push(...bytes(`${date}\0`)); // @86（20バイト）
  t.push(...be32(35), ...be32(1), ...be32(41), ...be32(1), ...be32(1234), ...be32(100)); // @106
  return t;
}

/** EXIF（GPS 入り）と XMP（GPS 入り）を持つ、小さな JPEG の形のバイト列 */
function jpegWithGps(date = "2027:08:03 10:11:12", body: number[] = []): Buffer {
  const tiff = tiffWithGps(date);
  const app1 = [0xff, 0xe1, ...be16(2 + 6 + tiff.length), ...bytes("Exif\0\0"), ...tiff];
  const xmpText = bytes('http://ns.adobe.com/xap/1.0/\0<x:xmpmeta><rdf:Description exif:GPSLatitude="35,41.12N"/></x:xmpmeta>');
  const xmp = [0xff, 0xe1, ...be16(2 + xmpText.length), ...xmpText];
  const sof = [0xff, 0xc0, ...be16(17), 8, ...be16(30), ...be16(40), 3, 1, 0x22, 0, 2, 0x11, 1, 3, 0x11, 1];
  const scan = body.length ? body : [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0, 0x12, 0x34, 0x56, 0xff, 0xd9];
  return Buffer.from([0xff, 0xd8, ...app1, ...xmp, ...sof, ...scan]);
}

/** 本物の JPEG（ffmpeg があれば作る）の頭に、GPS 入りの EXIF を差し込む */
function realJpegWithGps(color: string, date: string): Buffer {
  const out = path.join(dir, `src-${color}.jpg`);
  try {
    execFileSync("/opt/homebrew/bin/ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", `color=c=${color}:s=320x240`, "-frames:v", "1", out]);
    const real = fs.readFileSync(out);
    const tiff = tiffWithGps(date);
    const app1 = Buffer.from([0xff, 0xe1, ...be16(2 + 6 + tiff.length), ...bytes("Exif\0\0"), ...tiff]);
    return Buffer.concat([real.subarray(0, 2), app1, real.subarray(2)]);
  } catch {
    return jpegWithGps(date, [0xff, 0xda, ...be16(8), 1, 1, 0, 0, 0x3f, 0, ...bytes(color), 0xff, 0xd9]);
  }
}

const req = () => new Request("http://local/api/media");

// ───────── GPS と撮った日 ─────────

describe("GPS を消す（JPEG・PNG）", () => {
  it("JPEG: EXIF と XMP の GPS が消え、撮った日と画は残る", () => {
    const src = jpegWithGps();
    expect(S.sniffMime(src)).toBe("image/jpeg");
    expect(S.hasGps(src)).toBe(true);
    expect(S.readExifDate(src)).toBe("2027-08-03T10:11:12");
    const out = S.stripGps(src);
    expect(S.hasGps(out)).toBe(false);
    expect(S.readExifDate(out)).toBe("2027-08-03T10:11:12");
    expect(Buffer.from(out).includes(Buffer.from("GPSLatitude"))).toBe(false);
    // 緯度の値（35/1, 41/1）が中に残っていない
    expect(Buffer.from(out).includes(Buffer.from([0, 0, 0, 35, 0, 0, 0, 1, 0, 0, 0, 41]))).toBe(false);
    expect(S.jpegSize(out)).toEqual({ w: 40, h: 30 });
    // 画の部分（SOS から後）はそのまま
    const tail = (b: Uint8Array) => Buffer.from(b.subarray(Buffer.from(b).indexOf(Buffer.from([0xff, 0xda]))));
    expect(tail(out).equals(tail(src))).toBe(true);
    // 元のバイト列は変えない
    expect(S.hasGps(src)).toBe(true);
  });

  it("PNG: eXIf と GPS を含む文字の塊を抜く", () => {
    const tiff = Buffer.from(tiffWithGps("2027:01:02 03:04:05"));
    const chunk = (type: string, data: Buffer) => Buffer.concat([Buffer.from(be32(data.length)), Buffer.from(type), data, Buffer.alloc(4)]);
    const png = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk("IHDR", Buffer.alloc(13)),
      chunk("eXIf", tiff),
      chunk("iTXt", Buffer.from("XML:com.adobe.xmp\0exif:GPSLongitude")),
      chunk("IDAT", Buffer.alloc(8)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
    expect(S.hasGps(png)).toBe(true);
    expect(S.readExifDate(png)).toBe("2027-01-02T03:04:05");
    const out = S.stripGps(png);
    expect(S.hasGps(out)).toBe(false);
    expect(Buffer.from(out).includes(Buffer.from("IDAT"))).toBe(true);
  });

  it("形式の見分け: 動画・読めない物は写真にしない", () => {
    expect(S.sniffMime(Buffer.from([0, 0, 0, 0x18, ...bytes("ftypmp42"), 0, 0, 0, 0]))).toBe("video/mp4");
    expect(S.sniffMime(Buffer.from([0, 0, 0, 0x18, ...bytes("ftypheic"), 0, 0, 0, 0]))).toBe("image/heic");
    expect(() => S.stripGps(Buffer.from("not an image at all"))).toThrow();
  });
});

// ───────── 月齢・節目・この1枚 ─────────

describe("月齢・節目・この1枚", () => {
  const fam = { dueDate: "2027-05-10", birthDate: "2027-04-26" };
  it("節目は行事の日の目安だけ（お食い初め＝生後100日）", () => {
    expect(S.milestoneFor(fam.birthDate, "2027-08-03")?.id).toBe("okuizome");
    expect(S.milestoneFor(fam.birthDate, "2027-05-02")?.id).toBe("oshichiya");
    expect(S.milestoneFor(fam.birthDate, "2027-06-15")).toBeNull();
    expect(S.milestoneFor(undefined, "2027-08-03")).toBeNull();
    expect(S.milestoneToday(fam.birthDate, "2027-08-03")?.say).toBe("今日は生後100日です");
    expect(S.milestoneToday(fam.birthDate, "2027-08-10")).toBeNull();
    expect(S.ageLabel(fam, "2027-08-03")).toBe("生後3か月");
    expect(S.ageLabel(fam, "2027-01-10")).toMatch(/^妊娠\d+か月$/);
    expect(S.keptLine(fam, { date: "2027-08-03", milestone: "okuizome" })).toBe("8月3日・生後3か月・お食い初めのころ");
  });

  it("この1枚は★が一番強い。隠した写真は選ばない", () => {
    const base = (id: string, date: string, extra: Partial<import("./media-shared").ClientMedia> = {}) =>
      ({ id, date, createdAt: `${date}T00:00:00Z`, star: 0, techoIds: [], hidden: false, trashedAt: null, ...extra }) as import("./media-shared").ClientMedia;
    const xs = [base("a", "2027-08-01"), base("b", "2027-08-10", { milestone: "okuizome" }), base("c", "2027-08-20", { star: 1 }), base("d", "2027-08-21", { star: 3, hidden: true })];
    expect(S.pickOfMonth(xs)?.id).toBe("c");
    expect(S.pickOfMonth(xs.slice(0, 2))?.id).toBe("b");
    expect(S.pickOfMonth([])).toBeNull();
    const g = S.groupForAlbum(fam, xs);
    expect(g.map((p) => p.period)).toEqual(["はじめての一年"]);
    expect(g[0].months[0].label).toBe("生後3か月（2027年7月26日〜）");
  });

  it("月の見出しは月齢でまとめ、同じ見出しが2回出ない（生まれて1週間・1か月まで・生後の月・妊娠の月）", () => {
    const base = (id: string, date: string) => ({ id, date, createdAt: `${date}T00:00:00Z`, star: 0, techoIds: [], hidden: false, trashedAt: null }) as unknown as import("./media-shared").ClientMedia;
    const days = ["2026-10-01", "2026-10-25", "2027-04-26", "2027-04-30", "2027-05-06", "2027-05-16", "2027-05-26", "2027-06-10", "2027-09-30", "2027-10-06", "2027-10-26", "2028-04-26"];
    const g = S.groupForAlbum(fam, days.map((d, i) => base(String(i), d)));
    const labels = g.flatMap((p) => p.months.map((m) => m.label));
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain("生まれて1週間（2027年4月26日〜）");
    expect(labels).toContain("生まれて1か月まで（2027年5月3日〜）");
    expect(labels).toContain("生後1か月（2027年5月26日〜）");
    expect(labels).toContain("生後5か月（2027年9月26日〜）");
    expect(labels).toContain("1歳（2028年4月26日〜）");
    // 生後1か月の間（5/26〜6/25）は1つの見出し
    expect(g.flatMap((p) => p.months).find((m) => m.label.startsWith("生後1か月"))!.items.length).toBe(2);
  });
});

// ───────── 受け取る・暗号・ゴミ箱（見本の家族 demo-sato にログインなしで） ─────────

describe("受け取る → GPS を消して暗号にして置く → ゴミ箱", () => {
  it("置いた原本に GPS が残らない。置き場のファイルは暗号。同じ写真は二重に入らない", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const src = realJpegWithGps("pink", "2027:08:03 10:11:12");
    expect(S.hasGps(src)).toBe(true);
    const r = await M.saveUpload(ctx, { orig: src, lastModified: Date.UTC(2027, 0, 1) });
    expect(r.duplicate).toBe(false);
    const row = r.media;
    expect(row.takenAt).toBe("2027-08-03T10:11:12");
    expect(row.takenAtFrom).toBe("exif");
    expect(row.data.links.milestone).toBe("okuizome");
    expect(row.data.shareWithClaude).toBe(false);
    expect(row.storageKey.startsWith("households/demo-sato/")).toBe(true);
    for (const v of ["orig", "view", "thumb"] as const) {
      const got = await M.readVariant(ctx, row, v);
      expect(got).not.toBeNull();
      expect(S.hasGps(got!.buf)).toBe(false);
    }
    const orig = (await M.readVariant(ctx, row, "orig"))!.buf;
    expect(S.readExifDate(orig)).toBe("2027-08-03T10:11:12");
    const onDisk = await ctx.storage.get(`${row.storageKey}/orig`);
    expect(onDisk).not.toBeNull();
    expect(onDisk!.includes(Buffer.from("Exif"))).toBe(false);
    expect(onDisk!.equals(orig)).toBe(false);

    const again = await M.saveUpload(ctx, { orig: src, today: "2027-09-01" });
    expect(again.duplicate).toBe(true);
    expect(again.media.id).toBe(row.id);

    const c = M.toClient("demo-sato", row);
    expect(JSON.stringify(c)).not.toMatch(/iv|tag|storageKey|households\//);
    expect(c.urls.thumb).toBe(`/api/media/${row.id}?familyId=demo-sato&v=thumb`);
  });

  it("作った家族は、写真の日を画面の「今日」にする（時計を進めて見るため）。小さな写真は引き伸ばさない", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const { media: row } = await M.saveUpload(ctx, { orig: realJpegWithGps("plum", "2026:11:01 08:00:00"), today: "2027-05-02" });
    expect(row.takenAt?.slice(0, 10)).toBe("2027-05-02");
    expect(row.takenAtFrom).toBe("upload");
    expect(row.data.links.milestone).toBe("oshichiya");
    const view = (await M.readVariant(ctx, row, "view"))!.buf;
    const z = S.imageSize(view);
    if (z) expect(Math.max(z.w, z.h)).toBeLessThanOrEqual(320);
    ctx.db.media.patch(row.id, { trashedAt: new Date(0).toISOString() });
    await M.purgeExpired(ctx);
  });

  it("動画・読めない形式は受け付けない", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    await expect(M.saveUpload(ctx, { orig: Buffer.from([0, 0, 0, 0x18, ...bytes("ftypmp42"), 0, 0, 0, 0, 1, 2]) })).rejects.toMatchObject({ status: 415 });
    await expect(M.saveUpload(ctx, { orig: Buffer.from("hello, this is not a photo") })).rejects.toMatchObject({ status: 415 });
  });

  it("ゴミ箱: 一覧から消え、30日を過ぎるとファイルごと消える", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const { media: row } = await M.saveUpload(ctx, { orig: realJpegWithGps("teal", "2027:06:01 09:00:00") });
    ctx.db.media.patch(row.id, { trashedAt: new Date().toISOString() });
    expect(ctx.db.media.list({ kind: "photo" }).some((m) => m.id === row.id)).toBe(false);
    expect(ctx.db.media.get(row.id)).toBeNull();
    expect(await M.purgeExpired(ctx)).toBe(0); // まだ30日たっていない
    expect(await ctx.storage.exists(`${row.storageKey}/orig`)).toBe(true);
    expect(await M.purgeExpired(ctx, Date.now() + 31 * 86_400_000)).toBeGreaterThanOrEqual(1);
    expect(ctx.db.media.get(row.id, { includeTrashed: true })).toBeNull();
    expect(await ctx.storage.list(row.storageKey)).toEqual([]);
  });

  it("mediaForClaude: 印の無い写真は渡さない（既定は見せない）", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", ["media:read", "claude:send"]);
    const row = ctx.db.media.list<import("./media-shared").MediaData>({ kind: "photo" })[0];
    await expect(M.mediaForClaude(ctx, row.id)).rejects.toMatchObject({ status: 403 });
    // 印を付けても、作った写真でなければ（作った家族の世帯では）渡さない
    ctx.db.media.patch(row.id, { data: { shareWithClaude: { at: "x", by: "test" } } });
    await expect(M.mediaForClaude(ctx, row.id)).rejects.toMatchObject({ status: 403 });
    ctx.db.media.patch(row.id, { data: { shareWithClaude: false } });
  });
});

// ───────── 一冊（写真0枚でも壊れない・Claude への入力は文字だけ） ─────────

describe("声を残す", () => {
  /** 作った WAV（無音・1秒）。本物の声は使わない */
  function wav(seconds = 1, tone = 0): Buffer {
    const rate = 8000;
    const n = rate * seconds;
    const b = Buffer.alloc(44 + n);
    b.write("RIFF", 0);
    b.writeUInt32LE(36 + n, 4);
    b.write("WAVE", 8);
    b.write("fmt ", 12);
    b.writeUInt32LE(16, 16);
    b.writeUInt16LE(1, 20);
    b.writeUInt16LE(1, 22);
    b.writeUInt32LE(rate, 24);
    b.writeUInt32LE(rate, 28);
    b.writeUInt16LE(1, 32);
    b.writeUInt16LE(8, 34);
    b.write("data", 36);
    b.writeUInt32LE(n, 40);
    b.fill(128 + tone, 44);
    return b;
  }

  it("声は暗号にして置き、題は録り方と話した人から作る。同じ声は二重に入らない。画面に鍵は渡さない", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    expect(S.sniffAudio(wav())).toBe("audio/wav");
    expect(S.sniffAudio(Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0, 0, 0, 0, 0]))).toBe("audio/webm");
    const src = wav(1, 3);
    const r = await M.saveAudio(ctx, { audio: src, moment: "belly", who: "翔太", spokenTo: "ひなた", transcript: "ひなた、聞こえる？パパだよ。今日は寒かったね。", durationSec: 4.2, today: "2027-01-01" });
    expect(r.duplicate).toBe(false);
    expect(r.media.kind).toBe("audio");
    expect(r.media.takenAt?.slice(0, 10)).toBe("2027-01-01");
    expect(r.media.data.title).toBe("翔太から おなかへ");
    const onDisk = await ctx.storage.get(`${r.media.storageKey}/orig`);
    expect(onDisk!.equals(src)).toBe(false);
    expect((await M.readVariant(ctx, r.media, "orig"))!.buf.equals(src)).toBe(true);
    const again = await M.saveAudio(ctx, { audio: src, moment: "bedtime" });
    expect(again.duplicate).toBe(true);
    const c = M.toClient("demo-sato", r.media);
    expect(c.title).toBe("翔太から おなかへ");
    expect(JSON.stringify(c)).not.toMatch(/"iv"|"tag"|storageKey|households\//);
    // 写真の一覧には混ざらない。「この1枚」にも選ばれない
    expect(ctx.db.media.list({ kind: "photo" }).some((x) => x.id === r.media.id)).toBe(false);
    expect(S.pickOfMonth([c])).toBeNull();
    await expect(M.saveAudio(ctx, { audio: Buffer.from("not audio at all, just text") })).rejects.toMatchObject({ status: 415 });
  });

  it("一冊の声の候補は文字だけ（題・最初の一文）。隠した声・今日より後の声は入れない", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const late = await M.saveAudio(ctx, { audio: wav(1, 9), moment: "name", who: "美咲", transcript: "ひなた。", today: "2029-01-01" });
    const hid = await M.saveAudio(ctx, { audio: wav(1, 11), moment: "bedtime", who: "美咲", transcript: "おやすみ。", today: "2027-02-01" });
    ctx.db.media.patch(hid.media.id, { data: { hidden: true } });
    const f = ctx.family!;
    const xs = M.bookVoiceCandidates(f, "2027-12-31");
    expect(xs.some((x) => x.id === late.media.id)).toBe(false);
    expect(xs.some((x) => x.id === hid.media.id)).toBe(false);
    const belly = xs.find((x) => x.title === "翔太から おなかへ");
    expect(belly?.first).toBe("ひなた、聞こえる？");
    expect(JSON.stringify(xs)).not.toMatch(/storageKey|households\//);
  });
});

describe("一冊と写真", () => {
  const chapter = (period: string, photos: { mediaId: string; line: string }[] = []) => ({ period, title: "題", text: "本文", moments: [], photos });

  it("写真が0枚でも一冊ができ、写真の欄は空。Claude への入力は文字だけ", async () => {
    const { getFamily } = await import("./family");
    const f = { ...getFamily("demo-sato")!, id: "demo-empty" } as import("./demo-family").Family;
    calls.length = 0;
    fakeBook = { title: "t", dedication: "d", closing: "c", cover: "P3", film: [{ mediaId: "P9", sec: 4, caption: "x" }], chapters: [chapter("生まれた日", [{ mediaId: "P1", line: "?" }])] };
    const entries = B.gather("demo-sato", "2027-09-01");
    expect(entries.some((e) => e.kind === "手帳")).toBe(true);
    const keys = B.photoKeys(M.bookPhotoCandidates(f, "2027-09-01"));
    expect(keys).toEqual([]);
    const body = B.bookInput(f, "2027-09-01", entries, keys);
    expect(body).toContain("写真はまだ無い");
    expect(body).not.toContain("写真の候補");
    const settled = B.settlePhotos(fakeBook as never, keys);
    expect(settled.cover).toBe("");
    expect(settled.film).toEqual([]);
    expect(settled.chapters[0].photos).toEqual([]);
  });

  it("写真がある時: 候補は番号だけで渡し、画像・id は渡さない。答えの知らない番号は落とし、★の写真を表紙にする", async () => {
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const { media: starred } = await M.saveUpload(ctx, { orig: realJpegWithGps("orange", "2027:08:04 11:00:00"), starBy: "name:母", caption: "はじめてのお食い初め" });
    const { getFamily } = await import("./family");
    const f = getFamily("demo-sato")!;
    calls.length = 0;
    fakeBook = { title: "t", dedication: "d", closing: "c", cover: "P99", film: [], chapters: [chapter("はじめての一年", [{ mediaId: "P77", line: "?" }])] };
    const book = await B.makeBook(f, "2027-09-01");
    expect(calls).toHaveLength(1);
    const { content } = calls[0];
    // 文字だけ（画像のブロック・base64・写真の id・置き場の鍵を含まない）
    expect(typeof content).toBe("string");
    const text = content as string;
    expect(text).toContain("写真の候補");
    expect(text).toMatch(/P1 2027-08-0\d/);
    expect(text).toContain("一言「はじめてのお食い初め」");
    expect(text).not.toContain(starred.id);
    expect(text).not.toMatch(/data:image|base64|households\//);
    // 知らない番号は落とし、章には★・節目の写真を足す。表紙は★の写真
    expect(book.cover).toBe(starred.id);
    expect(book.chapters[0].photos.map((p) => p.mediaId)).toContain(starred.id);
    expect(book.film.length).toBeGreaterThan(0);
    expect(book.film.reduce((n, x) => n + x.sec, 0)).toBeLessThanOrEqual(120);
    expect(book.photoCount).toBeGreaterThan(0);
  });
});

// ───────── 画像を Claude に渡せるのは mediaForClaude だけ（grep） ─────────

describe("見本の家族の写真と声", () => {
  it("作った家族の世帯に、作った写真と声を入れる。二度呼んでも増えない。本物の世帯には入れない", async () => {
    const D = await import("./demo-media");
    const ctx = await A.withHousehold(req(), "demo-sato", "media:write");
    const first = await D.seedDemoMedia(ctx);
    expect(first).toBeGreaterThan(0);
    expect(await D.seedDemoMedia(ctx)).toBe(0);
    const voices = ctx.db.media.list<import("./media-shared").MediaData>({ kind: "audio" }).filter((r) => r.data.made);
    expect(voices.length).toBeGreaterThanOrEqual(7);
    expect(voices.every((v) => v.data.transcript && v.data.title)).toBe(true);
    // 種の日付は筋書きどおり（20週の夜の話しかけ）
    expect(voices.some((v) => v.data.title === "翔太から おなかへ")).toBe(true);
    expect(await D.seedDemoMedia({ ...ctx, household: { ...ctx.household, kind: "real" } })).toBe(0);
  });
});

describe("一冊と声", () => {
  const photo = (id: string, date: string, period: "はじめての一年" | "おなかにいた日々") => ({ id, date, period, age: "", techo: [], star: 0, score: 0 });
  const voice = (id: string, date: string, period: "はじめての一年" | "おなかにいた日々", star = 0) => ({ id, date, period, age: "", title: "パパから おなかへ", first: "", star });

  it("声の番号を id に戻し、知らない番号は落とす。映画で同じ声は1回だけ。声のある行は5秒以上", () => {
    const pk = B.photoKeys([photo("p1", "2027-02-01", "おなかにいた日々"), photo("p2", "2027-06-01", "はじめての一年")]);
    const vk = B.voiceKeys([voice("v1", "2027-02-03", "おなかにいた日々")]);
    expect(vk.map((k) => k.key)).toEqual(["V1"]);
    const content = {
      title: "t", dedication: "d", closing: "c", cover: "",
      chapters: [{ period: "おなかにいた日々", title: "a", text: "b", moments: [], photos: [], voices: [{ voiceId: "V1", line: "パパから" }, { voiceId: "V9", line: "x" }] }],
      film: [
        { mediaId: "p1", sec: 3, caption: "", voiceId: "V1" },
        { mediaId: "p2", sec: 3, caption: "", voiceId: "V1" },
      ],
    };
    const out = B.settleVoices(content, pk, vk);
    expect(out.chapters[0].voices).toEqual([{ voiceId: "v1", line: "パパから" }]);
    expect(out.film[0]).toMatchObject({ voiceId: "v1", sec: 5 });
    expect(out.film[1].voiceId).toBe("");
  });

  it("Claude が声を選ばなかった時（見本の答え）も、章に1本・映画の近い日の写真に声を付ける。半年より離れた写真には付けない", () => {
    const pk = B.photoKeys([photo("p1", "2027-02-01", "おなかにいた日々"), photo("p2", "2027-12-01", "はじめての一年")]);
    const vk = B.voiceKeys([voice("v1", "2027-02-10", "おなかにいた日々"), voice("v2", "2029-01-01", "はじめての一年")]);
    const content = {
      title: "t", dedication: "d", closing: "c", cover: "",
      chapters: [{ period: "おなかにいた日々", title: "a", text: "b", moments: [], photos: [], voices: [] }],
      film: [],
    };
    const settled = B.settlePhotos(content, pk);
    expect(settled.film.map((x) => x.mediaId)).toContain("p1");
    const out = B.settleVoices(settled, pk, vk);
    expect(out.chapters[0].voices[0].voiceId).toBe("v1");
    expect(out.film.find((x) => x.mediaId === "p1")?.voiceId).toBe("v1");
    expect(out.film.some((x) => x.voiceId === "v2")).toBe(false);
    // Claude への文に声の id は出さない（番号だけ）
    const f = { id: "x", city: "", prefecture: "", dueDate: "2027-05-10", birthDate: "2027-04-26", members: [] };
    const text = B.bookInput(f, "2027-12-31", [], pk, vk);
    expect(text).toContain("V1");
    expect(text).not.toContain("v1");
  });
});

describe("imageBlock を呼ぶ所（grep）", () => {
  const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const files: string[] = [];
  const walk = (d: string) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx|mts|mjs)$/.test(e.name) && !/\.test\./.test(e.name)) files.push(p);
    }
  };
  walk(SRC);
  const rel = (p: string) => path.relative(SRC, p).split(path.sep).join("/");
  const calling = files.filter((p) => /\bimageBlock\s*\(/.test(fs.readFileSync(p, "utf8"))).map(rel);

  it("写真（media）に触るファイルで imageBlock を呼ぶのは lib/media.ts の mediaForClaude だけ", () => {
    const mediaFiles = files.filter((p) => {
      const s = fs.readFileSync(p, "utf8");
      return /from "(@\/lib\/media|\.\/media|\.\.\/media|@\/lib\/storage|\.\/storage)"|readVariant|openForHousehold|\.media\.(get|list)/.test(s);
    });
    for (const p of mediaFiles) {
      if (rel(p) === "lib/media.ts" || rel(p) === "lib/claude.ts") continue;
      expect(/\bimageBlock\s*\(/.test(fs.readFileSync(p, "utf8")), `${rel(p)} が imageBlock を呼んでいます`).toBe(false);
    }
    const src = fs.readFileSync(path.join(SRC, "lib/media.ts"), "utf8");
    const at = [...src.matchAll(/\bimageBlock\s*\(/g)].map((m) => m.index!);
    expect(at).toHaveLength(1);
    const fn = src.indexOf("export async function mediaForClaude(");
    const next = src.indexOf("\nexport ", fn + 10);
    expect(fn).toBeGreaterThan(0);
    expect(at[0] > fn && at[0] < next).toBe(true);
  });

  it("imageBlock を呼ぶのは、決まったファイルだけ（紙を読む道と mediaForClaude）", () => {
    const allowed = new Set([
      "lib/claude.ts", // 定義
      "lib/media.ts", // mediaForClaude（写真。家族の印と同意がある時だけ）
      "app/api/capture/photo/route.ts", // 紙を読む（残さない）
      "app/api/techo/photo/route.ts", // 紙の母子手帳のページを読む（残さない）
      "app/api/visit/_lib/server.ts", // 健診の紙を読む（残さない）
    ]);
    for (const f of calling) expect(allowed.has(f), `${f} が imageBlock を呼んでいます（写真は mediaForClaude だけ）`).toBe(true);
  });
});
