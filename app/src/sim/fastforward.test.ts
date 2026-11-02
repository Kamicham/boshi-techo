// ① 早送りの検査: 作った30家族の1000日を、「今日」の画面と同じ純関数に毎日通して、決まりを守れているかを機械で確かめる。
//
// 画面（components/Techo.tsx）の組み立てをそのまま写す:
//   scheduleFor(family) → statusOf(m, today, done) → planToday(tasks, today, me)
//   健診の前日・当日は一番上が健診になる（visitIsTop = briefingDay）。一番上の事は「このあと」へ回る
//   今やる事が無ければ Calm（me の「家族」か自分の「まだ先」、無ければ「まだ先」の先頭）
//   シミュレーションの家族は isDemo = false（デモだけの「通り過ぎた期限は済み」は効かない）
//   参謀は app/api/advisor と同じ detectTriggers({ family, today, done, isDemo: false })
//
// 家族の動き（作った筋書き）:
//   - 使い始めた日（startedOn、無ければ最終月経の日）から2歳の誕生日の30日後まで、毎日開く
//   - 使い始めた日に、それより前に期限が過ぎた事は済みにする（api/family の「途中から使い始めた家族」と同じ）
//   - 家族の一人ずつが、自分の画面の一番上の「今やる1つ」を、動く日に1つ済ませる（PACE の日おき。祖父母は来ている間だけ）
//   - まだ生まれていないのに生まれてからの事は済ませられない。生まれる前は birthDate を知らない（現実と同じ）
//
// 判定: ○ = 守れた／△ = 今の作りでは避けられない既知の穴（KNOWN_GAPS に理由つきで登録）／× = それ以外の破れ（テストが落ちる）
import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, addMonths, clockAt, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import type { Family, Member } from "../lib/demo-family";
import { scheduleFor, statusOf } from "../lib/milestones";
import { detectTriggers, BIRTH_SHIFT_DAYS, BIRTH_WINDOW_DAYS, GRANDPARENT_LEAD_DAYS, MOVED_WINDOW_DAYS, type TriggerKind } from "../lib/advisor";
import { briefingDay } from "../lib/visit";
import { NOW, planToday, whoLabel, type Task } from "../components/today/task";
import { SIM_FAMILIES } from "./families";
import type { SimFamily } from "./types";

// ───────── 決まり ─────────

const RULES = {
  a: "一番上は使う人の担当か「家族」の事",
  b: "家族にいない役の担当が、担い手の分からない形で出ない",
  c: "期限切れが3件以上積み上がらない",
  d: "一番上の題は20字・一言は40字まで",
  e: "生まれた後に妊娠中だけの事／妊娠中に生後の事が今やるに出ない",
  f: "参謀のきっかけが起きるべき日に起き、起きるべきでない日に起きない",
  g: "今やる事が0の日も「次に来る事」が見つかる（2歳を過ぎた後を除く）",
} as const;
type Rule = keyof typeof RULES;
const RULE_IDS = Object.keys(RULES) as Rule[];

/** 妊娠中だけの事（生まれた後に今やるに出てはいけない）。パパの育休は生まれた後も意味があるので入れない */
const PREG_ONLY = new Set(["pregnancy-report", "checkup-plan", "tell-work", "checkup-biweekly", "direct-payment", "maternity-leave", "checkup-weekly", "hospital-bag"]);

const MAX_PLAIN = 20;
const MAX_HINT = 40;
const MAX_OVERDUE = 2;

