// 生まれた日の届けを「役所へ行く日」にまとめる（第1波②）。
// 生まれた日から15日の間、出生届・児童手当・保険・医療証・出生連絡票などを1枚に並べ、順番の理由と、どこに出すか（役所・勤め先・保険が届いたら）を添える。
// 「1回で全部」とは言い切らない: 会社の保険の家族は、医療証に赤ちゃんの保険の資格の書類が要り、勤め先を通して後から届く。
// 画面とサーバの両方で使う純関数（Claude は呼ばない）。
import { addDays, diffDays } from "./clock";
import type { Situation } from "./situation";

export type TripWhere = "役所" | "勤め先" | "保険が届いたら";

/** 束に入れる届けと、その順番の理由（並びがそのまま行く順）。期限は損で脅さず「いつまでに出すと、何が受け取れるか」で言う（総点検 0-6）。
 *  also は、その届けを出す時に一緒にする事（行の中に1行で出す） */
export const BIRTH_TRIP: { id: string; reason: string; also?: string }[] = [
  // 府令様式 p.1「赤ちゃんが生まれたら14日以内に出生届をして、同時に上欄に出生届出済の証明を受けてください。」
  // 生まれてから14日は、お祝いと届けの束の日で気をつける事の札を出さないので、念押しはこの行で（2026-11-05 早送りの検査 t）
  { id: "birth-registration", reason: "戸籍と住民票ができてから、ほかの届けを受け付ける町が多いので最初に", also: "母子手帳も持って行く（1ページ目に出生届出済の証明を受ける・府令様式 p.1）" },
  { id: "health-insurance", reason: "国保の家族は、出生届の後に同じ役所で。会社の保険は勤め先に扶養の届けを頼む" },
  // 児童手当法第8条・第9条（生まれた日の翌日から15日以内に出すと、生まれた月の翌月分から）
  { id: "child-allowance", reason: "生まれた日の翌日から15日以内に出すと、翌月分から受け取れる" },
  { id: "child-allowance-change", reason: "上の子の手当に足す届け。15日以内に出すと、翌月分から増える" },
  // 児童扶養手当法第7条（請求した月の翌月分から）
  { id: "single-child-support", reason: "申し込んだ次の月の分から受け取れるので、早めに" },
  { id: "medical-subsidy", reason: "赤ちゃんの保険の資格が分かる物が要るので、保険の後に" },
  { id: "single-medical", reason: "保険の資格が分かる物が要るので、保険の後に" },
  { id: "birth-notice", reason: "保健師さんの訪問の申し込み。出生届と同じ日に出せる町が多い" },
  { id: "low-birth-weight-report", reason: "出生連絡票と一緒に出せる町が多い" },
  { id: "preterm-medical", reason: "入院中の医療費の助成。病院の意見書をもらってから" },
];

const ORDER = new Map(BIRTH_TRIP.map((x, i) => [x.id, i]));
export const BIRTH_TRIP_IDS = new Set(BIRTH_TRIP.map((x) => x.id));

/** 束を出す日数（生まれた日から。児童手当の15日まで） */
export const TRIP_DAYS = 15;

/** 赤ちゃんが入る健康保険（答えが無ければ働き方から近似。わからなければ undefined） */
export function babyInsuranceOf(s: Situation | undefined): "勤め先" | "国保" | undefined {
  if (s?.babyInsurance) return s.babyInsurance;
  const employed = (w: string | undefined) => w === "会社員・公務員" || w === "パート・派遣";
  if (employed(s?.partnerWork) || employed(s?.motherWork)) return "勤め先";
  const own = (w: string | undefined) => w === "自営・フリー" || w === "仕事なし" || w === "出産で辞める";
  if (own(s?.motherWork) && (s?.partnerWork === undefined ? false : own(s.partnerWork))) return "国保";
  return undefined;
}

/** その届けをどこに出すか */
export function tripWhere(id: string, s: Situation | undefined): TripWhere {
  const ins = babyInsuranceOf(s);
  if (id === "health-insurance") return ins === "国保" ? "役所" : "勤め先";
  if (id === "child-allowance" || id === "child-allowance-change") return s?.publicServant ? "勤め先" : "役所";
  if (id === "medical-subsidy" || id === "single-medical") return ins === "国保" ? "役所" : "保険が届いたら";
  return "役所";
}

