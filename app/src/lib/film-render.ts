// 映画を1本の動画（mp4・1280×720・30コマ）に書き出す。
// 台本は画面の映画と同じ（lib/film-plan.ts）。写真はゆっくり寄り（zoompan）・重ねて切り替え（xfade）、字幕は sharp で画像にして重ねる
// （この機械の ffmpeg は字を書けない作りのため）。声はその写真の時刻に流し、音楽（lib/musicbox.ts）はその間だけ小さくする。
// 守り: 組むのはこのサーバの中だけ。Claude にも外のサービスにも送らない。解いた写真・声は一時フォルダに置き、組み終わったら消す。
// できた動画は家族の鍵で暗号にして media（kind video）に置く。
import "server-only";
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";
import type { HouseholdCtx } from "./access";
import type { Book } from "./book";
import { sealForHousehold } from "./crypto";
import type { MediaRow } from "./db";
import { CROSSFADE_SEC, dayLine, filmShots, filmTimeline, firstSentences, letterLine, voiceSpans, type FilmLetter, type Shot } from "./film-plan";
import { audit } from "./households";
import { HttpError } from "./http-error";
import { openedVoiceLetters, readLetterVoice } from "./letters";
import { readVariant, toClient, type MediaData } from "./media";
import type { ClientMedia } from "./media-shared";
import { renderMusicWav } from "./musicbox";
import { mediaKey } from "./storage";

const run = promisify(execFile);

export const W = 1280;
export const H = 720;
export const FPS = 30;
const FONT = "Hiragino Maru Gothic ProN, Zen Maru Gothic, Noto Sans CJK JP, Noto Sans JP, sans-serif";

/** 一冊の映画の印（同じ一冊・同じ写真と声なら、作り直さない） */
export function filmKey(book: Book, shots: readonly Shot<ClientMedia>[]): string {
  const ids = shots.map((s) => (s.kind === "photo" ? `${s.photo.id}:${s.voice?.id ?? ""}:${s.caption}:${s.sec}` : s.kind === "letter" ? `letter:${s.letter.id}:${s.sec}` : s.kind));
  return createHash("sha256").update(JSON.stringify([book.generatedAt, book.title, ids])).digest("hex").slice(0, 32);
}

/** 映画の場面と、使う写真・声の行。today は開いた手紙を決める日（本物の家族はサーバの日付・作った家族だけ画面の「今日」） */
export function filmFor(ctx: HouseholdCtx, book: Book, today?: string | null): { shots: Shot<ClientMedia>[]; rows: Map<string, MediaRow<MediaData>> } {
  const rows = new Map<string, MediaRow<MediaData>>();
  for (const kind of ["photo", "audio"] as const) for (const r of ctx.db.media.list<MediaData>({ kind })) if (!r.trashedAt) rows.set(r.id, r);
  const media = [...rows.values()].map((r) => toClient(ctx.household.id, r));
  return { shots: filmShots(book.film, media, openedVoiceLetters(ctx, today)), rows };
}

/** 書き出した動画（この一冊の物）。無ければ null */
export function existingFilm(ctx: HouseholdCtx, key: string): MediaRow<MediaData & { filmKey?: string }> | null {
  return ctx.db.media.list<MediaData & { filmKey?: string }>({ kind: "video" }).find((r) => !r.trashedAt && r.data.filmKey === key) ?? null;
}

// ───────── 字幕・題・終わりの画像（SVG → PNG） ─────────

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** 日本語を1行 n 字ほどで折る（句読点の後で折れる時はそこで） */
export function wrapJa(s: string, n: number, maxLines: number): string[] {
  const lines: string[] = [];
  let rest = s.replace(/\s+/g, " ").trim();
  while (rest && lines.length < maxLines) {
    if (rest.length <= n) {
      lines.push(rest);
      rest = "";
      break;
    }
    let cut = n;
    const p = Math.max(rest.lastIndexOf("。", n), rest.lastIndexOf("、", n));
    if (p >= n * 0.6) cut = p + 1;
    lines.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest && lines.length) lines[lines.length - 1] = lines[lines.length - 1].slice(0, -1) + "…";
  return lines;
}

const text = (x: number, y: number, size: number, body: string, o: { weight?: number; opacity?: number; spacing?: number; shadow?: boolean } = {}) =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${o.weight ?? 400}" fill="#f4f1ea" fill-opacity="${o.opacity ?? 1}" text-anchor="middle"${o.spacing ? ` letter-spacing="${o.spacing}"` : ""}${o.shadow ? ' filter="url(#s)"' : ""}>${esc(body)}</text>`;

