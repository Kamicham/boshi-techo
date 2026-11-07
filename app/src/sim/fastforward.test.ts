// ① 早送りの検査: 作った家族の1000日を、「今日」の画面と同じ純関数に通して、決まりを守れているかを機械で確かめる。
//   - 30家族（families.ts・珍しい型の見本）: 毎日確かめる
//   - 現実の割合から作った1000組（population.ts）: ふだんは7日ごと＋節目の日（届出・出産の前後・生後14日・1か月・3か月・1歳・2歳など）だけ確かめる。
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
import { MONEY, moneyWatch } from "../lib/money";
import { backDays, satogaeriReach } from "../lib/satogaeri";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { addDays, addMonths, clockAt, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import { BIRTH_TRIP_IDS, babyInsuranceOf, planBirthTrip, tripScreen, type TripScreen } from "../lib/birth-trip";
import { HOLIDAY_TAILS, holidayWhy, isOfficeHoliday, nextOpenDay, prevOpenDay } from "../lib/holidays";
import { vaxRetime } from "../lib/vax-next";
import { intervalDays, prenatalState } from "../lib/prenatal";
import { olderOf } from "../lib/older";
import { benefitFirst } from "../lib/leave-money";
import type { Family, Member } from "../lib/demo-family";
import { deadlineKindOf, PARENT_FILINGS, PREGNANCY_ONLY, scheduleFor, statusOf, type Milestone } from "../lib/milestones";
import { hasOlderChildren, hideCounts, motherEmployed, partnerEmployed, partnerTakesLeave } from "../lib/situation";
import { bodySeries } from "../lib/body-series";
import { detectTriggers, BIRTH_SHIFT_DAYS, BIRTH_WINDOW_DAYS, MOVED_WINDOW_DAYS, type TriggerKind } from "../lib/advisor";
import { briefingDay, familyMessage, lineMessage, resolveAppointmentDate, type VisitPlan } from "../lib/visit";
import { afterCheck, heardFlags, withHeard } from "../lib/visit-next";
import { NOW, planToday, shownDays, whenDate, whoLabel, type Task } from "../components/today/task";
import { foldNow, mustShow } from "../components/today/now-fold";
import { SIM_FAMILIES } from "./families";
import type { SimFamily } from "./types";
import { getPopulation, type PopFamily } from "./population";
import { BIRTHS_2025, PER_FAMILY } from "./stats";
import { birthFacts, birthWeightMedian, growthMedian, isMadeFamily, seedTecho } from "../lib/techo-seed";
import { DEMO_FAMILY } from "../lib/demo-family";
import type { TechoEntry } from "../lib/techo";
import { doneFromTecho, vaxHistory } from "../lib/techo-done";
import { isPopulationFamily, madeHouseholdKind } from "./kind";
import { CAUTION_IDS, CAUTION_LABEL, cautionFor, devDatesOf, type CautionSeen } from "../lib/cautions";
import { birthdayFor, celebrationFor, welcomeFor } from "../lib/media-shared";

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
  i: "妊娠中、予定日の8週前を過ぎたら、支援給付の2回目が今やる（か済み）に出る（第1波③）",
  j: "生まれた日から15日の間、出生届がまだなら、届けの束の1件目が出生届で、束の期限は生まれた日を含めて14日目（役所の休みなら次の開庁日＝見直し①）。束を一番上の1枚に出す日は、束の届けを「このあと」に重ねない＝出生届を2回出さない（第1波②・UX の見直し C08）",
  k: "妊娠中の妊婦健診の目安は、今日より前にならず予定日より前で、今日受けた時の次は国の標準の間隔を超えない（第1波⑧）",
  l: "上の子の予定は上の子がいる家族だけに出て、健診・接種の日は上の子の生まれた日から数え、期限切れにならない。園の継続は保育園の上の子がいる時だけ（第2波①）",
  m: "保育園の入る4月が仕事に戻りたい時期に合い（1歳まで＝1歳の誕生日まで・1歳を過ぎて＝その後）、見学は生後1か月より前に来ず、延長の申し出の期限は1歳の誕生日の2週間前（第2波④）",
  o: "里帰り: 同じ市なら遠方向け（訪問を頼む・健診代の申請・戻る日の段取り・里帰り先の町の調べ）が出ず、健診代の申請と戻る日の段取りは戻る日から、里帰り先の町の調べは里帰り先の町を答えた家族だけ（第2波⑦）",
  p: "お金の1000日: 児童手当の最初の振込は偶数月で申請の後・届いたか確かめる件は申請が済んだ物だけで額を出さない・自営や仕事なしの母に出産手当金が出ない（辞める母には出す＝健康保険法第104条）",
  n: "産休・育休のお金: 育休の給付の初回の期限は育休の4か月目の月末で、自営・仕事なし・辞める母には育休の給付が出ず、パートナーの14日の1件は14日以上の家族に出ない（第2波⑤）",
  q: "呼び名と担当: 「パパ」は法の呼び名「産後パパ育休」の中だけ（短い題・一言・正式な題とも。産後パパ育休の期限の行は、短い題にも呼び名を書く＝見直し⑦）。法律上の親が出す届け（出生届・児童手当・保険証・医療費助成）の担当がパートナーに決め打ちにならない（2026-11-04 見直し L2-2・同性の家族 sim-03・未婚の父 sim-05）",
  r: "引っ越しの行: 町を変えた家族だけに、引っ越した日から出る。転入届の期限は引っ越した日の14日後（住民基本台帳法第22条）・児童手当は15日後（児童手当法第8条第3項。どちらも役所の休みなら次の開庁日＝見直し①）で、児童手当と医療証は引っ越した時に子がいた家族だけ、受診券は妊娠中に引っ越した家族だけ（見直し C10①）",
  s: "早く生まれた時: 予定日より7日以上早く生まれ、育休を取るかもしれないパートナーがいる家族だけに「育休の始まりを早める」が、生まれた日から予定日の前日まで出る（遅く生まれた時・6日以内は出さない。見直し C10②）",
  t: "気をつける事の札（lib/cautions.ts）: 1日に1枚まで。静かにする家族・生まれた日・母の画面の生後14日まで・お祝いや届けの束や手帳の気づきの日には出ず、読んだ札は同じ端末に二度出ない。引用ごとに出典があり、労基法の引用は働く母の家族だけ。出生届出済証明は36週の札と、届けの束の出生届の行で伝える（2026-11-05 総点検の札）",
  u: "ほかに今やる事は畳んで出す（家族の声①「要らないのに、ずらっと並ぶ。疲れる」への直し A・2026-11-05）: 自分の番は3行まで・ほかの人の番は人ごとに1行・法の期限が明日までの事は誰の番でも畳まない。畳んだ後の行は6行まで（components/today/now-fold.ts。画面と同じ関数）",
  v: "健診の録音から聞こえた次の健診の日（作り手の方針「聞き違いは0にできない。最後の確かめと OK は本人」・lib/visit-next.ts）: 国の標準の間隔で正しく聞こえた日には機械の印が付かず（本当に年をまたぐ日だけ「年をまたいだ」）、月を聞き違えて翌年に回った日には印が付く。確かめる前は送る文（LINE・共有）に日が入らず、予定に heard の印が付き、前日の声かけは出る。確かめた後は送る文に入り、heard が外れる",
  w: "役所の休み（見直し①・lib/holidays.ts）: 役所への届けの法の期限と目安の日が、役所の休み（土日・祝日と休日・12/29〜1/3）に当たらない。動かすのは休みに当たった日だけで、法の期限と目安は次の開庁日（町の締切の近似の目安は前の開庁日＝期限は越えない）。職場・産院・健康保険の行（公務員の児童手当・勤め先の保険を含む）は動かさない。束の期限も同じ",
} as const;
type Rule = keyof typeof RULES;
const RULE_IDS = Object.keys(RULES) as Rule[];

