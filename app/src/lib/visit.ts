// ⑤ 健診の1日: 型と、画面・サーバの両方で使う純粋な処理。
// ここには DB・ファイル・Claude を呼ぶ処理を置かない（テストで直接読めるように）。
// サーバの処理は app/api/visit/_lib/server.ts。
// 画面に出す言葉（状態の札・段の名前・持ち物・呼び名）は日本語のまま返し、描く所で t() で訳す（鍵は lib/i18n/dict/visit-home.ts・visit-record.ts）。
// 保存する値（label など）と比べに使う値は日本語のまま。訳した呼び名は visitLabelIn・relabelVisit（描く時だけ）。家族へ送る文（familyMessage・lineMessage）は日本語のまま
// 家族の言葉（作り手の決め事②・切り替えの印 CLAUDE_LANG.visit の裏）: まとめを家族の言葉でも書いた健診（result.family）だけ、
// 結果の画面は家族の言葉を大きく・日本語の元の文を小さく出し（resultLines）、送る文も家族の言葉を選べる（familySendTexts）。日本語の文と画面は前のまま
import { z } from "zod";
import { addDays, addMonths, clockAt, clockShort, diffDays, fromDay, relabel, toDay, type FamilyDates } from "./clock";
import { currentLang, t, withLang, type Dict, type Lang } from "./i18n";
import { motherEmployed, type Situation } from "./situation";

// ───────── 記録の形（db の type = "visit"） ─────────

/** 録音から結果までの状態 */
export type VisitStatus = "ready" | "recording" | "transcribing" | "organizing" | "done" | "failed";

/** 状態の札（出す時に t() で訳す＝components/visit/StatusChip.tsx） */
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
  /** Claude の整理（家族の言葉でも書いた時は family と lang も。VisitResult） */
  result?: VisitResult;
  /**
   * 次の予約日。整理の直後は録音から聞こえた日（result.nextAppointment から計算）。
   * 本人が確かめた後は確かめた日（直した日）、「言われていない」なら null（lib/visit-next.ts）
   */
  nextDate?: string | null;
  /** 次の健診の日を本人が確かめたか（無い＝まだ確かめていない。2026-11-05 作り手の方針「最後の確かめと OK は本人」） */
  nextCheck?: NextCheck;
  agenda?: AgendaItem[];
  guide?: { steps: GuideStep[]; done: number[]; at: string; unsure?: string | null };
  demo?: boolean;
  /** 始めた時に持ち越した物（記録を消した時に、聞く事を元へ戻すため） */
  carried?: { prevCarriedFrom?: string; concerns: VisitPlan["concerns"] };
}

/**
 * 次の健診の日の確かめ（結果の画面の1問の答え）。
 * - ok: 聞こえた日で大丈夫 / fixed: 本人が直した / none: 次の日は言われていない
 * - date・time は ok・fixed の時の、本人が確かめた日と時刻（整理をやり直しても上書きしない）
 * - by は端末で選んだ人の名前（わが家の置き場はアカウントが無く、サーバには誰が押したか分からないため）。account はアカウントがある時だけ
 */
export interface NextCheck {
  state: "ok" | "fixed" | "none";
  date?: string | null;
  time?: string | null;
  /** 押した時刻（ISO） */
  at: string;
  by?: string | null;
  account?: string | null;
}

/**
 * 画面が受け取る健診1回分（canWrite: 確かめのボタンを出してよいか）。
 * sendWords: 家族の言葉で送る文の枠の言葉（家族の言葉でもまとめを書いた健診だけ。app/api/visit/_lib/server.ts の sendWordsOf）
 */
export type VisitView = VisitData & { id: string; familyId: string; running?: boolean; canWrite?: boolean; sendWords?: Dict };

