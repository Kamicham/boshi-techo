// 未来の手紙: 開く日まで封をして残す。中身は世帯の鍵で暗号にして記録（docs の type "letter"）に置く。
// - 封をしたら、書いた本人も開く日まで読めない（見えるのは「誰から・誰へ・いつ開くか」だけ）。消すことはできる
// - 本物の家族はサーバの日付（日本時間）で開く。画面の「今日」は信じない。作った家族（デモ・シミュレーション）は画面の「今日」で開く（時期を進めて開く場面を見る）
// - 声を添えられる。声はアルバムの声（media の表）に入れず、手紙の置き場（letters/<id>/voice）に暗号で置く。文字にはしない。
//   開く日の前は書いた本人にも流さない（文字と同じ関所 readLetterVoice）。手紙を消すと声も消える
// - Claude には中身を送らない（一冊にも、通数と開く日だけ）。書き出し（export）にも入れない（TYPES に無い）
import "server-only";
import { randomUUID } from "node:crypto";
import type { HouseholdCtx } from "./access";
import { openForHousehold, sealForHousehold } from "./crypto";
import { audit } from "./households";
import { HttpError } from "./http-error";
import { checkTrialRoom } from "./trial-room";
import { MAX_VOICE_BYTES, sniffAudio } from "./media-shared";
import { letterVoiceKey } from "./storage";
import { isLetterOpen, letterOpenOn, MAX_LETTER_CHARS, MAX_LETTER_VOICE_SEC, type ClientLetter, type LetterOpen } from "./letters-shared";

