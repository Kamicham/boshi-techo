// 映画の書き出しの試験: 台本から秒と声の時刻が決まる・みんなの章が終わりの前に入る・音楽の長さと声の間の小ささ・
// 見本の家族の写真3枚と声1本で本当に mp4 ができ、長さと音が入り、一時フォルダが残らない（ffmpeg がある所だけ）。
// DB と置き場は一時フォルダに作る（わが家の app/data には触らない）。写真と声は作った見本の家族の物だけ。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-film-test-"));
process.env.BOSHI_DATA_DIR = dir;
process.env.BETTER_AUTH_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BOSHI_KEK = "00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff";
delete process.env.BOSHI_STORAGE;
delete process.env.BOSHI_SIM;

type Plan = typeof import("./film-plan");
type MB = typeof import("./musicbox");
let P: Plan, MBX: MB;

beforeAll(async () => {
  P = await import("./film-plan");
  MBX = await import("./musicbox");
});
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const m = (id: string, kind: string, o: Partial<import("./film-plan").FilmMedia> = {}) => ({ id, kind, date: "2027-05-01", ...o });

describe("台本", () => {
  it("題 → 写真 → みんなの章 → 終わり。声のある場面は声の長さ＋1.2秒（18秒まで）、隠した物・消えた物は飛ばす", () => {
    const media = [
      m("p1", "photo"),
      m("p2", "photo", { hidden: true }),
      m("p3", "photo"),
      m("v1", "audio", { durationSec: 6 }),
      m("v2", "audio", { durationSec: 40 }),
      m("g1", "photo", { from: { name: "ばあば" }, caption: "箱が届いた", date: "2027-05-06" }),
      m("gv", "audio", { from: { name: "ばあば" }, durationSec: 9 }),
    ];
    const film = [
      { mediaId: "p1", sec: 4, caption: "一", voiceId: "v1" },
      { mediaId: "p2", sec: 4, caption: "隠した" },
      { mediaId: "gone", sec: 4, caption: "消えた" },
      { mediaId: "p3", sec: 5, caption: "三", voiceId: "v2" },
    ];
    const shots = P.filmShots(film, media);
    expect(shots.map((s) => (s.kind === "photo" ? s.photo.id : s.kind))).toEqual(["title", "p1", "p3", "g1", "end"]);
    const sec = shots.map((s) => s.sec);
    expect(sec).toEqual([P.TITLE_SEC, 7.2, P.MAX_VOICE_SHOT_SEC, 10.2, P.END_SEC]);
    const g = shots[3];
    expect(g.kind === "photo" && g.voice?.id).toBe("gv");

    const { items, total } = P.filmTimeline(shots);
    expect(items.map((x) => x.start)).toEqual([0, 4, 11.2, 29.2, 39.4]);
    expect(items[1].voiceAt).toBeCloseTo(4 + P.VOICE_LEAD_SEC);
    expect(items[0].voiceAt).toBeNull();
    expect(total).toBeCloseTo(39.4 + P.END_SEC + P.CROSSFADE_SEC);
    expect(P.voiceSpans(items)[0]).toEqual({ from: 4.6, to: 10.6 });
    // 写真が1枚も無い台本は、映画にしない
    expect(P.filmShots([{ mediaId: "gone", sec: 4, caption: "" }], media)).toEqual([]);
  });
});

describe("音楽（オルゴール）", () => {
  it("長さは全体と同じ。声の間は小さい。同じ引数なら同じ中身", () => {
    const rate = 8000;
    const w = MBX.renderMusicWav(12, [{ from: 5, to: 9 }], rate);
    expect(w.subarray(0, 4).toString()).toBe("RIFF");
    const n = (w.length - 44) / 2;
    expect(n).toBe(12 * rate);
    const rms = (a: number, b: number) => {
      let s = 0;
      for (let i = Math.round(a * rate); i < Math.round(b * rate); i++) s += w.readInt16LE(44 + i * 2) ** 2;
      return Math.sqrt(s / ((b - a) * rate));
    };
    expect(rms(6.5, 8.5)).toBeLessThan(rms(2.5, 4.5) * 0.5);
    expect(MBX.renderMusicWav(12, [{ from: 5, to: 9 }], rate).equals(w)).toBe(true);
  });
});