/** 次の予約と、家族の気がかり（家族ごとに1つ。id = visit-plan:<家族>） */
export interface VisitPlan {
  kind: "plan";
  /** heard: 録音から聞こえた日で、まだ本人が確かめていない（読む時に付ける印。保存しない＝lib/visit-next.ts の withHeard） */
  next?: { date: string; time?: string | null; source: "manual" | "visit"; visitId?: string; said?: string; heard?: boolean } | null;
  /** for: "child" は子の健診で聞く事（ママの健診の聞く事には入れない。健診のタブの子の欄に並ぶ） */
  concerns: { id: string; text: string; date: string; for?: "child" | "mother" }[];
  /** 前回の質問を、どの健診まで持ち越したか */
  carriedFrom?: string;
  /** 妊婦健診の受診券の数（家族が直した時だけ。無ければ国の標準14回） */
  tickets?: number;
  /** 妊婦健診で払った額（家族が入れた物。医療費控除・里帰りの払い戻しの材料。平均とは比べない） */
  paid?: { id: string; date: string; yen: number }[];
}

export const planId = (familyId: string) => `visit-plan:${familyId}`;

// ───────── Claude に返してもらう形 ─────────

/** まとめ1行の長さ（スマホで1行に収まる字数） */
export const SUMMARY_LINE = 40;

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
  summary: z
    .array(z.string())
    .describe(`家族への3行。1行は${SUMMARY_LINE}字まで・一文。専門の言葉は使わず、やさしい言葉に置き換える。評価はしない`),
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

// ───────── 家族の言葉（作り手の決め事②。頼みの段は lib/i18n/claude-lang.ts の organizeLangNote・組み立ては lib/visit-organize.ts） ─────────

/** 家族の言葉（日本語の外の画面の言葉） */
export type FamilyLang = Exclude<Lang, "ja">;

/**
 * 日本語の欄を、家族が読む言葉にした物。整理を頼んだ画面が zh・en で、切り替えの印 CLAUDE_LANG.visit が on の時だけ頼む。
 * 日本語の欄と同じ順・同じ数（そろわない時は保存しない＝lib/visit-organize.ts の organizedResult）。引用（quote）は入れない
 */
export const FamilyWordsSchema = z
  .object({
    summary: z.array(z.string()).describe("summary の各行を、家族の言葉にした物（同じ順・同じ数）"),
    said: z.array(z.string()).describe("said の point を、家族の言葉にした物（同じ順・同じ数）"),
    todo: z
      .array(
        z.object({
          what: z.string().describe("todo の what を、家族の言葉にした物"),
          when: z.string().nullable().describe("todo の when を、家族の言葉にした物（null は null のまま）"),
        }),
      )
      .describe("todo の what と when（同じ順・同じ数）"),
    numbers: z
      .array(
        z.object({
          name: z.string().describe("numbers の name を、家族の言葉にした物"),
          value: z.string().describe("numbers の value を、家族の言葉にした物（数値と単位は変えない・評価しない）"),
        }),
      )
      .describe("numbers の name と value（同じ順・同じ数）"),
    terms: z.array(z.string()).describe("terms の plain を、家族の言葉にした物（同じ順・同じ数）"),
    questions: z.array(z.string()).describe("questions の question を、家族の言葉にした物（同じ順・同じ数）"),
    answered: z.array(z.string().nullable()).describe("answered の answer を、家族の言葉にした物（同じ順・同じ数。null は null のまま）"),
  })
  .describe("日本語の欄を、家族が読む言葉にした物。引用（quote）は入れない。評価（順調・問題なし など）は先生がそう言った時だけ。専門の言葉は日本語の欄と同じく言い換える");
export type FamilyWords = z.infer<typeof FamilyWordsSchema>;

/** 家族の言葉も頼む時の受け取る形（OrganizedSchema はそのまま。日本語の画面と、印が off の間は使わない） */
export const OrganizedWithFamilySchema = OrganizedSchema.extend({ family: FamilyWordsSchema });

/** 保存する整理の結果。family と lang（家族の言葉＝整理を頼んだ画面の言葉）は、家族の言葉を残した時だけ、いつも2つ一緒に入る */
export type VisitResult = Organized & { family?: FamilyWords; lang?: FamilyLang };

/** family の数が日本語の欄とそろうか（そろわない family は使わない） */
export function familyFits(r: Organized, f: FamilyWords): boolean {
  return (
    f.summary.length === r.summary.length &&
    f.said.length === r.said.length &&
    f.todo.length === r.todo.length &&
    f.numbers.length === r.numbers.length &&
    f.terms.length === r.terms.length &&
    f.questions.length === r.questions.length &&
    f.answered.length === r.answered.length
  );
}