/** 家族の一人ずつが何日おきに開いて一番上を済ませるか（無ければ 母・パートナー=毎日、祖父母=来ている間だけ毎日） */
const PACE: Record<string, Record<string, number>> = {
  "sim-04": { keiko: 2 }, // 同居の祖父母
  "sim-08": { masaru: 7 }, // 単身赴任
  "sim-12": { yusuke: 3 }, // 夜勤
  "sim-13": { sota: 5 }, // 漁の時期は家にいない
  "sim-15": { goro: 4, sumie: 3 }, // 農家・除雪／同じ敷地の祖父母
  "sim-18": { isamu: 1 }, // 祖父母が自分で使う
  "sim-23": { kenji: 6, toshiko: 2 }, // 店で手一杯／同居の祖父母
  "sim-25": { yoshie: 3 }, // 週2回来る祖父母
  "sim-30": { takashi: 3 }, // 夜勤
};
/** 生まれてから10日、パートナーが手を付けられない家族（単身赴任・漁・店）。この間に「止まっている」が出るべき */
const AWAY_AFTER_BIRTH: Record<string, string> = { "sim-08": "masaru", "sim-13": "sota", "sim-23": "kenji" };
const AWAY_DAYS = 10;

// ───────── 既知の穴（△）: 今の作り（型・期限表・画面の組み立て）では避けられない物 ─────────

interface Violation {
  familyId: string;
  rule: Rule;
  date: string;
  /** その日の時計（妊娠33週・生後3日 など） */
  at: string;
  meId?: string;
  /** 同じ穴をまとめる鍵（rule + 中身） */
  sig: string;
  detail: string;
}

interface KnownGap {
  id: string;
  rule: Rule;
  title: string;
  /** なぜ今の作りでは避けられないか（本体に要る直し） */
  why: string;
  match: (v: Violation, f: SimFamily) => boolean;
}

const hasRole = (f: Family, role: Member["role"]) => f.members.some((m) => m.role === role);

const KNOWN_GAPS: KnownGap[] = [
  {
    id: "no-partner-label",
    rule: "b",
    title: "パートナーのいない家族に、パートナーの担当が「パパ」の番として出る",
    why: "期限表（milestones.ts）の who が役で固定され、whoLabel は役の人がいない時に「パパ」と言う。ひとり親では出生届・児童手当などが担い手不明のまま並ぶ",
    match: (v, f) => !hasRole(f, "パートナー") && v.sig.startsWith("b:パートナー:"),
  },
  {
    id: "no-partner-pile",
    rule: "c",
    title: "パートナーのいない家族で、パートナーの担当が誰の一番上にもならず、期限切れが積み上がる",
    why: "planToday は me の役の事しか一番上に出さない。いない役の事を、いる人へ振り直す仕組みが無い",
    match: (v, f) => !hasRole(f, "パートナー") && v.rule === "c",
  },
  {
    id: "preg-after-early-birth",
    rule: "e",
    title: "早く生まれた後も、妊娠中だけの事（入院の荷物・産休・健診が毎週に・一時金の書類）が今やるに残る",
    why: "scheduleFor は妊娠中の事を最終月経から数えるだけで、生まれた日で打ち切らない（birthDate を見ない）",
    match: (v, f) => v.sig.startsWith("e:after:") && !!f.birthDate && diffDays(f.dueDate, f.birthDate) > 0,
  },
  {
    id: "birth-before-born",
    rule: "e",
    title: "予定日を過ぎてまだ生まれていない間、出生届などの生まれてからの事が今やるに出る",
    why: "scheduleFor は生まれていない時、生まれてからの事を予定日で仮置きする。予定日を過ぎたら「生まれたら」に畳む分岐が無い",
    match: (v) => v.sig.startsWith("e:before:"),
  },
  {
    id: "stall-before-born",
    rule: "f",
    title: "予定日を過ぎてまだ生まれていない間に、出生届などで「パートナーが止まっている」と出る",
    why: "同じく、生まれてからの事が予定日から始まる扱いのため、まだ出せない出生届を手付かずと数える",
    match: (v) => v.sig.startsWith("f:stall-before-born"),
  },
  {
    id: "stall-before-start",
    rule: "f",
    title: "途中から使い始めた日に、使い始める前の日数で「パートナーが止まっている」と出る",
    why: "partnerStalled は手付かずの日数を事の始まりから数え、startedOn を見ない。使い始めた初日に、アプリが見ていなかった日を「止まっていた」と言う",
    match: (v, f) => v.sig.startsWith("f:stall-false-alarm") && !!f.startedOn && diffDays(v.date, f.startedOn) < 3,
  },
  {
    id: "late-pile",
    rule: "c",
    title: "予定日を過ぎてまだ生まれていない間、生まれてからの事が期限切れで積み上がる",
    why: "上と同じ（予定日で仮置きした出生届・児童手当の期限が、生まれる前に切れる）",
    match: (v, f) => v.rule === "c" && !!f.birthDate && v.date < f.birthDate && v.date > f.dueDate,
  },
  {
    id: "early-birth-pile",
    rule: "c",
    title: "早く生まれた家族で、妊娠中の事と生まれてからの事が重なり、期限切れが積み上がる",
    why: "妊娠中の事が生まれた日で打ち切られない（上の preg-after-early-birth と同じ根）。母の一番上が妊娠中の事に取られ、生まれてからの事が期限を過ぎる",
    match: (v, f) => v.rule === "c" && !!f.birthDate && diffDays(f.dueDate, f.birthDate) >= BIRTH_SHIFT_DAYS && v.date >= f.birthDate,
  },
];

