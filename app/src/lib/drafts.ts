// ③ 答えずに動く: 家族の代わりに下書きを作り、外のアプリへ渡せる形で返す。
// 送るのは家族。手帳は「メールで開く」「LINE で送る」まで用意して、勝手には送らない。
// 「いつもの」（会社名・上司の名前など）を覚えていれば、【 】の空欄は最初から埋める。
import "server-only";
import { z } from "zod";
import { clearDoneFromDraft, markDoneFromDraft } from "@/app/api/done/_lib/done";
import { findBlanks, isRoleWord, type Blank } from "./blanks";
import { structured } from "./claude";
import { get, list, put } from "./db";
import type { Family, Member } from "./demo-family";
import { fillBlanks, getKeep, type Keep } from "./keep";
import { getLocal } from "./local";
import { MILESTONES, scheduleFor, type MilestoneDef } from "./milestones";

export const DRAFT_KINDS = ["メール", "連絡文", "記入メモ", "持ち物", "質問リスト"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export const DraftSchema = z.object({
  kind: z.enum(DRAFT_KINDS),
  title: z.string().describe("下書きの見出し（メールなら件名）。短く"),
  to: z
    .string()
    .describe("宛名・出す先。メールなら「会社名 部署名 上司の名前様」の宛名だけ（メールアドレスは書かない）。分からない所は【会社名】【部署名】【上司の名前】のように空欄で残す"),
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

/** 画面へ返す形: 「いつもの」で埋めた下書きと、まだ残る空欄・メールの宛名と宛先 */
export interface DraftView {
  draft: Draft | null;
  /** まだ残っている【 】（出てきた順）。key がある物は覚えて次から自動で埋める */
  blanks: Blank[];
  /** メールアドレス（下書きの宛先か、覚えている上司のメール）。無ければ空 */
  mailTo: string;
  /** 宛名（メールアドレスと CC を外した宛先） */
  toName: string;
  /** CC に書かれた人（あれば） */
  cc: string;
  /** 書き手の家族の id（【自分の名前】に入れた名前を、この人の名前として覚える）。決まらなければ null */
  writerId: string | null;
}

export function draftId(familyId: string, milestoneId: string): string {
  return `draft:${familyId}:${milestoneId}`;
}

function stored(familyId: string, milestoneId: string): Draft | null {
  return get<Draft>(draftId(familyId, milestoneId))?.data ?? null;
}

/** その事の下書き（保存したままの形）。無ければ null */
export function getDraft(familyId: string, milestoneId: string): Draft | null {
  return stored(familyId, milestoneId);
}

/** 家族が印を付けた下書きの一覧。新しい順 */
export function listDrafts(familyId: string): Draft[] {
  return list<Draft>(familyId, "draft")
    .map((d) => d.data)
    .filter((d) => d.status === "ok");
}

/** 書き手: 開いた人が担当ならその人。担当が1人に決まるならその人。決まらなければ null */
export function writerOf(family: Family, milestoneId: string, meId?: string | null): Member | null {
  const m = MILESTONES.find((x) => x.id === milestoneId);
  const me = family.members.find((x) => x.id === meId);
  if (me && (!m || m.who === "家族" || me.role === m.who)) return me;
  const cands = m ? family.members.filter((x) => m.who === "家族" || x.role === m.who) : [];
  return cands.length === 1 ? cands[0] : null;
}

/** 手紙に書く書き手の名前: 覚えた名前 → 呼び名（「パパ」など役割の言葉なら使わない） */
export function writerName(family: Family, keep: Keep, milestoneId: string, meId?: string | null): string | null {
  const w = writerOf(family, milestoneId, meId);
  if (!w) return null;
  return keep.names?.[w.id] || (isRoleWord(w.name) ? null : w.name);
}

function fillDraft(d: Draft, keep: Keep, writer?: string | null): Draft {
  const o = { writer };
  return { ...d, title: fillBlanks(d.title, keep, o), to: fillBlanks(d.to, keep, o), body: fillBlanks(d.body, keep, o) };
}

const EMAIL_G = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;

/** 宛先の文を「宛名」「メールアドレス」「CC」に分ける */
export function splitTo(to: string): { name: string; email: string; cc: string } {
  const email = to.match(EMAIL_G)?.[0] ?? "";
  let cc = "";
  let name = to.replace(/[（(]\s*(CC|Cc|cc|ＣＣ)\s*[:：]?\s*([^）)]*)[）)]/g, (_m, _c, x: string) => {
    cc = x.trim();
    return "";
  });
  name = name
    .replace(/(宛先|メール|アドレス)\s*[:：]\s*/g, "")
    .replace(EMAIL_G, "")
    .replace(/[<＜]\s*[>＞]|[（(]\s*[）)]/g, "")
    .replace(/\s*\n\s*/g, " ")
    .replace(/[\s、,／/]+$/g, "")
    .trim();
  return { name, email, cc: cc.replace(EMAIL_G, "").trim() };
}

/** 下書きと「いつもの」から、画面へ返す形を作る。meId は「この手帳を使っている人」（【自分の名前】を埋める） */
export function viewDraft(family: Family, draft: Draft | null, meId?: string | null): DraftView {
  if (!draft) return { draft: null, blanks: [], mailTo: "", toName: "", cc: "", writerId: null };
  const keep = getKeep(family.id);
  const d = fillDraft(draft, keep, writerName(family, keep, draft.milestoneId, meId));
  const split = splitTo(d.to);
  const isMail = d.kind === "メール";
  const mailTo = split.email || (isMail ? (keep.work?.email ?? "") : "");
  const blanks = findBlanks({ to: d.to, title: d.title, body: d.body });
  // メールなのにアドレスが無い時は、上司のメールアドレスを欄で聞く
  if (isMail && !mailTo && !blanks.some((b) => b.key === "email")) {
    blanks.unshift({ raw: "【上司のメールアドレス】", label: "上司のメールアドレス", key: "email", input: "email" });
  }
  return {
    draft: d,
    blanks,
    mailTo,
    toName: isMail ? split.name : d.to,
    cc: isMail ? split.cc : "",
    writerId: writerOf(family, draft.milestoneId, meId)?.id ?? null,
  };
}

const SYSTEM = `あなたの役割: 家族の「やる事」1件について、家族がそのまま使える下書きを1つ作る係。家族がするのは最後に送る・使うだけにする。
- 種類（kind）は事に合う物を選ぶ: 職場への相談・報告は「メール」、家族や祖父母への頼み事は「連絡文」（LINE で送る短い文）、役所の届出・申請書は「記入メモ」（欄ごとに何を書くか・どこで分かるか）、入院の準備などは「持ち物」（1行に1つ）、窓口や保育園・病院で聞く事は「質問リスト」（1行に1つ）。
- 書き手は、その事の担当の家族（呼び名と役割を渡す）。その人の言葉づかいのヒントに合わせる。
- 「覚えている事」が渡された時は、会社名・上司の名前・病院の名前などをそれで書く。
- 宛先・会社名・上司の名前・住所・番号など分からない所は空欄で残す。作り話で埋めない。空欄の名前はそろえる（家族が一度入れると次から自動で埋まる）: 会社は【会社名】、部署は【部署名】、上司は【上司の名前】、上司のメールは【上司のメールアドレス】、人事の担当は【人事のご担当者名】、書き手の名前は【自分の名前】、病院・産院は【産院名】。
- 空欄には必ず中に名前を入れる（【 】のような名前の無い空欄は作らない）。日付で分からない所は【育休を始める日】【育休を終える日】のように「〜日」で終わる空欄にする（1つの空欄に1つの日付。「2026年【 】月【 】日」のように分けない）。
- メールの宛先（to）は宛名だけ（会社名 部署名 上司の名前様）。メールアドレスは to にも本文にも書かない（家族が別の欄で入れる）。CC が要る時は「（CC: 【人事のご担当者名】様）」の形で to の最後に。
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
    w.dept && `部署名: ${w.dept}`,
    w.boss && `上司の名前: ${w.boss}`,
    w.hr && `人事の担当: ${w.hr}`,
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
    writers.length ? `書き手: ${writers.map((x) => x.name).join("・")}` : "書き手: 【自分の名前】",
    // 手紙に書く名前（呼び名が「パパ」などの時は、空欄にして家族に入れてもらう）
    writers.length === 1
      ? keep.names?.[writers[0].id]
        ? `手紙に書く書き手の名前: ${keep.names[writers[0].id]}`
        : isRoleWord(writers[0].name)
          ? "手紙に書く書き手の名前: 分からない（【自分の名前】の空欄にする）"
          : ""
      : "",
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
  // 作り直したら、前の「送った」の印から付いた済みは外す（新しい下書きはまだ送っていない）
  clearDoneFromDraft(family.id, m.id);
  const draft = fillDraft({ ...out, milestoneId: m.id, milestoneTitle: m.title, status: "draft", usedLocal: !!local, today }, keep);
  put(family.id, "draft", draft, { id: draftId(family.id, m.id), date: today });
  return viewDraft(family, draft, meId);
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

/** 直した文を残す（「いつもの」で空欄も埋める）。文が変われば印は外す（unmark でも外す）。送信はしない。
 * 印を外したら、印から付いた済みも外す */
export function saveDraft(familyId: string, milestoneId: string, edits: Edits, opts: { unmark?: boolean; writer?: string | null } = {}): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const keep = getKeep(familyId);
  const next = applyEdits(cur, edits, keep);
  // 「いつもの」（書き手の名前を含む）で空欄が埋まっただけなら印は残す。家族が文を直した時だけ外す
  const before = fillDraft(cur, keep, opts.writer);
  const changed = next.title !== before.title || next.to !== before.to || next.body !== before.body;
  const unmarked = (changed || opts.unmark) && cur.status === "ok";
  const out: Draft = unmarked ? { ...next, status: "draft", okAt: undefined } : next;
  put(familyId, "draft", out, { id: draftId(familyId, milestoneId), date: cur.today });
  if (unmarked || opts.unmark) clearDoneFromDraft(familyId, milestoneId);
  return out;
}

/** 家族が「送った」「使った」の印を付ける（直した文もここで保存）。送信はしない。
 * 同時にその事を済みにする（auto: "draft"。印を外すと済みも外れる）。today は押した時の「今日」 */
export function confirmDraft(familyId: string, milestoneId: string, edits: Edits, today?: string): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const next: Draft = { ...applyEdits(cur, edits, getKeep(familyId)), status: "ok", okAt: new Date().toISOString() };
  put(familyId, "draft", next, { id: draftId(familyId, milestoneId), date: cur.today });
  markDoneFromDraft(familyId, milestoneId, today ?? cur.today);
  return next;
}
