// ③ 答えずに動く: 家族の代わりに下書きを作り、外のアプリへ渡せる形で返す。
// 送るのは家族。手帳は「メールで開く」「LINE で送る」まで用意して、勝手には送らない。
// 「いつもの」（会社名・上司の名前など）を覚えていれば、【 】の空欄は最初から埋める。
import "server-only";
import { isPaidId, MONEY } from "./money";
import { z } from "zod";
import { clearDoneFromDraft, markDoneFromDraft } from "@/app/api/done/_lib/done";
import { fillFamilyBlanks, findBlanks, isRoleWord, type Blank } from "./blanks";
import { EVERYDAY_MODEL, structured } from "./claude";
import { get, list, put } from "./db";
import type { Family, Member } from "./demo-family";
import { fillBlanks, getKeep, type Keep } from "./keep";
import { findMilestone, getLocal } from "./local";
import { MILESTONES, scheduleFor, type MilestoneDef } from "./milestones";
import { assigneeOf, workOf, type Work } from "./whose";

export const DRAFT_KINDS = ["メール", "記入メモ", "質問リスト", "頼み文"] as const;
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
  /** 誰が送る文か（開いた人の名前。手紙に書く名前が分からなければ呼び名）。決まらなければ空 */
  fromName: string;
  /** メールなのに宛先のアドレスが分からず、欄で聞かない時の案内（町の窓口あて: 「宛先は町のページで」） */
  mailHint: string;
  /** 開いた人が担当でない時の、担当の人（「翔太さんの番です。LINE で頼む」の1行を出す）。担当が開いた時・開いた人が分からない時は null */
  handTo: { id: string; name: string } | null;
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

/** その事の id と担当（家族に当てはめた後の担当。予定表に無い事は表の定義から） */
function taskOf(family: Family, milestoneId: string): { id: string; who: MilestoneDef["who"] } | undefined {
  const s = scheduleFor(family).find((x) => x.id === milestoneId);
  if (s) return { id: s.id, who: s.who };
  try {
    const def = findMilestone(milestoneId);
    return { id: def.id, who: def.who };
  } catch {
    return undefined;
  }
}

/**
 * 書き手: その事の担当の人（見直し C09: 翔太さんの事は、美咲さんが開いても翔太さんの名前と職場で書く）。
 * 担当が決まらない事（家族みんなの事で、誰がやるかまだ決めていない・2人で）は開いた人（me）。
 * それも分からなければ母（いなければ家族の最初の人）
 */
export function writerOf(family: Family, meId?: string | null, milestoneId?: string, assign?: Record<string, string>): Member | null {
  const t = milestoneId ? taskOf(family, milestoneId) : undefined;
  return (t && assigneeOf(t, family, assign)) || family.members.find((x) => x.id === meId) || family.members.find((x) => x.role === "母") || family.members[0] || null;
}

/** 書き手の職場（書き手が決まらなければ無し＝職場の空欄は埋めない） */
export function writerWork(family: Family, keep: Keep, meId?: string | null, milestoneId?: string): Work | undefined {
  return workOf(keep, family, writerOf(family, meId, milestoneId, keep.assign)?.id);
}

/** 宛先が職場（上司・人事）か。職場でなければ、上司のメールアドレスを聞かない */
function toWork(d: Pick<Draft, "to" | "title" | "body">, milestoneId: string): boolean {
  const m = MILESTONES.find((x) => x.id === milestoneId);
  if (m?.kind === "仕事") return true;
  return /会社|上司|人事|部長|課長|御中|職場/.test(d.to) && !/市役所|区役所|役場|窓口|保健|センター|市長|区長|町長|村長/.test(d.to);
}

/** 手紙に書く書き手の名前: 覚えた名前 → 呼び名（「パパ」など役割の言葉なら使わない） */
export function writerName(family: Family, keep: Keep, meId?: string | null, milestoneId?: string): string | null {
  const w = writerOf(family, meId, milestoneId, keep.assign);
  if (!w) return null;
  return keep.names?.[w.id] || (isRoleWord(w.name) ? null : w.name);
}