const svg = (inner: string, bg = "") =>
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.72"/></linearGradient><filter id="s"><feDropShadow dx="0" dy="1" stdDeviation="4" flood-opacity="0.6"/></filter></defs>${bg}${inner}</svg>`,
  );

export async function captionPng(caption: string, date: string, voiceTitle?: string): Promise<Buffer> {
  const lines = wrapJa(caption, 24, 2);
  const base = H - 64 - (voiceTitle ? 44 : 0);
  const capY = (i: number) => base - 40 - (lines.length - 1 - i) * 50;
  const pill = voiceTitle
    ? `<rect x="${W / 2 - (voiceTitle.length * 20 + 56) / 2}" y="${H - 86}" width="${voiceTitle.length * 20 + 56}" height="38" rx="19" fill="#000" fill-opacity="0.45"/>${text(W / 2, H - 60, 20, `♪ ${voiceTitle}`)}`
    : "";
  const inner = `<rect x="0" y="${H / 2}" width="${W}" height="${H / 2}" fill="url(#g)"/>${lines.map((l, i) => text(W / 2, capY(i), 40, l, { weight: 700, shadow: true })).join("")}${text(W / 2, base + 6, 22, dayLine(date), { opacity: 0.85 })}${pill}`;
  return sharp(svg(inner)).png().toBuffer();
}

export async function titlePng(book: Pick<Book, "title" | "childName">): Promise<Buffer> {
  const t = wrapJa(book.title, 20, 2);
  const inner = `${text(W / 2, 250, 20, "1000 日 の 記 録", { opacity: 0.7, spacing: 8 })}${t.map((l, i) => text(W / 2, 340 + i * 60, 50, l, { weight: 700 })).join("")}${text(W / 2, 340 + t.length * 60 + 30, 28, `${book.childName}へ`, { opacity: 0.9 })}`;
  return sharp(svg(inner, `<rect width="${W}" height="${H}" fill="#0d0c10"/>`)).png().toBuffer();
}

/** 開いた手紙の場面: 封筒の絵と「誰から 誰へ」「書いた日・開いた日」。手紙の文字は出さない */
export async function letterPng(l: Pick<FilmLetter, "from" | "to" | "sealedOn" | "openOn">): Promise<Buffer> {
  const cx = W / 2;
  const env = `<g transform="translate(${cx - 70} 170)" fill="none" stroke="#e9c9a8" stroke-width="5" stroke-linejoin="round"><rect x="0" y="0" width="140" height="96" rx="10"/><path d="M4 8 L70 58 L136 8"/></g>`;
  const inner = `${env}${text(cx, 330, 22, "未 来 の 手 紙", { opacity: 0.7, spacing: 8 })}${text(cx, 400, 46, `${l.from}から ${l.to}へ`, { weight: 700 })}${text(cx, 460, 24, letterLine(l), { opacity: 0.85 })}${text(cx, 560, 22, "♪ 声の手紙", { opacity: 0.75 })}`;
  return sharp(svg(inner, `<rect width="${W}" height="${H}" fill="#1f1812"/>`)).png().toBuffer();
}

export async function endPng(book: Pick<Book, "closing" | "asOf">): Promise<Buffer> {
  const lines = wrapJa(firstSentences(book.closing), 26, 5);
  const top = H / 2 - (lines.length * 54) / 2;
  const inner = `${lines.map((l, i) => text(W / 2, top + 40 + i * 54, 32, l)).join("")}${text(W / 2, top + 40 + lines.length * 54 + 30, 22, dayLine(book.asOf), { opacity: 0.7 })}`;
  return sharp(svg(inner, `<rect width="${W}" height="${H}" fill="#0d0c10"/>`)).png().toBuffer();
}

// ───────── 組む ─────────

