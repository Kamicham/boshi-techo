// 写真を残す（画面とサーバの両方で使う、部品を足さない小さな関数）。
// - GPS を消す（JPEG の APP1・XMP、PNG の eXIf、WebP の EXIF/XMP）と、消えたかの確かめ
// - 撮った日（EXIF の DateTimeOriginal）を読む
// - 月齢・節目・時期（一冊と同じ4つ）・毎月の「この1枚」の仮選び
// Claude には何も渡さない（画像を Claude に渡せるのは lib/media.ts の mediaForClaude だけ）。
// 体の判断はしない。節目は行事の日の目安だけで、発達や体の事には触れない。
import { addDays, addMonths, diffDays, lmpFromDue, monthsBetween } from "./clock";

// ───────── 型 ─────────

export type PhotoVariant = "orig" | "view" | "thumb";

/** 写真の行（media.data）の中身 */
export interface MediaData {
  /** 家族の一言 */
  caption?: string;
  captionBy?: "family" | "claude";
  /** 撮った人・足した人の呼び名 */
  who?: string;
  /** 結び先の正本はここだけ（手帳の記録の id・節目の id）。手帳の側には写真を持たせない */
  links: { techoIds?: string[]; milestone?: string };
  /** 生まれた日からの日数（生まれる前は負） */
  ageDays?: number;
  /** ★を付けた人（アカウントの id か、公開の世帯では呼び名） */
  star?: string[];
  /** 一冊・動画に入れない */
  hidden?: boolean;
  /** Claude に見せてよい印（既定 false。家族が1枚ずつ押した時だけ） */
  shareWithClaude: false | { at: string; by: string };
  /** 作った写真（デモ・シミュレーション） */
  made?: true;
  /** 画面用（view）の大きさ */
  w?: number;
  h?: number;
  /** 形ごとの暗号の iv・タグ（本体 orig の iv・tag は行にも持つ） */
  variants: Partial<Record<PhotoVariant, { iv: string; tag: string; bytes: number; mime: string }>>;
  /** 声（kind audio）だけ: 録り方・誰へ・長さ・文字起こし（自宅の機械で文字にした物。Claude には渡さない）・題 */
  moment?: VoiceMoment;
  spokenTo?: string;
  durationSec?: number;
  transcript?: string;
  title?: string;
  /** 作った家族の種の印（同じ種を二度入れない） */
  seedKey?: string;
  /** みんなの章: 家族みんな（祖父母など）が足した物。account は足した人（自分が足した物だけ直せる・消せる） */
  from?: MediaFrom;
}

/** みんなの章に足した人 */
export interface MediaFrom {
  name: string;
  relation?: string;
  account?: string;
}

// ───────── 声を残す（思い出の録り方） ─────────

/** 思い出として声を残す録り方。この3つ（と見本の家族の種）は記録の振り分け（Claude）にかけない */
export const VOICE_MOMENTS = [
  { id: "belly", label: "おなかに話しかける", hint: "生まれる前のあなたへ", short: "おなかへ" },
  { id: "bedtime", label: "寝る前のひとこと", hint: "今日のおやすみ", short: "おやすみ" },
  { id: "name", label: "名前を呼ぶ", hint: "はじめて・何度でも", short: "名前" },
] as const;
export type VoiceMoment = (typeof VOICE_MOMENTS)[number]["id"] | "message";
/**
 * 今の時期に出す録り方の並び。おなかに話しかけるのは妊娠中（生まれた日が無い・今日より先）だけ。
 * 生まれた後は出さず、今の声（寝る前のひとこと）を先頭にする。
 */
