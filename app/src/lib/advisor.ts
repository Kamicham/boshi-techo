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

// ── 鍵の無い時の気づき（見本の家族・公開版で上限の日）: 機械で確かめた事から、決まりで文を作る（Claude は呼ばない） ──

/**
 * 決まりで作った気づきの札。Claude が書いたふりをしない。
 * 理由の後ろに置く: カードの表には理由の1文目だけが1行で出るので、1文目は「何が起きたか」の短い文にする
 * （2026-11-05 UX: 札を頭に置いていた時は、表が「予定表から数えました。」だけで、なぜ数え直したのかが無かった）
 */
export const RULE_MARK = "予定表から数えました。Claude は使っていません。";

const MD = "(\\d{1,2}月\\d{1,2}日)";
type Find = (re: RegExp) => RegExpMatchArray | null;
/** 「神奈川県横浜市」→「横浜市」（題を短くする。県の付かない町はそのまま） */
const cityOnly = (s: string) => s.replace(/^.{2,3}?[都道府県](?=.)/, "");

/**
 * 機械で確かめた事（birthShift・moved が書いた文）から、気づきを決まりで作る。形が読めない時は null。
 * today: 今日（YYYY-MM-DD・転入の届けの締切を数える）。partner: 文に入れてよいパートナーの名前（仕事の無い人は渡さない）。
 * mother: 母の名前（育休の題と次にする事に入れる。パートナーが見ても、だれの育休かが分かるように＝UX 2026-11-05）
 */
export function ruleAdvice(facts: string[], ctx: { today?: string; partner?: string; mother?: string } = {}): AdviceFields | null {
  const lines = facts.map((x) => x.trim()).filter(Boolean);
  const find: Find = (re) => lines.map((l) => l.match(re)).find((m): m is RegExpMatchArray => m != null) ?? null;
  const leave = find(new RegExp(`^母の育休が始まる日は ${MD}（予定日で数えると ${MD}。(\\d+)日(早まる|遅くなる)）`));
  if (leave) return birthRule(lines, find, leave, ctx.partner, ctx.mother);
  const mv = find(new RegExp(`^${MD}に (.+?) から (.+?) へ引っ越した（その時: (.+?)）`));
  if (mv) return movedRule(find, mv, ctx.today);
  return null;
}

/** 予定日と違う日に生まれた: 育休の始まりの数え直しと、職場の上司あての文 */
function birthRule(lines: string[], find: Find, leave: RegExpMatchArray, partner?: string, mother?: string): AdviceFields {
  const [, start, startByDue, n, dir] = leave;
  const early = dir === "早まる";
  const born = find(new RegExp(`^予定日 ${MD}、生まれた日 ${MD}`));
  const post = find(new RegExp(`^産後休業.*?は ${MD} まで（予定日で数えると ${MD} だった）`));
  const plan = [`${mother ? `${mother}の` : ""}職場に、育休の始まりを${start}に直すと伝える`];
  if (early && partner && lines.some((l) => l.startsWith("産後パパ育休・育休の始まりを予定日で申し出ていた時")))
    plan.push(`${partner}の育休を予定日で申し出ていたら、1回だけ早められる（職場に確かめる）`);
  // 数え直した期限のうち、一番近い物を1つ（職場の事は1つ目と重なるので外す）
  const recount = lines
    .map((l) => l.match(new RegExp(`^- (.+?)（担当の目安: .+?）: ${MD}まで（あと(\\d+)日）$`)))
    .filter((m): m is RegExpMatchArray => m != null);
  const next = recount.filter((m) => !m[1].includes("職場")).sort((a, b) => Number(a[3]) - Number(b[3]))[0];
  if (next) plan.push(`${next[1].replace(/（.*?）/g, "")}: ${next[2]}まで${recount.length > 1 ? `（ほか${recount.length - 1}件も数え直し）` : ""}`);
  return {
    // 題はカードの2行（24字ほど）に収める。名前が長い時は名前を省く
    title: [`${mother}の育休の始まりを${start}に数え直しました`, `育休の始まりを${start}に数え直しました`].find((t) => !!mother && t.length <= 24) ?? `育休の始まりを${start}に数え直しました`,
    why: `予定日より${n}日${early ? "早く" : "遅く"}生まれました。産後休業は、生まれた日の翌日から8週間（労働基準法第65条）${post ? `で、${post[1]}まで` : ""}。その翌日の${start}から育休が始まります（予定日で数えると${startByDue}で、${n}日${early ? "早まります" : "遅くなります"}）。${RULE_MARK}`,
    plan,
    message: {
      to: "職場の上司",
      via: "mail",
      subject: "育児休業の始まりの日の変更について",
      body: [
        "【上司の名前】様",
        "",
        "お疲れさまです。【名前】です。",
        born ? `${born[2]}に子どもが生まれました。出産予定日（${born[1]}）と日がずれたので、休みの日付が変わります。` : "子どもが生まれました。出産予定日と日がずれたので、休みの日付が変わります。",
        "",
        ...(post ? [`・産後休業: ${post[1]}まで（予定日で数えると${post[2]}まで）`] : []),
        `・育児休業の始まり: ${start}から（予定日で数えると${startByDue}から）`,
        "",
        "お手数ですが、書類の日付の直しをお願いします。ほかに要る手続きがあれば教えてください。",
        "",
        "【名前】",
      ].join("\n"),
    },
  };
}