/** 写真のゆっくり寄り（画面の kb0〜kb3 に近い4通り）。on は今のコマ、N は全コマ */
function kenBurns(n: number, frames: number): string {
  const N = Math.max(1, frames - 1);
  const p = `(on/${N})`;
  const zs = [`1.02+0.12*${p}`, `1.14-0.11*${p}`, `1.05+0.10*${p}`, `1.12-0.10*${p}`][n % 4];
  // 寄る先を少しずつずらす（x・y は拡大後の左上）
  const dx = [`-0.02*${p}`, `0.02*(1-${p})`, `-0.02+0.04*${p}`, `0`][n % 4];
  const dy = [`-0.015*${p}`, `0.01*(1-${p})`, `-0.01*${p}`, `0.02-0.03*${p}`][n % 4];
  return `zoompan=z='${zs}':x='(iw-iw/zoom)/2+iw*(${dx})':y='(ih-ih/zoom)/2+ih*(${dy})':d=${frames}:s=${W}x${H}:fps=${FPS}`;
}

const extOf = (mime: string) => (mime.includes("webm") ? "webm" : mime.includes("ogg") ? "ogg" : mime.includes("wav") ? "wav" : mime.includes("mpeg") ? "mp3" : "m4a");

export async function ffmpegBin(): Promise<string | null> {
  for (const p of [process.env.BOSHI_FFMPEG, "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"].filter(Boolean) as string[]) if (fs.existsSync(p)) return p;
  return null;
}

/**
 * 動画を組んで、mp4 の中身と長さを返す（置くのは saveFilmVideo）。
 * 一時フォルダは必ず消す（途中で失敗しても）。
 */
