// 「気づいた事」: 期限表に無い事を、この家族の今から見つける（期限の数え直しと下書きだけ）。
// ここは機械で見つける所だけ（純関数・Claude は呼ばない）。文を書かせるのは app/api/advisor/_lib/write.ts。
// きっかけは2つ: 予定より早く／遅く生まれた・町が変わった。
// それとは別に、時期ごとに1回、Claude が家族の今（形・予定・記録）を見渡して、決まりに無い事に気づく（look。lookBucket で時期を決める）。
import { z } from "zod";
import { addDays, clockAt, diffDays } from "./clock";
import type { Family, Member } from "./demo-family";
import { scheduleFor, type Milestone } from "./milestones";
import type { Situation } from "./situation";

export type TriggerKind = "birth-early" | "birth-late" | "moved" | "look";

export interface Trigger {
  kind: TriggerKind;
  /** 同じ状況なら同じ鍵（種類＋中身の要約）。DB に覚える時の鍵 */
  key: string;
  /** 小さいほど先に出す */
  priority: number;
  /** 機械で確かめた事（Claude に渡す・画面の「なぜ？」にも出せる） */
  facts: string[];
  /** 文面の宛先になる人（いれば） */
  to?: { memberId?: string; role: string };
  /** 文面を送る人（家族の一人。その人の名前で書く） */
  from?: { memberId: string; name: string };
  /** 町が変わった時だけ: 調べに行く */
  research?: { from: string; to: string; phase: string };
}

export interface AdvisorInput {
  family: Family;
  today: string;
  /** 済んだ事（milestone id） */
  done: Set<string>;
  /** デモの家族は、通り過ぎた期限の事を済ませた前提にする（今日の画面と同じ） */
  isDemo: boolean;
  /** 最近の記録（新しい順・数件） */
  records?: { date: string | null; kind: string; title: string; who?: string }[];
}

/** 予定日と何日ずれたら「早く／遅く生まれた」と見るか */
export const BIRTH_SHIFT_DAYS = 7;
/** 生まれてから何日、期限の数え直しの気づきを出すか */
export const BIRTH_WINDOW_DAYS = 3;
/** 引っ越してから何日、差の気づきを出すか */
export const MOVED_WINDOW_DAYS = 30;

const jp = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

/** 済み（デモは通り過ぎた期限も済み）を足した集合 */
function doneWithPast(schedule: Milestone[], input: AdvisorInput): Set<string> {
  const d = new Set(input.done);
  if (input.isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < input.today) d.add(m.id);
  return d;
}

/**
 * 家族の形（situation）を、Claude に渡す言葉にする。わからない欄は書かない（決めつけない）。
 */
export function situationFacts(f: Family): string[] {
  const s: Situation | undefined = f.situation;
  if (!s) return [];
  const mom = f.members.find((m) => m.role === "母");
  const partner = f.members.find((m) => m.role === "パートナー");
  const out: string[] = [];
  if (s.motherWork) out.push(`${mom?.name ?? "母"}の働き方: ${s.motherWork}`);
  if (partner && s.partnerWork) out.push(`${partner.name}の働き方: ${s.partnerWork}${s.partnerLeave && s.partnerWork !== "仕事なし" ? `（育休: ${s.partnerLeave}）` : ""}`);
  if (s.olderChildren === true) out.push("上の子がいる");
  else if (s.olderChildren === false) out.push("初めての子（上の子はいない）");
  if (s.babies && s.babies > 1) out.push(`生まれる子は${s.babies}人（双子など）`);
  if (s.satogaeri === true) out.push("里帰り出産をする");
  else if (s.satogaeri === false) out.push("里帰り出産はしない");
  return out;
}

