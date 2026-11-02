// 全国共通の「その時やる事」の骨組み。
// ここには法律・国の目安で決まっている物だけを置く。町ごとに違う中身（窓口・持ち物・助成の額）は、
// その家族の町についてエージェントが取りに行く（needsLocal = true の物）。

import { addDays, addMonths, lmpFromDue, type FamilyDates } from "./clock";

export type Kind = "手続き" | "健診" | "仕事" | "準備" | "記録";
export type Who = "家族" | "母" | "パートナー" | "祖父母";

export interface MilestoneDef {
  id: string;
  /** 正式な言い方（下書き・調べ物・Why の中で使う） */
  title: string;
  /** やさしい見出し（中学生が読める・画面の表に出す） */
  plain: string;
  /** 一言の説明（1行まで） */
  hint: string;
  kind: Kind;
  who: Who;
  /** 何を起点に数えるか */
  anchor: "lmp" | "birth";
  /** 起点から何日目（または何か月目）に「起きる」か */
  start: { days?: number; months?: number };
  /** 期限（ある物だけ） */
  deadline?: { days?: number; months?: number };
  /** 期限の根拠（家族に見せる） */
  basis: string;
  /** 町ごとに中身が違い、取りに行く必要がある */
  needsLocal: boolean;
}

const w = (weeks: number) => ({ days: weeks * 7 });