export interface LetterData {
  from: string;
  relation?: string;
  /** 書いた人のアカウント（ログインして書いた時）。消せるのはこの人と家族の管理の人 */
  account?: string;
  to: string;
  open: LetterOpen;
  /** open が "date" の時の日 */
  date?: string;
  sealedOn: string;
  /** 暗号にした中身（base64） */
  ct: string;
  iv: string;
  tag: string;
  made?: true;
  seedKey?: string;
  /** 添えた声（置き場の鍵・暗号の印・形式・秒） */
  voice?: { key: string; iv: string; tag: string; mime: string; bytes: number; sec?: number };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const jstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** 開くかどうかを決める「今日」。本物の家族はサーバの日付、作った家族だけ画面の「今日」 */
export function letterToday(ctx: HouseholdCtx, asked?: string | null): string {
  if (ctx.household.kind !== "real" && asked && DAY.test(asked)) return asked;
  return jstToday();
}

const aad = (id: string) => `letter:${id}`;
const voiceAad = (id: string) => `letter:${id}:voice`;

function openOnOf(ctx: HouseholdCtx, d: LetterData): string | null {
  return letterOpenOn(d.open, ctx.family, d.date);
}

function isOpen(ctx: HouseholdCtx, d: LetterData, today: string): boolean {
  const on = openOnOf(ctx, d);
  return d.open === "now" || (!!on && on <= today);
}

function isMine(ctx: HouseholdCtx, d: LetterData, by?: string | null): boolean {
  if (ctx.account) return d.account === ctx.account.id;
  return !d.account && !!by && d.from === by;
}

function toClient(ctx: HouseholdCtx, id: string, d: LetterData, today: string, by?: string | null, withBody = false): ClientLetter {
  const opened = isOpen(ctx, d, today);
  return {
    id,
    from: d.from,
    ...(d.relation ? { relation: d.relation } : {}),
    to: d.to,
    open: d.open,
    openOn: openOnOf(ctx, d),
    sealedOn: d.sealedOn,
    opened,
    mine: isMine(ctx, d, by),
    ...(d.voice ? { voiceSec: d.voice.sec ?? 0 } : {}),
    ...(opened && withBody ? { body: openForHousehold(ctx.household.id, { ciphertext: Buffer.from(d.ct, "base64"), iv: d.iv, tag: d.tag }, aad(id)).toString("utf8") } : {}),
  };
}

export interface LetterInput {
  body: string;
  to?: string | null;
  open: unknown;
  date?: string | null;
  /** 書いた人の呼び名（ログインしていない公開の世帯では画面で選んだ人。ログインした人はアカウントの名前） */
  from?: string | null;
  relation?: string | null;
  today?: string | null;
  made?: boolean;
  seedKey?: string;
}

/** 手紙を書いて封をする（文字だけ） */
export function writeLetter(ctx: HouseholdCtx, input: LetterInput): ClientLetter {
  return putLetter(ctx, input, randomUUID());
}

export interface LetterVoice {
  audio: Buffer;
  sec?: number | null;
}

/** 声を添えた手紙を書いて封をする。文字は空でもよい（声だけの手紙） */
export async function writeVoiceLetter(ctx: HouseholdCtx, input: LetterInput, voice: LetterVoice): Promise<ClientLetter> {
  if (!ctx.can("media:contribute")) throw new HttpError(403, "この操作はできません");
  const raw = voice.audio;
  if (!raw?.length || raw.length < 1000) throw new HttpError(400, "声が短すぎました");
  if (raw.length > MAX_VOICE_BYTES) throw new HttpError(413, "声が長すぎます");
  const mime = sniffAudio(raw);
  if (!mime) throw new HttpError(415, "録音の形式が読めません");
  const sec = typeof voice.sec === "number" && Number.isFinite(voice.sec) && voice.sec > 0 ? Math.round(voice.sec * 10) / 10 : undefined;
  if (sec && sec > MAX_LETTER_VOICE_SEC + 5) throw new HttpError(413, `声は${MAX_LETTER_VOICE_SEC / 60}分までです`);
  // 先に文字と開く日を確かめる（置いてから断ると、声だけが残る）
  checkLetter(ctx, input, true);
  // 体験の写しは、写真と声で20件・50MB まで（lib/trial-room.ts）
  checkTrialRoom(ctx, raw.length, input.made);
  const id = randomUUID();
  const key = letterVoiceKey(ctx.household.id, id);
  const s = sealForHousehold(ctx.household.id, raw, voiceAad(id));
  await ctx.storage.put(key, s.ciphertext, { contentType: "application/octet-stream" });
  try {
    return putLetter(ctx, input, id, { key, iv: s.iv, tag: s.tag, mime, bytes: raw.length, ...(sec ? { sec } : {}) });
  } catch (e) {
    await ctx.storage.delete(key);
    throw e;
  }
}

function checkLetter(ctx: HouseholdCtx, input: LetterInput, voiced: boolean): { body: string; open: LetterOpen; today: string; date?: string } {
  if (!ctx.can("media:contribute")) throw new HttpError(403, "この操作はできません");
  const body = typeof input.body === "string" ? input.body.trim() : "";
  if (!body && !voiced) throw new HttpError(400, "手紙が空です");
  if (body.length > MAX_LETTER_CHARS) throw new HttpError(413, `手紙は${MAX_LETTER_CHARS}字までです`);
  if (!isLetterOpen(input.open)) throw new HttpError(400, "開く日の選び方が分かりません");
  const today = letterToday(ctx, input.today);
  const date = input.open === "date" ? (input.date ?? "") : undefined;
  if (input.open === "date" && (!DAY.test(date!) || date! <= today)) throw new HttpError(400, "開く日は、明日より後の日を選んでください");
  if (input.open !== "now" && input.open !== "date" && !ctx.family?.birthDate && !ctx.family?.dueDate) throw new HttpError(400, "生まれた日か予定日を設定すると、誕生日に開く手紙を書けます");
  if (seedExists(ctx, input.seedKey)) throw new HttpError(409, "同じ手紙があります");
  return { body, open: input.open as LetterOpen, today, ...(date !== undefined ? { date } : {}) };
}

function putLetter(ctx: HouseholdCtx, input: LetterInput, id: string, voice?: LetterData["voice"]): ClientLetter {
  const { body, open, today, date } = checkLetter(ctx, input, !!voice);
  const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : undefined);
  const from = ctx.account ? ctx.account.name || "家族" : (clip(input.from, 40) ?? "家族");
  const s = sealForHousehold(ctx.household.id, Buffer.from(body, "utf8"), aad(id));
  const data: LetterData = {
    from,
    ...(clip(input.relation, 40) ? { relation: clip(input.relation, 40) } : {}),
    ...(ctx.account ? { account: ctx.account.id } : {}),
    to: clip(input.to, 40) ?? ctx.family?.childName ?? "あなた",
    open,
    ...(date ? { date } : {}),
    sealedOn: today,
    ct: s.ciphertext.toString("base64"),
    iv: s.iv,
    tag: s.tag,
    ...(input.made ? { made: true as const } : {}),
    ...(input.seedKey ? { seedKey: input.seedKey } : {}),
    ...(voice ? { voice } : {}),
  };
  ctx.db.put<LetterData>("letter", data, { id, date: today });
  audit(ctx.household.id, ctx.account?.id ?? null, "letter.seal", { target: id, detail: { open: data.open, voice: !!voice } });
  return toClient(ctx, id, data, today, from);
}