// ───────── 早送り ─────────

/** その日の家族（現実と同じく、生まれる前は生まれた日を、引っ越す前は引っ越しを知らない） */
function viewAt(f: SimFamily, day: string): Family {
  let v: Family = f;
  if (f.birthDate && day < f.birthDate) v = { ...v, birthDate: undefined };
  if (f.movedOn && day < f.movedOn) v = { ...v, city: f.previousCity ?? v.city, prefecture: f.previousPrefecture ?? v.prefecture, previousCity: undefined, previousPrefecture: undefined, movedOn: undefined };
  return v;
}

const born = (f: SimFamily, day: string) => !!f.birthDate && day >= f.birthDate;

/** 健診の予定（家族が「次の健診」に入れた日）。28週と1か月健診の2回 */
function visitsOf(f: SimFamily): string[] {
  const lmp = lmpFromDue(f.dueDate);
  return [addDays(lmp, 28 * 7), addMonths(f.birthDate ?? f.dueDate, 1)];
}

function paceOf(f: SimFamily, m: Member, day: string): number {
  const p = PACE[f.id]?.[m.id];
  if (m.role === "祖父母") {
    const v = m.visit;
    if (v && day >= v.from && day <= (v.until ?? addDays(v.from, 6))) return 1;
    return p ?? 0;
  }
  return p ?? 1;
}

interface Checkpoint {
  date: string;
  label: string;
}

function checkpointsOf(f: SimFamily, start: string, end: string): Checkpoint[] {
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  const list: Checkpoint[] = [
    { date: start, label: "使い始めた日" },
    { date: addDays(lmp, 35), label: "妊娠がわかった頃（5週）" },
    { date: addDays(lmp, 56), label: "届出の頃（8週）" },
    { date: addDays(lmp, 140), label: "20週" },
    { date: addDays(lmp, 196), label: "28週" },
    { date: addDays(lmp, 231), label: "33週" },
    { date: addDays(visitsOf(f)[0], -1), label: "健診の前日" },
    { date: addDays(f.dueDate, -3), label: "予定日の前" },
    { date: birth, label: "生まれた日" },
    { date: addDays(birth, 3), label: "生後3日" },
    { date: addDays(birth, 14), label: "生後14日" },
    { date: addMonths(birth, 1), label: "1か月" },
    { date: addMonths(birth, 3), label: "3か月" },
    { date: addMonths(birth, 6), label: "6か月" },
    { date: addMonths(birth, 12), label: "1歳" },
    { date: addMonths(birth, 18), label: "1歳半" },
    { date: addMonths(birth, 24), label: "2歳" },
    ...f.persona.goals.map((g) => ({ date: g.on, label: `やりたい事: ${g.want}` })),
  ];
  if (f.birthDate && f.birthDate > f.dueDate) list.push({ date: addDays(f.dueDate, 3), label: "予定日を過ぎて" });
  if (f.movedOn) list.push({ date: addDays(f.movedOn, 1), label: "引っ越しの翌日" });
  for (const m of f.members) if (m.visit) list.push({ date: addDays(m.visit.from, -3), label: `${m.name}が来る前` });
  return list.filter((c) => c.date >= start && c.date <= end).sort((a, b) => a.date.localeCompare(b.date));
}