/** 空欄を埋める時の書き手（名前と職場） */
export type DraftFill = { writer?: string | null; work?: Work };

function fillDraft(d: Draft, keep: Keep, fill: DraftFill = {}, family?: Family): Draft {
  const { writer } = fill;
  const o = { writer, work: fill.work };
  // 家族の情報で分かる物（町名・パートナーの名前・予定日など）も埋める
  const fam = (t: string) => (family ? fillFamilyBlanks(t, family, { writer, names: keep.names }) : t);
  return { ...d, title: fam(fillBlanks(d.title, keep, o)), to: fam(fillBlanks(d.to, keep, o)), body: fam(fillBlanks(d.body, keep, o)) };
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
  if (!draft) return { draft: null, blanks: [], mailTo: "", toName: "", cc: "", writerId: null, fromName: "", mailHint: "", handTo: null };
  const keep = getKeep(family.id);
  const writer = writerOf(family, meId, draft.milestoneId, keep.assign);
  const work = workOf(keep, family, writer?.id);
  const d = fillDraft(draft, keep, { writer: writerName(family, keep, meId, draft.milestoneId), work }, family);
  const split = splitTo(d.to);
  const isMail = d.kind === "メール";
  const toBoss = isMail && toWork(d, draft.milestoneId);
  const mailTo = split.email || (toBoss ? (work?.email ?? "") : "");
  const blanks = findBlanks({ to: d.to, title: d.title, body: d.body });
  // 職場あてのメールなのにアドレスが無い時は、上司のメールアドレスを欄で聞く。町の窓口などは聞かず、町のページで調べてもらう
  if (toBoss && !mailTo && !blanks.some((b) => b.key === "email")) {
    blanks.unshift({ raw: "【上司のメールアドレス】", label: "上司のメールアドレス", key: "email", input: "email" });
  }
  return {
    draft: d,
    blanks,
    mailTo,
    toName: isMail ? split.name : d.to,
    cc: isMail ? split.cc : "",
    writerId: writer?.id ?? null,
    fromName: writer ? keep.names?.[writer.id] || writer.name : "",
    mailHint: isMail && !mailTo && !toBoss ? `宛先は${family.city}のページで（問い合わせのフォームやメールアドレス）` : "",
    // 開いた人が担当でない時だけ（開いた人がこの家族の人の時）
    handTo: writer && meId && writer.id !== meId && family.members.some((x) => x.id === meId) ? { id: writer.id, name: keep.names?.[writer.id] || writer.name } : null,
  };
}

/** 上の子の事の下書きの向き（第2波①）。上の子の年と通う所を渡す。名前は呼び名だけ */
function olderDraftLines(id: string, family: Family): string[] {
  const kids = family.situation?.olderKids ?? [];
  if (!["older-child-care", "older-pickup", "older-daycare-continue"].includes(id)) return [];
  const who = kids.length
    ? kids.map((k, i) => `- ${k.name ?? (kids.length > 1 ? `上の子${i + 1}` : "上の子")}: ${k.birthDate.slice(0, 7)}生まれ${k.care ? `・日中は${k.care}` : ""}`).join("\n")
    : "- 上の子（年と通う所は分からない）";
  const dir =
    id === "older-daycare-continue"
      ? `下書きの向き: 上の子が通う保育園か、住む町（${family.city}）の保育の窓口への問い合わせのメール。聞く事: 育休中も上の子が続けて通えるか・続けられる期間・申請の書類と出す期限・短い時間になるか。予定日を書く。続けられるかは決めつけない`
      : id === "older-pickup"
        ? "下書きの向き: 祖父母かパートナーへの頼み文。入院中と産後1か月の、上の子の園の送り迎えを頼む。曜日と時間は【送りの時間】【迎えの時間】の空欄。頼めない日があってよい事も書く"
        : "下書きの向き: 祖父母への頼み文。出産の入院中（数日〜1週間ほど）に上の子を見てほしい事と、夜中に陣痛が来た時に駆けつけてもらえるか・難しければ一時保育やファミリー・サポートを登録しておく事を、短く頼む。予定日を書く";
  return ["", "上の子:", who, dir];
}

