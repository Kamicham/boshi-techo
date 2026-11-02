// ④ 家族全体の参謀の「気づき」: 期限表に無い事を、この家族の今から見つける。
// ここは機械で見つける所だけ（純関数・Claude は呼ばない）。文を書かせるのは app/api/advisor/_lib/write.ts。
// きっかけは4つ: 予定より早く／遅く生まれた・パートナーの担当が止まっている・町が変わった・祖父母が来る。
import { z } from "zod";
import { addDays, clockAt, diffDays } from "./clock";
import type { Family, Member } from "./demo-family";
import { scheduleFor, statusOf, type Milestone } from "./milestones";

export type TriggerKind = "birth-early" | "birth-late" | "moved" | "grandparents" | "partner-stalled";

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
/** 生まれてから何日、組み直しの気づきを出すか */
export const BIRTH_WINDOW_DAYS = 3;
/** パートナーの担当: 期限まで何日以内の事を見るか */
export const STALL_HORIZON_DAYS = 14;
/** 始まってから何日手付かずなら「止まっている」と見るか */
export const STALL_IDLE_DAYS = 3;
/** 何件止まっていたら気づくか */
export const STALL_MIN_ITEMS = 2;
/** 引っ越してから何日、差の気づきを出すか */
export const MOVED_WINDOW_DAYS = 30;
/** 祖父母が来る何日前から割り振りを出すか */
export const GRANDPARENT_LEAD_DAYS = 7;

const jp = (d: string) => `${Number(d.slice(5, 7))}月${Number(d.slice(8, 10))}日`;

/** 済み（デモは通り過ぎた期限も済み）を足した集合 */
function doneWithPast(schedule: Milestone[], input: AdvisorInput): Set<string> {
  const d = new Set(input.done);
  if (input.isDemo) for (const m of schedule) if (m.deadlineDate && m.deadlineDate < input.today) d.add(m.id);
  return d;
}

function memberLine(m: Member): string {
  return `${m.name}（${m.role}）${m.voice ? `: ${m.voice}` : ""}`;
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
    `予定日 ${jp(f.dueDate)}、生まれた日 ${jp(f.birthDate)}（${n}日${early ? "早く" : "遅く"}生まれた）`,
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
    .filter((m) => m.anchor === "birth" && m.deadlineDate && !done.has(m.id) && diffDays(m.deadlineDate, today) >= 0 && diffDays(m.deadlineDate, today) <= 31)
    .map((m) => `- ${m.title}（担当の目安: ${m.who}）: ${jp(m.deadlineDate!)}まで（あと${diffDays(m.deadlineDate!, today)}日）`);
  if (due.length) facts.push("生まれた日で数え直した期限:", ...due);
  return {
    kind: early ? "birth-early" : "birth-late",
    key: `${early ? "birth-early" : "birth-late"}:${f.birthDate}:${f.dueDate}`,
    priority: 1,
    facts,
    to: { role: "職場の上司" },
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
  };
}

// ── 3. 祖父母が来る ──
function grandparents(input: AdvisorInput, schedule: Milestone[], done: Set<string>): Trigger | null {
  const { family: f, today } = input;
  const g = f.members
    .filter((m) => m.role === "祖父母" && m.visit?.from)
    .map((m) => ({ m, from: m.visit!.from, until: m.visit!.until }))
    .filter(({ from }) => {
      const d = diffDays(from, today);
      return d >= 0 && d <= GRANDPARENT_LEAD_DAYS;
    })
    .sort((a, b) => a.from.localeCompare(b.from))[0];
  if (!g) return null;
  const until = g.until && g.until >= g.from ? g.until : addDays(g.from, 6);
  const during = schedule.filter((m) => {
    if (done.has(m.id)) return false;
    const end = m.deadlineDate ?? addDays(m.startDate, 14);
    return m.startDate <= until && end >= g.from;
  });
  const left = diffDays(g.from, today);
  return {
    kind: "grandparents",
    key: `grandparents:${g.m.id}:${g.from}:${until}`,
    priority: 3,
    facts: [
      `${memberLine(g.m)}`,
      `${g.m.name}が ${jp(g.from)} から ${jp(until)} まで来る（${left === 0 ? "今日来る" : `あと${left}日`}）`,
      `来ている間の家族の時期: ${clockAt(f, g.from).label} 〜 ${clockAt(f, until).label}`,
      during.length ? "来ている間にある事:" : "来ている間に、期限表の事は特に無い",
      ...during.map((m) => `- ${m.title}（担当の目安: ${m.who}${m.deadlineDate ? `・${jp(m.deadlineDate)}まで` : ""}）`),
    ],
    to: { memberId: g.m.id, role: g.m.name },
  };
}