interface Screen {
  visitTop: boolean;
  top: Task | null;
  topIsSoon: boolean;
  rows: Task[];
  calmNext: Task | null;
}

/** Techo.tsx と同じ組み立て（focus 無し） */
function screenFor(tasks: Task[], day: string, me: Member | null, nextVisit: string | null): Screen {
  const plan = planToday(tasks, day, me);
  const visitTop = !!nextVisit && !!briefingDay(day, nextVisit);
  const top = visitTop ? null : plan.top;
  const rows = visitTop && plan.top ? [plan.top, ...plan.rest] : plan.rest;
  const calmNext = !visitTop && !top ? ((me && plan.upcoming.find((t) => t.who === "家族" || t.who === me.role)) || plan.upcoming[0] || null) : null;
  return { visitTop, top, topIsSoon: plan.topIsSoon, rows, calmNext };
}

interface CheckpointRow extends Checkpoint {
  clock: string;
  top: string;
  rows: number;
  overdue: number;
  triggers: TriggerKind[];
}

interface FamilyResult {
  id: string;
  label: string;
  meId: string;
  days: number;
  start: string;
  end: string;
  /** api/family の「途中から」の済み扱いが無かったら、使い始めた日に期限切れが何件出たか */
  startPileWithoutSeed: number;
  violations: Violation[];
  checkpoints: CheckpointRow[];
  triggersSeen: Partial<Record<TriggerKind, string>>;
}

