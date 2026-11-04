// 写真を残す（サーバ側）。受け取る・GPS を消す・暗号にして置く・読む・ゴミ箱・一冊の候補（文字だけ）。
// - 置き場は土台の storage（households/<hid>/<subject|shared>/photo/<yyyy>/<id>/orig|view|thumb）、台帳は media の表
// - ファイルは世帯の鍵で暗号にしてから置く（aad は "<id>:<形>"）
// - 画像を Claude に渡せるのは、このファイルの mediaForClaude だけ（試験で grep して守る）。家族が1枚ずつ印を付け、同意がある時だけ
// - 呼ぶ前に必ず lib/access.ts の withHousehold を通す（ctx を受け取る関数は、その世帯の中だけに触れる）
import "server-only";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import type Anthropic from "@anthropic-ai/sdk";
import type { HouseholdCtx } from "./access";
import { imageBlock } from "./claude";
import { openForHousehold, sealForHousehold, sha256Hex } from "./crypto";
import { forHousehold, type MediaRow } from "./db";
import type { Family } from "./demo-family";
import { HttpError } from "./http-error";
import { allConsented, audit } from "./households";
import { mediaKey } from "./storage";
import { listTecho } from "./techo-store";
import {
  ageLabel,
  hasGps,
  imageSize,
  isPhotoPage,
  jpegSize,
  MAX_PHOTO_BYTES,
  milestoneById,
  milestoneFor,
  periodOfDate,
  photoDate,
  photoScore,
  readExifDate,
  MAX_VOICE_BYTES,
  sniffAudio,
  sniffMime,
  stripGps,
  voiceTitle,
  type MediaFrom,
  TRASH_DAYS,
  VIEW_SIDE,
  THUMB_SIDE,
  type ClientMedia,
  type MediaData,
  type Period,
  type PhotoVariant,
  type VoiceMoment,
} from "./media-shared";

export * from "./media-shared";

export type PhotoRow = MediaRow<MediaData>;

// ───────── Mac の sips（HEIC を JPEG に・縮める）。無い所では使わない ─────────

const run = promisify(execFile);
const SIPS = "/usr/bin/sips";

