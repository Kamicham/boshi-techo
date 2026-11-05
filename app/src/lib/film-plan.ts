// 映画の台本（画面の映画 /book/film と、書き出す動画の両方が使う）。
// 一冊の film（Claude が書いた写真の順・秒・字幕・声）と、今ある写真・声から、場面の並びと秒・声を流し始める時刻を決める。
// 決まり: 題（4秒）→ 写真の場面 → みんなの章（祖父母などが足した写真と声。足した人ごとに組む）→ 開いた声の手紙 → 終わり（6秒）。
// 手紙は、開く日を過ぎて声のある物だけ（封の間の手紙は数も出さない）。手紙の文字は映画に出さず、誰から誰へ・書いた日と開いた日と、声だけ。
// 声のある場面は、声が終わるまで映す（18秒まで。祖父母の声はゆっくりで長い）。声は場面が映ってから 0.6 秒置いて話し始める。
// 画面とは別に読む（server-only ではない）。Claude には何も送らない。
// 人が読む言い方（日付・手紙の一行・みんなの章の字幕）は画面の言葉で（lib/i18n。書き出す動画はサーバで組むので日本語）。
import { t } from "./i18n";
import { dayLong } from "./memory-words";

export interface FilmMedia {
  id: string;
  kind: string;
  hidden?: boolean;
  caption?: string;
  date: string;
  durationSec?: number;
  title?: string;
  from?: { name: string; relation?: string };
}

export interface FilmCue {
  mediaId: string;
  sec: number;
  caption: string;
  voiceId?: string;
}

/** 映画に入れる手紙（画面に渡す手紙の形から、要る所だけ） */
export interface FilmLetter {
  id: string;
  from: string;
  to: string;
  sealedOn: string;
  openOn: string | null;
  opened: boolean;
  voiceSec?: number;
}

export type Shot<M extends FilmMedia = FilmMedia> =
  | { kind: "title" | "end"; sec: number }
  | { kind: "photo"; photo: M; caption: string; sec: number; voice: M | null }
  | { kind: "letter"; letter: FilmLetter; sec: number };

export const TITLE_SEC = 4;
export const END_SEC = 6;
export const MAX_VOICE_SHOT_SEC = 18;
/** 写真が映ってから話し始めるまで */
export const VOICE_LEAD_SEC = 0.6;
/** 重ねて切り替える長さ（書き出す動画） */
export const CROSSFADE_SEC = 1;

const voiceSec = (voice: FilmMedia, base: number) => Math.min(MAX_VOICE_SHOT_SEC, Math.max(base, (voice.durationSec ?? base) + 1.2));

export function filmShots<M extends FilmMedia>(film: readonly FilmCue[], media: readonly M[], letters: readonly FilmLetter[] = []): Shot<M>[] {
  const byId = new Map(media.filter((m) => !m.hidden).map((m) => [m.id, m]));
  const xs: Shot<M>[] = film.flatMap((x) => {
    const photo = byId.get(x.mediaId);
    if (!photo || photo.kind === "audio") return [];
    const v = x.voiceId ? (byId.get(x.voiceId) ?? null) : null;
    const voice = v && v.kind === "audio" ? v : null;
    return [{ kind: "photo" as const, photo, caption: x.caption, sec: voice ? voiceSec(voice, x.sec) : x.sec, voice }];
  });
  // みんなの章: 台本に入っていない、家族みんなが足した写真と声。写真と声は足した人ごとに組む
  const used = new Set(xs.flatMap((x) => (x.kind === "photo" ? [x.photo.id, x.voice?.id] : [])));
  const live = [...byId.values()];
  const fromPhotos = live.filter((m) => m.from && m.kind !== "audio" && !used.has(m.id)).sort((a, b) => a.date.localeCompare(b.date));
  const fromVoices = live.filter((m) => m.from && m.kind === "audio" && !used.has(m.id)).sort((a, b) => a.date.localeCompare(b.date));
  const minna: Shot<M>[] = fromPhotos.map((photo) => {
    const vi = fromVoices.findIndex((v) => v.from!.name === photo.from!.name);
    const voice = vi >= 0 ? fromVoices.splice(vi, 1)[0] : null;
    return { kind: "photo" as const, photo, caption: photo.caption ?? t("{name}から", { name: photo.from!.name }), sec: voice ? voiceSec(voice, 5) : 5, voice };
  });
  // 開いた声の手紙（開いた日の順）。封の間・声の無い手紙は入れない
  const opened: Shot<M>[] = letters
    .filter((l) => l.opened && l.voiceSec !== undefined)
    .sort((a, b) => (a.openOn ?? a.sealedOn).localeCompare(b.openOn ?? b.sealedOn))
    .map((letter) => ({ kind: "letter" as const, letter, sec: Math.min(MAX_VOICE_SHOT_SEC, Math.max(6, (letter.voiceSec || 6) + 1.2)) }));
  return xs.length ? [{ kind: "title", sec: TITLE_SEC }, ...xs, ...minna, ...opened, { kind: "end", sec: END_SEC }] : [];
}

export interface Timed<M extends FilmMedia = FilmMedia> {
  shot: Shot<M>;
  /** 場面が始まる時刻（秒。重ねて切り替える時は、前の場面と CROSSFADE_SEC だけ重なる） */
  start: number;
  /** 声を流し始める時刻（声の無い場面は null） */
  voiceAt: number | null;
}

/** 書き出す動画の時刻表。場面 k は、それまでの場面の秒の合計から始まり、最後の場面だけ CROSSFADE_SEC 長く映る */
export function filmTimeline<M extends FilmMedia>(shots: readonly Shot<M>[]): { items: Timed<M>[]; total: number } {
  let t = 0;
  const items = shots.map((shot) => {
    const it: Timed<M> = { shot, start: t, voiceAt: (shot.kind === "photo" && shot.voice) || shot.kind === "letter" ? t + VOICE_LEAD_SEC : null };
    t += shot.sec;
    return it;
  });
  return { items, total: shots.length ? t + CROSSFADE_SEC : 0 };
}

/** 声が流れている間（音楽を小さくする間） */
export function voiceSpans(items: readonly Timed[]): { from: number; to: number }[] {
  return items.flatMap((it) => {
    if (it.voiceAt == null) return [];
    if (it.shot.kind === "photo" && it.shot.voice) return [{ from: it.voiceAt, to: it.voiceAt + (it.shot.voice.durationSec ?? it.shot.sec - 1.2) }];
    if (it.shot.kind === "letter") return [{ from: it.voiceAt, to: it.voiceAt + (it.shot.letter.voiceSec || it.shot.sec - 1.2) }];
    return [];
  });
}

/** 終わりの言葉: 最初の2文 */
export function firstSentences(s: string): string {
  const xs = s.split(/(?<=[。！？])/).filter((x) => x.trim());
  return xs.slice(0, 2).join("");
}

export function dayLine(d: string): string {
  return dayLong(d);
}

/** 手紙の場面の言葉: 「2027年3月1日に書いて、2028年4月26日に開いた手紙」 */
export function letterLine(l: Pick<FilmLetter, "sealedOn" | "openOn">): string {
  return l.openOn ? t("{a}に書いて、{b}に開いた手紙", { a: dayLine(l.sealedOn), b: dayLine(l.openOn) }) : t("{a}に書いた手紙", { a: dayLine(l.sealedOn) });
}