function simulate(f: SimFamily): FamilyResult {
  const lmp = lmpFromDue(f.dueDate);
  const start = f.startedOn ?? lmp;
  const end = addDays(secondBirthday(f), 30);
  const lastDay = secondBirthday(f);
  const visits = visitsOf(f).filter((d) => d >= start);
  const persona = f.members.find((m) => m.id === f.persona.meId) ?? null;
  const cps = checkpointsOf(f, start, end);
  const cpByDate = new Map<string, Checkpoint[]>();
  for (const c of cps) cpByDate.set(c.date, [...(cpByDate.get(c.date) ?? []), c]);

  const done = new Set<string>();
  const startView = viewAt(f, start);
  const startSchedule = scheduleFor(startView);
  const startPileWithoutSeed = startSchedule.filter((m) => statusOf(m, start, new Set()) === "期限切れ").length;
  for (const m of startSchedule) if (m.deadlineDate && m.deadlineDate < start) done.add(m.id);

  const violations: Violation[] = [];
  const checkpoints: CheckpointRow[] = [];
  const triggersSeen: Partial<Record<TriggerKind, string>> = {};
  let stallSeenAfterBirth = false;
  const partner = f.members.find((m) => m.role === "パートナー");
  const partnerPace = partner ? (PACE[f.id]?.[partner.id] ?? 1) : 0;

  let days = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days++;
    const fv = viewAt(f, day);
    const isBorn = born(f, day);
    const at = clockAt(fv, day).label;
    const schedule = scheduleFor(fv);
    const tasksNow = (): Task[] => schedule.map((m) => ({ ...m, status: statusOf(m, day, done) }));
    const tasks = tasksNow();
    const nextVisit = visits.find((d) => d >= day) ?? null;
    const push = (rule: Rule, sig: string, detail: string, meId?: string) => violations.push({ familyId: f.id, rule, date: day, at, meId, sig: `${rule}:${sig}`, detail });

    // ── 家族全体の決まり（画面に出る今やる事・参謀） ──
    const nowTasks = tasks.filter((t) => NOW.has(t.status));
    // c: 期限切れの積み上がり（使う人の画面。一番上と「このあと」に出る今やる事すべて）
    const overdue = nowTasks.filter((t) => t.status === "期限切れ");
    if (overdue.length > MAX_OVERDUE) push("c", "pile", `期限切れ${overdue.length}件: ${overdue.map((t) => t.plain).join("・")}`, persona?.id);
    // e: 時期に合わない事
    for (const t of nowTasks) {
      if (isBorn && PREG_ONLY.has(t.id)) push("e", `after:${t.id}`, `生まれた後に「${t.plain}」が${t.status}`);
      if (!isBorn && t.anchor === "birth") push("e", `before:${t.id}`, `まだ生まれていないのに「${t.plain}」が${t.status}`);
    }
    // f: 参謀のきっかけ
    const trig = detectTriggers({ family: fv, today: day, done: new Set(done), isDemo: false });
    const kinds = new Set(trig.map((t) => t.kind));
    for (const k of kinds) triggersSeen[k] ??= day;
    {
      const shift = f.birthDate ? diffDays(f.dueDate, f.birthDate) : 0;
      const since = f.birthDate ? diffDays(day, f.birthDate) : -1;
      const wantShift = isBorn && Math.abs(shift) >= BIRTH_SHIFT_DAYS && since >= 0 && since <= BIRTH_WINDOW_DAYS ? (shift > 0 ? "birth-early" : "birth-late") : null;
      for (const k of ["birth-early", "birth-late"] as const) {
        if (k === wantShift && !kinds.has(k)) push("f", `missing:${k}`, `${k === "birth-early" ? "早く" : "遅く"}生まれた気づきが出ない（${Math.abs(shift)}日ずれ・生後${since}日）`);
        if (k !== wantShift && kinds.has(k)) push("f", `extra:${k}`, `${k === "birth-early" ? "早く" : "遅く"}生まれた気づきが、出るべきでない日に出た`);
      }
      const mv = f.movedOn ? diffDays(day, f.movedOn) : -1;
      const wantMoved = !!f.movedOn && mv >= 0 && mv <= MOVED_WINDOW_DAYS && (f.previousCity !== f.city || f.previousPrefecture !== f.prefecture);
      if (wantMoved && !kinds.has("moved")) push("f", "missing:moved", `引っ越して${mv}日目なのに、町が変わった気づきが出ない`);
      if (!wantMoved && kinds.has("moved")) push("f", "extra:moved", "町が変わった気づきが、出るべきでない日に出た");
      const wantGp = f.members.some((m) => m.role === "祖父母" && m.visit && diffDays(m.visit.from, day) >= 0 && diffDays(m.visit.from, day) <= GRANDPARENT_LEAD_DAYS);
      if (wantGp && !kinds.has("grandparents")) push("f", "missing:grandparents", "祖父母が来る7日前からなのに、気づきが出ない");
      if (!wantGp && kinds.has("grandparents")) push("f", "extra:grandparents", "祖父母が来る気づきが、出るべきでない日に出た");
      const stall = trig.find((t) => t.kind === "partner-stalled");
      if (stall) {
        if (!partner) push("f", "stall-no-partner", "パートナーがいないのに「止まっている」と出た");
        const ids = stall.key.split(":")[2]?.split(",") ?? [];
        const birthIds = ids.filter((id) => schedule.find((m) => m.id === id)?.anchor === "birth");
        if (!isBorn && birthIds.length) push("f", "stall-before-born", `まだ生まれていないのに「止まっている」（${birthIds.join("・")}）`);
        else if (isBorn && partnerPace === 1 && AWAY_AFTER_BIRTH[f.id] !== partner?.id) push("f", "stall-false-alarm", `パートナーが毎日動いているのに「止まっている」（${ids.join("・")}）`);
        if (isBorn && f.birthDate && diffDays(day, f.birthDate) <= AWAY_DAYS) stallSeenAfterBirth = true;
      }
      if (partner && AWAY_AFTER_BIRTH[f.id] === partner.id && f.birthDate && day === addDays(f.birthDate, AWAY_DAYS) && !stallSeenAfterBirth) {
        push("f", "missing:partner-stalled", `パートナーが生まれてから${AWAY_DAYS}日手を付けられないのに、「止まっている」が出なかった`);
      }
    }

    // ── 使う人ごとの決まり（家族の一人ずつが me） ──
    for (const me of f.members) {
      const s = screenFor(tasks, day, me, nextVisit);
      // a
      if (s.top && !(s.top.who === "家族" || s.top.who === me.role)) push("a", `${me.id}:${s.top.id}`, `${me.name}（${me.role}）の一番上が「${s.top.plain}」（${s.top.who}の番）`, me.id);
      // b
      for (const t of [s.top, ...s.rows]) {
        if (!t || t.who === "家族" || t.who === me.role) continue;
        if (!hasRole(f, t.who)) push("b", `${t.who}:${t.id}`, `いない役（${t.who}）の「${t.plain}」が「${whoLabel(t, fv, me)}」の番として出る`, me.id);
      }
      // e（使う人の画面）: 生まれた後に、妊娠中だけの事が「もうすぐ」や「このあと」にも出ない
      if (isBorn) {
        for (const t of [s.top, ...s.rows]) {
          if (t && PREG_ONLY.has(t.id) && !NOW.has(t.status)) push("e", `after:${t.id}`, `生まれた後に「${t.plain}」が${s.top?.id === t.id ? "一番上の" : "このあとの"}「もうすぐ」に出る`, me.id);
        }
      }
      // d
      const shown = s.top ?? s.calmNext;
      if (s.visitTop) {
        const title = `${briefingDay(day, nextVisit) === "eve" ? "明日" : "今日"} 10:30 健診`;
        if (title.length > MAX_PLAIN) push("d", "visit-title", `健診の題が${title.length}字: ${title}`, me.id);
      } else if (shown) {
        if (shown.plain.length > MAX_PLAIN) push("d", `plain:${shown.id}`, `題が${shown.plain.length}字: ${shown.plain}`, me.id);
        if (shown.hint.length > MAX_HINT) push("d", `hint:${shown.id}`, `一言が${shown.hint.length}字: ${shown.hint}`, me.id);
      }
      // g
      if (!s.visitTop && !s.top && !s.calmNext && day <= lastDay) push("g", "nothing-next", `${me.name}の画面に、今やる事も次に来る事も無い`, me.id);
    }

    // ── 節目の記録（persona の使う人の画面） ──
    for (const c of cpByDate.get(day) ?? []) {
      const s = screenFor(tasks, day, persona, nextVisit);
      const top = s.visitTop
        ? `${briefingDay(day, nextVisit) === "eve" ? "明日" : "今日"} 10:30 健診`
        : s.top
          ? `${s.topIsSoon ? "もうすぐ: " : ""}${s.top.plain}（${whoLabel(s.top, fv, persona)}）`
          : s.calmNext
            ? `今週は何もしなくて大丈夫 → 次は「${s.calmNext.plain}」`
            : "今週は何もしなくて大丈夫（次も無し）";
      checkpoints.push({ ...c, clock: at, top, rows: s.rows.length, overdue: overdue.length, triggers: [...kinds] });
    }

    // ── 家族が動く（一人ずつ、動く日に自分の一番上を1つ済ませる） ──
    for (const m of f.members) {
      const pace = paceOf(f, m, day);
      if (AWAY_AFTER_BIRTH[f.id] === m.id && f.birthDate && isBorn && diffDays(day, f.birthDate) < AWAY_DAYS) continue;
      if (pace <= 0 || diffDays(day, start) % pace !== 0) continue;
      const s = screenFor(tasksNow(), day, m, nextVisit);
      if (s.visitTop || !s.top || s.topIsSoon || !NOW.has(s.top.status)) continue;
      if (s.top.anchor === "birth" && !isBorn) continue; // 生まれる前には出せない
      done.add(s.top.id);
    }
  }

  return { id: f.id, label: f.persona.label, meId: f.persona.meId, days, start, end, startPileWithoutSeed, violations, checkpoints, triggersSeen };
}