export const MILESTONES: MilestoneDef[] = [
  // ── 妊娠中 ──
  { id: "pregnancy-report", title: "妊娠の届出と母子健康手帳の受け取り", plain: "役所に妊娠を届ける", hint: "母子手帳と、健診の補助券がもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(6), deadline: w(11), basis: "母子保健法第15条（期限の定めはなく、11週までが目安）", needsLocal: true },
  { id: "checkup-plan", title: "妊婦健診の予定を立てる（23週まで4週ごと）", plain: "妊婦健診の予定を立てる", hint: "23週までは4週に1回が目安", kind: "健診", who: "母", anchor: "lmp", start: w(8), basis: "国の標準的な健診の回数（14回）", needsLocal: false },
  { id: "tell-work", title: "職場に妊娠を伝え、産休・育休の段取りを相談する", plain: "職場に妊娠を伝える", hint: "産休・育休の段取りを一緒に決めます", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(20), basis: "目安（安定期のころ）", needsLocal: false },
  { id: "partner-leave", title: "パートナーの育休（産後パパ育休）を職場に相談する", plain: "パパの育休を職場に伝える", hint: "産後すぐ休むなら、予定日の2週間前までに", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, basis: "育児・介護休業法（産後パパ育休の申し出は原則2週間前まで。予定日から休むなら予定日の2週間前）", needsLocal: false },
  { id: "checkup-biweekly", title: "健診が2週ごとになる（24〜35週）", plain: "健診が2週に1回になる", hint: "24週から35週まで", kind: "健診", who: "母", anchor: "lmp", start: w(24), basis: "国の標準的な健診の回数", needsLocal: false },
  { id: "direct-payment", title: "出産育児一時金の直接支払制度の書類を産院で出す", plain: "出産のお金の書類を産院に出す", hint: "退院の時に大きなお金を払わずにすみます", kind: "手続き", who: "母", anchor: "lmp", start: w(30), deadline: w(36), basis: "健康保険法（出産育児一時金50万円）", needsLocal: false },
  { id: "maternity-leave", title: "産前休業が始められる（予定日の6週前）", plain: "産休に入れる", hint: "予定日の6週前から休めます", kind: "仕事", who: "母", anchor: "lmp", start: { days: 280 - 42 }, basis: "労働基準法第65条", needsLocal: false },
  { id: "checkup-weekly", title: "健診が毎週になる（36週から）", plain: "健診が毎週になる", hint: "36週から", kind: "健診", who: "母", anchor: "lmp", start: w(36), basis: "国の標準的な健診の回数", needsLocal: false },
  { id: "hospital-bag", title: "入院の持ち物をそろえる", plain: "入院の荷物をまとめる", hint: "陣痛が来たら、すぐ出られるように", kind: "準備", who: "家族", anchor: "lmp", start: w(34), deadline: w(36), basis: "目安", needsLocal: false },

  // ── 生まれてから ──
  { id: "birth-registration", title: "出生届を出す", plain: "出生届を出す", hint: "生まれた日から14日以内", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 0 }, deadline: { days: 13 }, basis: "戸籍法第49条（生まれた日を含めて14日以内）", needsLocal: true },
  { id: "child-allowance", title: "児童手当を申請する", plain: "児童手当を申し込む", hint: "遅れると、その月の分がもらえません", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法（生まれた日の翌日から15日以内に申請すると、翌月分から受け取れる）", needsLocal: true },
  { id: "health-insurance", title: "赤ちゃんを健康保険に入れる", plain: "赤ちゃんの保険証を作る", hint: "1か月健診までに", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, basis: "1か月健診までが目安", needsLocal: false },
  { id: "medical-subsidy", title: "子ども医療費助成の受給者証を申請する", plain: "子どもの医療費助成を申し込む", hint: "病院代の助成が受けられます", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, basis: "町の制度（保険証が届いたら）", needsLocal: true },
  { id: "birth-notice", title: "出生連絡票（新生児訪問の申し込み）を出す", plain: "出生連絡票を出す", hint: "保健師さんが家に来てくれます", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, basis: "母子保健法第11条（新生児訪問）", needsLocal: true },
  { id: "tell-work-birth", title: "職場に出産の報告と育休の開始を伝える", plain: "職場に生まれた事を伝える", hint: "育休の始まりも一緒に", kind: "仕事", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, basis: "目安", needsLocal: false },
  { id: "one-month-checkup", title: "1か月健診", plain: "1か月健診", hint: "ママと赤ちゃん、両方みてもらいます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, basis: "国の目安", needsLocal: false },
  { id: "vaccines-start", title: "予防接種が始まる（生後2か月）", plain: "予防接種を始める", hint: "生後2か月から。予約が要ります", kind: "健診", who: "家族", anchor: "birth", start: { months: 2 }, basis: "予防接種法（定期接種の標準的な開始時期）", needsLocal: true },
  { id: "home-visit", title: "乳児家庭全戸訪問（こんにちは赤ちゃん訪問）", plain: "赤ちゃん訪問を受ける", hint: "町の人が家に来てくれます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, deadline: { months: 4 }, basis: "児童福祉法（生後4か月まで）", needsLocal: true },
  { id: "checkup-3-4m", title: "3〜4か月健診", plain: "3〜4か月健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 5 }, basis: "町の乳幼児健診", needsLocal: true },
  { id: "daycare-research", title: "保育園の情報を集め、見学の予約をする", plain: "保育園を調べて、見学を申し込む", hint: "申し込みの時期は町ごとに違います", kind: "準備", who: "家族", anchor: "birth", start: { months: 4 }, basis: "町ごとに申込の時期が違う", needsLocal: true },
  { id: "first-birthday-vaccines", title: "1歳の予防接種（麻しん風しんなど）", plain: "1歳の予防接種", hint: "麻しん・風しんなど", kind: "健診", who: "家族", anchor: "birth", start: { months: 12 }, deadline: { months: 24 }, basis: "予防接種法", needsLocal: true },
  { id: "checkup-18m", title: "1歳6か月健診", plain: "1歳半健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 24 }, basis: "母子保健法第12条", needsLocal: true },
  { id: "the-book", title: "1000日の一冊を作る", plain: "1000日の一冊を作る", hint: "記録と声を、一冊にまとめます", kind: "記録", who: "家族", anchor: "birth", start: { months: 24 }, basis: "この手帳の約束", needsLocal: false },
];

export interface Milestone extends MilestoneDef {
  startDate: string;
  deadlineDate?: string;
}

function resolve(base: string, off: { days?: number; months?: number }): string {
  return addDays(addMonths(base, off.months ?? 0), off.days ?? 0);
}

/** 家族の日付に当てはめる。生まれていなければ、生まれてからの物は予定日で仮置きする */
export function scheduleFor(f: FamilyDates): Milestone[] {
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  return MILESTONES.map((m) => {
    const base = m.anchor === "lmp" ? lmp : birth;
    return {
      ...m,
      startDate: resolve(base, m.start),
      deadlineDate: m.deadline ? resolve(base, m.deadline) : undefined,
    };
  }).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export type Status = "まだ先" | "今やる" | "期限が近い" | "期限切れ" | "済み" | "過ぎた";

/** 期限の無い事（健診の回数が変わる、など）を「今」に出しておく日数 */
export const OPEN_WINDOW_DAYS = 14;

/** その事が「今」でなくなる日（期限、無ければ始まりから14日） */
export function endOf(m: Milestone): string {
  return m.deadlineDate ?? addDays(m.startDate, OPEN_WINDOW_DAYS);
}

/** 今日の時点での状態 */
export function statusOf(m: Milestone, today: string, done: Set<string>): Status {
  if (done.has(m.id)) return "済み";
  if (today < m.startDate) return "まだ先";
  if (!m.deadlineDate && today > endOf(m)) return "過ぎた";
  if (m.deadlineDate) {
    if (today > m.deadlineDate) return "期限切れ";
    const left = (Date.parse(m.deadlineDate) - Date.parse(today)) / 86_400_000;
    if (left <= 3) return "期限が近い";
  }
  return "今やる";
}