function seedExists(ctx: HouseholdCtx, seedKey?: string): boolean {
  return !!seedKey && ctx.db.list<LetterData>("letter", { limit: 1000 }).some((d) => d.data.seedKey === seedKey);
}

/** 手紙の一覧（中身なし）。作った家族は、画面の「今日」より後に書いた手紙は出さない */
export function listLetters(ctx: HouseholdCtx, asked?: string | null, by?: string | null): ClientLetter[] {
  const today = letterToday(ctx, asked);
  return ctx.db
    .list<LetterData>("letter", { limit: 1000 })
    .filter((d) => ctx.household.kind === "real" || d.data.sealedOn <= today)
    .map((d) => toClient(ctx, d.id, d.data, today, by))
    .sort((a, b) => (a.openOn ?? "0000").localeCompare(b.openOn ?? "0000") || a.sealedOn.localeCompare(b.sealedOn));
}

/** 開く日を過ぎた手紙だけを通す関所（文字も声も同じ）。開く日より前は 403（書いた本人でも） */
function openedLetter(ctx: HouseholdCtx, id: string, asked?: string | null): { data: LetterData; today: string } {
  const d = ctx.db.get<LetterData>(id);
  if (!d || d.type !== "letter") throw new HttpError(404, "見つかりません");
  const today = letterToday(ctx, asked);
  if (ctx.household.kind !== "real" && d.data.sealedOn > today) throw new HttpError(404, "見つかりません");
  if (!isOpen(ctx, d.data, today)) throw new HttpError(403, "まだ封をしてあります。開く日に読めます");
  return { data: d.data, today };
}

/** 1通を読む。開く日より前は 403（書いた本人でも） */
export function readLetter(ctx: HouseholdCtx, id: string, asked?: string | null, by?: string | null): ClientLetter {
  const { data, today } = openedLetter(ctx, id, asked);
  audit(ctx.household.id, ctx.account?.id ?? null, "letter.open", { target: id });
  return toClient(ctx, id, data, today, by, true);
}

/** 添えた声を解く。開く日より前は 403（書いた本人でも）。声の無い手紙は 404 */
export async function readLetterVoice(ctx: HouseholdCtx, id: string, asked?: string | null): Promise<{ buf: Buffer; mime: string }> {
  const { data } = openedLetter(ctx, id, asked);
  const v = data.voice;
  if (!v) throw new HttpError(404, "声はありません");
  const ct = await ctx.storage.get(v.key);
  if (!ct) throw new HttpError(404, "声が見つかりません");
  return { buf: openForHousehold(ctx.household.id, { ciphertext: ct, iv: v.iv, tag: v.tag }, voiceAad(id)), mime: v.mime };
}

/** 消す。書いた本人と、家族の管理の人だけ */
export async function removeLetter(ctx: HouseholdCtx, id: string, by?: string | null): Promise<void> {
  const d = ctx.db.get<LetterData>(id);
  if (!d || d.type !== "letter") throw new HttpError(404, "見つかりません");
  if (!isMine(ctx, d.data, by) && !ctx.can("household:admin")) throw new HttpError(403, "書いた人だけが消せます");
  ctx.db.remove(id);
  if (d.data.voice) await ctx.storage.delete(d.data.voice.key);
  audit(ctx.household.id, ctx.account?.id ?? null, "letter.remove", { target: id });
}

/** 映画に入れる手紙: 開く日を過ぎて、声のある物だけ（中身の文字は渡さない） */
export function openedVoiceLetters(ctx: HouseholdCtx, asked?: string | null): ClientLetter[] {
  return listLetters(ctx, asked).filter((l) => l.opened && l.voiceSec !== undefined);
}

/** 一冊に載せる事（中身は渡さない）: 通数と、いちばん早く開く日 */
export function letterSummary(ctx: HouseholdCtx, asked?: string | null): { sealed: number; opened: number; next: string | null } {
  const xs = listLetters(ctx, asked);
  const sealed = xs.filter((l) => !l.opened);
  return { sealed: sealed.length, opened: xs.length - sealed.length, next: sealed.map((l) => l.openOn).filter(Boolean).sort()[0] ?? null };
}
