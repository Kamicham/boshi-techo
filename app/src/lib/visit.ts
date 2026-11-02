// ⑤ 健診の1日: 型と、画面・サーバの両方で使う純粋な処理。
// ここには DB・ファイル・Claude を呼ぶ処理を置かない（テストで直接読めるように）。
// サーバの処理は app/api/visit/_lib/server.ts。
import { z } from "zod";
import { addDays, addMonths, clockAt, fromDay, toDay, type FamilyDates } from "./clock";

// ───────── 記録の形（db の type = "visit"） ─────────

/** 録音から結果までの状態 */
export type VisitStatus = "ready" | "recording" | "transcribing" | "organizing" | "done" | "failed";

export const STATUS_LABEL: Record<VisitStatus, string> = {
  ready: "これから",
  recording: "録音中",
  transcribing: "文字起こし中",
  organizing: "整理中",
  done: "できた",
  failed: "うまくいかなかった",
};

/** 1回の録音（途中でページを閉じて録り直すと、次の take になる） */
export interface Take {
  mime: string;
  ext: string;
  /** 受け取った chunk の数（seq の最大 + 1） */
  chunks: number;
  bytes: number;
}

export interface Segment {
  /** 秒。文字で渡した時は無い */
  start?: number;
  end?: number;
  text: string;
}

export interface VisitTranscript {
  text: string;
  segments: Segment[];
  duration?: number;
  /** asr = 録音から / text = 文字で渡された（デモなど） */
  source: "asr" | "text";
}

/** 今日聞く事（前回の質問と、家族が足した気がかり） */
export interface AgendaItem {
  id: string;
  text: string;
  from: "前回の質問" | "気がかり";
  /** 聞けたら押す */
  asked?: boolean;
}

export interface VisitData {
  kind: "visit";
  /** 健診の日 YYYY-MM-DD */
  date: string;
  /** 「妊娠28週」など */
  label: string;
  status: VisitStatus;
  error?: string;
  /** できたけれど気をつける事（途中の録音が届いていない など） */
  warning?: string;
  /** どこで失敗したか（やり直しで文字起こしを使い回すため） */
  failedAt?: "transcribe" | "organize";
  processingSince?: string;
  /** 先生に録音の了承を取ったか（画面の確かめを通った） */
  consent?: boolean;
  takes?: Take[];
  transcript?: VisitTranscript;
  result?: Organized;
  /** 結果から計算した次の予約日 */
  nextDate?: string | null;
  agenda?: AgendaItem[];
  guide?: { steps: GuideStep[]; done: number[]; at: string; unsure?: string | null };
  demo?: boolean;
  /** 始めた時に持ち越した物（記録を消した時に、聞く事を元へ戻すため） */
  carried?: { prevCarriedFrom?: string; concerns: VisitPlan["concerns"] };
}

/** 画面が受け取る健診1回分 */
export type VisitView = VisitData & { id: string; familyId: string; running?: boolean };

/** 次の予約と、家族の気がかり（家族ごとに1つ。id = visit-plan:<家族>） */
export interface VisitPlan {
  kind: "plan";
  next?: { date: string; time?: string | null; source: "manual" | "visit"; visitId?: string; said?: string } | null;
  concerns: { id: string; text: string; date: string }[];
  /** 前回の質問を、どの健診まで持ち越したか */
  carriedFrom?: string;
}

export const planId = (familyId: string) => `visit-plan:${familyId}`;

// ───────── Claude に返してもらう形 ─────────

export const AppointmentSchema = z.object({
  said: z.string().describe("先生（または受付）が言ったままの言い方。例: 「2週間後の月曜」"),
  month: z.number().int().nullable().describe("日付で言われた時の月（1〜12）。言われていなければ null"),
  day: z.number().int().nullable().describe("日付で言われた時の日（1〜31）。言われていなければ null"),
  afterWeeks: z.number().int().nullable().describe("「2週間後」「来週」なら週の数。言われていなければ null"),
  afterDays: z.number().int().nullable().describe("「10日後」なら日の数。言われていなければ null"),
  afterMonths: z.number().int().nullable().describe("「1か月後」なら月の数。言われていなければ null"),
  weekday: z.number().int().nullable().describe("曜日を言われた時だけ 0=日 1=月 … 6=土。言われていなければ null"),
  time: z.string().nullable().describe("時刻を言われた時だけ HH:MM（24時間）。言われていなければ null"),
});
export type AppointmentSaid = z.infer<typeof AppointmentSchema>;