/** 使える家族の言葉（無い・言葉が読めない・数がそろわない時は null） */
export function familyOf(r: VisitResult | null | undefined): { lang: FamilyLang; words: FamilyWords } | null {
  if (!r?.family || (r.lang !== "zh" && r.lang !== "en") || !familyFits(r, r.family)) return null;
  return { lang: r.lang, words: r.family };
}

/** 家族の言葉の1行の長さの目安（訳すと字数が変わる: 中文は日本語とほぼ同じかやや長く、English はおよそ2〜3倍） */
export const FAMILY_LINE: Readonly<Record<FamilyLang, number>> = { zh: SUMMARY_LINE + SUMMARY_LINE / 2, en: SUMMARY_LINE * 3 };

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

/** 健診の日の呼び名（妊娠中は「妊娠28週」、生まれた後は「生後1か月」など）。サーバが健診の記録に残す（label） */
export function visitLabel(f: FamilyDates, date: string): string {
  const c = clockAt(f, date);
  if (c.phase === "pregnant") return `妊娠${c.pregnancyWeek}週`;
  if (c.phase === "trying") return "妊娠の前";
  return c.label;
}

/**
 * 健診の日の呼び名を画面の言葉で（描く時だけ。保存には visitLabel）。日本語は visitLabel と1字も変えない。
 * ほかの言葉は週数・月齢の言い方（lib/clock の clockShort。今日の画面の VisitToday と同じ）
 */
export function visitLabelIn(f: FamilyDates, date: string): string {
  return currentLang() === "ja" ? visitLabel(f, date) : clockShort(clockAt(f, date));
}

/**
 * 残した呼び名（健診を作った時に visitLabel が日本語で書いた「妊娠28週」「妊娠の前」「生後1か月」「1歳3か月」など）を、画面の言葉にする（描く時だけ）。
 * 日本語の時と、読めない形はそのまま返す。妊娠中は visitLabelIn と同じ言い方（妊娠28周・28 weeks pregnant）
 */
export function relabelVisit(label: string): string {
  if (currentLang() === "ja") return label;
  const w = /^妊娠(\d+)週$/.exec(label);
  if (w) return t("妊娠{w}週", { w: Number(w[1]) });
  if (label === "妊娠の前") return t("妊娠の前");
  return relabel(label);
}

/**
 * 持ち物（全国共通の物だけ。名前は町や病院によって違う事がある）。名前は日本語のまま返し、画面は t(名前) で訳す
 * （窓口で見せる物なので、訳にも日本語を括弧で並べる。鍵は lib/i18n/dict/visit-record.ts）
 */
export function bringList(f: FamilyDates & { situation?: Situation }, date: string): string[] {
  const c = clockAt(f, date);
  if (c.phase === "pregnant" || c.phase === "trying") return ["母子健康手帳", "マイナ保険証か資格確認書", "妊婦健診の受診券", "診察券"];
  const base = ["母子健康手帳", "マイナ保険証か資格確認書", "子どもの医療証", "診察券"];
  // 1か月健診のころ（生まれて20〜45日）、雇われて働く母は、出産手当金の申請書の医師の証明の欄を書いてもらえる（第2波⑤）
  const days = f.birthDate ? diffDays(date, f.birthDate) : -1;
  if (days >= 20 && days <= 45 && motherEmployed(f.situation)) base.push("出産手当金の申請書（医師の証明の欄がまだなら）");
  return base;
}

/** 一覧に並べる新しい順（同じ日なら後に作った方を先） */
export function newestFirst<T extends { date: string; createdAt?: string }>(xs: T[]): T[] {
  return [...xs].sort((a, b) => (a.date === b.date ? (b.createdAt ?? "").localeCompare(a.createdAt ?? "") : b.date.localeCompare(a.date)));
}

