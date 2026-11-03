// ① 早送りの検査: 作った家族の1000日を、「今日」の画面と同じ純関数に通して、決まりを守れているかを機械で確かめる。
//   - 30家族（families.ts・珍しい型の見本）: 毎日確かめる
//   - 現実の割合から作った1000組（population.ts）: ふだんは1週おき＋節目の日（届出・出産の前後・生後14日・1か月・3か月・1歳・2歳など）だけ確かめる。
//     家族は毎日動く（間の日も一番上を済ませる）ので、間引くのは確かめる日だけ。SIM_FULL=1（npm run sim:full）なら毎日確かめる
//     1000組は「授かった時から使った」扱いで1000日を全部通す（startedOn を外す）。全国に直した数（1組 = 年に約671家族）が、時期の偏りなく意味を持つように。
//     途中から使い始める型は、30家族（startedOn のある家族）と、なりきり（サーバの pop- は今日から使い始める）で見る
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
//   - 家族の一人ずつが、自分の画面の一番上の「今やる1つ」を、動く日に1つ済ませる（PACE の日おき）
//   - まだ生まれていないのに生まれてからの事は済ませられない。生まれる前は birthDate を知らない（現実と同じ）
//
// 判定: ○ = 守れた／△ = 今の作りでは避けられない既知の穴（KNOWN_GAPS に理由つきで登録）／× = それ以外の破れ（テストが落ちる）
import { afterAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, addMonths, clockAt, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import type { Family, Member } from "../lib/demo-family";
import { PREGNANCY_ONLY, scheduleFor, statusOf } from "../lib/milestones";
import { motherEmployed, partnerEmployed } from "../lib/situation";
import { detectTriggers, BIRTH_SHIFT_DAYS, BIRTH_WINDOW_DAYS, MOVED_WINDOW_DAYS, type TriggerKind } from "../lib/advisor";
import { briefingDay } from "../lib/visit";
import { NOW, planToday, shownDays, whenDate, whoLabel, type Task } from "../components/today/task";
import { SIM_FAMILIES } from "./families";
import type { SimFamily } from "./types";
import { getPopulation, type PopFamily } from "./population";
import { BIRTHS_2025, PER_FAMILY } from "./stats";
import { birthFacts, birthWeightMedian, growthMedian, seedTecho } from "../lib/techo-seed";
import { DEMO_FAMILY } from "../lib/demo-family";
import type { TechoEntry } from "../lib/techo";

const FULL = process.env.SIM_FULL === "1";
/** アンケート用の日記（1000組が1000日の間に見た物）を sim/out/diary.json に書き出す（npm run survey が使う） */
const DIARY = process.env.SIM_DIARY === "1";
const TRIGGER_LABEL: Partial<Record<TriggerKind, string>> = {
  "birth-early": "参謀の気づき「予定より早く生まれた・組み直し」",
  "birth-late": "参謀の気づき「予定より遅く生まれた・組み直し」",
  moved: "参謀の気づき「町が変わった・引き継がれない制度」",
};

// ───────── 決まり ─────────

const RULES = {
  a: "一番上は使う人の担当か「家族」の事",
  b: "家族にいない役の担当が、担い手の分からない形で出ない",
  c: "期限切れが3件以上積み上がらない",
  d: "一番上の題は20字・一言は40字まで",
  e: "生まれた後に妊娠中だけの事／妊娠中に生後の事が今やるに出ない",
  f: "参謀のきっかけが起きるべき日に起き、起きるべきでない日に起きない",
  g: "今やる事が0の日も「次に来る事」が見つかる（予定表の最後の事を過ぎた後を除く。1歳半健診の後は2歳まで何も無い）",
  h: "家族に合わない項目が出ない（仕事のない母・パートナーに職場の事・パートナーのいない家族にパートナーの事・育休を取らないパートナーに育休の事）",
} as const;
type Rule = keyof typeof RULES;
const RULE_IDS = Object.keys(RULES) as Rule[];

/** 妊娠中だけの事（生まれた後に今やるに出てはいけない）。期限表の pregnancyOnly の印から。パパの育休は生まれた後も意味があるので入れない */
const PREG_ONLY = PREGNANCY_ONLY;

const MAX_PLAIN = 20;
const MAX_HINT = 40;
const MAX_OVERDUE = 2;

/** 家族の一人ずつが何日おきに開いて一番上を済ませるか（無ければ毎日） */
const PACE: Record<string, Record<string, number>> = {
  "sim-08": { masaru: 7 }, // 単身赴任
  "sim-12": { yusuke: 3 }, // 夜勤
  "sim-13": { sota: 5 }, // 漁の時期は家にいない
  "sim-15": { goro: 4 }, // 農家・除雪
  "sim-23": { kenji: 6 }, // 店で手一杯
  "sim-30": { takashi: 3 }, // 夜勤
};

const isPop = (f: SimFamily): f is PopFamily => "profile" in f;

/** 1000組の動き（30家族の表と同じ考え方を、家族の状況から当てる）: 夜勤の父は3日おき・単身赴任の父は7日おき */
function paceTable(f: SimFamily): Record<string, number> | undefined {
  if (!isPop(f)) return PACE[f.id];
  const t: Record<string, number> = {};
  const fa = f.profile.father;
  if (fa?.tanshin) t.partner = 7;
  else if (fa?.nightShift) t.partner = 3;
  return t;
}

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

/** h: この家族に合わない項目か（合わなければ理由の鍵。situation の無い家族は確かめない） */
function misfit(t: Task, f: Family): string | null {
  const s = f.situation;
  if (!s) return null;
  if (!motherEmployed(s) && t.kind === "仕事" && t.who === "母") return "mother-no-work";
  if (!partnerEmployed(s) && t.kind === "仕事" && t.who === "パートナー") return "partner-no-work";
  if (!hasRole(f, "パートナー") && (t.who === "パートナー" || t.id === "partner-leave")) return "no-partner";
  if (s.partnerLeave === "取らない" && t.id === "partner-leave") return "partner-no-leave";
  return null;
}

// 直った穴（2026-11-03 予定の組み方の直しで消した）: no-partner-label・no-partner-pile（パートナーの担当を母へ）、
// preg-after-early-birth・early-birth-pile（妊娠中だけの事は生まれた日で「過ぎた」）、birth-before-born・stall-before-born・late-pile（生まれるまで「生まれたら」で「まだ先」）
// 消した穴（2026-11-03 機能を削った）: stall-before-start（「パートナーが止まっている」の気づきごと消した）
const KNOWN_GAPS: KnownGap[] = [];

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

function paceOf(f: SimFamily, m: Member): number {
  return paceTable(f)?.[m.id] ?? 1;
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
  /** 画面を確かめた日数（間引いた時は days より少ない） */
  checked: number;
  start: string;
  end: string;
  /** api/family の「途中から」の済み扱いが無かったら、使い始めた日に期限切れが何件出たか */
  startPileWithoutSeed: number;
  violations: Violation[];
  checkpoints: CheckpointRow[];
  triggersSeen: Partial<Record<TriggerKind, string>>;
  /** アンケート用の日記（DIARY の時だけ。persona の使う人の画面が変わった日だけ） */
  diary: string[];
}

/** 確かめる日（間引く時）: 1週おき＋節目＋きっかけの窓（生まれた日の前後・引っ越し・使い始め） */
function checkDays(f: SimFamily, start: string, end: string, cps: Checkpoint[]): Set<string> {
  const days = new Set<string>();
  const add = (d: string, n = 1) => {
    for (let i = 0; i < n; i++) {
      const x = addDays(d, i);
      if (x >= start && x <= end) days.add(x);
    }
  };
  for (let d = start; d <= end; d = addDays(d, 7)) days.add(d);
  add(end);
  for (const c of cps) add(c.date);
  add(start, 4);
  if (f.birthDate) add(addDays(f.birthDate, -1), 16);
  add(addDays(f.dueDate, -1), 5);
  if (f.movedOn) add(addDays(f.movedOn, -1), 4);
  if (f.movedOn) add(addDays(f.movedOn, MOVED_WINDOW_DAYS), 2);
  return days;
}

function simulate(f: SimFamily, sampled = false): FamilyResult {
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
  const toCheck = sampled ? checkDays(f, start, end, cps) : null;
  // 期限表は、生まれた日と引っ越しを知っているかだけで変わる（同じ形なら作り直さない）
  const schedules = new Map<string, ReturnType<typeof scheduleFor>>();
  const scheduleOf = (fv: Family) => {
    const key = `${fv.birthDate ?? ""}|${fv.movedOn ?? ""}`;
    let s = schedules.get(key);
    if (!s) schedules.set(key, (s = scheduleFor(fv)));
    return s;
  };

  const diary: string[] = [];
  let diarySig = "";
  // 画面と同じ言い方: 30日までは「あと◯日」、その先は日付（task.ts の shownDays・whenDate）
  const when = (t: Task, day: string) => {
    if (!t.deadlineDate) return t.status;
    const n = diffDays(t.deadlineDate, day);
    if (n < 0) return `${-n}日過ぎ`;
    return shownDays(t, day) != null ? `あと${n}日` : (whenDate(t, day) ?? `あと${n}日`);
  };
  /** （担当・いつ）。「家族」の事は担当を出さない（画面と同じ） */
  const paren = (...xs: string[]) => {
    const p = xs.filter(Boolean);
    return p.length ? `（${p.join("・")}）` : "";
  };

  let days = 0;
  for (let day = start; day <= end; day = addDays(day, 1)) {
    days++;
    const fv = viewAt(f, day);
    const isBorn = born(f, day);
    const schedule = scheduleOf(fv);
    const tasksNow = (): Task[] => schedule.map((m) => ({ ...m, status: statusOf(m, day, done) }));
    const nextVisit = visits.find((d) => d >= day) ?? null;
    if (toCheck && !toCheck.has(day)) {
      act(day, isBorn, tasksNow, nextVisit);
      continue;
    }
    const at = clockAt(fv, day).label;
    const tasks = tasksNow();
    const push = (rule: Rule, sig: string, detail: string, meId?: string) => violations.push({ familyId: f.id, rule, date: day, at, meId, sig: `${rule}:${sig}`, detail });

    // ── 家族全体の決まり（画面に出る今やる事・参謀） ──
    const nowTasks = tasks.filter((t) => NOW.has(t.status));
    // c: 期限切れの積み上がり（使う人の画面。一番上と「このあと」に出る今やる事すべて。30日より多く過ぎて「済みましたか？」に畳んだ物は数えない）
    const shownAll = planToday(tasks, day, null);
    const overdue = [shownAll.top, ...shownAll.rest].filter((t): t is Task => !!t && t.status === "期限切れ");
    // h: 家族に合わない項目
    for (const t of nowTasks) {
      const why = misfit(t, fv);
      if (why) push("h", `${why}:${t.id}`, `家族に合わない「${t.plain}」が${t.status}（${why}）`);
    }
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
      // 消した気づき（パートナーが止まっている・祖父母が来る）は、出たら破れ
      for (const k of kinds) if (!TRIGGER_LABEL[k]) push("f", `removed:${k}`, `消した気づき（${k}）が出た`);
    }

    // 予定表の最後の事まで来たか（まだ先の事が1つも無い。「一冊を作る」を消したので、1歳半健診の後は2歳まで何も無い）
    const scheduleEnded = !tasks.some((t) => t.status === "まだ先");
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
      // h（使う人の画面の「もうすぐ」「このあと」）
      for (const t of [s.top, ...s.rows]) {
        const why = t && misfit(t, fv);
        if (t && why) push("h", `${why}:${t.id}`, `家族に合わない「${t.plain}」が${me.name}の画面に出る（${why}）`, me.id);
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
      if (!s.visitTop && !s.top && !s.calmNext && day <= lastDay && !scheduleEnded) push("g", "nothing-next", `${me.name}の画面に、今やる事も次に来る事も無い`, me.id);
    }

    // ── 日記（アンケート用。persona の使う人の画面が変わった日だけ書く） ──
    if (DIARY && isPop(f)) {
      const s = screenFor(tasks, day, persona, nextVisit);
      const top = s.visitTop
        ? `${briefingDay(day, nextVisit) === "eve" ? "明日" : "今日"}の健診の準備`
        : s.top
          ? `${s.topIsSoon ? "もうすぐ: " : ""}${s.top.plain}${paren(whoLabel(s.top, fv, persona), when(s.top, day))}`
          : s.calmNext
            ? `今週は何もしなくて大丈夫 → 次は「${s.calmNext.plain}」`
            : "今週は何もしなくて大丈夫";
      const rows = s.rows.slice(0, 5).map((t) => `${t.plain}${paren(whoLabel(t, fv, persona), when(t, day))}`);
      const stale = planToday(tasks, day, persona).stale;
      const sig = `${top}|${s.rows.map((t) => t.id + t.status).join(",")}|${[...kinds].join(",")}|${stale.length}`;
      if (sig !== diarySig) {
        diarySig = sig;
        diary.push(
          `${day}（${at}）一番上: ${top}${rows.length ? `／このあと: ${rows.join("・")}${s.rows.length > 5 ? ` ほか${s.rows.length - 5}件` : ""}` : ""}${overdue.length ? `／期限切れ${overdue.length}件` : ""}${stale.length ? `／「済みましたか？」の箱: ${stale.map((t) => t.plain).join("・")}` : ""}${kinds.size ? `／${[...kinds].map((k) => TRIGGER_LABEL[k] ?? k).join("・")}` : ""}`,
        );
      }
    }

    // ── 節目の記録（persona の使う人の画面） ──
    for (const c of cpByDate.get(day) ?? []) {
      const s = screenFor(tasks, day, persona, nextVisit);
      const top = s.visitTop
        ? `${briefingDay(day, nextVisit) === "eve" ? "明日" : "今日"} 10:30 健診`
        : s.top
          ? `${s.topIsSoon ? "もうすぐ: " : ""}${s.top.plain}${paren(whoLabel(s.top, fv, persona))}`
          : s.calmNext
            ? `今週は何もしなくて大丈夫 → 次は「${s.calmNext.plain}」`
            : "今週は何もしなくて大丈夫（次も無し）";
      checkpoints.push({ ...c, clock: at, top, rows: s.rows.length, overdue: overdue.length, triggers: [...kinds] });
    }

    act(day, isBorn, tasksNow, nextVisit);
  }

  /** 家族が動く（一人ずつ、動く日に自分の一番上を1つ済ませる） */
  function act(day: string, isBorn: boolean, tasksNow: () => Task[], nextVisit: string | null) {
    for (const m of f.members) {
      const pace = paceOf(f, m);
      if (pace <= 0 || diffDays(day, start) % pace !== 0) continue;
      const s = screenFor(tasksNow(), day, m, nextVisit);
      if (s.visitTop || !s.top || s.topIsSoon || !NOW.has(s.top.status)) continue;
      if (s.top.anchor === "birth" && !isBorn) continue; // 生まれる前には出せない
      done.add(s.top.id);
    }
  }

  return { id: f.id, label: f.persona.label, meId: f.persona.meId, days, checked: toCheck ? toCheck.size : days, start, end, startPileWithoutSeed, violations, checkpoints, triggersSeen, diary };
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

type Mark = "○" | "△" | "×";
interface Result {
  f: SimFamily;
  r: FamilyResult;
  groups: Group[];
  marks: Record<Rule, Mark>;
}
const results: Result[] = [];
const popResults: Result[] = [];

function marksOf(groups: Group[]): Record<Rule, Mark> {
  const out = {} as Record<Rule, Mark>;
  for (const r of RULE_IDS) {
    const gs = groups.filter((g) => g.rule === r);
    out[r] = gs.some((g) => g.mark === "×") ? "×" : gs.length ? "△" : "○";
  }
  return out;
}

function run(f: SimFamily, sampled: boolean): Result {
  const r = simulate(f, sampled);
  const groups = group(f, r.violations);
  return { f, r, groups, marks: marksOf(groups) };
}

const brokenOf = (x: Result) => x.groups.filter((g) => g.mark === "×").map((g) => `${g.rule} ${g.first}（${g.firstAt}）${g.days}日: ${g.detail}`);

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../sim/out");

const countOf = (rs: Result[]) => {
  const count = Object.fromEntries(RULE_IDS.map((r) => [r, { "○": 0, "△": 0, "×": 0 }])) as Record<Rule, Record<Mark, number>>;
  for (const x of rs) for (const r of RULE_IDS) count[r][x.marks[r]]++;
  return count;
};
const gapsOf = (rs: Result[]) =>
  KNOWN_GAPS.map((k) => {
    const gs = rs.flatMap((x) => x.groups.filter((g) => g.gap === k.id));
    return { ...k, match: undefined, families: gs.map((g) => g.familyId), familyDays: gs.reduce((n, g) => n + g.days, 0), examples: gs.slice(0, 3).map((g) => `${g.familyId} ${g.first}（${g.firstAt}）: ${g.detail}`) };
  });

/** 全国に直す（1000組の1組 = 年に約671家族） */
const nation = (n: number) => `約${(n * PER_FAMILY).toLocaleString("ja-JP")}`;

/** 今のアプリ（Family 型・期限表）が表せない状況。profile から数える */
const UNREPRESENTABLE: { label: string; why: string; hit: (f: PopFamily) => boolean }[] = [
  { label: "上の子がいる（第2子以降）", why: "Family 型に上の子が無い。入院中の預け先・きょうだいの健診や保育園と重なる事を表せない", hit: (f) => f.profile.order !== "第1子" },
  { label: "里帰り出産をする", why: "里帰り先の町・期間を持てない。里帰り先での健診（補助券の償還）・出生届の出し先を表せない", hit: (f) => !!f.profile.satogaeri },
  { label: "近くに祖父母がいない（同居・同じ市区町村のどちらにもいない）", why: "家族は母とパートナーだけで、祖父母を持たない。手を借りられない家族を区別できない", hit: (f) => !["同居", "同じ市区町村"].includes(f.profile.grandma.mother) && !["同居", "同じ市区町村"].includes(f.profile.grandma.father ?? "") },
  { label: "母が育休なしで働き続ける・自営", why: "期限表の「産休」「育休を職場に伝える」が全員に出る。育休の無い働き方を表せない", hit: (f) => f.profile.motherWork.after === "育休なしで継続" },
  { label: "帝王切開", why: "入院が長い・退院後に動けない期間を、担当の割り振りに入れられない", hit: (f) => f.profile.cesarean },
  { label: "父に夜勤がある", why: "パートナーが動ける時間帯を持てない（夜勤明けに窓口へ行けない等）", hit: (f) => !!f.profile.father?.nightShift },
  { label: "同じ市区町村の中で引っ越す", why: "住所が変わっても町は同じなので、Family 型では引っ越しにならない（転居届・郵便・保険証の住所変更が出ない）", hit: (f) => f.profile.move?.kind === "同じ市区町村の中" },
  { label: "体外受精など（生殖補助医療）", why: "授かる前・妊娠初期の治療と、クリニックから産院への移り方を表せない", hit: (f) => f.profile.art },
  { label: "妊娠37週未満で生まれる", why: "生まれた日は持てるが、早産に合わせた健診・予防接種の数え方（修正月齢）を持てない", hit: (f) => f.profile.weeks < 37 },
  { label: "自営（母か父）で育休が無い", why: "自営の家族に「職場に伝える」「育休」がそのまま出る。国民健康保険の産前産後の免除などを表せない", hit: (f) => f.profile.motherWork.atPregnancy === "自営など" || f.profile.father?.work === "自営など" },
  { label: "父母のどちらかが外国籍", why: "親の国の大使館への出生の届け・在留資格の手続きを表せない", hit: (f) => f.profile.nationality.mother !== "日本" || (!!f.profile.nationality.father && f.profile.nationality.father !== "日本") },
  { label: "NICU に入る", why: "入院中の出生届・医療費（未熟児養育医療）・面会の段取りを表せない", hit: (f) => f.profile.nicu },
  { label: "日本語に不安がある親がいる", why: "言葉の力を Family 型に持てない（やさしい日本語・母語への切り替えができない）", hit: (f) => f.profile.japaneseAnxious.mother || f.profile.japaneseAnxious.father },
  { label: "ひとり親", why: "パートナーの担当は母へ移り、児童扶養手当などを足した（members から）。事実婚・離婚の途中など、ひとり親の形の違いは持てない", hit: (f) => f.profile.marital === "ひとり親" },
  { label: "双子", why: "子が1人の前提。出生届・児童手当・健診・予防接種が2人分にならない", hit: (f) => f.profile.twins },
  { label: "単身赴任", why: "パートナーが離れて暮らす事を持てない（担当を振り直す根拠が無い）", hit: (f) => !!f.profile.father?.tanshin },
  { label: "事実婚（婚姻届を出していない）", why: "認知の届け・親権・児童手当の受け取る人を表せない", hit: (f) => f.profile.marital === "事実婚" },
  { label: "祖父母がだれもいない・国外（両方の母が亡くなっている・国外）", why: "外の手（産前産後ヘルパー・ファミサポ）へ振る根拠が無い", hit: (f) => ["亡くなっている", "国外"].includes(f.profile.grandma.mother) && (!f.profile.grandma.father || ["亡くなっている", "国外"].includes(f.profile.grandma.father)) },
  { label: "国外から引っ越してくる", why: "前の町が国外の時の手続き（転入・母子手帳の取り直し）を表せない", hit: (f) => f.profile.move?.kind === "国外から" },
  { label: "耳が聞こえにくい親", why: "健診の録音・電話の予約が前提の所がある。筆談・文字の連絡を表せない", hit: (f) => !!f.profile.hearing },
  { label: "離島に住む", why: "島外の産院へ移る（出産前の滞在）・船の時刻を表せない", hit: (f) => f.profile.placeType === "離島" },
];

function writeReport() {
  fs.mkdirSync(OUT, { recursive: true });
  const count = countOf(results);
  const gapsSeen = gapsOf(results);
  const pcount = countOf(popResults);
  const pgaps = gapsOf(popResults);
  const pop = popResults.map((x) => x.f as PopFamily);
  const unrep = UNREPRESENTABLE.map((u) => ({ label: u.label, why: u.why, n: pop.filter(u.hit).length })).sort((a, b) => b.n - a.n);
  const json = {
    generatedFor: "① 早送りの検査",
    families: results.length,
    rules: RULES,
    count,
    knownGaps: gapsSeen,
    results: results.map((x) => ({ id: x.r.id, label: x.r.label, meId: x.r.meId, start: x.r.start, end: x.r.end, days: x.r.days, startPileWithoutSeed: x.r.startPileWithoutSeed, marks: x.marks, triggersSeen: x.r.triggersSeen, groups: x.groups, checkpoints: x.r.checkpoints })),
    population: popResults.length
      ? {
          families: popResults.length,
          mode: FULL ? "毎日" : "1週おき＋節目",
          perFamily: PER_FAMILY,
          count: pcount,
          knownGaps: pgaps.map((g) => ({ id: g.id, rule: g.rule, title: g.title, families: g.families.length, nationwide: g.families.length * PER_FAMILY })),
          unrepresentable: unrep.map((u) => ({ ...u, nationwide: u.n * PER_FAMILY })),
          results: popResults.map((x) => ({ id: x.r.id, label: x.r.label, days: x.r.days, checked: x.r.checked, marks: x.marks, gaps: [...new Set(x.groups.map((g) => g.gap ?? `×${g.sig}`))] })),
        }
      : undefined,
  };
  fs.writeFileSync(path.join(OUT, "fastforward.json"), JSON.stringify(json, null, 2));

  const L: string[] = [];
  L.push("# 早送りの検査（1000組＋30家族 × 1000日）", "");
  if (popResults.length) {
    const days = popResults.reduce((n, x) => n + x.r.days, 0);
    const checked = popResults.reduce((n, x) => n + x.r.checked, 0);
    L.push("## 現実の割合から作った1000組", "");
    L.push(`1000組（\`population.ts\`・割合と出典は docs/SIM_STATS.md）が、授かった時から使い始めて2歳の誕生日の30日後まで（全国に直すため、どの家族も1000日を全部通す）。のべ ${days.toLocaleString("ja-JP")}日、うち画面を確かめた日 ${checked.toLocaleString("ja-JP")}日（${FULL ? "毎日" : "1週おき＋節目の日。家族は毎日動く"}）。`);
    L.push(`全国に直す時は、1組 = 年に約${PER_FAMILY}家族（2025年の出生 ${BIRTHS_2025.toLocaleString("ja-JP")}人 ÷ 1000。双子の家族も1家族）。`, "");
    L.push("### 決まりごとの数（1000組）", "", "| 決まり | 中身 | ○ | △ | × | △×の家族を全国に直すと（年） |", "|---|---|---|---|---|---|");
    for (const r of RULE_IDS) L.push(`| ${r} | ${RULES[r]} | ${pcount[r]["○"]} | ${pcount[r]["△"]} | ${pcount[r]["×"]} | ${nation(pcount[r]["△"] + pcount[r]["×"])}家族 |`);
    L.push("", "### 既知の穴（1000組で当たった家族の多い順）", "", "| 穴 | 決まり | 中身 | 1000組 | 全国（年） | 例 |", "|---|---|---|---|---|---|");
    for (const g of [...pgaps].sort((a, b) => b.families.length - a.families.length)) L.push(`| △ ${g.id} | ${g.rule} | ${g.title} | ${g.families.length} | ${nation(g.families.length)}家族 | ${g.examples[0] ?? "—"} |`);
    const broken = popResults.filter((x) => x.groups.some((g) => g.mark === "×"));
    if (broken.length) {
      L.push("", "### × 新しい破れ（既知の穴に無い）", "");
      for (const x of broken.slice(0, 20)) L.push(`- ${x.r.id} ${x.r.label}: ${brokenOf(x).join(" ／ ")}`);
    }
    L.push("", "### 今のアプリが表せない状況（1000組の人数と全国換算）", "", "今の Family 型・期限表では持てない状況。困る人の多い順に、作る物の優先順位を決められる。", "", "| 状況 | 1000組 | 全国（年） | 何が表せないか |", "|---|---|---|---|");
    for (const u of unrep) L.push(`| ${u.label} | ${u.n} | ${nation(u.n)}家族 | ${u.why} |`);
    L.push("");
  }

  L.push("## 30家族（珍しい型の見本・毎日確かめる）", "");
  L.push(`家族 ${results.length}組・のべ ${results.reduce((n, x) => n + x.r.days, 0)}日。○ = 守れた／△ = 既知の穴（直さずに登録）／× = 新しい破れ（テストが落ちる）`, "");
  L.push("### 決まりごとの数", "", "| 決まり | 中身 | ○ | △ | × |", "|---|---|---|---|---|");
  for (const r of RULE_IDS) L.push(`| ${r} | ${RULES[r]} | ${count[r]["○"]} | ${count[r]["△"]} | ${count[r]["×"]} |`);
  L.push("", "### 既知の穴（重い順 = 当たった家族・日数）", "");
  for (const g of [...gapsSeen].sort((a, b) => b.familyDays - a.familyDays)) {
    L.push(`#### △ ${g.id}（決まり ${g.rule}）${g.families.length ? `— ${g.families.length}家族・のべ${g.familyDays}日` : " — 今回は当たらず（直った？）"}`, "", g.title, "", `- なぜ: ${g.why}`);
    if (g.families.length) L.push(`- 家族: ${g.families.join("・")}`);
    for (const e of g.examples) L.push(`- 例: ${e}`);
    L.push("");
  }
  L.push("### 家族ごと", "", `| id | 一言 | ${RULE_IDS.join(" | ")} |`, `|---|---|${RULE_IDS.map(() => "---").join("|")}|`);
  for (const x of results) L.push(`| ${x.r.id} | ${x.r.label} | ${RULE_IDS.map((r) => x.marks[r]).join(" | ")} |`);
  L.push("");
  for (const x of results) {
    L.push(`#### ${x.r.id} ${x.r.label}`, "", `使う人: ${x.r.meId}／${x.r.start} 〜 ${x.r.end}（${x.r.days}日）／参謀が最初に出た日: ${Object.entries(x.r.triggersSeen).map(([k, d]) => `${k} ${d}`).join("・") || "無し"}${x.r.startPileWithoutSeed ? `／途中からの済み扱いが無ければ、使い始めた日に期限切れ${x.r.startPileWithoutSeed}件` : ""}`, "");
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
  L.push(...techoReport);
  fs.writeFileSync(path.join(OUT, "fastforward.md"), L.join("\n"));
}

describe("① 早送りの検査: 30家族の1000日（毎日）", () => {
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
      const x = run(f, false);
      results.push(x);
      const broken = brokenOf(x);
      expect(broken, `新しい破れ（既知の穴に無い）:\n${broken.join("\n")}`).toEqual([]);
    });
  }
});