export const OrganizedSchema = z.object({
  summary: z.array(z.string()).describe("家族への3行。今日の健診で話した事を、家族の言葉で。評価はしない"),
  said: z
    .array(
      z.object({
        point: z.string().describe("先生が言った事の要点（短く）"),
        quote: z.string().describe("元の発言の引用（文字起こしのまま）"),
        at: z.string().nullable().describe("文字起こしの時刻（例 3:12）。無ければ null"),
      }),
    )
    .describe("先生が言った事"),
  todo: z
    .array(
      z.object({
        what: z.string().describe("次までにやる事"),
        when: z.string().nullable().describe("いつまでに（言われていれば）"),
        quote: z.string().describe("元の発言の引用"),
      }),
    )
    .describe("次の健診までに家族がやる事。先生が言った物だけ"),
  nextAppointment: AppointmentSchema.nullable().describe("次の予約。言っていなければ null"),
  numbers: z
    .array(
      z.object({
        name: z.string().describe("何の数値か（体重・血圧・推定体重・子宮頸管長など）"),
        value: z.string().describe("言われたとおりの値と単位（評価しない）"),
        quote: z.string().describe("元の発言の引用"),
      }),
    )
    .describe("話に出た数値"),
  terms: z
    .array(
      z.object({
        term: z.string().describe("元の言葉"),
        quote: z.string().describe("その言葉が出た元の発言"),
        plain: z.string().describe("やさしい説明: それが何か／何を測るものか。良い悪いは言わない"),
      }),
    )
    .describe("家族が分からなかったかもしれない言葉"),
  questions: z
    .array(
      z.object({
        question: z.string().describe("次に先生へ聞く質問（家族の口から言える形）"),
        why: z.string().describe("どの話の、どこが分からないまま残ったか"),
      }),
    )
    .describe("意味が残った所を、次の健診で聞く質問にした物"),
  answered: z
    .array(
      z.object({
        ask: z.string().describe("今日聞く予定だった事（渡された一覧のまま）"),
        answer: z.string().nullable().describe("先生の答えの要点。録音の中に答えが無ければ null"),
        quote: z.string().nullable().describe("答えの元の発言。無ければ null"),
      }),
    )
    .describe("今日聞く予定だった事それぞれへの答え。一覧が空なら空"),
});
export type Organized = z.infer<typeof OrganizedSchema>;

export const GuideSchema = z.object({
  steps: z
    .array(
      z.object({
        place: z.string().describe("場所の名前（写真の表記のまま）"),
        floor: z.string().nullable().describe("階（写真から読めた時だけ）"),
        what: z.string().describe("そこで何をするか（短く）"),
        note: z.string().nullable().describe("持って行く物・番号札など、気をつける事"),
      }),
    )
    .describe("今日回る順番"),
  unsure: z.string().nullable().describe("写真から読み取れず、受付で確かめた方がよい事。無ければ null"),
  hospital: z.string().nullable().describe("病院の名前（写真にはっきり書いてある時だけ、書いてあるまま）。無ければ null"),
});
export type GuideStep = z.infer<typeof GuideSchema>["steps"][number];

// ───────── 録音のファイル ─────────

/** 試す順。Chrome は webm/opus、iOS Safari は mp4 */
export const RECORDER_MIMES = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/ogg;codecs=opus"];

export function pickMime(isSupported: (t: string) => boolean): string | null {
  for (const t of RECORDER_MIMES) {
    try {
      if (isSupported(t)) return t;
    } catch {}
  }
  return null;
}

export function extFromMime(mime: string | null | undefined): string {
  const m = (mime ?? "").toLowerCase();
  if (m.includes("webm")) return "webm";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("ogg")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("wav")) return "wav";
  return "audio";
}

/** ファイル名の拡張子から（取り込みの時） */
export function extFromName(name: string): string | null {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : null;
}

export const isSafeExt = (ext: string) => /^[a-z0-9]{1,5}$/.test(ext);

export const chunkName = (seq: number, ext: string) => `chunk-${String(seq).padStart(4, "0")}.${ext}`;
export const takeDirName = (take: number) => `take${take}`;