const ffmpeg = ["/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].find((p) => fs.existsSync(p));
const ffprobe = ffmpeg?.replace(/ffmpeg$/, "ffprobe");

describe.skipIf(!ffmpeg || !fs.existsSync(ffprobe ?? ""))("見本の家族で mp4 を書き出す", () => {
  it("写真3枚と声1本で、長さの合う mp4（映像と音）ができ、暗号にして置かれる。一時フォルダは残らない", async () => {
    const A = await import("./access");
    const M = await import("./media");
    const R = await import("./film-render");
    const req = new Request("http://localhost:3000/api/x");
    const ctx = await A.withHousehold(req, "demo-sato", "media:write");
    const base = ["demo-media", "app/demo-media"].map((d) => path.join(process.cwd(), d)).find((d) => fs.existsSync(d))!;
    const add = (f: string, today: string, caption: string) => M.saveUpload(ctx, { orig: fs.readFileSync(path.join(base, f)), caption, today, made: true });
    const a = await add("p03-echo.jpg", "2026-10-01", "はじめてのエコー写真");
    const b = await add("b01-finger.jpg", "2027-04-26", "はじめまして");
    const c = await add("g01-parcel.jpg", "2027-05-06", "鹿児島から箱が届いた");
    const v = await M.saveAudio(ctx, { audio: fs.readFileSync(path.join(base, "v04.m4a")), moment: "name", who: "翔太", spokenTo: "ひなた", durationSec: 4.7, today: "2027-04-26" });
    const book = {
      familyId: "demo-sato",
      title: "見本の一冊",
      childName: "ひなた",
      asOf: "2027-06-01",
      generatedAt: "2027-06-01T00:00:00Z",
      closing: "あなたに会えた日のことを、ずっと覚えています。生まれてきてくれて、ありがとう。",
      film: [
        { mediaId: a.media.id, sec: 3, caption: "はじめてのエコー写真" },
        { mediaId: b.media.id, sec: 3, caption: "はじめまして", voiceId: v.media.id },
        { mediaId: c.media.id, sec: 3, caption: "鹿児島から箱が届いた" },
      ],
    } as unknown as import("./book").Book;
    const { shots, rows } = R.filmFor(ctx, book);
    expect(shots.length).toBe(5);
    const before = fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith("boshi-film-") && !x.startsWith("boshi-film-test-")).length;
    const { mp4, durationSec } = await R.renderFilm(ctx, book, shots, rows);
    const after = fs.readdirSync(os.tmpdir()).filter((x) => x.startsWith("boshi-film-") && !x.startsWith("boshi-film-test-")).length;
    expect(after).toBe(before);
    const out = path.join(dir, "out.mp4");
    fs.writeFileSync(out, mp4);
    const probe = JSON.parse(execFileSync(ffprobe!, ["-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height", "-of", "json", out]).toString()) as {
      format: { duration: string };
      streams: { codec_type: string; width?: number; height?: number }[];
    };
    expect(probe.streams.map((s) => s.codec_type).sort()).toEqual(["audio", "video"]);
    expect(probe.streams.find((s) => s.codec_type === "video")).toMatchObject({ width: 1280, height: 720 });
    expect(Math.abs(Number(probe.format.duration) - durationSec)).toBeLessThan(0.5);

    const key = R.filmKey(book, shots);
    const row = await R.saveFilmVideo(ctx, mp4, { key, title: book.title, durationSec, date: book.asOf });
    expect(R.existingFilm(ctx, key)?.id).toBe(row.id);
    const onDisk = await ctx.storage.get(`${row.storageKey}/orig`);
    expect(onDisk!.equals(mp4)).toBe(false);
    expect((await M.readVariant(ctx, row, "orig"))!.buf.equals(mp4)).toBe(true);
    // アルバムの写真・声の一覧には混ざらない
    expect(ctx.db.media.list({ kind: "photo" }).some((x) => x.id === row.id)).toBe(false);
  }, 180_000);
});

describe("字幕の折り返し", () => {
  it("句読点の後で折り、行を超えたら … で切る", async () => {
    const R = await import("./film-render");
    expect(R.wrapJa("短い", 10, 2)).toEqual(["短い"]);
    const xs = R.wrapJa("線が2本。しばらく二人で黙って見ていた、あの朝のことを覚えている。", 12, 2);
    expect(xs.length).toBe(2);
    expect(xs[0].endsWith("。") || xs[0].endsWith("、") || xs[0].length === 12).toBe(true);
    expect(xs[1].endsWith("…")).toBe(true);
  });
});
