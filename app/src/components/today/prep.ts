// 手帳が先回りした跡（UX の見直し C07・2026-11-05）:
// 一番上の札の「✓ 職場へのメールを下書きしました（あと上司の名前だけ）」、行の札「下書きあり」「窓口 ✓」、
// 開いた時に手帳が先に用意する事の選び方、週数の帯の下の「手帳がしておいた事（日付）」。
// 画面とサーバ（/api/prep）の両方から読む純関数（Claude は呼ばない）。
import type { DraftKind } from "@/lib/drafts";
import type { Family, Member } from "@/lib/demo-family";
import { diffDays } from "@/lib/clock";
import { DRAFTABLE } from "@/lib/draft-kinds";
import { t as tr } from "@/lib/i18n";
import { isMadeId } from "@/lib/i18n/names";
import { NOW, byDays, daysLeft, isMine, isStale, type Task } from "./task";

/** 下書きを何と呼ぶかの種類: 表（lib/draft-kinds.ts）を先に見る＝札の下のボタン（MilestoneActions）と同じ順。
 *  Claude が表と違う種類で作った時も、「✓ …を下書きしました」の行とボタンが同じ名前で言う。表に無い事だけ、作った種類で言う */
export function draftKindFor(id: string, made?: DraftKind | null): DraftKind {
  // 訳さない: 下書きの種類の値（画面の呼び名は nounFor・描く所で訳す）
  return DRAFTABLE[id] ?? made ?? "記入メモ";
}

/** 見本の答えの札（lib/samples.ts の SAMPLE_MARK と同じ。あちらは server-only なので画面用に写す。同じかは試験で見る） */
// 訳さない: 見本の答えの印（保存した題の頭と比べるだけ）
export const SAMPLE_MARK = "（見本の答え）";

/** 鍵が無い時の見本の答えか（手帳が用意したとは数えない＝「下書きしました」と言わない） */
export function isSample(d: { title?: string } | null | undefined): boolean {
  return !!d?.title?.startsWith(SAMPLE_MARK);
}

/** 手帳が前に用意した物（GET /api/prep の1件）。on は作った日・調べた日（YYYY-MM-DD） */
export interface Prepared {
  draft?: { kind: DraftKind; on: string; blanks: string[] };
  local?: { on: string };
}

/** 空欄の名前がこれより長い時は、名前を言わずに数で言う（名前の無い【 】は、その行の文が名前になる） */
const BLANK_LABEL_MAX = 12;

/** 下書きに残る空欄の一言: 「（あと上司の名前だけ）」「（空欄あと2つ）」。無ければ空。画面の言葉で返す（空欄の名前は下書きの日本語のまま） */
export function blankNote(blanks: string[]): string {
  if (blanks.length === 0) return "";
  const one = blanks[0].trim();
  if (blanks.length === 1 && one && one.length <= BLANK_LABEL_MAX) return tr("（あと{blank}だけ）", { blank: one });
  return tr("（空欄あと{n}つ）", { n: blanks.length });
}

/** できた下書きの行（✓ の後ろ）: 「職場へのメールを下書きしました（あと上司の名前だけ）」。メモと一覧は「作りました」 */
export function madeLine(noun: string, kind: DraftKind, blanks: string[]): string {
  const vars = { noun: tr(noun), note: blankNote(blanks) };
  return kind === "メール" || kind === "頼み文" ? tr("{noun}を下書きしました{note}", vars) : tr("{noun}を作りました{note}", vars);
}

/** 窓口を先に調べる事（役所に出す手続きだけ。産院・職場に出す物を役所の窓口で調べると、違う行き先が出る＝sim-14 の直接支払制度） */
export function canLocalFor(t: Pick<Task, "needsLocal" | "kind" | "title" | "plain">, family: Pick<Family, "city">): boolean {
  return !!t.needsLocal && !!family.city && t.kind === "手続き" && !/産院|職場/.test(`${t.title}${t.plain}`);
}

/** これより先に始まる事は、先に用意しない */
export const PREP_DAYS = 14;
/** 開いた時に手帳が用意する数（一番上を含めて） */
export const PREP_MAX = 3;

/**
 * 開いた時に手帳が先に用意する事（一番上を含めて3件まで）。
 * 14日以内に始まる事（今やる事・期限の近い事を含む）で、自分か家族の番の事。窓口か下書きのある事だけ（can）。
 * ほかの人の番の事は先に書かない（下書きは開いた人の名前で書かれるため）。時期を過ぎて畳んだ事は入れない。並びは、あと何日の順。
 * first = 一番上の札（か届けの束の1行目）が用意する事。用意できる事なら先頭に入れる。
 */
export function prepAhead(tasks: Task[], today: string, me: Member | null, first: Task | null, can: (t: Task) => boolean): Task[] {
  const near = (t: Task) => NOW.has(t.status) || (t.status === "まだ先" && !t.awaitingBirth && !t.awaitingPregnancy && diffDays(t.startDate, today) <= PREP_DAYS);
  const ok = (t: Task) => near(t) && !isStale(t, today) && (!me || isMine(t, me)) && can(t);
  const head = first && ok(first) ? [first] : [];
  const rest = byDays(
    tasks.filter((t) => ok(t) && t.id !== first?.id),
    (t) => daysLeft(t, today),
  );
  return [...head, ...rest].slice(0, PREP_MAX);
}

/**
 * 帯の下の1行の中身: 用意した物のある事（窓口・下書き）と、いちばん新しい日。何も無ければ null。
 * 作った家族（見本・なりきり・公開版の写し）は、日を場面の今日（scene.today）にする。町の窓口の調べは本物の日付で
 * 共有の置き場に残るので、見本の 2027/1/19 の画面に本物の今日（2026/11/6（金））が出ていた（デモの会話が見つけた⑥・2026-11-06）
 */
export function prepNoteOf(
  ids: string[],
  prepared: Record<string, Prepared>,
  scene?: { familyId: string; today: string },
): { on: string; local: string[]; draft: string[] } | null {
  const local = ids.filter((id) => prepared[id]?.local);
  const draft = ids.filter((id) => prepared[id]?.draft);
  if (local.length === 0 && draft.length === 0) return null;
  if (scene && isMadeId(scene.familyId)) return { on: scene.today, local, draft };
  const days = [...local.map((id) => prepared[id].local!.on), ...draft.map((id) => prepared[id].draft!.on)].filter(Boolean).sort();
  return { on: days[days.length - 1] ?? "", local, draft };
}