/**
 * 健診で聞く事が、だれの健診の物か。
 * - child: 子の健診（for が child。生まれた後の for の無い古い物＝第30回より前に「聞く」から足した物も、子の事が多いのでこちら）
 * - mother: ママの健診
 * - past: 生まれる前に足した物を、生まれた後に見た時（妊娠中の気がかり。ママの「聞く事」には出さず、ふり返りに回す＝第31回）
 * birthDate は、もう生まれている時だけ渡す。
 */
export function concernSide(c: { date: string; for?: "child" | "mother" }, birthDate?: string | null): "child" | "mother" | "past" {
  if (c.for === "child") return "child";
  if (birthDate && c.date < birthDate) return "past";
  if (c.for === "mother") return "mother";
  return birthDate ? "child" : "mother";
}

/**
 * 次の健診で聞く事: 一番新しい「できた」健診の質問（まだ持ち越していなければ）と、家族の気がかり。
 */
export function nextAgenda(
  visits: { id: string; status: VisitStatus; date: string; createdAt?: string; result?: Pick<Organized, "questions"> }[],
  plan: Pick<VisitPlan, "concerns" | "carriedFrom">,
  /** もう生まれていれば、生まれた日 */
  birthDate?: string | null,
): { items: AgendaItem[]; fromVisit: string | null } {
  const last = newestFirst(visits.filter((v) => v.status === "done" && v.result))[0];
  const items: AgendaItem[] = [];
  if (last && last.id !== plan.carriedFrom) {
    last.result!.questions.forEach((q, i) => items.push({ id: `${last.id}:q${i}`, text: q.question, from: "前回の質問" }));
  }
  for (const c of plan.concerns) if (concernSide(c, birthDate) === "mother") items.push({ id: c.id, text: c.text, from: "気がかり" });
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

/** 段の名前（出す時に t(s.label) で訳す） */
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

/** 本人が「大丈夫」か「直す」で確かめたか（「言われていない」は日が無いので入れない） */
export function isChecked(c: NextCheck | null | undefined): c is NextCheck & { state: "ok" | "fixed"; date: string } {
  return !!c && (c.state === "ok" || c.state === "fixed") && !!c.date;
}

/**
 * この健診から出た次の健診の日と時刻。checked: 本人が確かめた日か（false は録音から聞こえただけの日）。
 * 確かめた日は nextCheck、まだなら nextDate と聞こえた時刻。「言われていない」は null
 */
export function nextOfVisit(v: Pick<VisitData, "nextDate" | "nextCheck" | "result">): { date: string; time: string | null; checked: boolean } | null {
  const c = v.nextCheck;
  if (c?.state === "none") return null;
  if (isChecked(c)) return { date: c.date, time: c.time ?? null, checked: true };
  if (!v.nextDate) return null;
  return { date: v.nextDate, time: v.result?.nextAppointment?.time ?? null, checked: false };
}

/**
 * 家族へ送る短い文（3行のまとめ＋次の予約）。評価は足さない。
 * 次の予約は、本人が確かめた日だけ入れる（録音から聞こえただけの日を家族へ広げない。2026-11-05 作り手の方針）
 * 送る文は日本語のまま（まとめの3行が Claude の日本語なので、枠だけ訳すと言葉が混ざる。2026-11-05 統括）。jp も日本語の書き方を渡す
 */
export function familyMessage(v: Pick<VisitData, "date" | "label" | "result" | "nextDate" | "nextCheck">, jp: (d: string) => string): string {
  const r = v.result;
  const lines = [`${jp(v.date)}の健診（${v.label}）`];
  for (const s of (r?.summary ?? []).slice(0, 3)) lines.push(`・${s}`);
  const n = nextOfVisit(v);
  if (n?.checked) lines.push(`次の健診: ${jp(n.date)}${n.time ? ` ${n.time}` : ""}`);
  return lines.join("\n");
}

/** まとめが長すぎるか（3行×40字を超える・4行以上）。長い時、画面は1行目だけを先に見せる */
export function summaryTooLong(summary: string[]): boolean {
  return summary.length > 3 || summary.some((s) => s.length > SUMMARY_LINE);
}

/** 長い1行を字数で切る */
export function clip(s: string, n: number): string {
  const t = s.trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

/**
 * LINE に渡す、さらに短い文: 「6/10 健診（妊娠28週）」＋まとめ2行（40字まで）＋次の健診（本人が確かめた日だけ）。
 * 送る文は日本語のまま（familyMessage と同じ）
 */
export function lineMessage(v: Pick<VisitData, "date" | "label" | "result" | "nextDate" | "nextCheck">): string {
  const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
  const r = v.result;
  const lines = [`${md(v.date)} 健診（${v.label}）`];
  for (const s of (r?.summary ?? []).slice(0, 2)) lines.push(clip(s, SUMMARY_LINE));
  const n = nextOfVisit(v);
  if (n?.checked) lines.push(`次は ${md(n.date)}${n.time ? ` ${n.time}` : ""}`);
  return lines.join("\n");
}

// ───────── 家族の言葉: 結果の画面と送る文（家族の言葉でもまとめを書いた健診だけ。ほかは前のまま） ─────────

/** 結果の画面の1行: text を大きく出し、ja があればその下に小さく添える（家族の言葉で出す時の、日本語の元の文）。ほかの時は ja が null で、text は日本語のまま */
export interface Shown {
  text: string;
  ja: string | null;
}

/** 結果の画面に出す行（components/visit/Results.tsx） */
export interface ResultLines {
  /** 家族の言葉で出す時のその言葉（出さない時は null＝前と同じ日本語だけ） */
  lang: FamilyLang | null;
  /** まとめの全部の行（画面は3行まで。長い時は「全部読む」の中に全部） */
  summary: Shown[];
  /** まとめが長い時（summaryTooLong）に先に見せる1行目（切った物） */
  first: Shown;
  said: Shown[];
  todo: { what: Shown; when: Shown | null }[];
  numbers: { name: Shown; value: Shown }[];
  terms: Shown[];
  questions: Shown[];
  /** 答えが録れていない（answer が null）所は null */
  answered: (Shown | null)[];
}

/**
 * 結果の画面に出す行を選ぶ。家族の言葉があり、画面の言葉（screen）が整理を頼んだ言葉と同じ時だけ、家族の言葉を大きく・日本語の元の文を小さく。
 * それ以外は日本語だけ（前と同じ字）。家族の言葉が空の行・日本語と同じ字の行は、日本語だけで出す。
 * 引用（quote）・時刻・元の言葉（term）・聞く予定だった事（ask）・理由（why）は、ここを通さず日本語のまま出す
 */
export function resultLines(r: VisitResult, screen: Lang): ResultLines {
  const f = familyOf(r);
  const fam = f && f.lang === screen ? f : null;
  const w = fam?.words;
  const shown = (ja: string, other: string | null | undefined): Shown => (w && other?.trim() && other !== ja ? { text: other, ja } : { text: ja, ja: null });
  const summary = r.summary.map((s, i) => shown(s, w?.summary[i]));
  const s0 = summary[0];
  return {
    lang: fam?.lang ?? null,
    summary,
    first: fam && s0?.ja ? { text: clip(s0.text, FAMILY_LINE[fam.lang] * 2), ja: clip(s0.ja, SUMMARY_LINE * 2) } : { text: clip(r.summary[0] ?? "", SUMMARY_LINE * 2), ja: null },
    said: r.said.map((x, i) => shown(x.point, w?.said[i])),
    todo: r.todo.map((x, i) => {
      const o = w?.todo[i];
      if (!o?.what?.trim() || o.what === x.what) return { what: { text: x.what, ja: null }, when: x.when ? { text: x.when, ja: null } : null };
      // 家族の言葉: いつまでに（when）は家族の言葉で横に出し、日本語の元の文には括弧で並べる
      return { what: { text: o.what, ja: x.when ? `${x.what}（${x.when}）` : x.what }, when: x.when ? { text: o.when?.trim() ? o.when : x.when, ja: null } : null };
    }),
    numbers: r.numbers.map((n, i) => ({ name: shown(n.name, w?.numbers[i]?.name), value: shown(n.value, w?.numbers[i]?.value) })),
    terms: r.terms.map((x, i) => shown(x.plain, w?.terms[i])),
    questions: r.questions.map((q, i) => shown(q.question, w?.questions[i])),
    answered: r.answered.map((a, i) => (a.answer ? shown(a.answer, w?.answered[i]) : null)),
  };
}

/**
 * 家族の言葉で送る文の枠に使う鍵（familySendTexts が t() で引く物すべて）。健診の API が、家族の言葉の辞書からこの鍵だけを sendWords として画面へ渡す
 * （送る文の言葉は画面の言葉と別に選べ、画面は今の言葉の辞書しか持たないため。試験が、この鍵だけで組んだ文と辞書全部で組んだ文を比べる）
 */
export const SEND_WORD_KEYS: readonly string[] = [
  "{date}の健診（{label}）",
  "・{line}",
  "次の健診: {date}",
  "{date} 健診（{label}）",
  "次は {date}",
  "{label}の健診",
  "妊娠{w}週",
  "妊娠の前",
];

/** 言葉の辞書から、送る文の枠の鍵だけを取り出す（サーバが DICTS[家族の言葉] から作る） */
export function sendWordsFrom(dict: Dict): Dict {
  const out: Record<string, string> = {};
  for (const k of SEND_WORD_KEYS) if (dict[k]) out[k] = dict[k];
  return out;
}

/**
 * 家族の言葉で送る文（3行の全文・LINE の短い文・共有の題）。まとめの行は family.summary、枠（日付・「の健診」・次の健診・呼び名）は
 * その言葉の辞書（dict。画面では健診の API の sendWords、試験では DICTS）で組み、日付は jp をその言葉で書く（components/today/dates の jpDate）。
 * 次の健診は、日本語の文と同じく本人が確かめた日だけ。家族の言葉が無い時・dict に枠の訳が無い時は null（送る文は日本語の familyMessage・lineMessage のまま）
 */
export function familySendTexts(
  v: Pick<VisitData, "date" | "label" | "result" | "nextDate" | "nextCheck">,
  dict: Dict,
  jp: (d: string) => string,
): { lang: FamilyLang; message: string; line: string; title: string } | null {
  const f = familyOf(v.result);
  if (!f || !dict["{date}の健診（{label}）"]) return null;
  const { lang, words } = f;
  return withLang(
    lang,
    () => {
      const label = relabelVisit(v.label);
      const n = nextOfVisit(v);
      const time = n?.time ? ` ${n.time}` : "";
      const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
      const message = [t("{date}の健診（{label}）", { date: jp(v.date), label }), ...words.summary.slice(0, 3).map((s) => t("・{line}", { line: s }))];
      if (n?.checked) message.push(t("次の健診: {date}", { date: `${jp(n.date)}${time}` }));
      const line = [t("{date} 健診（{label}）", { date: md(v.date), label }), ...words.summary.slice(0, 2).map((s) => clip(s, FAMILY_LINE[lang]))];
      if (n?.checked) line.push(t("次は {date}", { date: `${md(n.date)}${time}` }));
      return { lang, message: message.join("\n"), line: line.join("\n"), title: t("{label}の健診", { label }) };
    },
    dict,
  );
}

/**
 * 送る文の言葉: 家族の言葉で送る文がある時だけ、日本語と家族の言葉の2つから選べる。
 * 選ぶ前は、画面の言葉が家族の言葉ならそれ、ほかは日本語（picked は本人が押した言葉。選べない言葉なら選ぶ前と同じ）
 */
export function sendLangChoice(family: FamilyLang | null | undefined, screen: Lang, picked: Lang | null): { choices: Lang[]; lang: Lang } {
  if (!family) return { choices: [], lang: "ja" };
  const choices: Lang[] = ["ja", family];
  return { choices, lang: picked && choices.includes(picked) ? picked : screen === family ? family : "ja" };
}

/** 文字起こしのヒント（専門用語） */
export const ASR_HINT =
  "妊婦健診の診察です。子宮頸管長、推定体重、尿蛋白、尿糖、浮腫、むくみ、NST、ノンストレステスト、逆子、胎盤、羊水、羊水量、GBS、貧血、血圧、腹囲、子宮底長、エコー、胎動、張り、経腟エコー、母子健康手帳、受診券。";
