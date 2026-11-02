// ③ 答えずに動く: 家族の代わりに下書きを作り、家族の「OK」を待つ。
// OK は送信ではなく「家族が確かめた」の印。何も外へ送らない。
import "server-only";
import { z } from "zod";
import { structured } from "./claude";
import { get, list, put } from "./db";
import type { Family } from "./demo-family";
import { getLocal } from "./local";
import { scheduleFor, type MilestoneDef } from "./milestones";

export const DRAFT_KINDS = ["メール", "連絡文", "記入メモ", "持ち物", "質問リスト"] as const;

export const DraftSchema = z.object({
  kind: z.enum(DRAFT_KINDS),
  title: z.string().describe("下書きの見出し（メールなら件名）"),
  to: z.string().describe("宛先・出す先。分からない所は【会社名】【上司の名前】のように空欄で残す"),
  body: z.string().describe("本文。そのまま使える文。分からない所は【 】の空欄で残す"),
  checklist: z.array(z.string()).describe("出す前・行く前に家族が確かめる事"),
});
export type DraftFields = z.infer<typeof DraftSchema>;

export interface Draft extends DraftFields {
  milestoneId: string;
  milestoneTitle: string;
  status: "draft" | "ok";
  /** 町の調べ結果を使ったか */
  usedLocal: boolean;
  /** 作った時の「今日」（デモの時計を含む） */
  today: string;
  okAt?: string;
}

export function draftId(familyId: string, milestoneId: string): string {
  return `draft:${familyId}:${milestoneId}`;
}

export function getDraft(familyId: string, milestoneId: string): Draft | null {
  return get<Draft>(draftId(familyId, milestoneId))?.data ?? null;
}

/** 家族が確かめた（OK した）下書きの一覧。新しい順 */
export function listDrafts(familyId: string): Draft[] {
  return list<Draft>(familyId, "draft")
    .map((d) => d.data)
    .filter((d) => d.status === "ok");
}

const SYSTEM = `あなたの役割: 家族の「やる事」1件について、家族がそのまま使える下書きを1つ作る係。家族がするのは最後の確認だけにする。
- 種類（kind）は事に合う物を選ぶ: 職場への相談・報告は「メール」、家族や祖父母への頼み事は「連絡文」、役所の届出・申請書は「記入メモ」（欄ごとに何を書くか・どこで分かるか）、入院の準備などは「持ち物」、窓口や保育園・病院で聞く事は「質問リスト」。
- 書き手は、その事の担当の家族（呼び名と役割を渡す）。その人の言葉づかいのヒントに合わせる。
- 宛先・会社名・上司の名前・住所・番号など分からない所は【会社名】のように空欄で残す。作り話で埋めない。
- 町の調べ結果が渡された時は、窓口・持ち物・期限をそれに合わせる。無い時は全国共通の決まりだけを使い、町ごとに違う所は「確かめる」と書く。
- 体の様子・病気・経過について書き足さない。体の判断（良い・悪い・正常・異常）をしない。職場への連絡でも、体の事は必要最小限（予定日・出産した事）にとどめる。
- 日付は渡された「今日」と予定日・生まれた日から書く。短く、やさしく、具体的に。`;

function jpDay(s: string): string {
  const [y, m, d] = s.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}

/** 下書きを作る（まだ OK 前として保存する） */
export async function makeDraft(family: Family, m: MilestoneDef, today: string): Promise<Draft> {
  const sched = scheduleFor(family).find((x) => x.id === m.id);
  const local = getLocal(family, m.id);
  const writers = family.members.filter((x) => m.who === "家族" || x.role === m.who);
  const born = family.birthDate && family.birthDate <= today;
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
    writers.length ? `書き手の候補: ${writers.map((x) => x.name).join("・")}` : "書き手: 【名前】",
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
  const draft: Draft = { ...out, milestoneId: m.id, milestoneTitle: m.title, status: "draft", usedLocal: !!local, today };
  put(family.id, "draft", draft, { id: draftId(family.id, m.id), date: today });
  return draft;
}

/** 家族が確かめた印を付ける（直した文もここで保存）。送信はしない */
export function confirmDraft(familyId: string, milestoneId: string, edits: Partial<Pick<Draft, "title" | "to" | "body" | "checklist">>): Draft | null {
  const cur = getDraft(familyId, milestoneId);
  if (!cur) return null;
  const next: Draft = {
    ...cur,
    title: edits.title ?? cur.title,
    to: edits.to ?? cur.to,
    body: edits.body ?? cur.body,
    checklist: edits.checklist ?? cur.checklist,
    status: "ok",
    okAt: new Date().toISOString(),
  };
  put(familyId, "draft", next, { id: draftId(familyId, milestoneId), date: cur.today });
  return next;
}