async function sipsJpeg(buf: Buffer, maxSide?: number): Promise<Buffer | null> {
  if (process.platform !== "darwin" || !fs.existsSync(SIPS)) return null;
  // 家族の写真を一時に置くのは変換の間だけ（自分だけが読める形で置き、すぐ消す）
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-media-"));
  try {
    const inp = path.join(dir, "in");
    const out = path.join(dir, "out.jpg");
    fs.writeFileSync(inp, buf, { mode: 0o600 });
    const args = ["-s", "format", "jpeg", "-s", "formatOptions", "85"];
    if (maxSide) args.push("-Z", String(maxSide));
    await run(SIPS, [...args, inp, "--out", out], { timeout: 60_000 });
    const b = fs.readFileSync(out);
    return sniffMime(b) === "image/jpeg" ? b : null;
  } catch {
    return null;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ───────── 時刻 ─────────

/** 日本時間の "YYYY-MM-DDTHH:MM:SS" */
function jstStamp(ms: number): string {
  return new Date(ms + 9 * 3600_000).toISOString().slice(0, 19);
}

function takenFromFile(lastModified: number | null | undefined, now: number): string | null {
  if (typeof lastModified !== "number" || !Number.isFinite(lastModified)) return null;
  // 2000年より前・明日より先は、端末の時計か送り方の誤りとして使わない
  if (lastModified < Date.UTC(2000, 0, 1) || lastModified > now + 86_400_000) return null;
  return jstStamp(lastModified);
}

// ───────── 受け取る ─────────

export type TechoChoice = { id: string; page: string; title: string; date: string };

export interface UploadInput {
  /** 受け取ったままの原本 */
  orig: Buffer;
  /** 端末で縮めた画面用（長い辺 1568px の JPEG）・一覧用（400px）。無ければサーバで作る */
  view?: Buffer | null;
  thumb?: Buffer | null;
  /** 端末のファイルの日時（ミリ秒）。EXIF が無い時に使う */
  lastModified?: number | null;
  techoId?: string | null;
  caption?: string | null;
  who?: string | null;
  /** ★を付けて残す時、付けた人 */
  starBy?: string | null;
  subjectId?: string | null;
  made?: boolean;
  today?: string;
  /** みんなの章（祖父母など）が足した物 */
  from?: MediaFrom | null;
}

export interface UploadResult {
  media: PhotoRow;
  duplicate: boolean;
  /** その日の手帳の記録（結ぶ先の候補） */
  candidates: TechoChoice[];
}

/** 縮めた形を確かめる（JPEG だけ・GPS を消す）。使えなければ null */
function cleanVariant(b: Buffer | null | undefined, maxBytes: number): Buffer | null {
  if (!b || b.length === 0 || b.length > maxBytes || sniffMime(b) !== "image/jpeg") return null;
  try {
    const s = Buffer.from(stripGps(b));
    return hasGps(s) ? null : s;
  } catch {
    return null;
  }
}

/** その日の手帳の記録（写真の枠のあるページ・OK 済みだけ） */
export function techoChoices(householdId: string, family: Family | null, date: string, today?: string): TechoChoice[] {
  return listTecho(householdId, { family: family ?? undefined, today })
    .filter((d) => !d.data.pending && isPhotoPage(d.data.page) && d.data.date === date)
    .map((d) => ({ id: d.id, page: d.data.page, title: d.data.title, date: d.data.date }));
}

/** 手帳の記録が今もあるか（作った家族の作った記録も含む）。ある id だけを返す */
export function existingTechoIds(householdId: string, family: Family | null, ids: readonly string[], today?: string): string[] {
  if (!ids.length) return [];
  const have = new Set(listTecho(householdId, { family: family ?? undefined, today }).map((d) => d.id));
  return ids.filter((id) => have.has(id));
}

/**
 * 1枚を受け取って残す。Claude には何も送らない。
 * 1) 形式を中身で見分ける（動画はまだ受け付けない） 2) 同じ中身（sha256）があれば、その行を返す
 * 3) 撮った日: EXIF → ファイルの日時 → 受け取った日 4) HEIC は Mac の sips で JPEG に
 * 5) GPS を消し、残っていないことを確かめてから、世帯の鍵で暗号にして置く
 * 6) 節目・その日の手帳の記録に結ぶ（記録が1件だけの時。手帳から足した時はその記録）
 */
export async function saveUpload(ctx: HouseholdCtx, input: UploadInput): Promise<UploadResult> {
  const hid = ctx.household.id;
  const now = Date.now();
  const raw = input.orig;
  if (!raw?.length) throw new HttpError(400, "写真が空です");
  if (raw.length > MAX_PHOTO_BYTES) throw new HttpError(413, "写真が大きすぎます（30MB まで）");
  const mime0 = sniffMime(raw);
  if (!mime0) throw new HttpError(415, "写真の形式が読めません（JPEG・PNG・HEIC）");
  if (mime0.startsWith("video/")) throw new HttpError(415, "動画を残すのは、もう少し後で使えるようにします。いまは写真だけです");

  const sha = sha256Hex(raw);
  const dup = ctx.db.media.findBySha<MediaData>(sha);
  if (dup) {
    const date = photoDate(dup);
    return { media: dup, duplicate: true, candidates: techoChoices(hid, ctx.family, date, input.today) };
  }

  // 撮った日（GPS を消す前の原本から読む）
  // 作った家族（デモ・シミュレーション）は時計を進めて見るので、写真の日も画面の「今日」にする（本当の日付だと生まれる前に並ぶ）
  const madeToday = ctx.household.kind !== "real" && input.today && /^\d{4}-\d{2}-\d{2}$/.test(input.today) ? input.today : null;
  const exifAt = madeToday ? null : readExifDate(raw);
  const fileAt = exifAt || madeToday ? null : takenFromFile(input.lastModified, now);
  const takenAt = exifAt ?? fileAt ?? (madeToday ? `${madeToday}${jstStamp(now).slice(10)}` : jstStamp(now));
  const takenAtFrom = exifAt ? "exif" : fileAt ? "file" : "upload";

  // HEIC・AVIF は JPEG にしてから扱う（どの機械でも開ける形で残す）
  let orig: Buffer = raw;
  if (mime0 === "image/heic" || mime0 === "image/avif") {
    const j = await sipsJpeg(raw);
    if (!j) throw new HttpError(415, "HEIC の写真を読めませんでした（iPhone の設定 → カメラ → フォーマット →「互換性優先」で撮ると届きます）");
    orig = j;
  }
  let clean: Buffer;
  try {
    clean = Buffer.from(stripGps(orig));
  } catch (e) {
    throw new HttpError(415, (e as Error).message);
  }
  if (hasGps(clean)) throw new HttpError(422, "写真の位置の情報を消せなかったので、残しませんでした");
  const mime = sniffMime(clean) ?? "image/jpeg";

  // 画面用・一覧用: 端末で縮めた物 → Mac の sips → 原本（JPEG の時だけ）の順
  // 小さな写真は大きくしない（sips の -Z は小さい物も引き伸ばすので、長い辺がはみ出す時だけ縮める）
  const side = (() => {
    const z = imageSize(clean);
    return z ? Math.max(z.w, z.h) : Infinity;
  })();
  const shrink = async (max: number) => (side <= max ? (mime === "image/jpeg" ? clean : await sipsJpeg(clean)) : await sipsJpeg(clean, max));
  let view = cleanVariant(input.view, 12 * 1024 * 1024);
  if (!view) view = cleanVariant(await shrink(VIEW_SIDE), 12 * 1024 * 1024);
  if (!view && mime === "image/jpeg") view = clean;
  let thumb = cleanVariant(input.thumb, 2 * 1024 * 1024);
  if (!thumb) thumb = cleanVariant(await shrink(THUMB_SIDE), 2 * 1024 * 1024);
  if (!thumb) thumb = view;
  const size = view ? jpegSize(view) : null;

  // 本人: 選んだ人（見てよい本人だけ）。無ければ子、子がいなければ世帯全体
  let subjectId: string | null = null;
  if (input.subjectId) {
    if (!ctx.subjects.some((s) => s.id === input.subjectId)) throw new HttpError(404, "見つかりません");
    subjectId = input.subjectId;
  } else subjectId = ctx.subjects.find((s) => s.kind === "child")?.id ?? null;

  // 結ぶ先
  const date = takenAt.slice(0, 10);
  const candidates = techoChoices(hid, ctx.family, date, input.today);
  let techoIds: string[] = [];
  if (input.techoId) techoIds = existingTechoIds(hid, ctx.family, [input.techoId], input.today);
  else if (candidates.length === 1) techoIds = [candidates[0].id];
  const birth = ctx.family?.birthDate;
  const ms = milestoneFor(birth, date);

  const id = randomUUID();
  const storageKey = mediaKey({ householdId: hid, subjectId, kind: "photo", id, date });
  const variants: MediaData["variants"] = {};
  const put = async (v: PhotoVariant, buf: Buffer, m: string) => {
    const s = sealForHousehold(hid, buf, `${id}:${v}`);
    await ctx.storage.put(`${storageKey}/${v}`, s.ciphertext, { contentType: "application/octet-stream" });
    variants[v] = { iv: s.iv, tag: s.tag, bytes: buf.length, mime: m };
    return s;
  };
  let sealed: { iv: string; tag: string };
  try {
    sealed = await put("orig", clean, mime);
    if (view && view !== clean) await put("view", view, "image/jpeg");
    if (thumb && thumb !== clean && thumb !== view) await put("thumb", thumb, "image/jpeg");
  } catch (e) {
    await ctx.storage.delete(storageKey).catch(() => {});
    throw e;
  }
  const caption = typeof input.caption === "string" && input.caption.trim() ? input.caption.trim().slice(0, 400) : undefined;
  const data: MediaData = {
    links: { ...(techoIds.length ? { techoIds } : {}), ...(ms ? { milestone: ms.id } : {}) },
    shareWithClaude: false,
    variants,
    ...(caption ? { caption, captionBy: "family" as const } : {}),
    ...(input.who ? { who: String(input.who).slice(0, 40) } : {}),
    ...(input.starBy ? { star: [input.starBy] } : {}),
    ...(birth ? { ageDays: Math.round((Date.parse(date) - Date.parse(birth)) / 86_400_000) } : {}),
    ...(input.made ? { made: true as const } : {}),
    ...(size ? { w: size.w, h: size.h } : {}),
    ...(cleanFrom(input.from) ? { from: cleanFrom(input.from) } : {}),
  };
  let row: PhotoRow;
  try {
    row = ctx.db.media.insert<MediaData>({
      id,
      subjectId,
      kind: "photo",
      storageKey,
      mime,
      bytes: clean.length,
      iv: sealed.iv,
      tag: sealed.tag,
      takenAt,
      takenAtFrom,
      sha256: sha,
      data,
    });
  } catch (e) {
    await ctx.storage.delete(storageKey).catch(() => {});
    throw e;
  }
  audit(hid, ctx.account?.id ?? null, "media.add", { target: id });
  return { media: row, duplicate: false, candidates };
}

// ───────── 声を残す ─────────

export interface VoiceInput {
  audio: Buffer;
  moment?: VoiceMoment | null;
  who?: string | null;
  spokenTo?: string | null;
  transcript?: string | null;
  durationSec?: number | null;
  caption?: string | null;
  subjectId?: string | null;
  /** 作った家族（デモ・シミュレーション）: 録った日にする日（画面の「今日」か、種の日） */
  today?: string;
  made?: boolean;
  seedKey?: string;
  from?: MediaFrom | null;
}

/**
 * 声を1本残す。写真と同じく世帯の鍵で暗号にして置く。声そのものは Claude にも外の機械にも渡さない
 * （文字起こしは自宅の機械 lib/asr.ts。ここでは受け取った文字を残すだけ）。
 * 同じ中身（sha256）は二度入れない。
 */
export async function saveAudio(ctx: HouseholdCtx, input: VoiceInput): Promise<{ media: PhotoRow; duplicate: boolean }> {
  const hid = ctx.household.id;
  const raw = input.audio;
  if (!raw?.length) throw new HttpError(400, "声が空です");
  if (raw.length > MAX_VOICE_BYTES) throw new HttpError(413, "声が長すぎます（30MB まで）");
  const mime = sniffAudio(raw);
  if (!mime) throw new HttpError(415, "録音の形式が読めません");
  const sha = sha256Hex(raw);
  const dup = ctx.db.media.findBySha<MediaData>(sha);
  if (dup) return { media: dup, duplicate: true };

  const now = Date.now();
  const madeDay = ctx.household.kind !== "real" && input.today && /^\d{4}-\d{2}-\d{2}$/.test(input.today) ? input.today : null;
  const takenAt = madeDay ? `${madeDay}${jstStamp(now).slice(10)}` : jstStamp(now);
  const date = takenAt.slice(0, 10);
  let subjectId: string | null = null;
  if (input.subjectId) {
    if (!ctx.subjects.some((s) => s.id === input.subjectId)) throw new HttpError(404, "見つかりません");
    subjectId = input.subjectId;
  } else subjectId = ctx.subjects.find((s) => s.kind === "child")?.id ?? null;

  const birth = ctx.family?.birthDate;
  const ms = milestoneFor(birth, date);
  const id = randomUUID();
  const storageKey = mediaKey({ householdId: hid, subjectId, kind: "audio", id, date });
  const sealed = sealForHousehold(hid, raw, `${id}:orig`);
  await ctx.storage.put(`${storageKey}/orig`, sealed.ciphertext, { contentType: "application/octet-stream" });
  const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  const base = {
    moment: input.moment ?? undefined,
    who: clip(input.who, 40),
    spokenTo: clip(input.spokenTo, 40),
  };
  const data: MediaData = {
    links: { ...(ms ? { milestone: ms.id } : {}) },
    shareWithClaude: false,
    variants: { orig: { iv: sealed.iv, tag: sealed.tag, bytes: raw.length, mime } },
    ...(base.moment ? { moment: base.moment } : {}),
    ...(base.who ? { who: base.who } : {}),
    ...(base.spokenTo ? { spokenTo: base.spokenTo } : {}),
    ...(clip(input.transcript, 2000) ? { transcript: clip(input.transcript, 2000) } : {}),
    ...(typeof input.durationSec === "number" && input.durationSec > 0 ? { durationSec: Math.round(input.durationSec * 10) / 10 } : {}),
    ...(clip(input.caption, 400) ? { caption: clip(input.caption, 400), captionBy: "family" as const } : {}),
    title: voiceTitle(base),
    ...(birth ? { ageDays: Math.round((Date.parse(date) - Date.parse(birth)) / 86_400_000) } : {}),
    ...(input.made ? { made: true as const } : {}),
    ...(input.seedKey ? { seedKey: input.seedKey } : {}),
    ...(cleanFrom(input.from) ? { from: cleanFrom(input.from) } : {}),
  };
  let row: PhotoRow;
  try {
    row = ctx.db.media.insert<MediaData>({
      id,
      subjectId,
      kind: "audio",
      storageKey,
      mime,
      bytes: raw.length,
      iv: sealed.iv,
      tag: sealed.tag,
      takenAt,
      takenAtFrom: madeDay ? "manual" : "upload",
      sha256: sha,
      data,
    });
  } catch (e) {
    await ctx.storage.delete(storageKey).catch(() => {});
    throw e;
  }
  audit(hid, ctx.account?.id ?? null, "media.add", { target: id, detail: { kind: "audio" } });
  return { media: row, duplicate: false };
}

// ───────── 読む ─────────

/** その形の中身（復号した物）。無い形は、一覧用 → 画面用 → 原本の順に代わりを出す */
export async function readVariant(ctx: Pick<HouseholdCtx, "household" | "storage">, row: PhotoRow, want: PhotoVariant): Promise<{ buf: Buffer; mime: string } | null> {
  const order: PhotoVariant[] = want === "thumb" ? ["thumb", "view", "orig"] : want === "view" ? ["view", "orig"] : ["orig"];
  for (const v of order) {
    const meta = v === "orig" ? (row.iv && row.tag ? { iv: row.iv, tag: row.tag, mime: row.mime } : null) : row.data.variants?.[v];
    if (!meta) continue;
    const ct = await ctx.storage.get(`${row.storageKey}/${v}`);
    if (!ct) continue;
    const buf = openForHousehold(ctx.household.id, { ciphertext: ct, iv: meta.iv, tag: meta.tag }, `${row.id}:${v}`);
    return { buf, mime: meta.mime };
  }
  return null;
}

/** 画面に渡す形（鍵・iv・置き場の鍵は渡さない）。me は★を付けたかを見る人 */
export function toClient(familyId: string, row: PhotoRow, me?: string | null, liveTechoIds?: ReadonlySet<string>): ClientMedia {
  const q = (v: PhotoVariant) => `/api/media/${encodeURIComponent(row.id)}?familyId=${encodeURIComponent(familyId)}&v=${v}`;
  const stars = row.data.star ?? [];
  const techoIds = (row.data.links?.techoIds ?? []).filter((id) => !liveTechoIds || liveTechoIds.has(id));
  return {
    id: row.id,
    kind: row.kind,
    takenAt: row.takenAt,
    takenAtFrom: row.takenAtFrom,
    date: photoDate(row),
    mime: row.mime,
    bytes: row.bytes + Object.entries(row.data.variants ?? {}).reduce((n, [k, v]) => n + (k === "orig" ? 0 : (v?.bytes ?? 0)), 0),
    ...(row.data.w ? { w: row.data.w, h: row.data.h } : {}),
    ...(row.data.caption ? { caption: row.data.caption } : {}),
    ...(row.data.who ? { who: row.data.who } : {}),
    techoIds,
    ...(row.data.links?.milestone ? { milestone: row.data.links.milestone } : {}),
    star: stars.length,
    starredByMe: !!me && stars.includes(me),
    hidden: !!row.data.hidden,
    shared: !!row.data.shareWithClaude,
    made: !!row.data.made,
    subjectId: row.subjectId,
    trashedAt: row.trashedAt,
    createdAt: row.createdAt,
    urls: { orig: q("orig"), view: q("view"), thumb: q("thumb") },
    ...(row.kind === "audio"
      ? {
          ...(row.data.moment ? { moment: row.data.moment } : {}),
          ...(row.data.spokenTo ? { spokenTo: row.data.spokenTo } : {}),
          ...(row.data.durationSec ? { durationSec: row.data.durationSec } : {}),
          ...(row.data.transcript ? { transcript: row.data.transcript } : {}),
          title: row.data.title ?? voiceTitle(row.data),
        }
      : {}),
    ...(row.data.from ? { from: { name: row.data.from.name, ...(row.data.from.relation ? { relation: row.data.from.relation } : {}) } } : {}),
    ...(row.data.from?.account && me && row.data.from.account === me ? { mine: true } : {}),
  };
}

// ───────── みんなの章（祖父母など） ─────────

function cleanFrom(f: MediaFrom | null | undefined): MediaFrom | undefined {
  if (!f || typeof f.name !== "string" || !f.name.trim()) return undefined;
  return {
    name: f.name.trim().slice(0, 40),
    ...(typeof f.relation === "string" && f.relation.trim() ? { relation: f.relation.trim().slice(0, 40) } : {}),
    ...(typeof f.account === "string" && f.account ? { account: f.account } : {}),
  };
}

/**
 * 足す人の印。家族の記録を書ける人（media:write）は null（ふつうの写真・声）。
 * みんなの章だけに足せる人（祖父母など・media:contribute）は、ログインした本人の名前とアカウントを必ず付ける（名乗りを偽れない）
 */
export function contributorFrom(ctx: HouseholdCtx, relation?: string | null): MediaFrom | null {
  if (ctx.can("media:write")) return null;
  if (!ctx.can("media:contribute") || !ctx.account) throw new HttpError(403, "この操作はできません");
  return { name: ctx.account.name || "家族", account: ctx.account.id, ...(relation ? { relation: relation.slice(0, 40) } : {}) };
}

/** その写真・声を直せる・消せるか。書ける人は全部、みんなの章の人は自分が足した物だけ */
export function canEditMedia(ctx: HouseholdCtx, row: { data: MediaData }): boolean {
  if (ctx.can("media:write")) return true;
  return ctx.can("media:contribute") && !!ctx.account && row.data.from?.account === ctx.account.id;
}

/** ★を付けた人の印: ログインした人はアカウントの id、公開の世帯は画面で選んだ呼び名 */
export function starKey(accountId: string | null | undefined, by: unknown): string | null {
  if (accountId) return accountId;
  return typeof by === "string" && by.trim() ? `name:${by.trim().slice(0, 40)}` : null;
}

// ───────── ゴミ箱 ─────────

/** 行とファイルを消す（ゴミ箱から消す・30日を過ぎた時） */
export async function purgePhoto(ctx: Pick<HouseholdCtx, "household" | "storage" | "db" | "account">, row: PhotoRow): Promise<void> {
  await ctx.storage.delete(row.storageKey);
  ctx.db.media.remove(row.id);
  audit(ctx.household.id, ctx.account?.id ?? null, "media.purge", { target: row.id });
}

/** ゴミ箱に入って30日を過ぎた写真を消す。消した数 */
export async function purgeExpired(ctx: Pick<HouseholdCtx, "household" | "storage" | "db" | "account">, now = Date.now()): Promise<number> {
  const before = new Date(now - TRASH_DAYS * 86_400_000).toISOString();
  const rows = ctx.db.media.trashedBefore<MediaData>(before);
  for (const r of rows) await purgePhoto(ctx, r);
  return rows.length;
}

/** 日付を家族が直した時の、節目と月齢の付け直し */
export function relinkForDate(family: Family | null, data: MediaData, date: string): Partial<MediaData> {
  const birth = family?.birthDate;
  const ms = milestoneFor(birth, date);
  const links = { ...data.links };
  if (ms) links.milestone = ms.id;
  else delete links.milestone;
  return { links, ...(birth ? { ageDays: Math.round((Date.parse(date) - Date.parse(birth)) / 86_400_000) } : {}) };
}

// ───────── Claude に画像を渡せる唯一の口 ─────────

/**
 * 写真1枚を Claude に渡す形にする。画像を Claude に渡せるのはこの関数だけ（ほかから imageBlock を呼ばない。試験で grep して守る）。
 * 通る条件（すべて）:
 * - claude:send の権限がある
 * - その写真に、家族が「Claude に見せる」の印（shareWithClaude）を付けている
 * - 本物の世帯: 写真の本人（無ければ世帯の本人の全員）に、Claude に送る同意（claude_us）がある
 *   作った家族の世帯: 作った写真（made）だけ
 * 渡すのは画面用（長い辺 1568px 以下・メタデータなし）。原本は渡さない。渡した事は操作の記録に残す。
 */
export async function mediaForClaude(ctx: HouseholdCtx, id: string): Promise<Anthropic.Beta.BetaImageBlockParam> {
  if (!ctx.can("claude:send")) throw new HttpError(403, "この操作はできません");
  const row = ctx.db.media.get<MediaData>(id);
  if (!row || row.kind !== "photo") throw new HttpError(404, "見つかりません");
  if (!row.data.shareWithClaude) throw new HttpError(403, "この写真には「Claude に見せる」の印が付いていません");
  if (ctx.household.kind === "real") {
    const sids = row.subjectId ? [row.subjectId] : ctx.subjects.map((s) => s.id);
    if (!allConsented(ctx.household.id, sids, "claude_us")) throw new HttpError(403, "Claude に送る同意がまだありません");
  } else if (!row.data.made) {
    throw new HttpError(403, "作った家族の世帯では、作った写真だけを見せられます");
  }
  const got = await readVariant(ctx, row, "view");
  if (!got || sniffMime(got.buf) !== "image/jpeg") throw new HttpError(422, "見せられる形の写真がありません");
  const size = jpegSize(got.buf);
  if (!size || Math.max(size.w, size.h) > VIEW_SIDE) throw new HttpError(422, "写真が大きすぎて見せられません");
  const clean = Buffer.from(stripGps(got.buf));
  if (hasGps(clean)) throw new HttpError(422, "位置の情報が残っているので見せません");
  audit(ctx.household.id, ctx.account?.id ?? null, "claude.send", { target: id, detail: { what: "photo:view" } });
  return imageBlock(`data:image/jpeg;base64,${clean.toString("base64")}`);
}

// ───────── 一冊の候補（文字だけ。画像は渡さない） ─────────

export interface BookPhoto {
  id: string;
  date: string;
  period: Period;
  age: string;
  milestone?: string;
  caption?: string;
  /** 結んだ手帳の記録の見出し */
  techo: string[];
  star: number;
  score: number;
}

/**
 * 一冊を作る時の写真の候補（日付・月齢・節目・一言・結んだ記録・★の数）。画像は読まない。
 * 隠した写真・ゴミ箱の写真・今日より後の写真は入れない。
 * アカウントの表がまだ無い置き場（わが家の app/data。BOSHI_ACCOUNTS を入れる前）では空（一冊は写真なしで作る）。
 */
export function bookPhotoCandidates(f: Family, today: string): BookPhoto[] {
  let rows: PhotoRow[];
  try {
    rows = forHousehold(f.id).media.list<MediaData>({ kind: "photo" });
  } catch {
    return [];
  }
  if (!rows.length) return [];
  const techo = new Map(listTecho(f.id, { family: f, today }).map((d) => [d.id, d.data.title]));
  return rows
    .filter((r) => !r.data.hidden && photoDate(r) <= today)
    .map((r) => {
      const date = photoDate(r);
      const titles = (r.data.links?.techoIds ?? []).map((id) => techo.get(id)).filter((x): x is string => !!x);
      const ms = milestoneById(r.data.links?.milestone);
      const star = r.data.star?.length ?? 0;
      return {
        id: r.id,
        date,
        period: periodOfDate(f.birthDate, date),
        age: ageLabel(f, date),
        ...(ms ? { milestone: ms.label } : {}),
        ...(r.data.caption ? { caption: r.data.caption } : {}),
        techo: titles,
        star,
        score: photoScore({ star, milestone: ms?.id, techoIds: titles, caption: r.data.caption }),
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ───────── 一冊の声の候補（文字だけ。声は渡さない） ─────────

export interface BookVoice {
  id: string;
  date: string;
  period: Period;
  age: string;
  title: string;
  /** 文字起こしの最初の一文（60字まで） */
  first: string;
  star: number;
}

/** 一冊を作る時の声の候補（日付・題・最初の一文）。声のファイルは読まない。隠した・今日より後は入れない */
export function bookVoiceCandidates(f: Family, today: string): BookVoice[] {
  let rows: PhotoRow[];
  try {
    rows = forHousehold(f.id).media.list<MediaData>({ kind: "audio" });
  } catch {
    return [];
  }
  return rows
    .filter((r) => !r.data.hidden && photoDate(r) <= today)
    .map((r) => {
      const date = photoDate(r);
      return {
        id: r.id,
        date,
        period: periodOfDate(f.birthDate, date),
        age: ageLabel(f, date),
        title: r.data.title ?? voiceTitle(r.data),
        first: (r.data.transcript ?? r.data.caption ?? "").split(/(?<=[。！？])/)[0].slice(0, 60),
        star: r.data.star?.length ?? 0,
      };
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}