/** 決まり w: 役所に出さない届け（産院・健康保険・どこに出すか決まっていない母の保険の切り替え）。職場の事（kind 仕事）も役所の印を持たない */
const NOT_OFFICE = new Set(["direct-payment", "maternity-allowance-cert", "maternity-allowance-apply", "lump-sum-diff", "mother-insurance-switch"]);
/** 決まり w: 役所（町・国）への届け。赤ちゃんの保険は国保の時だけ・児童手当は公務員でない時だけ */
const OFFICE_IDS = new Set([
  "pregnancy-report", "nenkin-maternity-exempt", "kokuho-maternity-exempt", "older-daycare-continue", "satogaeri-visit", "pregnancy-support-2",
  "birth-registration", "child-allowance", "child-allowance-change", "health-insurance", "medical-subsidy", "single-child-support", "single-medical",
  "birth-notice", "low-birth-weight-report", "preterm-medical", "satogaeri-checkup-refund", "daycare-apply", "medical-deduction",
  "moved-tennyu", "moved-child-allowance", "moved-checkup-tickets", "moved-medical-card",
]);

/** 妊娠中だけの事（生まれた後に今やるに出てはいけない）。期限表の pregnancyOnly の印から。パパの育休は生まれた後も意味があるので入れない */
const PREG_ONLY = PREGNANCY_ONLY;

const MAX_PLAIN = 20;
const MAX_HINT = 40;
const MAX_OVERDUE = 2;
/** 「ほかに今やる事」の畳んだ後の行の上限（自分の番3行＋「ほかに◯件」＋ほかの人ごとに1行。決まり u） */
const MAX_NOW_LINES = 6;

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
/** パートナーの育休を職場に申し出る行（産後パパ育休・ふつうの育休） */
const LEAVE_ASK = new Set(["partner-leave", "partner-leave-regular"]);

/** h: この家族に合わない項目か（合わなければ理由の鍵。situation の無い家族は確かめない） */
function misfit(t: Task, f: Family): string | null {
  const s = f.situation;
  if (!s) return null;
  if (!motherEmployed(s) && t.kind === "仕事" && t.who === "母") return "mother-no-work";
  if (!partnerEmployed(s) && t.kind === "仕事" && t.who === "パートナー") return "partner-no-work";
  if (!hasRole(f, "パートナー") && (t.who === "パートナー" || LEAVE_ASK.has(t.id))) return "no-partner";
  if (s.partnerLeave === "取らない" && LEAVE_ASK.has(t.id)) return "partner-no-leave";
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
  // 生まれた後は、手帳の出産の記録の体重・週数を知っている（lib/family.ts の withBirthFacts と同じ値）
  else if (f.birthDate) {
    const { gestDays, weightsG } = birthFacts(f);
    v = { ...v, birthWeightG: Math.min(...weightsG), birthWeek: Math.floor(gestDays / 7) };
  }
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
  /** 生まれた日から15日の間の届けの束（束を一番上の1枚にするか、母の画面で1行にたたむか） */
  trip: TripScreen<Task> | null;
}

/**
 * Techo.tsx と同じ組み立て（focus 無し）。
 * 生まれた日から15日の間は、届けの束（lib/birth-trip.ts の tripScreen・UX の見直し C08）: 束を開く画面は束の1件目が一番上で、束の届けは「このあと」に出さない。
 * 母の画面で届けをパートナーの番に決めた時は、一番上は母の今日の一番上（この検査の家族は担当を決めないので、たたむ型は components/today/trip.test.ts で見る）
 */
function screenFor(tasks: Task[], day: string, me: Member | null, nextVisit: string | null, fv: Family): Screen {
  const plan = planToday(tasks, day, me);
  const born = fv.birthDate && fv.birthDate <= day ? fv.birthDate : undefined;
  const trip = tripScreen(
    planBirthTrip(tasks, day, born, fv.situation),
    tasks,
    plan,
    me?.role,
    fv.members.some((m) => m.role === "パートナー"),
    day,
  );
  const baseTop = trip ? trip.top : plan.top;
  const baseRest = trip ? trip.rest : plan.rest;
  const visitTop = !!nextVisit && !!briefingDay(day, nextVisit);
  const top = visitTop ? null : baseTop;
  const rows = visitTop && baseTop ? [baseTop, ...baseRest] : baseRest;
  const calmNext = !visitTop && !top ? ((me && plan.upcoming.find((t) => t.who === "家族" || t.who === me.role)) || plan.upcoming[0] || null) : null;
  return { visitTop, top, topIsSoon: !trip?.full && plan.topIsSoon, rows, calmNext, trip };
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
  /** 気をつける事の札が出た日（使う人ごと。出た日に「読んだ」を押す筋書き） */
  cautions: CautionShown[];
}

interface CautionShown {
  id: string;
  title: string;
  kind: keyof typeof CAUTION_LABEL;
  meId: string;
  date: string;
  at: string;
}