export interface TripItem<T> {
  task: T;
  /** 1から */
  step: number;
  reason: string;
  /** その届けを出す時に一緒にする事（BIRTH_TRIP の also） */
  also?: string;
  where: TripWhere;
}

export interface BirthTrip<T> {
  /** 束の期限（出生届の期限＝生まれた日を含めて14日目） */
  deadline: string;
  items: TripItem<T>[];
}

/**
 * 束を作る。生まれた日から15日の間で、まだの届けが2件以上ある時だけ（1件なら、ふつうの1枚で足りる）。
 * tasks は今日の予定（status 付き）。済み・過ぎた・期限切れの物は入れない（期限切れは、ふり返りの箱が受け持つ）
 */
export function planBirthTrip<T extends { id: string; status: string }>(tasks: T[], today: string, birthDate: string | undefined, s: Situation | undefined): BirthTrip<T> | null {
  if (!birthDate || today < birthDate) return null;
  if (diffDays(today, birthDate) > TRIP_DAYS) return null;
  const open = tasks
    .filter((t) => BIRTH_TRIP_IDS.has(t.id) && t.status !== "済み" && t.status !== "過ぎた" && t.status !== "期限切れ")
    .sort((a, b) => ORDER.get(a.id)! - ORDER.get(b.id)!);
  if (open.length < 2) return null;
  const where = (t: T) => tripWhere(t.id, s);
  // 行く順: 役所 → 勤め先 → 保険が届いたら（同じ段の中は理由の順）
  const rank: Record<TripWhere, number> = { 役所: 0, 勤め先: 1, 保険が届いたら: 2 };
  const sorted = [...open].sort((a, b) => rank[where(a)] - rank[where(b)] || ORDER.get(a.id)! - ORDER.get(b.id)!);
  return {
    deadline: addDays(birthDate, 13),
    items: sorted.map((t, i) => {
      const x = BIRTH_TRIP.find((b) => b.id === t.id)!;
      return { task: t, step: i + 1, reason: x.reason, ...(x.also ? { also: x.also } : {}), where: where(t) };
    }),
  };
}

/** 束の中で、担当と期限を見るための形（今日の画面の Task の一部） */
export interface TripTask {
  id: string;
  status: string;
  who: string;
  deadlineDate?: string;
  deadlineKind?: "期限" | "目安";
}

/** 法の期限（目安ではない期限）がある事か。milestones.ts の deadlineKindOf と同じ（milestones.ts がこのファイルを読むので、ここで書く） */
const legal = (t: TripTask) => !!t.deadlineDate && (t.deadlineKind ?? "期限") === "期限";

/** 届けのうち、いちばん近い法の期限（同じ日なら行く順）。目安の届けしか無ければ null */
export function tripDue<T extends TripTask>(tasks: T[], today: string): { task: T; date: string; left: number } | null {
  const t = tasks.filter(legal).sort((a, b) => a.deadlineDate!.localeCompare(b.deadlineDate!) || (ORDER.get(a.id) ?? 99) - (ORDER.get(b.id) ?? 99))[0];
  return t ? { task: t, date: t.deadlineDate!, left: diffDays(t.deadlineDate!, today) } : null;
}

/** 法の期限までこの日数を切ったら、たたんだ1行を「声をかける文を作る」に変える */
export const NUDGE_DAYS = 5;

export interface TripFold<T> {
  /** たたんだ届け（まだの物。束の順） */
  items: T[];
  /** 担当の役 */
  who: string;
  /** その人の番の届けのうち、済んだ数と全部の数（過ぎた・期限切れは数えない） */
  done: number;
  total: number;
  /** たたんだ届けの、いちばん近い法の期限 */
  due: { task: T; date: string; left: number } | null;
  /** 期限まで5日を切った（声をかける文を作る） */
  nudge: boolean;
}

/**
 * 母の画面で、届けの束を1行にたたむか（UX の見直し C08: 生まれた翌日の母の画面を軽く）。
 * たたむのは、パートナーのいる家族で、束の届けを誰が出すかを決め終え（「家族」＝まだ決めていない・2人で、が残っていない）、
 * パートナーの番の届けがある時だけ。母の番の届け（出生連絡票など）は、たたまずに母の一番上へ回す。
 */