const SYSTEM = `あなたの役割: 家族の「やる事」1件について、家族がそのまま使える下書きを1つ作る係。家族がするのは最後に送る・使うだけにする。
- 種類（kind）は事に合う物を選ぶ: 職場への相談・報告は「メール」、役所の届出・申請書は「記入メモ」（欄ごとに何を書くか・どこで分かるか）、窓口や保育園・病院で聞く事は「質問リスト」（1行に1つ）、祖父母・親せき・パートナーへの頼み事は「頼み文」（LINE などでそのまま送れる、短くあたたかい話し言葉。宛名は「お母さんへ」などの呼び方で、分からなければ【頼む人の呼び方】）。
- 書き手は、その事の担当の家族の一人（担当が決まっていない事は、この手帳を開いた人。呼び名と役割を渡す）。
- 「覚えている事」が渡された時は、会社名・上司の名前・病院の名前などをそれで書く。渡す職場は書き手の職場。
- 職場あての文は、書き手の職場の事だけを書く。家族のほかの人の勤め先・上司の名前は書かない（分からない所は空欄）。
- 書き手の名前は、家族が送る文の最後に必ず書く（分からなければ【自分の名前】）。町名・都道府県・家族の名前・予定日・生まれた日は、渡した家族の情報で書く（空欄にしない）。
- 宛先・会社名・上司の名前・住所・番号など分からない所は空欄で残す。作り話で埋めない。空欄の名前はそろえる（家族が一度入れると次から自動で埋まる）: 会社は【会社名】、部署は【部署名】、上司は【上司の名前】、上司のメールは【上司のメールアドレス】、人事の担当は【人事のご担当者名】、書き手の名前は【自分の名前】、病院・産院は【産院名】。
- 空欄には必ず中に名前を入れる（【 】のような名前の無い空欄は作らない）。日付で分からない所は【育休を始める日】【育休を終える日】のように「〜日」で終わる空欄にする（1つの空欄に1つの日付。「2026年【 】月【 】日」のように分けない）。
- 役所・保健センターなど町の窓口あてのメールは、宛名を「（窓口の名前）ご担当者様」の形で（分からなければ【担当の窓口】ご担当者様）。メールアドレスは書かない（家族が町のページで調べる）。
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
  // 書き手はその事の担当の人（担当が決まらない事は開いた人。選んでいなければ母）
  const writer = writerOf(family, meId, m.id, keep.assign);
  const born = family.birthDate && family.birthDate <= today;
  // 職場は書き手の職場だけ（ほかの家族の会社・上司を渡さない＝見直し C09）
  const w: Work = workOf(keep, family, writer?.id) ?? {};
  const known = [
    w.company && `会社名: ${w.company}`,
    w.dept && `部署名: ${w.dept}`,
    w.boss && `上司の名前: ${w.boss}`,
    w.hr && `人事の担当: ${w.hr}`,
    keep.hospital?.name && `通う病院: ${keep.hospital.name}`,
    keep.office?.name && `役所: ${keep.office.name}${keep.office.address ? `（${keep.office.address}）` : ""}`,
  ].filter(Boolean);
  const lines = [
    `事: ${m.title}（${m.kind}）`,
    `根拠: ${m.basis}`,
    sched?.deadlineDate ? `期限: ${jpDay(sched.deadlineDate)}` : "",
    `今日: ${jpDay(today)}`,
    `出産予定日: ${jpDay(family.dueDate)}`,
    born ? `生まれた日: ${jpDay(family.birthDate!)}` : "まだ生まれていない",
    family.childName ? `赤ちゃんの呼び名: ${family.childName}` : "",
    `住む町: ${family.prefecture}${family.city}`,
    "家族:",
    ...family.members.map((x) => `- ${x.name}（${x.role}）`),
    writer ? `書き手: ${writer.name}（${writer.role}）` : "書き手: 【自分の名前】",
    // 手紙に書く名前（呼び名が「パパ」などの時は、空欄にして家族に入れてもらう）
    writer
      ? keep.names?.[writer.id]
        ? `手紙に書く書き手の名前: ${keep.names[writer.id]}`
        : isRoleWord(writer.name)
          ? "手紙に書く書き手の名前: 分からない（【自分の名前】の空欄にする）"
          : ""
      : "",
    ...(known.length ? ["", `覚えている事（職場は${writer ? `${writer.name}の` : "書き手の"}職場）:`, ...known.map((k) => `- ${k}`)] : []),
    ...(m.id === "pregnancy-support-2"
      ? [
          "",
          `下書きの向き: 住む町（${family.city}）のこども家庭センター（母子保健の窓口）への問い合わせのメール。聞く事: 2回目の面談の予約の仕方・申請書の出し方（郵送・電子申請）・受け取り方・申請の期限${family.situation?.satogaeri ? "。里帰り中なので、面談を里帰り先かオンラインで受けられるかと、戻る前に済ませるべきかも聞く" : ""}。おなかの子の数: ${family.situation?.babies && family.situation.babies > 1 ? family.situation.babies : 1}人。額は書かない`,
        ]
      : []),
    ...olderDraftLines(m.id, family),
    ...(isPaidId(m.id)
      ? ["", `下書きの向き: ${MONEY[m.id.slice(5)].ask}への問い合わせのメール。${MONEY[m.id.slice(5)].name}を申請したが、届く時期を過ぎてもまだ振り込まれていない事を伝え、手続きが今どこまで進んでいるか・足りない書類が無いか・振り込まれる予定の日を聞く。申請した日は【申請した日】の空欄。額は書かない。遅れの理由を決めつけない・責めない`]
      : []),
    ...(m.id === "daycare-extend" || m.id === "daycare-extend-2"
      ? [
          "",
          `下書きの向き: 職場（上司か人事）へのメール。保育園に入れなかった（保留の通知が届いた）ので、育休を${m.id === "daycare-extend" ? "1歳6か月" : "2歳"}まで延ばしたい事を申し出る。延ばす期間は【延長を始める日】〜【延長を終える日】の空欄。育児休業給付の延長のために、保育所の申込書の写し・保留の通知・延長事由の申告書を出す事と、職場から頼みたい手続き（ハローワークへの申請）を書く。入れるかどうか・給付の額は書かない`,
        ]
      : []),
    ...(m.id === "leave-money-request"
      ? [
          "",
          "下書きの向き: 勤め先の人事（か上司）へのメール。産休・育休の間のお金の手続きを、まとめて頼む。並べる事: ①出産手当金の申請書の用紙と、出す流れ（医師の証明の欄は産院で書いてもらう） ②産休・育休の間の健康保険と厚生年金の保険料の免除の届け ③育児休業給付の申請（初回と2か月ごと。振込の口座を伝える） ④それぞれ、いつ誰が出すか。産休の始まりの予定日（【産休を始める日】）を書く。額は書かない。もらえるかは決めつけず「手続きを教えてください」と聞く",
        ]
      : []),
    ...(m.id === "partner-leave-14"
      ? [
          "",
          "下書きの向き: パートナーの勤め先（上司か人事）へのメール。子が生まれて8週の間に、育休（産後パパ育休を含む）を通算14日以上取りたい事を相談する。予定日を書き、休む日は【育休を始める日】【育休を終える日】の空欄（分けて取るなら2回分）。2025年4月からの出生後休業支援給付の条件（14日以上）を伝え、手続きを頼む。額は書かない",
        ]
      : []),
    ...(m.id === "childcare-benefit-first"
      ? ["", "下書きの向き: 勤め先の人事へのメール。育児休業給付の初回の申請を頼み、出してもらえた日と、次の2か月ごとの申請の予定を教えてほしいと聞く。振込の口座は【振込の口座】の空欄。額は書かない"]
      : []),
    ...(m.id === "satogaeri-return"
      ? ["", `下書きの向き: 住む町（${family.city || "住む町"}）の保健センターへのメール。里帰り出産から住む町に戻る事を知らせる。戻る日は【戻る日】の空欄。赤ちゃん訪問（新生児訪問・こんにちは赤ちゃん）を戻った後に受けたい事と、乳幼児健診・予防接種の案内の受け取り方を聞く。${family.situation?.satogaeriPlace ? `里帰り先は${family.situation.satogaeriPlace.prefecture}${family.situation.satogaeriPlace.city}。` : ""}体の様子の相談は書かない`]
      : []),
    ...(m.id === "daycare-prep"
      ? ["", "下書きの向き: パートナーか祖父母への頼み文。慣らし保育（1〜2週間ほど・時間が短い）の間の送り迎えと、子が熱を出した時のお迎えを頼む。曜日と時間は【送りの時間】【迎えの時間】の空欄。病児保育に登録しておく事も一言"]
      : []),
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
  const out = await structured(DraftSchema, SYSTEM, lines.filter(Boolean).join("\n"), { model: EVERYDAY_MODEL, effort: "low", maxTokens: 6000, task: "draft" });
  // 作り直したら、前の「送った」の印から付いた済みは外す（新しい下書きはまだ送っていない）
  clearDoneFromDraft(family.id, m.id);
  const draft = fillDraft({ ...out, milestoneId: m.id, milestoneTitle: m.title, status: "draft", usedLocal: !!local, today }, keep, { work: w }, family);
  put(family.id, "draft", draft, { id: draftId(family.id, m.id), date: today });
  return viewDraft(family, draft, meId);
}

type Edits = Partial<Pick<Draft, "title" | "to" | "body" | "checklist">>;

function applyEdits(cur: Draft, edits: Edits, keep: Keep, fill: DraftFill = {}): Draft {
  return fillDraft(
    {
      ...cur,
      title: edits.title ?? cur.title,
      to: edits.to ?? cur.to,
      body: edits.body ?? cur.body,
      checklist: edits.checklist ?? cur.checklist,
    },
    keep,
    { work: fill.work },
  );
}

/** 直した文を残す（「いつもの」で空欄も埋める）。文が変われば印は外す（unmark でも外す）。送信はしない。
 * 印を外したら、印から付いた済みも外す */
export function saveDraft(familyId: string, milestoneId: string, edits: Edits, opts: { unmark?: boolean; writer?: string | null; work?: Work } = {}): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const keep = getKeep(familyId);
  const next = applyEdits(cur, edits, keep, { work: opts.work });
  // 「いつもの」（書き手の名前と職場を含む）で空欄が埋まっただけなら印は残す。家族が文を直した時だけ外す
  const before = fillDraft(cur, keep, { writer: opts.writer, work: opts.work });
  const changed = next.title !== before.title || next.to !== before.to || next.body !== before.body;
  const unmarked = (changed || opts.unmark) && cur.status === "ok";
  const out: Draft = unmarked ? { ...next, status: "draft", okAt: undefined } : next;
  put(familyId, "draft", out, { id: draftId(familyId, milestoneId), date: cur.today });
  if (unmarked || opts.unmark) clearDoneFromDraft(familyId, milestoneId);
  return out;
}

/** 家族が「送った」「使った」の印を付ける（直した文もここで保存）。送信はしない。
 * 同時にその事を済みにする（auto: "draft"。印を外すと済みも外れる）。today は押した時の「今日」 */
export function confirmDraft(familyId: string, milestoneId: string, edits: Edits, today?: string, fill: DraftFill = {}): Draft | null {
  const cur = stored(familyId, milestoneId);
  if (!cur) return null;
  const next: Draft = { ...applyEdits(cur, edits, getKeep(familyId), fill), status: "ok", okAt: new Date().toISOString() };
  put(familyId, "draft", next, { id: draftId(familyId, milestoneId), date: cur.today });
  markDoneFromDraft(familyId, milestoneId, today ?? cur.today);
  return next;
}