/** take の置き場の名前を順に並べる */
export function orderTakeDirs(names: string[]): string[] {
  return names
    .map((n) => ({ n, m: n.match(/^take(\d+)$/) }))
    .filter((x) => x.m)
    .sort((a, b) => Number(a.m![1]) - Number(b.m![1]))
    .map((x) => x.n);
}

/** chunk のファイルを seq の順に並べ、抜けている番号を見つける */
export function orderChunks(names: string[]): { files: string[]; ext: string | null; missing: number[] } {
  const found = names
    .map((n) => ({ n, m: n.match(/^chunk-(\d+)\.([a-z0-9]+)$/) }))
    .filter((x) => x.m)
    .map((x) => ({ name: x.n, seq: Number(x.m![1]), ext: x.m![2] }))
    .sort((a, b) => a.seq - b.seq);
  const missing: number[] = [];
  const last = found.length ? found[found.length - 1].seq : -1;
  const have = new Set(found.map((f) => f.seq));
  for (let i = 0; i <= last; i++) if (!have.has(i)) missing.push(i);
  return { files: found.map((f) => f.name), ext: found[0]?.ext ?? null, missing };
}

/** 何回かに分かれた録音の文字起こしを、時刻をずらして1本にする */
export function mergeTranscripts(parts: { text: string; segments: { start: number; end: number; text: string }[]; duration: number }[]): VisitTranscript {
  let offset = 0;
  const segments: Segment[] = [];
  for (const p of parts) {
    for (const s of p.segments) segments.push({ start: round1(s.start + offset), end: round1(s.end + offset), text: s.text });
    offset += p.duration;
  }
  return { text: parts.map((p) => p.text).join("\n"), segments, duration: round1(offset), source: "asr" };
}

/** 文字で渡された文字起こし（デモ・貼り付け）を、行ごとの区切りにする */
export function segmentsFromText(text: string): Segment[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((t) => ({ text: t }));
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** 秒 → 「3:05」「1:02:09」 */
export function formatClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}

/** Claude に渡す文字起こし（時刻つき） */
export function transcriptForPrompt(t: VisitTranscript): string {
  return t.segments.map((s) => (s.start !== undefined ? `[${formatClock(s.start)}] ${s.text}` : s.text)).join("\n");
}

// ───────── 日付 ─────────

const weekdayOf = (d: string) => new Date(toDay(d) * 86_400_000).getUTCDay();

function validDate(y: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const s = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return fromDay(toDay(s)) === s ? s : null;
}

/**
 * 先生の言い方から、次の予約日を健診の日を起点に計算する。
 * - 「3月1日」: 健診の日以降で一番近いその日
 * - 「2週間後」「10日後」「1か月後」: 健診の日から数える
 * - 「来週の水曜」（週＋曜日）: その週（月曜はじまり）の、その曜日
 * - 「水曜に」（曜日だけ）: 健診の日の後で一番近いその曜日
 */
export function resolveAppointmentDate(visitDate: string, a: Omit<AppointmentSaid, "said" | "time">): string | null {
  if (a.month != null && a.day != null) {
    const y = Number(visitDate.slice(0, 4));
    for (const yy of [y, y + 1]) {
      const d = validDate(yy, a.month, a.day);
      if (d && d >= visitDate) return d;
    }
    return null;
  }
  if (a.afterWeeks != null || a.afterDays != null || a.afterMonths != null) {
    let d = a.afterMonths ? addMonths(visitDate, a.afterMonths) : visitDate;
    d = addDays(d, (a.afterWeeks ?? 0) * 7 + (a.afterDays ?? 0));
    if (a.weekday != null && a.afterWeeks) {
      const mon = (weekdayOf(d) + 6) % 7;
      const target = (a.weekday + 6) % 7;
      d = addDays(d, target - mon);
    }
    return d > visitDate ? d : null;
  }
  if (a.weekday != null) {
    const delta = (a.weekday - weekdayOf(visitDate) + 7) % 7 || 7;
    return addDays(visitDate, delta);
  }
  return null;
}

/** 前日の声かけを出す日か: 前日 = "eve" / 当日 = "day" */
export function briefingDay(today: string, next: string | null | undefined): "eve" | "day" | null {
  if (!next) return null;
  if (next === today) return "day";
  if (addDays(today, 1) === next) return "eve";
  return null;
}