export function voiceMomentsFor(birthDate: string | undefined, today: string): (typeof VOICE_MOMENTS)[number][] {
  const before = !birthDate || diffDays(today, birthDate) < 0;
  if (before) return [...VOICE_MOMENTS];
  const order = ["bedtime", "name"] as const;
  return order.map((id) => VOICE_MOMENTS.find((m) => m.id === id)!).filter(Boolean);
}
export function voiceMomentById(id: string | null | undefined) {
  return VOICE_MOMENTS.find((m) => m.id === id);
}
/** 声の題（「翔太から おなかへ」）。Claude を使わず、録り方と話した人から作る */
export function voiceTitle(m: { moment?: string; who?: string; spokenTo?: string }): string {
  const mo = voiceMomentById(m.moment);
  const from = m.who ? `${m.who}から` : "";
  if (mo) return [from, mo.short === "名前" ? "名前を呼んだ声" : mo.short].filter(Boolean).join(" ");
  return [from, m.spokenTo ? `${m.spokenTo}へ` : "の声"].filter(Boolean).join(" ") || "声";
}
/** 声1本の上限（原本） */
export const MAX_VOICE_BYTES = 30 * 1024 * 1024;

/** 録音の形式を中身で見分ける（届いた content-type は信じない） */
export function sniffAudio(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return "audio/webm";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WAVE") return "audio/wav";
  if (ascii(b, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(b, 0, 3) === "ID3" || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0)) return "audio/mpeg";
  if (ascii(b, 4, 4) === "ftyp") return "audio/mp4";
  return null;
}

/** 画面に渡す写真1枚（鍵・iv・置き場の鍵は渡さない） */
export interface ClientMedia {
  id: string;
  kind: "photo" | "video" | "scan" | "audio";
  takenAt: string | null;
  takenAtFrom: "exif" | "file" | "upload" | "manual" | null;
  /** YYYY-MM-DD（撮った日。無ければ足した日） */
  date: string;
  mime: string;
  bytes: number;
  w?: number;
  h?: number;
  caption?: string;
  who?: string;
  techoIds: string[];
  milestone?: string;
  star: number;
  starredByMe: boolean;
  hidden: boolean;
  /** Claude に見せてよい印が付いているか */
  shared: boolean;
  made: boolean;
  subjectId: string | null;
  trashedAt: string | null;
  createdAt: string;
  urls: Record<PhotoVariant, string>;
  /** 声だけ */
  moment?: VoiceMoment;
  spokenTo?: string;
  durationSec?: number;
  transcript?: string;
  title?: string;
  /** みんなの章（祖父母など）が足した物。mine は自分が足した物 */
  from?: { name: string; relation?: string };
  mine?: boolean;
}

/** 手帳の中で写真の枠を出すページ（できた日・出産・気持ち・成長） */
export const PHOTO_PAGES = ["development", "birth", "feeling", "growth"] as const;
export function isPhotoPage(page: string): boolean {
  return (PHOTO_PAGES as readonly string[]).includes(page);
}

/** 画面用の長い辺（Claude の画像の上限 1568px に合わせる＝見せる時に縮め直さない） */
export const VIEW_SIDE = 1568;
export const THUMB_SIDE = 400;
/** 1枚の上限（原本） */
export const MAX_PHOTO_BYTES = 30 * 1024 * 1024;
/** ゴミ箱に置く日数 */
export const TRASH_DAYS = 30;

// ───────── バイト列の小さな道具 ─────────

const u16 = (b: Uint8Array, o: number, le: boolean) => (le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
const u32 = (b: Uint8Array, o: number, le: boolean) =>
  le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16)) + b[o + 3] * 0x1000000 : b[o] * 0x1000000 + ((b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]);
function w16(b: Uint8Array, o: number, v: number, le: boolean) {
  if (le) {
    b[o] = v & 0xff;
    b[o + 1] = (v >> 8) & 0xff;
  } else {
    b[o] = (v >> 8) & 0xff;
    b[o + 1] = v & 0xff;
  }
}
function w32(b: Uint8Array, o: number, v: number, le: boolean) {
  const x = [(v >>> 24) & 0xff, (v >>> 16) & 0xff, (v >>> 8) & 0xff, v & 0xff];
  for (let i = 0; i < 4; i++) b[o + i] = le ? x[3 - i] : x[i];
}
const ascii = (b: Uint8Array, o: number, n: number) => {
  let s = "";
  for (let i = 0; i < n && o + i < b.length; i++) s += String.fromCharCode(b[o + i]);
  return s;
};
function indexOfText(b: Uint8Array, text: string, from = 0, to = b.length): number {
  const t = [...text].map((c) => c.charCodeAt(0));
  outer: for (let i = from; i <= Math.min(to, b.length) - t.length; i++) {
    for (let j = 0; j < t.length; j++) if (b[i + j] !== t[j]) continue outer;
    return i;
  }
  return -1;
}
function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