// ── 1. 予定より早く／遅く生まれた ──
function birthShift(input: AdvisorInput, schedule: Milestone[], done: Set<string>): Trigger | null {
  const { family: f, today } = input;
  if (!f.birthDate) return null;
  const since = diffDays(today, f.birthDate);
  if (since < 0 || since > BIRTH_WINDOW_DAYS) return null;
  const shift = diffDays(f.dueDate, f.birthDate); // 正 = 早く
  if (Math.abs(shift) < BIRTH_SHIFT_DAYS) return null;
  const early = shift > 0;
  const n = Math.abs(shift);
  // 産後休業は生まれた日の翌日から8週間（労働基準法第65条）。母の育休はその翌日から
  const postEnd = addDays(f.birthDate, 56);
  const postEndByDue = addDays(f.dueDate, 56);
  const leaveStart = addDays(f.birthDate, 57);
  const leaveStartByDue = addDays(f.dueDate, 57);
  const facts = [
    // 「早く／遅く生まれた」は体の評価に聞こえるので言わない（37〜41週は正期産。安心のデザイン #8）
    `予定日 ${jp(f.dueDate)}、生まれた日 ${jp(f.birthDate)}（予定日との差 ${n}日。生まれた日に合わせて日付を数え直す）`,
    `産後休業（労働基準法第65条・生まれた日の翌日から8週間）は ${jp(postEnd)} まで（予定日で数えると ${jp(postEndByDue)} だった）`,
    `母の育休が始まる日は ${jp(leaveStart)}（予定日で数えると ${jp(leaveStartByDue)}。${n}日${early ? "早まる" : "遅くなる"}）。職場へ伝えた日付の直しが要る`,
  ];
  if (early) {
    facts.push(
      "産後パパ育休・育休の始まりを予定日で申し出ていた時: 予定日より早く生まれたら、始まる日を1回だけ早められる（育児・介護休業法。申し出は原則1週間前まで。職場に確かめる）",
    );
    if (!done.has("partner-leave")) facts.push("パートナーの育休の申し出は、まだ済みになっていない");
  }
  const due = schedule
    .filter((m) => m.anchor === "birth" && !m.older && m.deadlineDate && !done.has(m.id) && diffDays(m.deadlineDate, today) >= 0 && diffDays(m.deadlineDate, today) <= 31)
    .map((m) => `- ${m.title}（担当の目安: ${m.who}）: ${jp(m.deadlineDate!)}まで（あと${diffDays(m.deadlineDate!, today)}日）`);
  if (due.length) facts.push("生まれた日で数え直した期限:", ...due);
  return {
    kind: early ? "birth-early" : "birth-late",
    key: `${early ? "birth-early" : "birth-late"}:${f.birthDate}:${f.dueDate}`,
    priority: 1,
    facts,
    to: { role: "職場の上司" },
    ...fromRole(f, "母"),
  };
}

// ── 2. 町が変わった ──
function moved(input: AdvisorInput): Trigger | null {
  const { family: f, today } = input;
  if (!f.previousCity || !f.movedOn) return null;
  const since = diffDays(today, f.movedOn);
  if (since < 0 || since > MOVED_WINDOW_DAYS) return null;
  if (f.previousCity === f.city && (f.previousPrefecture ?? f.prefecture) === f.prefecture) return null;
  const from = `${f.previousPrefecture ?? ""}${f.previousCity}`;
  const to = `${f.prefecture}${f.city}`;
  const clock = clockAt({ dueDate: f.dueDate, birthDate: f.birthDate }, f.movedOn);
  return {
    kind: "moved",
    key: `moved:${from}>${to}:${f.movedOn}`,
    priority: 2,
    facts: [`${jp(f.movedOn)}に ${from} から ${to} へ引っ越した（その時: ${clock.label}）`, `今日は引っ越して${since}日目`],
    research: { from, to, phase: clock.label },
    ...fromRole(f, "母"),
  };
}

/** 文面を送る人（その役の人がいれば） */
function fromRole(f: Family, role: Member["role"]): { from?: Trigger["from"] } {
  const p = f.members.find((m) => m.role === role);
  return p ? { from: { memberId: p.id, name: p.name } } : {};
}