describe(`① 早送りの検査: 現実の割合から作った1000組（${FULL ? "毎日" : "1週おき＋節目"}）`, () => {
  const pop = getPopulation();
  // 100組ずつ回す（1000個の it に分けると、報告が長くなりすぎる）
  for (let i = 0; i < pop.length; i += 100) {
    const chunk = pop.slice(i, i + 100);
    it(`${chunk[0].id}〜${chunk[chunk.length - 1].id}`, () => {
      const broken: string[] = [];
      for (const f of chunk) {
        const x = run({ ...f, startedOn: undefined }, !FULL);
        popResults.push(x);
        for (const b of brokenOf(x)) broken.push(`${f.id}（${f.persona.label}）${b}`);
      }
      expect(broken, `新しい破れ（既知の穴に無い）:\n${broken.slice(0, 30).join("\n")}`).toEqual([]);
    }, 120_000);
  }
});

// ───────── 手帳の記録（作った家族の記録・seedTecho） ─────────
// 作った家族（デモ・30家族・1000組）に入れる記録の決まり。体の数字は家族のデータか出典の中央値の近くだけ。判定の言葉を持たない。
const TECHO_RULES = {
  t1: "今日より後の日付の記録が無い",
  t2: "生まれる前に、生まれた後の記録が無い",
  t3: "出生体重は家族のデータ（1000組は population.ts の値）か、週数の中央値の±10%",
  t4: "生まれた後の体重・身長・頭囲は、発育調査の中央値の0.5〜1.5倍（早く生まれた子は修正月齢で）",
  t5: "妊婦健診は標準の14回まで・週数の順",
  t6: "判定の言葉（異常・正常・大丈夫）を含まない",
  t7: "みな source が seed で、候補（pending）ではない",
  t8: "わが家（mine）には何も無い",
} as const;
type TechoRule = keyof typeof TECHO_RULES;
const AFTER_BIRTH = new Set(["birth", "newborn", "stool", "postpartum", "growth", "development", "child-checkup", "vaccine"]);
const JUDGE = /異常|正常|大丈夫/;
const techoReport: string[] = [];