/** 町が変わった: 転入の届けの締切と、町ごとに出している物（妊娠中は健診の券・生まれた後は医療証と予防接種） */
function movedRule(find: Find, mv: RegExpMatchArray, today?: string): AdviceFields {
  const [, movedOn, fromFull, toFull, phase] = mv;
  const from = cityOnly(fromFull);
  const to = cityOnly(toFull);
  const pregnant = phase.startsWith("妊娠");
  const born = /^生|歳/.test(phase);
  const what = pregnant ? "転入の届けと健診の券の取り替え" : born ? "転入の届けと医療証・予防接種" : "転入の届け";
  // 題はカードの2行（iPhone の幅で24字ほど）に収める。長い時は前の町を省く
  const title = [`${from}から${to}へ: ${what}`, `${to}へ: ${what}`].find((t) => t.length <= 24) ?? what;
  // 転入の届けは、引っ越した日の翌日から数えて14日以内（住民基本台帳法第22条・初日は数えない）
  const since = Number(find(/^今日は引っ越して(\d+)日目/)?.[1]);
  const by = today && Number.isFinite(since) && since <= 14 ? jp(addDays(today, 14 - since)) : null;
  const plan = [
    by ? `転入の届け: ${by}まで（引っ越した日から14日以内）` : "転入の届けが済んだか確かめる（引っ越した日から14日以内）",
    ...(pregnant ? [`${to}の窓口で、健診の券（受診票）の取り替えを確かめる`, "次の健診の日までに取り替えが済むよう、窓口へ行く日を決める"] : []),
    ...(born ? [`${to}の窓口で、子どもの医療証と予防接種の予診票を確かめる`, "転入の届けの時に、子どもの手続きも一緒にできるか聞く"] : []),
  ];
  const ask = pregnant
    ? `${from}でもらった妊婦健診の受診票の残りがあります。${to}の受診票への取り替えのやり方と、持って行く物を教えてください。`
    : born
      ? `子どもの医療証と、予防接種の予診票の受け取り方と、持って行く物を教えてください。`
      : null;
  return {
    title,
    why: `${movedOn}に${from}から引っ越しました。転入の届けは、引っ越した日から14日以内（住民基本台帳法第22条）。${pregnant ? "妊婦健診の券（受診票）は町ごとに出しているので、扱いを新しい町で確かめます。" : born ? "子どもの医療証と予防接種の予診票は町ごとに出しているので、新しい町で確かめます。" : ""}${RULE_MARK}`,
    plan,
    ...(ask
      ? {
          message: {
            to: `${to}の子育ての窓口`,
            via: "mail" as const,
            subject: pregnant ? "転入した妊婦の健診の受診票について" : "転入した子どもの医療証と予防接種について",
            body: [`${to} 子育ての窓口のご担当の方`, "", `${movedOn}に${from}から転入しました（引っ越した時、${phase}）。`, ask, "", "【名前】"].join("\n"),
          },
        }
      : {}),
  };
}