/** 健診の日の呼び名（妊娠中は「妊娠28週」、生まれた後は「生後1か月」など） */
export function visitLabel(f: FamilyDates, date: string): string {
  const c = clockAt(f, date);
  if (c.phase === "pregnant") return `妊娠${c.pregnancyWeek}週`;
  if (c.phase === "trying") return "妊娠の前";
  return c.label;
}

/** 持ち物（全国共通の物だけ。名前は町や病院によって違う事がある） */
export function bringList(f: FamilyDates, date: string): string[] {
  const c = clockAt(f, date);
  if (c.phase === "pregnant" || c.phase === "trying") return ["母子健康手帳", "健康保険証（マイナ保険証）", "妊婦健診の受診券", "診察券"];
  return ["母子健康手帳", "健康保険証（マイナ保険証）", "子どもの医療証", "診察券"];
}

/** 一覧に並べる新しい順（同じ日なら後に作った方を先） */
export function newestFirst<T extends { date: string; createdAt?: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => (a.date === b.date ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "") : b.date.localeCompare(a.date)));
}

/**
 * 次の健診で聞く事: 一番新しい「できた」健診の質問（まだ持ち越していなければ）と、家族の気がかり。
 */
export function nextAgenda(
  visits: { id: string; status: VisitStatus; date: string; createdAt?: string; result?: Pick<Organized, "questions"> }[],
  plan: Pick<VisitPlan, "concerns" | "carriedFrom">,
): { items: AgendaItem[]; fromVisit: string | null } {
  const last = newestFirst(visits.filter((v) => v.status === "done" && v.result))[0];
  const items: AgendaItem[] = [];
  if (last && last.id !== plan.carriedFrom) {
    last.result!.questions.forEach((q, i) => items.push({ id: `${last.id}:q${i}`, text: q.question, from: "前回の質問" }));
  }
  for (const c of plan.concerns) items.push({ id: c.id, text: c.text, from: "気がかり" });
  return { items, fromVisit: last && last.id !== plan.carriedFrom ? last.id : null };
}

/** 処理中のまま止まっていそうか（サーバの再起動など） */
export function looksStuck(v: Pick<VisitData, "status" | "processingSince">, now: number, limitMin = 20): boolean {
  if (v.status !== "transcribing" && v.status !== "organizing") return false;
  if (!v.processingSince) return true;
  return now - Date.parse(v.processingSince) > limitMin * 60_000;
}

// ───────── 健診の日の段 ─────────

/** 健診の日の流れ: 着く → 受付・道案内 → 診察で録音 → 帰り道に読む → 家族に送る */
export type VisitStage = "arrive" | "guide" | "record" | "read" | "send";

export const STAGES: { key: VisitStage; label: string }[] = [
  { key: "arrive", label: "着く" },
  { key: "guide", label: "案内" },
  { key: "record", label: "録音" },
  { key: "read", label: "読む" },
  { key: "send", label: "送る" },
];

/** 開いた時の段（記録の状態から） */
export function autoStage(v: Pick<VisitData, "status" | "takes" | "guide" | "transcript">): VisitStage {
  if (v.status === "done" || v.status === "transcribing" || v.status === "organizing") return "read";
  if (v.status === "failed") return v.transcript ? "read" : "record";
  if (v.status === "recording" || v.takes?.some((t) => t.chunks > 0)) return "record";
  if (v.guide) return v.guide.steps.length && v.guide.done.length >= v.guide.steps.length ? "record" : "guide";
  return "arrive";
}

/** 家族へ送る短い文（3行のまとめ＋次の予約）。評価は足さない */
export function familyMessage(v: Pick<VisitData, "date" | "label" | "result" | "nextDate">, jp: (d: string) => string): string {
  const r = v.result;
  const lines = [`${jp(v.date)}の健診（${v.label}）`];
  for (const s of (r?.summary ?? []).slice(0, 3)) lines.push(`・${s}`);
  if (v.nextDate) lines.push(`次の健診: ${jp(v.nextDate)}${r?.nextAppointment?.time ? ` ${r.nextAppointment.time}` : ""}`);
  return lines.join("\n");
}

/** 文字起こしのヒント（専門用語） */
export const ASR_HINT =
  "妊婦健診の診察です。子宮頸管長、推定体重、尿蛋白、尿糖、浮腫、むくみ、NST、ノンストレステスト、逆子、胎盤、羊水、羊水量、GBS、貧血、血圧、腹囲、子宮底長、エコー、胎動、張り、経腟エコー、母子健康手帳、受診券。";