// ───────── まとめ ─────────

interface Group {
  familyId: string;
  rule: Rule;
  sig: string;
  mark: "△" | "×";
  gap?: string;
  first: string;
  firstAt: string;
  last: string;
  days: number;
  meIds: string[];
  detail: string;
}

function group(f: SimFamily, vs: Violation[]): Group[] {
  const by = new Map<string, Group & { dates: Set<string> }>();
  for (const v of vs) {
    const g = KNOWN_GAPS.find((k) => k.rule === v.rule && k.match(v, f));
    const key = g ? `${g.id}` : v.sig;
    const cur = by.get(key);
    if (!cur) {
      by.set(key, { familyId: f.id, rule: v.rule, sig: v.sig, mark: g ? "△" : "×", gap: g?.id, first: v.date, firstAt: v.at, last: v.date, days: 1, meIds: v.meId ? [v.meId] : [], detail: v.detail, dates: new Set([v.date]) });
    } else {
      if (!cur.dates.has(v.date)) {
        cur.dates.add(v.date);
        cur.days++;
      }
      if (v.date > cur.last) cur.last = v.date;
      if (v.meId && !cur.meIds.includes(v.meId)) cur.meIds.push(v.meId);
    }
  }
  return [...by.values()].map(({ dates: _d, ...g }) => {
    void _d;
    return g;
  });
}