/** 中身の頭から形式を見分ける（届いた content-type は信じない） */
export function sniffMime(b: Uint8Array): string | null {
  if (b.length < 12) return null;
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && ascii(b, 1, 3) === "PNG") return "image/png";
  if (ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "image/webp";
  if (ascii(b, 0, 4) === "GIF8") return "image/gif";
  if (ascii(b, 4, 4) === "ftyp") {
    const brand = ascii(b, 8, 4);
    if (["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"].includes(brand)) return "image/heic";
    if (brand === "avif" || brand === "avis") return "image/avif";
    if (brand === "qt  ") return "video/quicktime";
    return "video/mp4";
  }
  return null;
}

// ───────── EXIF（TIFF の中身） ─────────

const TYPE_SIZE: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8, 13: 4 };
const TAG_EXIF_IFD = 0x8769;
const TAG_GPS_IFD = 0x8825;

type Tiff = { b: Uint8Array; t: number; le: boolean; end: number };

function tiffAt(b: Uint8Array, t: number, end: number): Tiff | null {
  if (t + 8 > end) return null;
  const order = ascii(b, t, 2);
  if (order !== "II" && order !== "MM") return null;
  const le = order === "II";
  if (u16(b, t + 2, le) !== 42) return null;
  return { b, t, le, end };
}

type IfdEntry = { at: number; tag: number; type: number; count: number; value: number };

function readIfd(x: Tiff, off: number): { entries: IfdEntry[]; next: number; at: number } | null {
  const at = x.t + off;
  if (off < 8 || at + 2 > x.end) return null;
  const n = u16(x.b, at, x.le);
  if (n > 1000 || at + 2 + n * 12 + 4 > x.end) return null;
  const entries: IfdEntry[] = [];
  for (let i = 0; i < n; i++) {
    const e = at + 2 + i * 12;
    entries.push({ at: e, tag: u16(x.b, e, x.le), type: u16(x.b, e + 2, x.le), count: u32(x.b, e + 4, x.le), value: u32(x.b, e + 8, x.le) });
  }
  return { entries, next: u32(x.b, at + 2 + n * 12, x.le), at };
}

function entryAscii(x: Tiff, e: IfdEntry): string {
  const size = (TYPE_SIZE[e.type] ?? 1) * e.count;
  const at = size <= 4 ? e.at + 8 : x.t + e.value;
  if (at + size > x.end) return "";
  return ascii(x.b, at, size).replace(/\0+$/, "");
}

function tiffHasGps(x: Tiff): boolean {
  const ifd0 = readIfd(x, u32(x.b, x.t + 4, x.le));
  const gps = ifd0?.entries.find((e) => e.tag === TAG_GPS_IFD);
  if (!gps) return false;
  const g = readIfd(x, gps.value);
  return !!g && g.entries.length > 0;
}

/** TIFF の中の GPS を、中身ごと 0 で埋め、IFD0 から GPS の入口を外す（形はそのまま・長さは変えない） */
function tiffStripGps(x: Tiff): void {
  const ifd0 = readIfd(x, u32(x.b, x.t + 4, x.le));
  if (!ifd0) return;
  const idx = ifd0.entries.findIndex((e) => e.tag === TAG_GPS_IFD);
  if (idx < 0) return;
  const gps = readIfd(x, ifd0.entries[idx].value);
  if (gps) {
    for (const e of gps.entries) {
      const size = (TYPE_SIZE[e.type] ?? 1) * e.count;
      if (size > 4 && x.t + e.value + size <= x.end) x.b.fill(0, x.t + e.value, x.t + e.value + size);
    }
    x.b.fill(0, gps.at, gps.at + 2 + gps.entries.length * 12 + 4);
  }
  // IFD0 から入口を抜く: 後ろの項目を前へ詰め、次の IFD の位置も前へ。空いた 12 バイトは 0
  const n = ifd0.entries.length;
  const start = ifd0.at + 2 + idx * 12;
  const tail = ifd0.at + 2 + n * 12 + 4;
  x.b.copyWithin(start, start + 12, tail);
  x.b.fill(0, tail - 12, tail);
  w16(x.b, ifd0.at, n - 1, x.le);
  // 次の IFD の位置（u32）は copyWithin で一緒に前へ動いている
}