function techoBroken(f: Family, today: string, es: TechoEntry[]): string[] {
  const bad: string[] = [];
  const born = f.birthDate && f.birthDate <= today ? f.birthDate : null;
  const { gestDays, weightsG } = birthFacts(f);
  const pop = isPop(f as SimFamily) ? (f as PopFamily) : null;
  const early = born && gestDays < 259 ? Math.max(0, diffDays(f.dueDate, born)) : 0;
  let checkups = 0;
  let lastWeek = -1;
  for (const e of es) {
    const tag = `${today} ${e.page} ${e.date} ${e.title}`;
    if (e.date > today) bad.push(`t1 ${tag}`);
    if (AFTER_BIRTH.has(e.page) && (!born || e.date < born)) bad.push(`t2 ${tag}`);
    if (e.page === "birth") {
      const g = Number(e.values.weightG);
      if (pop) {
        if (!pop.profile.weights.includes(g)) bad.push(`t3 ${tag} ${g}g が家族のデータ ${pop.profile.weights.join("・")}g に無い`);
      } else {
        const med = birthWeightMedian(gestDays) * (weightsG.length > 1 ? 0.9 : 1);
        if (Math.abs(g / med - 1) > 0.1) bad.push(`t3 ${tag} ${g}g（中央値 ${Math.round(med)}g）`);
      }
    }
    if (e.page === "growth" && born) {
      const m = Math.max(0, diffDays(e.date, born) / 30.4 - early / 30.4);
      const med = growthMedian(m);
      for (const [k, v] of [["kg", e.values.weightKg], ["cm", e.values.heightCm], ["head", e.values.headCm]] as const) {
        const r = Number(v) / med[k];
        if (!(r >= 0.5 && r <= 1.5)) bad.push(`t4 ${tag} ${k}=${v}（中央値 ${med[k].toFixed(1)}）`);
      }
    }
    if (e.page === "pregnancy-checkup") {
      checkups++;
      const w = parseInt(String(e.values.week), 10);
      if (!(w > lastWeek)) bad.push(`t5 ${tag} 週数が戻った`);
      lastWeek = w;
    }
    if (JUDGE.test(JSON.stringify(e))) bad.push(`t6 ${tag}`);
    if (e.source !== "seed" || e.pending) bad.push(`t7 ${tag}`);
  }
  if (checkups > 14) bad.push(`t5 ${today} 妊婦健診が${checkups}回`);
  return bad;
}