/** 確かめる日（間引く時）: 7日ごと＋節目＋きっかけの窓（生まれた日の前後・引っ越し・使い始め） */
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
  const startSchedule = scheduleFor(startView, start);
  const startPileWithoutSeed = startSchedule.filter((m) => statusOf(m, start, new Set()) === "期限切れ").length;
  for (const m of startSchedule) if (m.deadlineDate && m.deadlineDate < start) done.add(m.id);

  const violations: Violation[] = [];
  const checkpoints: CheckpointRow[] = [];
  const triggersSeen: Partial<Record<TriggerKind, string>> = {};
  const toCheck = sampled ? checkDays(f, start, end, cps) : null;
  // t: 気をつける事の札。「読んだ」は使う人の端末ごと（components/today/CautionCard.tsx と同じ）。筋書きは、出た日に読む。
  // 手帳のできた日（寝返り・はいはい・つかまり立ち・ひとり歩き）は、作った家族の記録（techo-seed）から。画面と同じく生後3か月〜1歳2か月だけ渡す
  const cautionSeen = new Map<string, CautionSeen>();
  const cautions: CautionShown[] = [];
  const devAll = f.birthDate ? devDatesOf(seedTecho(viewAt(f, end), end)) : {};
  // 期限表は、生まれた日と引っ越しを知っているかだけで変わる（同じ形なら作り直さない）
  const schedules = new Map<string, ReturnType<typeof scheduleFor>>();
  // 授かる前（最終月経の日より前）は、どの事も「授かったら」になる（scheduleFor に今日を渡す）
  const scheduleOf = (fv: Family, day: string) => {
    const trying = day < lmp;
    const key = `${fv.birthDate ?? ""}|${fv.movedOn ?? ""}|${trying}`;
    let s = schedules.get(key);
    if (!s) schedules.set(key, (s = scheduleFor(fv, day)));
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
    const schedule = scheduleOf(fv, day);
    const tasksNow = (): Task[] => schedule.map((m) => ({ ...m, status: statusOf(m, day, done) }));
    const nextVisit = visits.find((d) => d >= day) ?? null;
    if (toCheck && !toCheck.has(day)) {
      act(day, isBorn, tasksNow, nextVisit, fv);
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
      if (!isBorn && t.anchor === "birth" && !t.older) push("e", `before:${t.id}`, `まだ生まれていないのに「${t.plain}」が${t.status}`);
    }
    // i: 支援給付の2回目（予定日の8週前から。済んでいなければ今やるか期限の近い事として出る）
    if (!isBorn && diffDays(f.dueDate, day) <= 56) {
      const t2 = tasks.find((t) => t.id === "pregnancy-support-2");
      if (!t2) push("i", "missing", "予定日の8週前を過ぎたのに、支援給付の2回目が予定に無い");
      else if (t2.status === "まだ先" && !t2.awaitingPregnancy) push("i", "late", `予定日の8週前を過ぎたのに、支援給付の2回目が「まだ先」`);
    }
    // j: 生まれた届けの束
    if (isBorn && f.birthDate && day <= nextOpenDay(addDays(f.birthDate, 15))) {
      const reg = tasks.find((t) => t.id === "birth-registration");
      const trip = planBirthTrip(tasks, day, f.birthDate, fv.situation);
      if (reg && reg.status !== "済み" && reg.status !== "期限切れ") {
        if (!trip) {
          if (tasks.filter((t) => BIRTH_TRIP_IDS.has(t.id) && t.status !== "済み" && t.status !== "過ぎた" && t.status !== "期限切れ").length >= 2) push("j", "missing", "出生届がまだで届けが2件以上あるのに、束が出ない");
        } else {
          if (trip.items[0].task.id !== "birth-registration") push("j", "order", `束の1件目が「${trip.items[0].task.plain}」`);
          if (trip.deadline !== nextOpenDay(addDays(f.birthDate, 13))) push("j", "deadline", `束の期限が ${trip.deadline}`);
          if (isOfficeHoliday(trip.deadline)) push("w", "trip", `束の期限 ${trip.deadline} が役所の休み（${holidayWhy(trip.deadline)}）`);
        }
      }
    }
    // k: 妊婦健診の次の目安（受けていない時・今日受けた時）
    if (!isBorn) {
      for (const ck of [[], [day]] as string[][]) {
        const ps = prenatalState(f, day, ck);
        if (!ps || !ps.next) continue;
        if (ps.next < day) push("k", "past", `健診の目安 ${ps.next} が今日より前`);
        if (ps.next >= f.dueDate) push("k", "due", `健診の目安 ${ps.next} が予定日以降`);
        if (ck.length && diffDays(day, lmpFromDue(f.dueDate)) >= 56 && diffDays(ps.next, day) > intervalDays(Math.floor(diffDays(day, lmpFromDue(f.dueDate)) / 7))) push("k", "gap", `今日受けたのに次の目安が ${diffDays(ps.next, day)} 日後`);
      }
    }
    // v: 健診の録音から聞こえた次の健診の日（健診の日だけ。整理の後の形を lib/visit-next.ts の関数で作って見る）
    if (visits.includes(day)) {
      const wk = Math.floor(diffDays(day, lmpFromDue(f.dueDate)) / 7);
      const right = isBorn ? addMonths(day, 1) : addDays(day, intervalDays(wk));
      const said = (month: number, d: number) => ({ month, day: d, afterWeeks: null, afterDays: null, afterMonths: null, weekday: null });
      const rs = said(Number(right.slice(5, 7)), Number(right.slice(8, 10)));
      if (resolveAppointmentDate(day, rs) !== right) push("v", "resolve", `正しく聞こえた ${right} が ${resolveAppointmentDate(day, rs)} になった`);
      const fl = heardFlags(day, rs, right, f).filter((x) => !(x === "rollover" && right.slice(0, 4) !== day.slice(0, 4)));
      if (fl.length) push("v", "flag-right", `正しく聞こえた ${right} に印 ${fl.join("・")}`);
      // 月を聞き違えた日: 健診の月の1日（健診の日より前の月日なので、翌年に回る）
      if (Number(day.slice(8, 10)) > 1) {
        const ws = said(Number(day.slice(5, 7)), 1);
        const wrong = resolveAppointmentDate(day, ws);
        if (!wrong || !heardFlags(day, ws, wrong, f).includes("rollover")) push("v", "flag-wrong", `聞き違えて ${wrong} に回った日に「年をまたいだ」の印が無い`);
      }
      // 確かめる前と後
      const id = `ff-${day}`;
      const result = { summary: ["a"], said: [], todo: [], nextAppointment: { said: "x", ...rs, time: "10:30" }, numbers: [], terms: [], questions: [], answered: [] };
      const v = { date: day, label: "x", result, nextDate: right };
      const plan: VisitPlan["next"] = { date: right, time: "10:30", source: "visit", visitId: id, said: "x" };
      const jp = (x: string) => x;
      if (familyMessage(v, jp).includes(right) || lineMessage(v).includes("次は")) push("v", "send-heard", `確かめていない ${right} が送る文に入った`);
      if (!withHeard(plan, () => ({}))?.heard) push("v", "heard", `確かめていない ${right} に heard が付かない`);
      if (briefingDay(addDays(right, -1), withHeard(plan, () => ({}))?.date) !== "eve") push("v", "eve", `確かめていない ${right} の前日の声かけが出ない`);
      const check = { state: "ok" as const, date: right, time: "10:30", at: `${day}T03:00:00.000Z` };
      const out = afterCheck({ id, date: day }, "x", plan, check, true);
      if (!familyMessage({ ...v, nextCheck: check }, jp).includes(right) || withHeard(out.planNext, () => ({ nextCheck: check }))?.heard) push("v", "send-checked", `確かめた ${right} が送る文に入らない・heard が残る`);
    }
    // l: 上の子の予定
    {
      const kids = fv.situation?.olderChildren ? fv.situation.olderKids ?? [] : [];
      for (const t of tasks) {
        const o = olderOf(t.id);
        if (!o) continue;
        const kid = kids[o.index];
        if (!kid) {
          push("l", "stray", `上の子がいないのに「${t.plain}」`);
          continue;
        }
        if (kid.care === "小学校") push("l", "school", `小学生の上の子に「${t.plain}」`);
        if (t.status === "期限切れ") push("l", "overdue", `上の子の「${t.plain}」が期限切れ`);
        if (o.baseId === "checkup-3y" && t.startDate !== addMonths(kid.birthDate, 36)) push("l", "date", `上の子の3歳児健診の始まりが ${t.startDate}`);
      }
      const daycare = kids.some((k) => k.care === "保育園");
      if (!daycare && tasks.some((t) => t.id === "older-daycare-continue")) push("l", "daycare", "保育園の上の子がいないのに、園の継続の申請が出る");
      if (daycare && !tasks.some((t) => t.id === "older-daycare-continue")) push("l", "daycare-missing", "保育園の上の子がいるのに、園の継続の申請が無い");
    }
    // m: 保育園の逆算
    {
      const ra = fv.situation?.returnAt;
      const born = isBorn && f.birthDate ? f.birthDate : f.dueDate;
      // 入る4月は、入園の準備の期限（入る日の1週後）から読む
      const prep = tasks.find((t) => t.id === "daycare-prep");
      if (prep?.deadlineDate && ra) {
        const entry = addDays(prep.deadlineDate, -7);
        const one = addMonths(born, 12);
        if (ra === "1歳まで" && entry > one && entry >= addDays(born, 57) && `${Number(entry.slice(0, 4)) - 1}-04-01` >= addDays(born, 57)) push("m", "late", `1歳までの家族の入る4月が ${entry}（1歳の誕生日 ${one} の後）`);
        if (ra === "1歳を過ぎて" && entry < one) push("m", "early", `1歳を過ぎての家族の入る4月が ${entry}（1歳の誕生日 ${one} より前）`);
      }
      const research = tasks.find((t) => t.id === "daycare-research");
      if (research && isBorn && f.birthDate && research.startDate < addMonths(f.birthDate, 1) && !research.awaitingBirth) push("m", "research", `見学が生後1か月より前（${research.startDate}）`);
      const ext = tasks.find((t) => t.id === "daycare-extend");
      if (ext && isBorn && f.birthDate && ext.deadlineDate !== addDays(addMonths(f.birthDate, 12), -14)) push("m", "extend", `延長の申し出の期限が ${ext.deadlineDate}`);
      if (tasks.some((t) => t.id === "daycare-extend-2") && ra !== "1歳を過ぎて") push("m", "extend2", "1歳を過ぎての家族でないのに、2回目の延長が出る");
    }
    // n: 産休・育休のお金
    {
      const mw = fv.situation?.motherWork;
      const first = tasks.find((t) => t.id === "childcare-benefit-first");
      if (first && (mw === "自営・フリー" || mw === "仕事なし" || mw === "出産で辞める")) push("n", "who", `${mw}の母に育休の給付の申請が出る`);
      if (first && isBorn && f.birthDate) {
        const b = benefitFirst(f.birthDate);
        if (first.startDate !== b.start || first.deadlineDate !== b.deadline) push("n", "first", `育休の給付の初回が ${first.startDate}〜${first.deadlineDate}`);
        if (first.deadlineDate && first.deadlineDate.slice(8) < "28") push("n", "eom", `初回の期限 ${first.deadlineDate} が月末でない`);
      }
      const len = fv.situation?.partnerLeaveLen;
      if (tasks.some((t) => t.id === "partner-leave-14") && (len === "2週間〜1か月" || len === "1か月以上")) push("n", "14", `パートナーの育休が${len}なのに、14日の1件が出る`);
    }
    // p: お金の1000日（申請の期限の日に済んだとして見る）
    {
      const doneMoney = new Set(tasks.filter((t) => t.id in MONEY).map((t) => t.id));
      const watch = moneyWatch(tasks, doneMoney, {}, isBorn ? f.birthDate : undefined);
      const ca = watch.find((w) => w.id === "paid-child-allowance");
      const src = tasks.find((t) => t.id === "child-allowance");
      if (ca && src) {
        if (Number(ca.startDate.slice(5, 7)) % 2 !== 0) push("p", "even", `児童手当の振込が奇数月（${ca.startDate}）`);
        if (ca.startDate <= (src.deadlineDate ?? src.startDate)) push("p", "after", `児童手当の振込 ${ca.startDate} が申請 ${src.deadlineDate} より前`);
      }
      for (const w of watch) if (/円/.test(`${w.title}${w.plain}${w.hint}`)) push("p", "yen", `${w.id} に額が出る`);
      if (moneyWatch(tasks, new Set(), {}, f.birthDate).length) push("p", "unapplied", "申請していないのに届いたか確かめる件が出る");
      const mw = fv.situation?.motherWork;
      if (tasks.some((t) => t.id === "maternity-allowance-apply") && (mw === "自営・フリー" || mw === "仕事なし")) push("p", "who", `${mw}の母に出産手当金の申請が出る`);
    }
    // q: 呼び名と担当（予定表と、届いたか確かめる件のすべて）
    {
      const all = [...tasks, ...moneyWatch(tasks, new Set(tasks.filter((t) => t.id in MONEY).map((t) => t.id)), {}, isBorn ? f.birthDate : undefined)];
      for (const t of all) {
        if (/パパ/.test(`${t.plain}${t.hint}`.replace(/産後パパ育休/g, ""))) push("q", `word:${t.id}`, `${t.id} の短い題か一言に「パパ」（法の呼び名「産後パパ育休」の外）`);
        if (/パパ/.test(t.title.replace(/産後パパ育休/g, ""))) push("q", `title:${t.id}`, `${t.id} の題に「パパ」（産後パパ育休の外）`);
        if (PARENT_FILINGS.has(t.id) && t.who === "パートナー") push("q", `who:${t.id}`, `${t.id} の担当がパートナーに決め打ち`);
      }
    }
    // r: 引っ越しの行（見直し C10①）
    {
      const mv = tasks.filter((t) => t.anchor === "moved");
      const moved = !!fv.movedOn && !!fv.previousCity && (fv.previousCity !== fv.city || (fv.previousPrefecture ?? fv.prefecture) !== fv.prefecture);
      if (!moved && mv.length) push("r", "stray", `引っ越していないのに「${mv[0].plain}」`);
      if (moved) {
        const on = fv.movedOn!;
        const tennyu = mv.find((t) => t.id === "moved-tennyu");
        if (!tennyu) push("r", "missing", "引っ越したのに、転入届の行が無い");
        else if (tennyu.startDate !== on || tennyu.deadlineDate !== nextOpenDay(addDays(on, 14))) push("r", "tennyu-date", `転入届が ${tennyu.startDate}〜${tennyu.deadlineDate}（引っ越した日 ${on} から14日後（休みなら次の開庁日）まで、でない）`);
        const kid = (!!f.birthDate && f.birthDate <= on) || hasOlderChildren(fv.situation);
        const ca = mv.find((t) => t.id === "moved-child-allowance");
        if (kid !== !!ca) push("r", "allowance", kid ? "引っ越した時に子がいたのに、児童手当の行が無い" : "引っ越した時に子がいないのに、児童手当の行が出る");
        if (ca && ca.deadlineDate !== nextOpenDay(addDays(on, 15))) push("r", "allowance-date", `児童手当の期限が ${ca.deadlineDate}（引っ越した日の15日後（休みなら次の開庁日）でない）`);
        if (kid !== mv.some((t) => t.id === "moved-medical-card")) push("r", "medical", kid ? "引っ越した時に子がいたのに、医療証の行が無い" : "引っ越した時に子がいないのに、医療証の行が出る");
        const pregMove = on >= lmpFromDue(f.dueDate) && (!f.birthDate || on < f.birthDate);
        if (pregMove !== mv.some((t) => t.id === "moved-checkup-tickets")) push("r", "tickets", pregMove ? "妊娠中に引っ越したのに、受診券の行が無い" : "妊娠中でない引っ越しに、受診券の行が出る");
      }
    }
    // w: 役所の休み（見直し①）。予定表のすべての行の期限・目安の日を見る
    {
      for (const t of tasks) {
        if (!t.deadlineDate) continue;
        const kindWord = deadlineKindOf(t) === "目安" ? "目安の日" : "期限";
        // 役所に出さない届け（職場の事・産院・健康保険・どこに出すか決まっていない母の保険）と、公務員の児童手当（勤め先）には印が無い
        const toOffice =
          t.kind !== "仕事" &&
          !NOT_OFFICE.has(t.id) &&
          !(fv.situation?.publicServant && (t.id === "child-allowance" || t.id === "child-allowance-change")) &&
          (t.id !== "health-insurance" || babyInsuranceOf(fv.situation) === "国保");
        if (!!t.office !== (toOffice && OFFICE_IDS.has(t.id))) push("w", `mark:${t.id}`, t.office ? `役所に出さない「${t.plain}」に役所の印` : `役所への届け「${t.plain}」に役所の印が無い`);
        if (!t.office) {
          if (t.deadlineOnHoliday) push("w", `stay:${t.id}`, `職場・産院・健康保険の「${t.plain}」の日を ${t.deadlineOnHoliday} から動かした`);
          continue;
        }
        if (isOfficeHoliday(t.deadlineDate)) push("w", `holiday:${t.id}`, `「${t.plain}」の${kindWord} ${t.deadlineDate} が役所の休み（${holidayWhy(t.deadlineDate)}）`);
        if (t.deadlineOnHoliday) {
          if (!isOfficeHoliday(t.deadlineOnHoliday)) push("w", `needless:${t.id}`, `「${t.plain}」を休みでない日 ${t.deadlineOnHoliday} から動かした`);
          const early = !!t.officeNoLater && deadlineKindOf(t) === "目安";
          const want = early ? prevOpenDay(t.deadlineOnHoliday) : nextOpenDay(t.deadlineOnHoliday);
          if (t.deadlineDate !== want) push("w", `where:${t.id}`, `「${t.plain}」を ${t.deadlineOnHoliday} から ${t.deadlineDate} へ（${early ? "前" : "次"}の開庁日 ${want} でない）`);
          if (!t.basis.includes("開庁日")) push("w", `why:${t.id}`, `「${t.plain}」の日を動かしたのに、根拠に理由が無い`);
        }
      }
    }
    // s: 早く生まれた時のパートナーの育休（見直し C10②）
    {
      const t = tasks.find((x) => x.id === "partner-leave-earlier");
      const early = isBorn && diffDays(f.dueDate, f.birthDate!) >= BIRTH_SHIFT_DAYS;
      const want = early && fv.members.some((m) => m.role === "パートナー") && partnerTakesLeave(fv.situation);
      if (!want && t) push("s", "stray", "早く生まれていない・育休を取らない家族に、育休を早める行が出る");
      if (want && !t) push("s", "missing", "早く生まれたのに、パートナーの育休を早める行が無い");
      if (t && (t.startDate !== f.birthDate || t.deadlineDate !== addDays(f.dueDate, -1))) push("s", "date", `育休を早める行が ${t.startDate}〜${t.deadlineDate}（生まれた日〜予定日の前日、でない）`);
    }
    // o: 里帰りの2つの町
    if (fv.situation?.satogaeri) {
      const reach = satogaeriReach(fv, fv.situation);
      const away = ["satogaeri-visit", "satogaeri-checkup-refund", "satogaeri-return", "satogaeri-local"].filter((id) => tasks.some((t) => t.id === id));
      if (reach === "同じ市" && away.length) push("o", "same", `同じ市の里帰りに遠方向けが出る（${away.join("・")}）`);
      if (tasks.some((t) => t.id === "satogaeri-local") && reach !== "同じ県" && reach !== "ほかの県") push("o", "local", "里帰り先の町を答えていないのに、里帰り先の町の調べが出る");
      if (isBorn && f.birthDate) {
        const back = addDays(f.birthDate, backDays(fv.situation.satogaeriBack));
        const refund = tasks.find((t) => t.id === "satogaeri-checkup-refund");
        if (refund && refund.startDate !== back) push("o", "refund", `健診代の申請が ${refund.startDate}（戻る日 ${back} でない）`);
        const ret = tasks.find((t) => t.id === "satogaeri-return");
        if (ret && ret.deadlineDate !== back) push("o", "return", `戻る日の段取りの目安が ${ret.deadlineDate}（戻る日 ${back} でない）`);
      }
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
    // t: 画面が札を出さない日（Techo.tsx の cautionBusy）: お祝いの日・手帳の気づきが開いている日（届けの束は使う人ごとに下で）
    const festive = !!birthdayFor(fv, day) || welcomeFor(fv, day) !== null || !!celebrationFor(fv, day);
    // ── 使う人ごとの決まり（家族の一人ずつが me） ──
    for (const me of f.members) {
      const s = screenFor(tasks, day, me, nextVisit, fv);
      // a
      if (s.top && !(s.top.who === "家族" || s.top.who === me.role)) push("a", `${me.id}:${s.top.id}`, `${me.name}（${me.role}）の一番上が「${s.top.plain}」（${s.top.who}の番）`, me.id);
      // u: ほかに今やる事を畳む（画面と同じ foldNow）。法の期限が明日までの事は畳まず、畳んだ後も6行まで
      {
        const nr = s.rows.map((task) => ({ kind: "task" as const, task }));
        const fd = foldNow(nr, me, day);
        const lines = fd.shown.length + (fd.more.length ? 1 : 0) + fd.others.length;
        if (lines > MAX_NOW_LINES) push("u", `lines:${me.id}`, `${me.name}の「ほかに今やる事」が、畳んでも${lines}行`, me.id);
        for (const r of nr) if (mustShow(r.task, day) && !fd.shown.includes(r)) push("u", `keep:${me.id}:${r.task.id}`, `法の期限が明日までの「${r.task.plain}」が畳まれる`, me.id);
        if (fd.shown.length + fd.more.length + fd.others.reduce((n, g) => n + g.rows.length, 0) !== nr.length) push("u", `lost:${me.id}`, `${me.name}の「ほかに今やる事」の行が、畳むと消える`, me.id);
      }
      // j（使う人の画面）: 束を一番上の1枚に出す日は、束の届けを「このあと」に重ねない（期限切れの届けは束に入らず、ふり返りが受け持つ）
      if (s.trip?.full && !s.visitTop) {
        for (const t of s.rows) if (BIRTH_TRIP_IDS.has(t.id) && t.status !== "期限切れ") push("j", `twice:${me.id}:${t.id}`, `束の「${t.plain}」が、${me.name}の「このあと」にも出る`, me.id);
      }
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
      // t: 気をつける事の札（画面と同じ入力: 役・出さない日・手帳のできた日）
      {
        const role = me.role === "パートナー" ? "パートナー" : "母";
        const seen = cautionSeen.get(me.id) ?? { ids: [] };
        const b = fv.birthDate && fv.birthDate <= day ? fv.birthDate : null;
        const dev = b && day >= addMonths(b, 3) && day < addMonths(b, 14) ? Object.fromEntries(Object.entries(devAll).filter(([, d]) => !!d && d <= day)) : undefined;
        const busy = festive || (!!s.trip?.full && !s.visitTop) || kinds.size > 0;
        const c = cautionFor(fv, day, seen, { role, busy, dev });
        if (c) {
          const since = b ? diffDays(day, b) : null;
          const was = `${me.name}の画面に「${c.title}」`;
          if (busy) push("t", `busy:${c.id}`, `お祝い・届けの束・手帳の気づきの日に、${was}`, me.id);
          if (fv.situation?.quiet) push("t", `quiet:${c.id}`, `静かにする家族（${fv.situation.quiet}）の${was}`, me.id);
          if (since === 0) push("t", `birthday:${c.id}`, `生まれた日に、${was}`, me.id);
          if (role === "母" && since !== null && since <= 14) push("t", `mother14:${c.id}`, `生後${since}日の${was}`, me.id);
          if (seen.ids.includes(c.id)) push("t", `again:${c.id}`, `読んだ札がまた出た: ${was}`, me.id);
          if (!c.quotes.length || c.quotes.some((q) => !q.from) || !c.sources.length || c.sources.some((x) => !x.href.startsWith("https://")))
            push("t", `source:${c.id}`, `引用か出典が欠けている: ${was}`, me.id);
          if (c.quotes.some((q) => q.from.includes("労働基準法")) && !motherEmployed(fv.situation)) push("t", `labor:${c.id}`, `働いていない母の家族に、労基法の引用: ${was}`, me.id);
          cautionSeen.set(me.id, { ids: [...seen.ids, c.id], day });
          cautions.push({ id: c.id, title: c.title, kind: c.kind, meId: me.id, date: day, at });
        }
      }
    }

    // ── 日記（アンケート用。persona の使う人の画面が変わった日だけ書く） ──
    if (DIARY && isPop(f)) {
      const s = screenFor(tasks, day, persona, nextVisit, fv);
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
      const s = screenFor(tasks, day, persona, nextVisit, fv);
      const top = s.visitTop
        ? `${briefingDay(day, nextVisit) === "eve" ? "明日" : "今日"} 10:30 健診`
        : s.top
          ? `${s.topIsSoon ? "もうすぐ: " : ""}${s.top.plain}${paren(whoLabel(s.top, fv, persona))}`
          : s.calmNext
            ? `今週は何もしなくて大丈夫 → 次は「${s.calmNext.plain}」`
            : "今週は何もしなくて大丈夫（次も無し）";
      checkpoints.push({ ...c, clock: at, top, rows: s.rows.length, overdue: overdue.length, triggers: [...kinds] });
    }

    act(day, isBorn, tasksNow, nextVisit, fv);
  }

  /** 家族が動く（一人ずつ、動く日に自分の一番上を1つ済ませる） */
  function act(day: string, isBorn: boolean, tasksNow: () => Task[], nextVisit: string | null, fv: Family) {
    for (const m of f.members) {
      const pace = paceOf(f, m);
      if (pace <= 0 || diffDays(day, start) % pace !== 0) continue;
      const s = screenFor(tasksNow(), day, m, nextVisit, fv);
      if (s.visitTop || !s.top || s.topIsSoon || !NOW.has(s.top.status)) continue;
      if (s.top.anchor === "birth" && !isBorn) continue; // 生まれる前には出せない
      done.add(s.top.id);
    }
  }

  return { id: f.id, label: f.persona.label, meId: f.persona.meId, days, checked: toCheck ? toCheck.size : days, start, end, startPileWithoutSeed, violations, checkpoints, triggersSeen, diary, cautions };
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

/**
 * 今のアプリ（Family 型・期限表）が表せない状況。profile から数える。
 * 表せるようになった物は外す（2026-11-05: 上の子＝決まり l・里帰り＝決まり o・自営で育休が無い＝決まり h・n・p と国保・国民年金の産前産後の免除）
 */
const UNREPRESENTABLE: { label: string; why: string; hit: (f: PopFamily) => boolean }[] = [
  { label: "近くに祖父母がいない（同居・同じ市区町村のどちらにもいない）", why: "家族は母とパートナーだけで、祖父母を持たない。手を借りられない家族を区別できない", hit: (f) => !["同居", "同じ市区町村"].includes(f.profile.grandma.mother) && !["同居", "同じ市区町村"].includes(f.profile.grandma.father ?? "") },
  { label: "母が育休なしで働き続ける・自営", why: "自営・フリーの母には、職場の事・出産手当金・育休の給付が出ない（決まり h・n・p）。雇われて育休を取らずに働き続ける母は持てず、「産休」「育休を職場に伝える」が出る", hit: (f) => f.profile.motherWork.after === "育休なしで継続" },
  { label: "帝王切開", why: "入院が長い・退院後に動けない期間を、担当の割り振りに入れられない", hit: (f) => f.profile.cesarean },
  { label: "父に夜勤がある", why: "パートナーが動ける時間帯を持てない（夜勤明けに窓口へ行けない等）", hit: (f) => !!f.profile.father?.nightShift },
  { label: "同じ市区町村の中で引っ越す", why: "住所が変わっても町は同じなので、Family 型では引っ越しにならない（転居届・郵便・保険証の住所変更が出ない）", hit: (f) => f.profile.move?.kind === "同じ市区町村の中" },
  { label: "体外受精など（生殖補助医療）", why: "授かる前・妊娠初期の治療と、クリニックから産院への移り方を表せない", hit: (f) => f.profile.art },
  { label: "妊娠37週未満で生まれる", why: "生まれた日と週数は持てる。発育曲線は修正月齢で見て（lib/growth.ts）、育休の始まりを早める事（決まり s）・低出生体重児の届出・未熟児養育医療も出る。乳幼児健診の時期を修正月齢で数える事は持てない", hit: (f) => f.profile.weeks < 37 },
  { label: "父母のどちらかが外国籍", why: "親の国の大使館への出生の届け・在留資格の手続きを表せない", hit: (f) => f.profile.nationality.mother !== "日本" || (!!f.profile.nationality.father && f.profile.nationality.father !== "日本") },
  { label: "NICU に入る", why: "未熟児養育医療・低出生体重児の届出は出て、入院の間は「静かにする」（nicu）を選べる。面会の段取りと退院の日は持てない", hit: (f) => f.profile.nicu },
  { label: "日本語に不安がある親がいる", why: "言葉の力を Family 型に持てない（画面は日本語・中文・English を切り替えられるが、やさしい日本語とほかの母語は無い）", hit: (f) => f.profile.japaneseAnxious.mother || f.profile.japaneseAnxious.father },
  { label: "ひとり親", why: "パートナーの担当は母へ移り、児童扶養手当などを足した（members から）。事実婚・離婚の途中など、ひとり親の形の違いは持てない", hit: (f) => f.profile.marital === "ひとり親" },
  { label: "双子", why: "生まれる子の数は持てる（出生届・児童手当・保険証・医療費助成・出生通知に「2人分」、産前休業は14週）。健診・予防接種の予定は1人分の言い方のまま", hit: (f) => f.profile.twins },
  { label: "単身赴任", why: "パートナーが離れて暮らす事を持てない（担当を振り直す根拠が無い）", hit: (f) => !!f.profile.father?.tanshin },
  { label: "事実婚（婚姻届を出していない）", why: "認知の届け・親権・児童手当の受け取る人を表せない", hit: (f) => f.profile.marital === "事実婚" },
  { label: "祖父母がだれもいない・国外（両方の母が亡くなっている・国外）", why: "外の手（産前産後ヘルパー・ファミサポ）へ振る根拠が無い", hit: (f) => ["亡くなっている", "国外"].includes(f.profile.grandma.mother) && (!f.profile.grandma.father || ["亡くなっている", "国外"].includes(f.profile.grandma.father)) },
  { label: "国外から引っ越してくる", why: "前の町が国外の時の手続き（転入・母子手帳の取り直し）を表せない", hit: (f) => f.profile.move?.kind === "国外から" },
  { label: "耳が聞こえにくい親", why: "健診の録音・電話の予約が前提の所がある。筆談・文字の連絡を表せない", hit: (f) => !!f.profile.hearing },
  { label: "離島に住む", why: "島外の産院へ移る（出産前の滞在）・船の時刻を表せない", hit: (f) => f.profile.placeType === "離島" },
];

/** 決まり w の報告: 役所の休みで動かした期限・目安の日（家族ごとに、2歳の誕生日の時点の予定表をまるごと1回組んで数える。空振りでない事を見る） */
function holidayLines(rs: Result[], heading: string): string[] {
  const how = (m: Milestone) =>
    m.office === "国" ? "国の役所→次の開庁日" : m.basis.endsWith(HOLIDAY_TAILS.前) ? "目安→前の開庁日" : deadlineKindOf(m) === "目安" ? "目安→次の開庁日" : "法の期限→次の開庁日";
  const rows = new Map<string, number>();
  const examples: string[] = [];
  let families = 0;
  let total = 0;
  for (const x of rs) {
    const moved = scheduleFor(viewAt(x.f, secondBirthday(x.f))).filter((m) => m.deadlineOnHoliday);
    if (moved.length) families++;
    for (const m of moved) {
      total++;
      const k = `${m.plain}（${how(m)}）`;
      rows.set(k, (rows.get(k) ?? 0) + 1);
      if (examples.length < 3) examples.push(`${x.r.id}: ${m.plain} ${m.deadlineOnHoliday}（${holidayWhy(m.deadlineOnHoliday!)}）→ ${m.deadlineDate}`);
    }
  }
  const list = [...rows.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}件`);
  return [`### 役所の休みで動かした日（決まり w・${heading}）`, "", `${rs.length}家族のうち ${families}家族・${total}件。${list.join("・") || "—"}`, "", ...examples.map((e) => `- 例: ${e}`), ""];
}

/** 決まり t の報告: 気をつける事の札が、どの家族に・いつ出たか（家族ごとに、使う人の誰かに最初に出た時。妊娠中の時期は週にまとめる） */
function cautionLines(rs: Result[], heading: string, sampled: boolean): string[] {
  const week = (at: string) => at.replace(/^(妊娠\d+週)\d+日$/, "$1");
  const keyOf = (id: string) => id.replace(/-\d{4}$/, "");
  const top = (m: Map<string, number>, n: number) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, n)
      .map(([k, v]) => `${k}（${v}）`)
      .join("・");
  const cards = new Map<string, { title: string; kind: string; families: number; times: number; when: Map<string, number> }>();
  const firstOf = new Map<string, number>();
  const none: Result[] = [];
  const perFamily: number[] = [];
  for (const x of rs) {
    const cs = x.r.cautions;
    if (!cs.length) {
      none.push(x);
      perFamily.push(0);
      continue;
    }
    const first = cs.reduce((a, c) => (c.date < a.date ? c : a));
    const fk = `${week(first.at)}「${first.title}」`;
    firstOf.set(fk, (firstOf.get(fk) ?? 0) + 1);
    const here = new Map<string, CautionShown>();
    for (const c of cs) {
      const k = keyOf(c.id);
      const cur = cards.get(k) ?? { title: c.title, kind: CAUTION_LABEL[c.kind], families: 0, times: 0, when: new Map<string, number>() };
      cur.times++;
      cards.set(k, cur);
      const prev = here.get(k);
      if (!prev || c.date < prev.date) here.set(k, c);
    }
    for (const [k, c] of here) {
      const cur = cards.get(k)!;
      cur.families++;
      cur.when.set(week(c.at), (cur.when.get(week(c.at)) ?? 0) + 1);
    }
    perFamily.push(here.size);
  }
  const sorted = [...perFamily].sort((a, b) => a - b);
  const median = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const quietNone = none.filter((x) => x.f.situation?.quiet).length;
  const L: string[] = [`### 気をつける事の札（決まり t・${heading}）`, ""];
  L.push(
    `札が出た家族 ${rs.length - none.length}/${rs.length}（出なかった ${none.length}・うち静かにする家族 ${quietNone}）。1家族に出た札の種類は中央値 ${median}。筋書きは、出た日に「読んだ」を押す（1日に1枚・端末ごと）。${sampled ? "確かめる日（7日ごと＋節目）だけ見るので、出た日は最大6日遅れる。" : ""}`,
    "",
  );
  const never = CAUTION_IDS.filter((id) => !cards.has(id));
  if (never.length) L.push(`一度も出なかった札: ${never.join("・")}（時期が、出さない日＝お祝い・届けの束・手帳の気づきの日と重なっていないか見る）`, "");
  L.push("| 札 | 種類 | 出た家族 | のべ（人・年） | よく出た時期（その家族で最初に出た時） |", "|---|---|---|---|---|");
  for (const [k, c] of [...cards.entries()].sort((a, b) => b[1].families - a[1].families)) L.push(`| ${k} ${c.title} | ${c.kind} | ${c.families} | ${c.times} | ${top(c.when, 3)} |`);
  L.push("", "家族ごとに最初に出た札（多い順）:", "", "| 時期と札 | 家族 |", "|---|---|");
  for (const [k, v] of [...firstOf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) L.push(`| ${k} | ${v} |`);
  if (firstOf.size > 10) L.push(`| ほか ${firstOf.size - 10}通り | ${[...firstOf.values()].sort((a, b) => b - a).slice(10).reduce((n, v) => n + v, 0)} |`);
  if (none.length && rs.length <= 30) {
    L.push("", "出なかった家族:", "");
    for (const x of none) L.push(`- ${x.r.id} ${x.r.label}${x.f.situation?.quiet ? `（静かにする家族: ${x.f.situation.quiet}）` : ""}`);
  }
  L.push("");
  return L;
}

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
          mode: FULL ? "毎日" : "7日ごと＋節目",
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
    L.push(`1000組（\`population.ts\`・割合と出典は docs/SIM_STATS.md）が、授かった時から使い始めて2歳の誕生日の30日後まで（全国に直すため、どの家族も1000日を全部通す）。のべ ${days.toLocaleString("ja-JP")}日、うち画面を確かめた日 ${checked.toLocaleString("ja-JP")}日（${FULL ? "毎日" : "7日ごと＋節目の日。家族は毎日動く"}）。`);
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
    L.push("", ...cautionLines(popResults, "1000組", !FULL));
    L.push(...holidayLines(popResults, "1000組"));
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
  L.push(...cautionLines(results, "30家族", false));
  L.push(...holidayLines(results, "30家族"));
  L.push("### 家族ごと", "", `| id | 一言 | ${RULE_IDS.join(" | ")} |`, `|---|---|${RULE_IDS.map(() => "---").join("|")}|`);
  for (const x of results) L.push(`| ${x.r.id} | ${x.r.label} | ${RULE_IDS.map((r) => x.marks[r]).join(" | ")} |`);
  L.push("");
  for (const x of results) {
    L.push(`#### ${x.r.id} ${x.r.label}`, "", `使う人: ${x.r.meId}／${x.r.start} 〜 ${x.r.end}（${x.r.days}日）／参謀が最初に出た日: ${Object.entries(x.r.triggersSeen).map(([k, d]) => `${k} ${d}`).join("・") || "無し"}${x.r.startPileWithoutSeed ? `／途中からの済み扱いが無ければ、使い始めた日に期限切れ${x.r.startPileWithoutSeed}件` : ""}`, "");
    {
      const cs = x.r.cautions;
      L.push(`気をつける事の札: ${cs.length ? `のべ${cs.length}回（最初は ${cs[0].date}・${cs[0].at}・${cs[0].meId}「${cs[0].title}」）` : "出ない"}`, "");
    }
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

describe(`① 早送りの検査: 現実の割合から作った1000組（${FULL ? "毎日" : "7日ごと＋節目"}）`, () => {
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
  t6: "判定の言葉（異常・正常・大丈夫・順調・増えすぎ・多い・少ない・注意）を含まない",
  t7: "みな source が seed で、候補（pending）ではない",
  t8: "本物の世帯（kind = real・わが家の mine・アカウントで作った世帯）には何も無い",
  t9: "からだの記録の図（lib/body-series.ts。手帳の画面と同じ関数・家族の声②・プランの B）: 健診の表の行＝今日までの妊婦健診の日の数・今日より後の点が無い・生まれた後は子ごとに線が分かれる（双子は2本）・つらい別れの家族には図を作らない",
} as const;
type TechoRule = keyof typeof TECHO_RULES;
/**
 * 本物の世帯（kind = real）の id の見本。わが家の mine と、アカウントで作った世帯の id（Better Auth の organization の id は
 * 英数字32字・"-" を含まない。乱数なので、ここでは決まった文字で形だけ似せる）。
 * ※ techo-seed の isMadeFamily は今も id の形（demo-・sim-・pop- で始まるか）で決めている。本物の世帯の id は "-" を含まないので
 *   重ならないが、kind で決める形に直すまでは、ここに "pop-1001" のような形の id を入れると落ちる（設計 ⑤の12）
 */
const REAL_LIKE_IDS = ["mine", "family-x", "Xk3v9QpL0aZr7TbN2mWc5HsY8dFj1UeG", "a0b1c2d3e4f5g6h7i8j9k0l1m2n3o4p5"];
const AFTER_BIRTH = new Set(["birth", "newborn", "stool", "postpartum", "growth", "development", "child-checkup", "vaccine"]);
const JUDGE = /異常|正常|大丈夫|順調|増えすぎ|多い|少ない|注意/;
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
  // t9 からだの記録の図（手帳の画面と同じ関数で、作った記録から描く物を数える）
  const body = bodySeries(es, f, today);
  if (hideCounts(f)) {
    if (body !== null) bad.push(`t9 ${today} つらい別れの家族に図がある`);
  } else if (!body) bad.push(`t9 ${today} 図が作られない`);
  else {
    const lmp = lmpFromDue(f.dueDate);
    const dates = new Set(es.filter((e) => e.page === "pregnancy-checkup" && e.date <= today && e.date >= lmp && (!f.birthDate || e.date < f.birthDate)).map((e) => e.date));
    if (body.mother.checkups.length !== dates.size) bad.push(`t9 ${today} 健診の表が${body.mother.checkups.length}行（健診の日は${dates.size}日）`);
    const future = [...body.mother.checkups, ...body.mother.home, ...body.babies.flatMap((b) => b.points)].filter((x) => x.date > today);
    if (future.length) bad.push(`t9 ${today} 今日より後の点が${future.length}個`);
    if (born && body.babies.length !== weightsG.length) bad.push(`t9 ${today} 子の線が${body.babies.length}本（生まれた子は${weightsG.length}人）`);
  }
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
  const count: Record<TechoRule, number> = { t1: 0, t2: 0, t3: 0, t4: 0, t5: 0, t6: 0, t7: 0, t8: 0, t9: 0 };
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

  it("t8 本物の世帯（kind = real）には何も作らない", () => {
    // 本物の世帯: わが家（mine）・アカウントで作った世帯（Better Auth の organization の id ＝ 英数字32字）・形の似た id
    for (const id of REAL_LIKE_IDS) {
      expect(madeHouseholdKind(id), id).toBeNull();
      const real: Family = { ...DEMO_FAMILY, id };
      for (const d of techoDays(real)) expect(seedTecho(real, d), id).toEqual([]);
    }
  });

  it("作った家族の印（techo-seed の isMadeFamily）と世帯の種類（households.kind）が食い違わない", () => {
    const made = [DEMO_FAMILY.id, ...SIM_FAMILIES.map((f) => f.id), ...getPopulation().map((f) => f.id)];
    for (const id of made) {
      expect(madeHouseholdKind(id), id).not.toBeNull();
      expect(isMadeFamily(id), id).toBe(true);
    }
    expect(madeHouseholdKind(DEMO_FAMILY.id)).toBe("demo");
    for (const f of SIM_FAMILIES) expect(madeHouseholdKind(f.id)).toBe("sim");
    for (const f of getPopulation().filter((_, i) => i % 50 === 0)) expect(madeHouseholdKind(f.id)).toBe("sim");
    // 本物の世帯の id は、作った家族の印を持たない（持つと、作った記録が本物の世帯に入る）
    for (const id of REAL_LIKE_IDS) expect(isMadeFamily(id), id).toBe(false);
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
    const pop = rows.filter((r) => isPopulationFamily(r.id));
    const others = rows.filter((r) => !isPopulationFamily(r.id));
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

// ───────── 手帳の記録と今日の画面（手帳を背骨に） ─────────
// 作った家族の手帳の記録（seedTecho = 標準の時期に受けた接種・行った健診）だけで、家族が「済んだ」を押さなくても、
// 今日の画面が済んだ接種・健診を「今やる」「期限切れ」に出さない事を確かめる（/api/done の fromTecho と同じ関数）。
/** 手帳の記録で済みになる予定（2歳まで。作った記録が標準の時期に入る物） */
const TECHO_BACKED = ["vaccines-start", "vaccines-3m", "vaccines-4m", "bcg", "vaccines-7m", "first-birthday-vaccines", "vaccines-18m", "one-month-checkup", "checkup-3-4m", "checkup-9-10m", "checkup-18m"];

describe("① 早送りの検査: 手帳で済んだ接種・健診", () => {
  const families: Family[] = [DEMO_FAMILY, ...SIM_FAMILIES, ...getPopulation().filter((_, i) => i % 10 === 0)].filter((f) => !!f.birthDate);

  it("手帳で済んだ接種・健診を、今やる・期限切れに出さない（生後1か月〜2歳の節目）", () => {
    const bad: string[] = [];
    for (const f of families) {
      const birth = f.birthDate!;
      for (const m of [2, 4, 6, 9, 13, 20, 24]) {
        const day = addDays(addMonths(birth, m), 12);
        const fv = viewAt(f as SimFamily, day);
        const records = seedTecho(f, day);
        const fromTecho = doneFromTecho(records, day);
        for (const t of scheduleFor(fv, day)) {
          const st = statusOf(t, day, fromTecho);
          if (!TECHO_BACKED.includes(t.id)) continue;
          // 手帳に記録がある（作った記録は標準の時期に必ず入る）のに、今やる・期限切れに出たら破れ
          if (fromTecho.has(t.id) && st !== "済み") bad.push(`${f.id} ${day} ${t.id} が ${st}`);
          if (st === "期限切れ") bad.push(`${f.id} ${day}（生後${m}か月）${t.plain} が期限切れ（手帳の記録: ${records.filter((e) => e.page === "vaccine" || e.page === "child-checkup").map((e) => e.title).join("・")}）`);
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it("予防接種の数え直し（第1波⑥）: 標準の時期に打った家族は日がずれず、数え直した日は前の回＋間隔より早くならない", () => {
    const bad: string[] = [];
    for (const f of families) {
      const birth = f.birthDate!;
      for (const m of [2, 3, 4, 6, 9, 13, 20, 24]) {
        const day = addDays(addMonths(birth, m), 12);
        const fv = viewAt(f as SimFamily, day);
        const sched = scheduleFor(fv, day);
        const r = vaxRetime(vaxHistory(seedTecho(f, day), day), sched);
        for (const [id, x] of Object.entries(r)) {
          const base = sched.find((t) => t.id === id)!;
          // 作った記録は標準の時期に入るので、ずれても2週より大きくはならない
          if (diffDays(x.start, base.startDate) > 14) bad.push(`${f.id} ${day} ${id} が ${base.startDate} → ${x.start}（${x.note}）`);
          if (x.start <= x.lastDate) bad.push(`${f.id} ${day} ${id} の最短日 ${x.start} が前の回 ${x.lastDate} より早い`);
        }
      }
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it("2歳の誕生日には、2歳までの接種・健診がみな手帳で済み", () => {
    const bad: string[] = [];
    for (const f of families) {
      const day = secondBirthday(f);
      const done = doneFromTecho(seedTecho(f, day), day);
      for (const id of TECHO_BACKED) if (!done.has(id)) bad.push(`${f.id} ${id}`);
    }
    expect(bad.slice(0, 20)).toEqual([]);
  });

  it("3歳児健診が2歳半からの家族に出る（「まだ先」で日付つき → 3歳で今やる）", () => {
    for (const f of families) {
      const birth = f.birthDate!;
      const half = addMonths(birth, 30);
      const s = scheduleFor(viewAt(f as SimFamily, half), half);
      const c3 = s.find((t) => t.id === "checkup-3y");
      expect(c3, f.id).toBeTruthy();
      expect(statusOf(c3!, half, new Set())).toBe("まだ先");
      expect(c3!.startDate).toBe(addMonths(birth, 36));
      // 今日の画面の「まだ先」に入る（1000日を過ぎた後も、次が見える）
      const tasks = s.map((t) => ({ ...t, status: statusOf(t, half, new Set(s.filter((x) => x.deadlineDate && x.deadlineDate < half).map((x) => x.id))) }));
      expect(planToday(tasks, half, null).upcoming.some((t) => t.id === "checkup-3y"), f.id).toBe(true);
      expect(statusOf(c3!, addDays(addMonths(birth, 36), 1), new Set())).toBe("今やる");
    }
  });
});

// 見本の家族（Techo.tsx の isDemo と同じ組み立て）: 期限を過ぎた手続きは始まりから数日後に出したとみなす（lib/money.ts の demoAppliedOn）。
// 1歳・2歳の誕生日の前後1週間、一番上が「届いたか見る」にならない（2026-11-04 初見の目 L3）
describe("見本の家族の1歳・2歳の一番上", () => {
  it("誕生日の前後1週間、一番上は届いたかの確かめではない", async () => {
    const { demoAppliedOn, isPaidId } = await import("../lib/money");
    const f = DEMO_FAMILY;
    const birth = f.birthDate!;
    const bad: string[] = [];
    for (const age of [12, 24])
      for (let d = -7; d <= 7; d++) {
        const day = addDays(addMonths(birth, age), d);
        const base = scheduleFor(f, day);
        const applied = new Set(base.filter((m) => m.deadlineDate && m.deadlineDate < day).map((m) => m.id));
        const schedule = [...base, ...moneyWatch(base, applied, demoAppliedOn(base, day), birth)];
        const done = new Set(schedule.filter((m) => m.deadlineDate && m.deadlineDate < day).map((m) => m.id));
        const tasks = schedule.map((m) => ({ ...m, status: statusOf(m, day, done) }));
        const top = planToday(tasks, day, f.members[0]).top;
        if (top && isPaidId(top.id)) bad.push(`${day}: ${top.title}`);
      }
    expect(bad).toEqual([]);
  });
});

// 静かにする（つらい別れ・入院）を選んだ家族には、手帳から気づきを出さない（Claude も呼ばない）。
// つらい別れの間は、週数・日数を上の帯にも出さない（lib/situation.ts の hideCounts）
describe("静かにする間の気づきと数", () => {
  it("30家族の loss・nicu の写し: 1000日のどの節目でも、気づきのきっかけが出ない", async () => {
    const { hideCounts } = await import("../lib/situation");
    for (const quiet of ["loss", "nicu"] as const) {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        expect(hideCounts(f), f.id).toBe(quiet === "loss");
        const start = lmpFromDue(f.dueDate);
        for (let i = 0; i <= 1000; i += 7) {
          const day = addDays(start, i);
          expect(detectTriggers({ family: f, today: day, done: new Set(), isDemo: false }), `${f.id} ${quiet} ${day}`).toEqual([]);
        }
      }
      expect(hideCounts(SIM_FAMILIES[0])).toBe(false);
    }
  });

  it("30家族の loss・nicu の写し: 1000日の毎日、母にもパートナーにも気をつける事の札が出ない（決まり t）", () => {
    for (const quiet of ["loss", "nicu"] as const) {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        const start = lmpFromDue(f.dueDate);
        for (let i = 0; i <= 1000; i++) {
          const day = addDays(start, i);
          const fv = viewAt(f, day);
          for (const role of ["母", "パートナー"] as const) expect(cautionFor(fv, day, { ids: [] }, { role, busy: false }), `${f.id} ${quiet} ${role} ${day}`).toBeNull();
        }
      }
    }
  });
});