/** 今のきっかけを、出す順に並べて返す（何も無ければ空） */
export function detectTriggers(input: AdvisorInput): Trigger[] {
  // 静かにする（つらい別れ・入院）間は、手帳から気づきを出さない（お知らせを止めている）
  if (input.family.situation?.quiet) return [];
  const schedule = scheduleFor(input.family);
  const done = doneWithPast(schedule, input);
  return [birthShift(input, schedule, done), moved(input)]
    .filter((t): t is Trigger => t != null)
    .sort((a, b) => a.priority - b.priority);
}

/**
 * 見渡す時期（Claude が家族の今を見て、決まりに無い事に気づく。時期ごとに1回）。
 * 妊娠中は4週ごと、生まれてからは1か月ごと、2歳の誕生日まで。授かる前は見渡さない。
 */
export function lookBucket(f: Family, today: string): string | null {
  if (f.birthDate && today >= f.birthDate) {
    const days = diffDays(today, f.birthDate);
    if (days > 730) return null;
    return `m${Math.floor(days / 30.44)}`;
  }
  const lmp = addDays(f.dueDate, -280);
  const days = diffDays(today, lmp);
  if (days < 0) return null;
  return `w${Math.floor(days / 7 / 4) * 4}`;
}

/** デモの早送りで、気づきが出る日（ジャンプのボタン用） */
export function advisorMoments(f: Family): { label: string; date: string }[] {
  const out: { label: string; date: string }[] = [];
  if (f.movedOn) out.push({ label: "引っ越した", date: addDays(f.movedOn, 1) });
  if (f.birthDate && Math.abs(diffDays(f.dueDate, f.birthDate)) >= BIRTH_SHIFT_DAYS) out.push({ label: "生まれた日", date: addDays(f.birthDate, 1) });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Claude に書かせる形（画面とサーバの両方で使う） ──

export const AdviceSchema = z.object({
  title: z.string().describe("気づいた事を1文で。30字まで。家族の言葉で（例: 生まれた日に合わせて、育休の始まりを数え直しました）"),
  why: z.string().describe("なぜ気づいたか。この家族の状況（日付・人・件数）を使って2行まで"),
  plan: z.array(z.string().describe("次の一手。40字まで。何を・いつまでに")).max(3).describe("次にする事。3つまで"),
  message: z
    .object({
      to: z.string().describe("相手の役（例: 職場の上司・町の窓口）"),
      via: z.enum(["mail", "line"]).describe("職場・役所は mail、家族は line"),
      subject: z.string().optional().describe("mail の時だけ。件名"),
      body: z.string().describe("そのまま送れる本文。送る人の名前で書く。分からない名前・日付は【 】の空欄にする"),
    })
    .optional()
    .describe("そのまま渡せる文面（1通）。要らなければ省く"),
});
export type AdviceFields = z.infer<typeof AdviceSchema>;

/** 見渡した時に Claude が返す形（見つからない時は found=false） */
export const LookSchema = z.object({
  found: z.boolean().describe("決まりの予定表に無い、この家族ならではの事が見つかったか。無理に作らない（見つからなければ false）"),
  basis: z.array(z.string().describe("気づいた根拠。渡した事（家族の形・予定・記録・健診の予約）から、そのまま引く。1行40字まで")).max(3).describe("見つかった時だけ。1〜3つ"),
  advice: AdviceSchema.optional().describe("見つかった時だけ"),
});

export interface Advice extends AdviceFields {
  kind: TriggerKind;
  key: string;
  facts: string[];
  sources?: { title: string; url: string }[];
  /** 書いた時の「今日」 */
  today: string;
  createdAt: string;
  dismissedAt?: string;
  /** 見渡したが、決まりに無い事は見つからなかった（同じ時期には見渡し直さない） */
  none?: boolean;
}

/** 文字数の約束を守らせる（Claude が少し長く書いた時の保険） */
export function trimAdvice(a: AdviceFields): AdviceFields {
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  return { ...a, title: cut(a.title.trim(), 30), plan: a.plan.slice(0, 3).map((p) => cut(p.trim(), 40)) };
}