// ── 4. パートナーの担当が止まっている ──
function partnerStalled(input: AdvisorInput, schedule: Milestone[], done: Set<string>): Trigger | null {
  const { family: f, today } = input;
  const partner = f.members.find((m) => m.role === "パートナー");
  if (!partner) return null;
  const stuck = schedule.filter((m) => {
    if (m.who !== "パートナー" || !m.deadlineDate) return false;
    const st = statusOf(m, today, done);
    if (st !== "今やる" && st !== "期限が近い") return false;
    return diffDays(m.deadlineDate, today) <= STALL_HORIZON_DAYS && diffDays(today, m.startDate) >= STALL_IDLE_DAYS;
  });
  if (stuck.length < STALL_MIN_ITEMS) return null;
  const mother = f.members.find((m) => m.role === "母");
  const motherOpen = schedule.filter((m) => m.who === "母" && m.deadlineDate && ["今やる", "期限が近い"].includes(statusOf(m, today, done))).length;
  const gps = f.members.filter((m) => m.role === "祖父母");
  const facts = [
    `${partner.name}（パートナー）の担当で、始まってから${STALL_IDLE_DAYS}日以上手付かずのまま、期限まで${STALL_HORIZON_DAYS}日以内の事が${stuck.length}件:`,
    ...stuck.map((m) => `- ${m.title}: ${jp(m.deadlineDate!)}まで（あと${diffDays(m.deadlineDate!, today)}日・始まって${diffDays(today, m.startDate)}日）`),
    `今の時期: ${clockAt(f, today).label}`,
    mother ? `${mother.name}（母）の担当で今動いている事: ${motherOpen}件` : "",
    gps.length
      ? `祖父母: ${gps.map((g) => `${memberLine(g)}${g.visit?.from ? `（${jp(g.visit.from)}から来る予定）` : ""}`).join("／")}`
      : "祖父母は家族に入っていない（外の手: 自治体の産前産後ヘルパー・家事支援など。町のページで調べる前提で）",
  ].filter(Boolean);
  const g = gps[0];
  return {
    kind: "partner-stalled",
    key: `partner-stalled:${partner.id}:${stuck.map((m) => m.id).join(",")}`,
    priority: 4,
    facts,
    to: g ? { memberId: g.id, role: g.name } : { role: "町の窓口" },
  };
}

/** 今のきっかけを、出す順に並べて返す（何も無ければ空） */
export function detectTriggers(input: AdvisorInput): Trigger[] {
  const schedule = scheduleFor(input.family);
  const done = doneWithPast(schedule, input);
  return [birthShift(input, schedule, done), moved(input), grandparents(input, schedule, done), partnerStalled(input, schedule, done)]
    .filter((t): t is Trigger => t != null)
    .sort((a, b) => a.priority - b.priority);
}

/** デモの早送りで、気づきが出る日（ジャンプのボタン用） */
export function advisorMoments(f: Family): { label: string; date: string }[] {
  const out: { label: string; date: string }[] = [];
  if (f.movedOn) out.push({ label: "引っ越した", date: addDays(f.movedOn, 1) });
  if (f.birthDate && Math.abs(diffDays(f.dueDate, f.birthDate)) >= BIRTH_SHIFT_DAYS) out.push({ label: "早く生まれた", date: addDays(f.birthDate, 1) });
  if (f.birthDate) out.push({ label: "生まれて5日", date: addDays(f.birthDate, 5) });
  const g = f.members.find((m) => m.role === "祖父母" && m.visit?.from);
  if (g?.visit) out.push({ label: `${g.name}が来る前`, date: addDays(g.visit.from, -3) });
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ── Claude に書かせる形（画面とサーバの両方で使う） ──

export const AdviceSchema = z.object({
  title: z.string().describe("気づいた事を1文で。30字まで。家族の言葉で（例: 予定より2週間早く生まれ、職場への連絡が早まります）"),
  why: z.string().describe("なぜ気づいたか。この家族の状況（日付・人・件数）を使って2行まで"),
  plan: z.array(z.string().describe("組み直しの一手。40字まで。誰が・何を・いつまでに")).max(3).describe("組み直し案。3つまで"),
  message: z
    .object({
      to: z.string().describe("相手の役（例: 職場の上司・和子さん・町の窓口）"),
      via: z.enum(["mail", "line"]).describe("職場・役所は mail、家族は line"),
      subject: z.string().optional().describe("mail の時だけ。件名"),
      body: z.string().describe("そのまま送れる本文。分からない名前・日付は【 】の空欄にする"),
    })
    .optional()
    .describe("そのまま渡せる文面（1通）。要らなければ省く"),
});
export type AdviceFields = z.infer<typeof AdviceSchema>;

export interface Advice extends AdviceFields {
  kind: TriggerKind;
  key: string;
  facts: string[];
  sources?: { title: string; url: string }[];
  /** 書いた時の「今日」 */
  today: string;
  createdAt: string;
  dismissedAt?: string;
}

/** 文字数の約束を守らせる（Claude が少し長く書いた時の保険） */
export function trimAdvice(a: AdviceFields): AdviceFields {
  const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
  return { ...a, title: cut(a.title.trim(), 30), plan: a.plan.slice(0, 3).map((p) => cut(p.trim(), 40)) };
}