const results: { f: SimFamily; r: FamilyResult; groups: Group[]; marks: Record<Rule, "○" | "△" | "×"> }[] = [];

function marksOf(groups: Group[]): Record<Rule, "○" | "△" | "×"> {
  const out = {} as Record<Rule, "○" | "△" | "×">;
  for (const r of RULE_IDS) {
    const gs = groups.filter((g) => g.rule === r);
    out[r] = gs.some((g) => g.mark === "×") ? "×" : gs.length ? "△" : "○";
  }
  return out;
}

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../sim/out");

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  const count = Object.fromEntries(RULE_IDS.map((r) => [r, { "○": 0, "△": 0, "×": 0 }])) as Record<Rule, Record<"○" | "△" | "×", number>>;
  for (const x of results) for (const r of RULE_IDS) count[r][x.marks[r]]++;
  const gapsSeen = KNOWN_GAPS.map((k) => {
    const gs = results.flatMap((x) => x.groups.filter((g) => g.gap === k.id));
    return { ...k, match: undefined, families: gs.map((g) => g.familyId), familyDays: gs.reduce((n, g) => n + g.days, 0), examples: gs.slice(0, 3).map((g) => `${g.familyId} ${g.first}（${g.firstAt}）: ${g.detail}`) };
  });
  const json = {
    generatedFor: "① 早送りの検査",
    families: results.length,
    rules: RULES,
    count,
    knownGaps: gapsSeen,
    results: results.map((x) => ({ id: x.r.id, label: x.r.label, meId: x.r.meId, start: x.r.start, end: x.r.end, days: x.r.days, startPileWithoutSeed: x.r.startPileWithoutSeed, marks: x.marks, triggersSeen: x.r.triggersSeen, groups: x.groups, checkpoints: x.r.checkpoints })),
  };
  fs.writeFileSync(path.join(OUT, "fastforward.json"), JSON.stringify(json, null, 2));

  const L: string[] = [];
  L.push("# 早送りの検査（30家族 × 1000日）", "");
  L.push(`家族 ${results.length}組・のべ ${results.reduce((n, x) => n + x.r.days, 0)}日。○ = 守れた／△ = 既知の穴（直さずに登録）／× = 新しい破れ（テストが落ちる）`, "");
  L.push("## 決まりごとの数", "", "| 決まり | 中身 | ○ | △ | × |", "|---|---|---|---|---|");
  for (const r of RULE_IDS) L.push(`| ${r} | ${RULES[r]} | ${count[r]["○"]} | ${count[r]["△"]} | ${count[r]["×"]} |`);
  L.push("", "## 既知の穴（重い順 = 当たった家族・日数）", "");
  for (const g of [...gapsSeen].sort((a, b) => b.familyDays - a.familyDays)) {
    L.push(`### △ ${g.id}（決まり ${g.rule}）${g.families.length ? `— ${g.families.length}家族・のべ${g.familyDays}日` : " — 今回は当たらず（直った？）"}`, "", g.title, "", `- なぜ: ${g.why}`);
    if (g.families.length) L.push(`- 家族: ${g.families.join("・")}`);
    for (const e of g.examples) L.push(`- 例: ${e}`);
    L.push("");
  }
  L.push("## 家族ごと", "", "| id | 一言 | a | b | c | d | e | f | g |", "|---|---|---|---|---|---|---|---|---|");
  for (const x of results) L.push(`| ${x.r.id} | ${x.r.label} | ${RULE_IDS.map((r) => x.marks[r]).join(" | ")} |`);
  L.push("");
  for (const x of results) {
    L.push(`### ${x.r.id} ${x.r.label}`, "", `使う人: ${x.r.meId}／${x.r.start} 〜 ${x.r.end}（${x.r.days}日）／参謀が最初に出た日: ${Object.entries(x.r.triggersSeen).map(([k, d]) => `${k} ${d}`).join("・") || "無し"}${x.r.startPileWithoutSeed ? `／途中からの済み扱いが無ければ、使い始めた日に期限切れ${x.r.startPileWithoutSeed}件` : ""}`, "");
    if (x.groups.length) {
      L.push("| 印 | 決まり | 最初の日 | 時期 | 日数 | 使う人 | 中身 |", "|---|---|---|---|---|---|---|");
      for (const g of [...x.groups].sort((a, b) => (a.mark === b.mark ? a.first.localeCompare(b.first) : a.mark === "×" ? -1 : 1)))
        L.push(`| ${g.mark}${g.gap ? ` ${g.gap}` : ""} | ${g.rule} | ${g.first} | ${g.firstAt} | ${g.days} | ${g.meIds.join("・") || "—"} | ${g.detail} |`);
      L.push("");
    }
    L.push("| 日付 | 節目 | 時期 | 一番上 | このあと | 期限切れ | 参謀 |", "|---|---|---|---|---|---|---|");
    for (const c of x.r.checkpoints) L.push(`| ${c.date} | ${c.label} | ${c.clock} | ${c.top} | ${c.rows} | ${c.overdue} | ${c.triggers.join("・") || "—"} |`);
    L.push("");
  }
  fs.writeFileSync(path.join(OUT, "fastforward.md"), L.join("\n"));
}

describe("① 早送りの検査: 30家族の1000日", () => {
  it("30家族そろっている（id は sim- で始まり、重ならない）", () => {
    expect(SIM_FAMILIES).toHaveLength(30);
    const ids = SIM_FAMILIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(30);
    for (const f of SIM_FAMILIES) {
      expect(f.id.startsWith("sim-")).toBe(true);
      expect(f.members.some((m) => m.id === f.persona.meId)).toBe(true);
      expect(f.persona.goals.length).toBeGreaterThanOrEqual(2);
    }
  });

  for (const f of SIM_FAMILIES) {
    it(`${f.id} ${f.persona.label}`, () => {
      const r = simulate(f);
      const groups = group(f, r.violations);
      results.push({ f, r, groups, marks: marksOf(groups) });
      const broken = groups.filter((g) => g.mark === "×").map((g) => `${g.rule} ${g.first}（${g.firstAt}）${g.days}日: ${g.detail}`);
      expect(broken, `新しい破れ（既知の穴に無い）:\n${broken.join("\n")}`).toEqual([]);
    });
  }

  afterAll(() => {
    if (results.length) writeReport();
  });
});