export async function renderFilm(
  ctx: HouseholdCtx,
  book: Book,
  shots: readonly Shot<ClientMedia>[],
  rows: ReadonlyMap<string, MediaRow<MediaData>>,
  today?: string | null,
): Promise<{ mp4: Buffer; durationSec: number }> {
  const ff = await ffmpegBin();
  if (!ff) throw new HttpError(503, "この置き場では動画を作れません（ffmpeg がありません）");
  if (!shots.length) throw new HttpError(400, "映画にする写真がまだありません");
  const { items, total } = filmTimeline(shots);
  // 一時フォルダの親は BOSHI_TMP_DIR（試験で、ほかの書き出しと混ざらないように）か、機械の一時フォルダ
  const dir = fs.mkdtempSync(path.join(process.env.BOSHI_TMP_DIR || os.tmpdir(), "boshi-film-"));
  try {
    const args: string[] = ["-hide_banner", "-loglevel", "error", "-y"];
    const filters: string[] = [];
    let input = 0;
    const vlabels: string[] = [];
    for (const [i, it] of items.entries()) {
      const s = it.shot;
      const len = s.sec + CROSSFADE_SEC;
      const frames = Math.round(len * FPS);
      if (s.kind === "photo") {
        const row = rows.get(s.photo.id);
        const got = row ? await readVariant(ctx, row, "view") : null;
        if (!got) throw new HttpError(404, "写真のファイルが見つかりません");
        const img = path.join(dir, `p${i}.jpg`);
        fs.writeFileSync(img, got.buf);
        const cap = path.join(dir, `c${i}.png`);
        fs.writeFileSync(cap, await captionPng(s.caption, s.photo.date, s.voice?.title));
        args.push("-i", img, "-loop", "1", "-framerate", String(FPS), "-t", len.toFixed(3), "-i", cap);
        filters.push(
          `[${input}:v]scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase,crop=${W * 2}:${H * 2},setsar=1,${kenBurns(i, frames)},trim=end_frame=${frames},setpts=PTS-STARTPTS[b${i}]`,
          `[${input + 1}:v]format=rgba,fade=in:st=0.5:d=1.2:alpha=1[o${i}]`,
          `[b${i}][o${i}]overlay=0:0:shortest=1,format=yuv420p,setsar=1[v${i}]`,
        );
        input += 2;
      } else {
        const card = path.join(dir, `k${i}.png`);
        fs.writeFileSync(card, s.kind === "title" ? await titlePng(book) : s.kind === "letter" ? await letterPng(s.letter) : await endPng(book));
        args.push("-loop", "1", "-framerate", String(FPS), "-t", len.toFixed(3), "-i", card);
        filters.push(`[${input}:v]scale=${W}:${H},format=yuv420p,setsar=1,fps=${FPS}[v${i}]`);
        input += 1;
      }
      vlabels.push(`v${i}`);
    }
    // 重ねて切り替える（場面 k は items[k].start から）
    let last = vlabels[0];
    for (let k = 1; k < vlabels.length; k++) {
      const out = k === vlabels.length - 1 ? "vout" : `x${k}`;
      filters.push(`[${last}][${vlabels[k]}]xfade=transition=fade:duration=${CROSSFADE_SEC}:offset=${items[k].start.toFixed(3)}[${out}]`);
      last = out;
    }
    if (vlabels.length === 1) filters.push(`[${last}]null[vout]`);

    // 音: 音楽（声の間は小さく）＋ 声（その場面の時刻に）
    const music = path.join(dir, "music.wav");
    fs.writeFileSync(music, renderMusicWav(total, voiceSpans(items)));
    args.push("-i", music);
    const mIn = input++;
    const alabels = [`[${mIn}:a]`];
    for (const [i, it] of items.entries()) {
      if (it.voiceAt == null) continue;
      let got: { buf: Buffer; mime: string } | null = null;
      if (it.shot.kind === "photo" && it.shot.voice) {
        const row = rows.get(it.shot.voice.id);
        got = row ? await readVariant(ctx, row, "orig") : null;
      } else if (it.shot.kind === "letter") {
        // 手紙の関所を通して解く（開く日の前なら 403 で止まる）
        got = await readLetterVoice(ctx, it.shot.letter.id, today);
      }
      if (!got) continue;
      const f = path.join(dir, `a${i}.${extOf(got.mime)}`);
      fs.writeFileSync(f, got.buf);
      args.push("-i", f);
      const ms = Math.round(it.voiceAt * 1000);
      filters.push(`[${input}:a]aresample=44100,aformat=channel_layouts=mono,adelay=${ms}:all=1[a${i}]`);
      alabels.push(`[a${i}]`);
      input++;
    }
    filters.push(`${alabels.join("")}amix=inputs=${alabels.length}:normalize=0:duration=first,alimiter=limit=0.95[aout]`);

    const out = path.join(dir, "film.mp4");
    // 組み方は引数で渡す（-filter_complex_script は新しい ffmpeg で消え、-/filter_complex は古い ffmpeg に無い）
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[vout]", "-map", "[aout]",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", "-r", String(FPS),
      "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
      "-t", total.toFixed(3), "-movflags", "+faststart", out,
    );
    try {
      await run(ff, args, { maxBuffer: 16 * 1024 * 1024, timeout: 10 * 60_000 });
    } catch (e) {
      console.error("film render", (e as { stderr?: string }).stderr?.slice(-2000) ?? e);
      throw new HttpError(500, "動画を作れませんでした");
    }
    return { mp4: fs.readFileSync(out), durationSec: Math.round(total * 10) / 10 };
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/** できた動画を家族の鍵で暗号にして置く（media kind video）。アルバムの写真の一覧には混ざらない */
export async function saveFilmVideo(ctx: HouseholdCtx, mp4: Buffer, o: { key: string; title: string; durationSec: number; date: string }): Promise<MediaRow<MediaData & { filmKey?: string }>> {
  const hid = ctx.household.id;
  const id = randomUUID();
  const subjectId = ctx.subjects.find((s) => s.kind === "child")?.id ?? null;
  const storageKey = mediaKey({ householdId: hid, subjectId, kind: "video", id, date: o.date });
  const sealed = sealForHousehold(hid, mp4, `${id}:orig`);
  await ctx.storage.put(`${storageKey}/orig`, sealed.ciphertext, { contentType: "application/octet-stream" });
  const data: MediaData & { filmKey: string } = {
    links: {},
    shareWithClaude: false,
    variants: { orig: { iv: sealed.iv, tag: sealed.tag, bytes: mp4.length, mime: "video/mp4" } },
    title: o.title,
    durationSec: o.durationSec,
    hidden: true, // 一冊・映画の写真の候補には入れない
    filmKey: o.key,
    ...(ctx.household.kind !== "real" ? { made: true as const } : {}),
  };
  try {
    const row = ctx.db.media.insert<MediaData & { filmKey: string }>({
      id,
      subjectId,
      kind: "video",
      storageKey,
      mime: "video/mp4",
      bytes: mp4.length,
      iv: sealed.iv,
      tag: sealed.tag,
      takenAt: `${o.date}T12:00:00`,
      takenAtFrom: "manual",
      sha256: createHash("sha256").update(mp4).digest("hex"),
      data,
    });
    audit(hid, ctx.account?.id ?? null, "media.film", { target: id, detail: { durationSec: o.durationSec } });
    return row;
  } catch (e) {
    await ctx.storage.delete(storageKey).catch(() => {});
    throw e;
  }
}