/** 確かめる日: 授かって2か月・予定日・生まれて100日・2歳の誕生日・使い始めた日 */
function techoDays(f: Family): string[] {
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  return [...new Set([addDays(lmp, 60), f.dueDate, addDays(birth, 100), addMonths(birth, 9), secondBirthday(f), ...(f.startedOn ? [f.startedOn] : [])])];
}

describe("① 早送りの検査: 手帳の記録（作った家族の記録）", () => {
  const rows: { id: string; label: string; n: number; pages: number; bad: string[] }[] = [];
  const count: Record<TechoRule, number> = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, t8: 0 };
  const check = (f: Family, label: string) => {
    const bad: string[] = [];
    let n = 0;
    const pages = new Set<string>();
    for (const d of techoDays(f)) {
      const es = seedTecho(f, d);
      n = Math.max(n, es.length);
      es.forEach((e) => pages.add(e.page));
      bad.push(...techoBroken(f, d, es));
    }
    for (const b of bad) count[b.slice(0, 2) as TechoRule]++;
    rows.push({ id: f.id, label, n, pages: pages.size, bad });
    return bad;
  };

  it("t8 わが家（mine）には何も作らない", () => {
    const mine: Family = { ...DEMO_FAMILY, id: "mine" };
    for (const d of techoDays(mine)) expect(seedTecho(mine, d)).toEqual([]);
    // 作った家族の印の無い家族にも作らない
    expect(seedTecho({ ...DEMO_FAMILY, id: "family-x" }, "2028-01-01")).toEqual([]);
  });

  it("デモの家族（2歳まで、ページがそろう）", () => {
    const bad = check(DEMO_FAMILY, "デモ（作った家族）");
    expect(bad).toEqual([]);
    const all = seedTecho(DEMO_FAMILY, secondBirthday(DEMO_FAMILY));
    const pages = new Set(all.map((e) => e.page));
    for (const p of ["pregnancy-checkup", "birth", "newborn", "growth", "development", "vaccine", "feeling"]) expect(pages.has(p as TechoEntry["page"]), p).toBe(true);
  });

  it("30家族", () => {
    const bad = SIM_FAMILIES.flatMap((f) => check(f, f.persona.label).map((b) => `${f.id} ${b}`));
    expect(bad.slice(0, 30)).toEqual([]);
  });

  it("1000組", () => {
    const bad = getPopulation().flatMap((f) => check(f, f.persona.label).map((b) => `${f.id} ${b}`));
    expect(bad.slice(0, 30)).toEqual([]);
  }, 120_000);

  afterAll(() => {
    if (!rows.length) return;
    const pop = rows.filter((r) => r.id.startsWith("pop-"));
    const others = rows.filter((r) => !r.id.startsWith("pop-"));
    techoReport.push("## 手帳の記録（作った家族の記録・seedTecho）", "");
    techoReport.push(`デモ・30家族・1000組の ${rows.length}家族を、授かって2か月・予定日・生まれて100日・9か月・2歳の誕生日・使い始めた日で確かめた。`, "");
    techoReport.push("| 決まり | 中身 | 破れ |", "|---|---|---|");
    for (const k of Object.keys(TECHO_RULES) as TechoRule[]) techoReport.push(`| ${k} | ${TECHO_RULES[k]} | ${count[k]} |`);
    techoReport.push("", "| id | 一言 | 2歳までの記録の数 | ページの種類 | 破れ |", "|---|---|---|---|---|");
    for (const r of others) techoReport.push(`| ${r.id} | ${r.label} | ${r.n} | ${r.pages} | ${r.bad.length ? r.bad.slice(0, 2).join("／") : "○"} |`);
    techoReport.push(`| 1000組 | 現実の割合から作った家族 | 平均 ${Math.round(pop.reduce((n, r) => n + r.n, 0) / Math.max(1, pop.length))} | — | ${pop.filter((r) => r.bad.length).length}家族 |`, "");
  });
});

afterAll(() => {
  if (results.length || popResults.length) writeReport();
  if (DIARY && popResults.length) {
    const out = Object.fromEntries(popResults.map((x) => [x.f.id, { label: x.f.persona.label, start: x.r.start, end: x.r.end, diary: x.r.diary }]));
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "diary.json"), JSON.stringify(out));
  }
});