const DATE_RE = /^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

function tiffDate(x: Tiff): string | null {
  const ifd0 = readIfd(x, u32(x.b, x.t + 4, x.le));
  if (!ifd0) return null;
  const pick = (s: string) => {
    const m = DATE_RE.exec(s);
    if (!m || m[1] === "0000" || m[2] === "00") return null;
    return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`;
  };
  const exifPtr = ifd0.entries.find((e) => e.tag === TAG_EXIF_IFD);
  if (exifPtr) {
    const exif = readIfd(x, exifPtr.value);
    for (const tag of [0x9003, 0x9004]) {
      const e = exif?.entries.find((y) => y.tag === tag);
      const d = e && pick(entryAscii(x, e));
      if (d) return d;
    }
  }
  const e = ifd0.entries.find((y) => y.tag === 0x0132);
  return (e && pick(entryAscii(x, e))) || null;
}

// ───────── JPEG ─────────

type Seg = { marker: number; start: number; data: number; end: number };

/** SOS（画の始まり）までの区切り */
function jpegSegments(b: Uint8Array): { segs: Seg[]; body: number } | null {
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  const segs: Seg[] = [];
  let o = 2;
  while (o + 4 <= b.length) {
    if (b[o] !== 0xff) return null;
    let marker = b[o + 1];
    while (marker === 0xff && o + 2 < b.length) {
      o++;
      marker = b[o + 1];
    }
    if (marker === 0xd9 || marker === 0xda) return { segs, body: o };
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      o += 2;
      continue;
    }
    const len = u16(b, o + 2, false);
    if (len < 2 || o + 2 + len > b.length) return null;
    segs.push({ marker, start: o, data: o + 4, end: o + 2 + len });
    o += 2 + len;
  }
  return { segs, body: o };
}

const isExifSeg = (b: Uint8Array, s: Seg) => s.marker === 0xe1 && ascii(b, s.data, 6) === "Exif\0\0";
const isXmpSeg = (b: Uint8Array, s: Seg) => (s.marker === 0xe1 && ascii(b, s.data, 28) === "http://ns.adobe.com/xap/1.0/") || (s.marker === 0xe1 && ascii(b, s.data, 34) === "http://ns.adobe.com/xmp/extension/");
const xmpHasGps = (b: Uint8Array, s: Seg) => indexOfText(b, "GPS", s.data, s.end) >= 0;

function jpegTiffs(b: Uint8Array): Tiff[] {
  const p = jpegSegments(b);
  if (!p) return [];
  return p.segs.filter((s) => isExifSeg(b, s)).flatMap((s) => tiffAt(b, s.data + 6, s.end) ?? []);
}

/** JPEG の大きさ（SOF から）。読めなければ null */
export function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  const p = jpegSegments(b);
  if (!p) return null;
  const sof = p.segs.find((s) => s.marker >= 0xc0 && s.marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(s.marker));
  if (!sof || sof.data + 5 > sof.end) return null;
  return { h: u16(b, sof.data + 1, false), w: u16(b, sof.data + 3, false) };
}

/** 写真の大きさ（JPEG・PNG）。読めなければ null */
export function imageSize(b: Uint8Array): { w: number; h: number } | null {
  const mime = sniffMime(b);
  if (mime === "image/jpeg") return jpegSize(b);
  if (mime === "image/png" && b.length >= 24 && ascii(b, 12, 4) === "IHDR") return { w: u32(b, 16, false), h: u32(b, 20, false) };
  return null;
}

// ───────── PNG ─────────

type Chunk = { type: string; start: number; data: number; len: number; end: number };

function pngChunks(b: Uint8Array): Chunk[] | null {
  if (!(b[0] === 0x89 && ascii(b, 1, 3) === "PNG")) return null;
  const out: Chunk[] = [];
  let o = 8;
  while (o + 12 <= b.length) {
    const len = u32(b, o, false);
    const type = ascii(b, o + 4, 4);
    if (o + 12 + len > b.length) return null;
    out.push({ type, start: o, data: o + 8, len, end: o + 12 + len });
    o += 12 + len;
    if (type === "IEND") break;
  }
  return out;
}
const PNG_TEXT = new Set(["tEXt", "iTXt", "zTXt"]);

// ───────── WebP ─────────

function webpChunks(b: Uint8Array): Chunk[] | null {
  if (!(ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP")) return null;
  const out: Chunk[] = [];
  let o = 12;
  while (o + 8 <= b.length) {
    const type = ascii(b, o, 4);
    const len = u32(b, o + 4, true);
    const end = o + 8 + len + (len % 2);
    if (o + 8 + len > b.length) return null;
    out.push({ type, start: o, data: o + 8, len, end: Math.min(end, b.length) });
    o = end;
  }
  return out;
}

// ───────── 外に出す関数 ─────────

/** 写真に位置（GPS）が残っているか。JPEG・PNG・WebP を見る（ほかの形式は false） */
export function hasGps(input: Uint8Array): boolean {
  const b = input;
  const mime = sniffMime(b);
  if (mime === "image/jpeg") {
    const p = jpegSegments(b);
    if (!p) return false;
    if (p.segs.some((s) => isXmpSeg(b, s) && xmpHasGps(b, s))) return true;
    return jpegTiffs(b).some(tiffHasGps);
  }
  if (mime === "image/png") {
    const cs = pngChunks(b) ?? [];
    for (const c of cs) {
      if (c.type === "eXIf") {
        const x = tiffAt(b, c.data, c.data + c.len);
        if (x && tiffHasGps(x)) return true;
      }
      if (PNG_TEXT.has(c.type) && indexOfText(b, "GPS", c.data, c.data + c.len) >= 0) return true;
    }
    return false;
  }
  if (mime === "image/webp") {
    const cs = webpChunks(b) ?? [];
    for (const c of cs) {
      if (c.type === "EXIF") {
        const t = ascii(b, c.data, 6) === "Exif\0\0" ? c.data + 6 : c.data;
        const x = tiffAt(b, t, c.data + c.len);
        if (x && tiffHasGps(x)) return true;
      }
      if (c.type === "XMP " && indexOfText(b, "GPS", c.data, c.data + c.len) >= 0) return true;
    }
  }
  return false;
}

/**
 * 写真から位置（GPS）を消した写しを返す（元は変えない）。撮った日など、ほかの情報は残す。
 * - JPEG: EXIF の GPS の中身を 0 で埋めて入口を外す。GPS を含む XMP の区切りは丸ごと抜く
 * - PNG: eXIf の GPS を同じく消す。GPS を含む文字の塊は抜く
 * - WebP: EXIF・XMP の塊を抜く
 * 読めない形の時は例外（GPS が残ったまま置かないため。呼ぶ側は受け付けない）
 */
export function stripGps(input: Uint8Array): Uint8Array {
  const mime = sniffMime(input);
  if (mime === "image/jpeg") {
    const b = new Uint8Array(input);
    const p = jpegSegments(b);
    if (!p) throw new Error("JPEG の形が読めません");
    const keep: Uint8Array[] = [b.subarray(0, 2)];
    for (const s of p.segs) {
      if (isXmpSeg(b, s) && xmpHasGps(b, s)) continue;
      if (isExifSeg(b, s)) {
        const x = tiffAt(b, s.data + 6, s.end);
        if (x) tiffStripGps(x);
      }
      keep.push(b.subarray(s.start, s.end));
    }
    keep.push(b.subarray(p.body));
    return concat(keep);
  }
  if (mime === "image/png") {
    const b = new Uint8Array(input);
    const cs = pngChunks(b);
    if (!cs) throw new Error("PNG の形が読めません");
    const keep: Uint8Array[] = [b.subarray(0, 8)];
    for (const c of cs) {
      if (c.type === "eXIf") continue; // 撮った日は受け取る前に読んでいる。PNG の eXIf は CRC ごと抜く方が安全
      if (PNG_TEXT.has(c.type) && indexOfText(b, "GPS", c.data, c.data + c.len) >= 0) continue;
      keep.push(b.subarray(c.start, c.end));
    }
    const last = cs[cs.length - 1];
    if (last && last.end < b.length) keep.push(b.subarray(last.end));
    return concat(keep);
  }
  if (mime === "image/webp") {
    const b = new Uint8Array(input);
    const cs = webpChunks(b);
    if (!cs) throw new Error("WebP の形が読めません");
    const parts: Uint8Array[] = [];
    for (const c of cs) {
      if (c.type === "EXIF" || c.type === "XMP ") continue;
      const piece = new Uint8Array(b.subarray(c.start, c.end));
      // VP8X の印から EXIF（0x08）と XMP（0x04）を外す
      if (c.type === "VP8X" && piece.length > 8) piece[8] &= ~0x0c;
      parts.push(piece);
    }
    const body = concat(parts);
    const head = new Uint8Array(12);
    head.set(b.subarray(0, 12));
    w32(head, 4, body.length + 4, true);
    return concat([head, body]);
  }
  if (mime === "image/gif") return new Uint8Array(input); // GIF は位置を持たない
  throw new Error("この形式の写真は受け付けていません（JPEG・PNG・WebP・HEIC）");
}

/** 撮った日（EXIF の DateTimeOriginal。無ければ DateTimeDigitized・DateTime）を "YYYY-MM-DDTHH:MM:SS"（撮った所の時刻）で。無ければ null */
export function readExifDate(b: Uint8Array): string | null {
  const mime = sniffMime(b);
  let tiffs: Tiff[] = [];
  if (mime === "image/jpeg") tiffs = jpegTiffs(b);
  else if (mime === "image/png") tiffs = (pngChunks(b) ?? []).filter((c) => c.type === "eXIf").flatMap((c) => tiffAt(b, c.data, c.data + c.len) ?? []);
  else if (mime === "image/webp")
    tiffs = (webpChunks(b) ?? [])
      .filter((c) => c.type === "EXIF")
      .flatMap((c) => tiffAt(b, ascii(b, c.data, 6) === "Exif\0\0" ? c.data + 6 : c.data, c.data + c.len) ?? []);
  for (const x of tiffs) {
    const d = tiffDate(x);
    if (d) return d;
  }
  return null;
}

// ───────── 月齢・節目・時期 ─────────

/** 一冊と同じ4つの時期（lib/book.ts もここから読む） */
export const PERIODS = ["おなかにいた日々", "生まれた日", "はじめての一年", "二歳までの一年"] as const;
export type Period = (typeof PERIODS)[number];

/** 時期に分ける（生まれた日〜生後6日は「生まれた日」の章） */
export function periodOfDate(birthDate: string | undefined, date: string): Period {
  if (!birthDate || diffDays(date, birthDate) < 0) return "おなかにいた日々";
  const age = diffDays(date, birthDate);
  if (age <= 6) return "生まれた日";
  // 1歳の誕生日まで（365日で切ると、うるう年をまたぐ年は誕生日の前日が「二歳までの一年」に入る）
  if (diffDays(date, addMonths(birthDate, 12)) < 0) return "はじめての一年";
  return "二歳までの一年";
}

/**
 * 写真の節目（行事の日の目安）。体の事・発達の事には触れない。
 * 根拠: 行事をした割合はお食い初め・お宮参りが8割超、ハーフバースデーが6割超（コズレ 2018）。
 * お宮参りは地域・家庭で日が違う（男の子31日・女の子32日など）ので「約1か月」の幅で取る。
 * 初節句は子の性別で日が違うが、性別は発育曲線の帯のためだけに預かっているので使わない（出さない）。
 */
export interface PhotoMilestone {
  id: string;
  label: string;
  /** 今日の画面の一言（「今日は生後100日です」） */
  say: string;
  at: (birth: string) => string;
  /** 写真を結ぶ幅（at からの日数） */
  win: [number, number];
}

export const PHOTO_MILESTONES: readonly PhotoMilestone[] = [
  { id: "oshichiya", label: "お七夜", say: "今日は生後7日です", at: (b) => addDays(b, 6), win: [0, 3] },
  { id: "omiyamairi", label: "お宮参り", say: "生後1か月のころです", at: (b) => addDays(b, 30), win: [-3, 14] },
  { id: "okuizome", label: "お食い初め", say: "今日は生後100日です", at: (b) => addDays(b, 99), win: [-5, 14] },
  { id: "half", label: "ハーフバースデー", say: "今日で生後6か月です", at: (b) => addMonths(b, 6), win: [-3, 14] },
  { id: "first-birthday", label: "1歳の誕生日", say: "今日は1歳の誕生日です", at: (b) => addMonths(b, 12), win: [-3, 14] },
  { id: "18m", label: "1歳6か月", say: "今日で1歳6か月です", at: (b) => addMonths(b, 18), win: [-3, 14] },
  { id: "second-birthday", label: "2歳の誕生日", say: "今日は2歳の誕生日です", at: (b) => addMonths(b, 24), win: [-3, 14] },
];

export function milestoneById(id: string | undefined): PhotoMilestone | null {
  return PHOTO_MILESTONES.find((m) => m.id === id) ?? null;
}

/** その日に撮った写真が結ばれる節目（無ければ null） */
export function milestoneFor(birthDate: string | undefined, date: string): PhotoMilestone | null {
  if (!birthDate || diffDays(date, birthDate) < 0) return null;
  for (const m of PHOTO_MILESTONES) {
    const d = diffDays(date, m.at(birthDate));
    if (d >= m.win[0] && d <= m.win[1]) return m;
  }
  return null;
}

/** 今日の画面に出す節目（その日から2日の間だけ。開かなかった日を取りこぼさない） */
export function milestoneToday(birthDate: string | undefined, today: string): PhotoMilestone | null {
  if (!birthDate) return null;
  return PHOTO_MILESTONES.find((m) => {
    const d = diffDays(today, m.at(birthDate));
    return d >= 0 && d <= 2;
  }) ?? null;
}

/**
 * 今日、思い出の一言（節目の写真）を出すか。家族が「静かにする」（つらい別れ・赤ちゃんの入院）を選んでいる間は出さない。
 * 入院中の子は、生まれた日から数える節目が実際の様子と合わないので、静かにする間は数えない（戻せば出る）
 */
export function memoryNudgeFor(f: { birthDate?: string; situation?: { quiet?: string } }, today: string): PhotoMilestone | null {
  if (f.situation?.quiet) return null;
  return milestoneToday(f.birthDate, today);
}

/** 写真の見出しの月齢（「生後3か月」「生後12日」「妊娠7か月」「1歳2か月」） */
export function ageLabel(f: { dueDate: string; birthDate?: string }, date: string): string {
  if (f.birthDate && diffDays(date, f.birthDate) >= 0) {
    const days = diffDays(date, f.birthDate);
    if (days === 0) return "生まれた日";
    if (days < 28) return `生後${days}日`;
    const m = monthsBetween(f.birthDate, date);
    if (m < 12) return `生後${m}か月`;
    return `${Math.floor(m / 12)}歳${m % 12 ? `${m % 12}か月` : ""}`;
  }
  const since = diffDays(date, lmpFromDue(f.dueDate));
  if (since < 0) return "授かる前";
  // 妊娠の月数（4週で1か月・0〜3週が1か月目）
  return `妊娠${Math.floor(since / 28) + 1}か月`;
}

/**
 * 月の見出しと並べる鍵。見出しは月齢（妊娠の月・生後の月）でまとめ、（）にはその月齢の始まりの日を書く
 * （「生後1か月（2027年5月26日〜）」）。暦の月を書くと、同じ暦の月が2つの見出しに出て重なって見えるため（11/4 初見の通し）。
 * 生まれて1か月までは、一冊の「生まれた日」（7日目まで）と「はじめての一年」に分かれるので、「生まれて1週間」と「生まれて1か月まで」に分ける
 */
export function monthGroupOf(f: { dueDate: string; birthDate?: string }, date: string): { key: string; label: string } {
  let key: string;
  let head: string;
  let from: string;
  if (f.birthDate && diffDays(date, f.birthDate) >= 0) {
    const days = diffDays(date, f.birthDate);
    const months = days < 28 ? 0 : monthsBetween(f.birthDate, date);
    if (months === 0 && days <= 6) {
      key = "c000a";
      head = "生まれて1週間";
      from = f.birthDate;
    } else if (months === 0) {
      key = "c000b";
      head = "生まれて1か月まで";
      from = addDays(f.birthDate, 7);
    } else {
      key = `c${String(months).padStart(3, "0")}`;
      head = ageLabel(f, addMonths(f.birthDate, months));
      from = addMonths(f.birthDate, months);
    }
  } else {
    const lmp = lmpFromDue(f.dueDate);
    const since = diffDays(date, lmp);
    head = ageLabel(f, date);
    key = `p${head}`;
    from = since < 0 ? date : addDays(lmp, Math.floor(since / 28) * 28);
  }
  const [y, m, d] = from.split("-").map(Number);
  return { key, label: `${head}（${y}年${m}月${d}日〜）` };
}

/** 写真の日付（YYYY-MM-DD）。撮った日、無ければ足した日（日本時間） */
export function photoDate(m: { takenAt: string | null; createdAt: string }): string {
  if (m.takenAt && /^\d{4}-\d{2}-\d{2}/.test(m.takenAt)) return m.takenAt.slice(0, 10);
  return new Date(Date.parse(m.createdAt) + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 1枚の重み（★ > 節目 > 手帳に結んだ > 一言）。一冊の候補の並びと「この1枚」に使う */
export function photoScore(m: Pick<ClientMedia, "star" | "milestone" | "techoIds" | "caption">): number {
  return m.star * 10 + (m.milestone ? 5 : 0) + (m.techoIds.length ? 3 : 0) + (m.caption ? 2 : 0);
}

/**
 * 月ごとの「この1枚」を仮に選ぶ（Claude は使わない）。家族の★が一番強い。
 * 同じ重みなら、その月の真ん中ごろの1枚（月の初めと終わりに偏らない）。隠した・ゴミ箱の写真は選ばない。
 */
export function pickOfMonth(items: readonly ClientMedia[]): ClientMedia | null {
  const xs = items.filter((m) => m.kind !== "audio" && !m.hidden && !m.trashedAt).sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  if (!xs.length) return null;
  const mid = (xs.length - 1) / 2;
  let best = xs[0];
  let bestKey = -Infinity;
  xs.forEach((m, i) => {
    const key = photoScore(m) * 1000 - Math.abs(i - mid);
    if (key > bestKey) {
      best = m;
      bestKey = key;
    }
  });
  return best;
}

export interface MonthGroup {
  key: string;
  label: string;
  period: Period;
  items: ClientMedia[];
  pick: ClientMedia | null;
}

/** 時期（一冊の4つ）→ 月ごとに分ける。日付の古い順 */
export function groupForAlbum(f: { dueDate: string; birthDate?: string }, items: readonly ClientMedia[]): { period: Period; months: MonthGroup[] }[] {
  const months = new Map<string, MonthGroup>();
  const sorted = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const m of sorted) {
    const g = monthGroupOf(f, m.date);
    const period = periodOfDate(f.birthDate, m.date);
    const k = `${period}|${g.key}`;
    if (!months.has(k)) months.set(k, { key: k, label: g.label, period, items: [], pick: null });
    months.get(k)!.items.push(m);
  }
  for (const g of months.values()) g.pick = pickOfMonth(g.items);
  return PERIODS.map((period) => ({ period, months: [...months.values()].filter((g) => g.period === period) })).filter((p) => p.months.length);
}

/** 「11月3日・生後3か月・お食い初めのころ」 */
export function keptLine(f: { dueDate: string; birthDate?: string }, m: Pick<ClientMedia, "date" | "milestone">): string {
  const [, mo, d] = m.date.split("-").map(Number);
  const ms = milestoneById(m.milestone);
  return [`${mo}月${d}日`, ageLabel(f, m.date), ms ? `${ms.label}のころ` : null].filter(Boolean).join("・");
}

/** 容量の言い方 */
export function bytesLabel(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))}KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)}MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)}GB`;
}
