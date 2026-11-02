// ③ 答えずに動く: 家族の代わりに下書きを作り、外のアプリへ渡せる形で返す。
// 送るのは家族。手帳は「メールで開く」「LINE で送る」まで用意して、勝手には送らない。
// 「いつもの」（会社名・上司の名前など）を覚えていれば、【 】の空欄は最初から埋める。
import "server-only";
import { z } from "zod";
import { structured } from "./claude";
import { get, list, put } from "./db";
import type { Family } from "./demo-family";
import { fillBlanks, getKeep, type Keep } from "./keep";
import { getLocal } from "./local";
import { scheduleFor, type MilestoneDef } from "./milestones";

export const DRAFT_KINDS = ["メール", "連絡文", "記入メモ", "持ち物", "質問リスト"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DraftSchema = z.object({
  kind: z.enum(DRAFT_KINDS),
  title: z.string().describe("下書きの見出し（メールなら件名）。短く"),
  to: z.string().describe("宛先・出す先。分からない所は【会社名】【上司の名前】【上司のメールアドレス】のように空欄で残す"),
  body: z.string().describe("本文。そのまま使える文。分からない所は【 】の空欄で残す"),
  checklist: z.array(z.string()).describe("出す前・行く前に家族が確かめる事。1つずつ短く"),
});
export type DraftFields = z.infer<typeof DraftSchema>;

export interface Draft extends DraftFields {
  milestoneId: string;
  milestoneTitle: string;
  /** "ok" = 家族が「送った」「使った」の印を付けた（送信ではない。一冊がこれを読む） */
  status: "draft" | "ok";
  /** 町の調べ結果を使ったか */
  usedLocal: boolean;
  /** 作った時の「今日」（デモの時計を含む） */
  today: string;
  okAt?: string;
}

/** 下書きの空欄のうち、家族に一度聞けば次から埋まる物 */
export type AskKey = "company" | "boss" | "email";

/** 画面へ返す形: 「いつもの」で埋めた下書きと、まだ聞く空欄・メールの宛先 */
export interface DraftView {
  draft: Draft | null;
  /** まだ埋まっていない「いつもの」の空欄 */
  ask: AskKey[];
  /** 「メールで開く」の宛先（下書きの宛先か、覚えている上司のメール） */
  mailTo: string;
}

export function draftId(familyId: string, milestoneId: string): string {
  return `draft:${familyId}:${milestoneId}`;
}

function stored(familyId: string, milestoneId: string): Draft | null {
  return get<Draft>(draftId(familyId, milestoneId))?.data ?? null;
}

/** その事の下書き（「いつもの」で空欄を埋めた形）。無ければ null */
export function getDraft(familyId: string, milestoneId: string): Draft | null {
  const d = stored(familyId, milestoneId);
  return d ? fillDraft(d, getKeep(familyId)) : null;
}

/** 家族が印を付けた下書きの一覧。新しい順 */
export function listDrafts(familyId: string): Draft[] {
  return list<Draft>(familyId, "draft")
    .map((d) => d.data)
    .filter((d) => d.status === "ok");
}

function fillDraft(d: Draft, keep: Keep): Draft {
  return { ...d, title: fillBlanks(d.title, keep), to: fillBlanks(d.to, keep), body: fillBlanks(d.body, keep) };
}

const EMAIL = /[\w.+-]+@[\w-]+(\.[\w-]+)+/;

/** 下書きと「いつもの」から、画面へ返す形を作る */
export function viewDraft(familyId: string, draft: Draft | null): DraftView {
  const keep = getKeep(familyId);
  if (!draft) return { draft: null, ask: [], mailTo: "" };
  const d = fillDraft(draft, keep);
  // どの空欄が「いつもの」で埋まるか: 目印の値で埋めてみて、目印が出た物がまだ空いている
  const probe = fillBlanks(`${d.title}\n${d.to}\n${d.body}`, { work: { company: "\u0001C", boss: "\u0001B", email: "\u0001E" } });
  const ask: AskKey[] = [];
  if (probe.includes("\u0001C")) ask.push("company");
  if (probe.includes("\u0001B")) ask.push("boss");
  if (probe.includes("\u0001E")) ask.push("email");
  const mailTo = d.to.match(EMAIL)?.[0] ?? (d.kind === "メール" ? (keep.work?.email ?? "") : "");
  return { draft: d, ask, mailTo };
}

const SYSTEM = `あなたの役割: 家族の「やる事」1件について、家族がそのまま使える下書きを1つ作る係。家族がするのは最後に送る・使うだけにする。
- 種類（kind）は事に合う物を選ぶ: 職場への相談・報告は「メール」、家族や祖父母への頼み事は「連絡文」（LINE で送る短い文）、役所の届出・申請書は「記入メモ」（欄ごとに何を書くか・どこで分かるか）、入院の準備などは「持ち物」（1行に1つ）、窓口や保育園・病院で聞く事は「質問リスト」（1行に1つ）。
- 書き手は、その事の担当の家族（呼び名と役割を渡す）。その人の言葉づかいのヒントに合わせる。
- 「覚えている事」が渡された時は、会社名・上司の名前・病院の名前などをそれで書く。
- 宛先・会社名・上司の名前・住所・番号など分からない所は空欄で残す。作り話で埋めない。空欄の名前は、会社は【会社名】、上司は【上司の名前】、上司のメールは【上司のメールアドレス】、病院・産院は【産院名】とそろえる（家族が一度入れると次から自動で埋まる）。
- 町の調べ結果が渡された時は、窓口・持ち物・期限をそれに合わせる。無い時は全国共通の決まりだけを使い、町ごとに違う所は「確かめる」と書く。
- 体の様子・病気・経過について書き足さない。体の判断（良い・悪い・正常・異常）をしない。職場への連絡でも、体の事は必要最小限（予定日・出産した事）にとどめる。
- 日付は渡された「今日」と予定日・生まれた日から書く。短く、やさしく（中学生が読める言葉で）、具体的に。`;

function jpDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 下書きを作る（まだ印の無い下書きとして保存する）。meId は「この手帳を使っている人」 */
export async function makeDraft(family: Family, m: MilestoneDef, today: string, meId?: string | null): Promise<DraftView> {
  const sched = scheduleFor(family).find((x) => x.id === m.id);
  const local = getLocal(family, m.id);
  const keep = getKeep(family.id);
  const candidates = family.members.filter((x) => m.who === "家族" || x.role === m.who);
  const me = family.members.find((x) => x.id === meId);
  // 開いた人が担当（か「家族」の事）なら、その人が書き手
  const writers = me && (m.who === "家族" || me.role === m.who) ? [me] : candidates;
  const born = family.birthDate && family.birthDate <= today;
  const w = keep.work ?? {};
  const known = [
    w.company && `会社名: ${w.company}`,
    w.boss && `上司の名前: ${w.boss}`,
    w.email && `上司のメールアドレス: ${w.email}`,
    keep.hospital?.name && `通う病院: ${keep.hospital.name}`,
    keep.office?.name && `役所: ${keep.office.name}${keep.office.address ? `（${keep.office.address}）` : ""}`,
  ].filter(Boolean);
  const lines = [
    `事: ${m.title}（${m.kind}・担当: ${m.who}）`,
    `根拠: ${m.basis}`,
    sched?.deadlineDate ? `期限: ${jpDay(sched.deadlineDate)}` : "",
    `今日: ${jpDay(today)}`,
    `出産予定日: ${jpDay(family.dueDate)}`,
    born ? `生まれた日: ${jpDay(family.birthDate!)}` : "まだ生まれていない",
    family.childName ? `赤ちゃんの呼び名: ${family.childName}` : "",
    `住む町: ${family.prefecture}${family.city}`,
    "家族:",
    ...family.members.map((x) => `- ${x.name}（${x.role}）: ${x.voice}`),
    writers.length ? `書き手: ${writers.map((x) => x.name).join("・")}` : "書き手: 【名前】",
    ...(known.length ? ["", "覚えている事:", ...known.map((k) => `- ${k}`)] : []),
  ];
  if (local) {
    lines.push(
      "",
      `町の調べ結果（${local.researchedAt} に調べた）:`,
      `要点: ${local.summary}`,
      `窓口: ${local.where}`,
      `持ち物: ${local.bring.join("、")}`,
      `オンライン: ${local.online}`,
      `期限: ${local.deadline}`,
      `町独自: ${local.extras}`,
      `気をつける事: ${local.caution}`,
    );
  }
  const out = await structured(DraftSchema, SYSTEM, lines.filter(Boolean).join("\n"), { effort: "low", maxTokens: 6000 });
  const draft = fillDraft({ ...out, milestoneId: m.id, milestoneTitle: m.title, status: "draft", usedLocal: !!local, today }, keep);
  put(family.id, "draft", draft, { id: draftId(family.id, m.id), date: today });
  return viewDraft(family.id, draft);
}

type Edits = Partial<Pick<Draft, "title" | "to" | "body" | "checklist">>;

function applyEdits(cur: Draft, edits: Edits, keep: Keep): Draft {
  return fillDraft(
    {
      ...cur,
      title: edits.title ?? cur.title,
      to: edits.to ?? cur.to,
      body: edits.body ?? cur.body,
      checklist: edits.checklist ?? cur.checklist,
    },
    keep,
  );
}

/** 直した文を残す（「いつもの」で空欄も埋める）。文が変われば印は外す（unmark でも外す）。送信はしない */
export function saveDraft(familyId: string, milestoneId: string, edits: Edits, opts: { unmark?: boolean } = {}): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const keep = getKeep(familyId);
  const next = applyEdits(cur, edits, keep);
  // 「いつもの」で空欄が埋まっただけなら印は残す。家族が文を直した時だけ外す
  const before = fillDraft(cur, keep);
  const changed = next.title !== before.title || next.to !== before.to || next.body !== before.body;
  const out: Draft = (changed || opts.unmark) && cur.status === "ok" ? { ...next, status: "draft", okAt: undefined } : next;
  put(familyId, "draft", out, { id: draftId(familyId, milestoneId), date: cur.today });
  return out;
}

/** 家族が「送った」「使った」の印を付ける（直した文もここで保存）。送信はしない */
export function confirmDraft(familyId: string, milestoneId: string, edits: Edits): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const next: Draft = { ...applyEdits(cur, edits, getKeep(familyId)), status: "ok", okAt: new Date().toISOString() };
  put(familyId, "draft", next, { id: draftId(familyId, milestoneId), date: cur.today });
  return next;
}