export function foldTrip<T extends TripTask>(trip: BirthTrip<T>, tasks: T[], meRole: string | undefined, hasPartner: boolean, today: string): TripFold<T> | null {
  if (meRole !== "母" || !hasPartner) return null;
  const open = trip.items.map((i) => i.task);
  if (open.some((t) => t.who === "家族")) return null;
  const items = open.filter((t) => t.who !== meRole);
  if (items.length === 0) return null;
  const who = items[0].who;
  const done = tasks.filter((t) => BIRTH_TRIP_IDS.has(t.id) && t.who === who && t.status === "済み").length;
  const due = tripDue(items, today);
  return { items, who, done, total: done + items.length, due, nudge: !!due && due.left >= 0 && due.left < NUDGE_DAYS };
}

export interface TripScreen<T> {
  /** 束を一番上の1枚にする（一番上の札を重ねない。自分の番の最初の届けの窓口と書く事は、束の中で用意する） */
  full: boolean;
  /** 母の画面で1行にたたむ届け */
  fold: TripFold<T> | null;
  /**
   * 一番上の事。束を開く時は、束のうち自分の番（「家族」を含む）の最初の届け（行く順。無ければ null）。
   * たたむ時はその人の今日の一番上で、無ければ null＝休む札
   */
  top: T | null;
  /** このあと（束に入れた事・たたんだ事は出さない） */
  rest: T[];
}

/**
 * 生まれた日から15日の間の、今日の画面の上の方の決め方（UX の見直し C08）。
 * - 束が自分の番の画面（パートナー・ひとりの家族・母が行く家族）と、まだ誰が行くか決めていない家族: 束を一番上の1枚に。出生届を2回出さない。
 *   一番上の事（束の中で開いて用意する1件）は、束のうち自分の番の最初の届け（行く順の先頭が母の出生連絡票の日に、パートナーの一番上を母の事にしない）
 * - 母の画面で、届けをパートナーの番に決めた時: 一番上は母の今日の一番上（planToday の top）。パートナーの番の届けは1行にたたむ
 * plan は同じ人の planToday（top と rest）。meRole が無い時（使う人を決めていない）は、束の1件目
 */
export function tripScreen<T extends TripTask>(
  trip: BirthTrip<T> | null,
  tasks: T[],
  plan: { top: T | null; rest: T[] },
  meRole: string | undefined,
  hasPartner: boolean,
  today: string,
): TripScreen<T> | null {
  if (!trip) return null;
  const fold = foldTrip(trip, tasks, meRole, hasPartner, today);
  const hidden = new Set((fold ? fold.items : trip.items.map((i) => i.task)).map((t) => t.id));
  const mine = (t: T) => !meRole || t.who === "家族" || t.who === meRole;
  const top = fold ? (plan.top && !hidden.has(plan.top.id) ? plan.top : null) : (trip.items.map((i) => i.task).find(mine) ?? null);
  const rest = [plan.top, ...plan.rest].filter((t): t is T => !!t && !hidden.has(t.id) && t.id !== top?.id);
  return { full: !fold, fold, top, rest };
}

/** 持ち物の言い方の揺れをそろえる（Claude は使わない。書かれていない物は足さない） */
const SAME: [RegExp, string][] = [
  [/^母子(健康)?手帳.*/, "母子手帳"],
  [/^(印鑑|認印|はんこ).*/, "印鑑（認印）"],
  [/^(マイナンバーカード|個人番号カード|マイナンバー).*/, "マイナンバーカード（個人番号が分かる物）"],
  [/^(保険証|健康保険証|資格確認書|マイナ保険証).*/, "保険の資格が分かる物（マイナ保険証・資格確認書）"],
  [/^(本人確認|運転免許).*/, "本人確認の書類"],
  [/^(通帳|口座|キャッシュカード).*/, "振込先の口座が分かる物"],
  [/^出生届.*/, "出生届（出生証明書の欄は産院が書く）"],
];

function norm(item: string): string {
  const t = item.normalize("NFKC").replace(/[（(].*?[）)]/g, "").trim();
  for (const [re, name] of SAME) if (re.test(t)) return name;
  return item.trim();
}

/** 調べた届けの持ち物を合わせる。どの届けの分かを残す（同じ物は1行に） */
export function mergeBring(locals: { title: string; bring: string[] }[]): { item: string; for: string[] }[] {
  const map = new Map<string, Set<string>>();
  for (const l of locals) {
    for (const b of l.bring) {
      if (!b.trim()) continue;
      const k = norm(b);
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(l.title);
    }
  }
  return [...map.entries()].map(([item, f]) => ({ item, for: [...f] }));
}
