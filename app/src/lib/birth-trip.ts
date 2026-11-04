// 生まれた日の届けを「役所へ行く日」にまとめる（第1波②）。
// 生まれた日から15日の間、出生届・児童手当・保険・医療証・出生連絡票などを1枚に並べ、順番の理由と、どこに出すか（役所・勤め先・保険が届いたら）を添える。
// 「1回で全部」とは言い切らない: 会社の保険の家族は、医療証に赤ちゃんの保険の資格の書類が要り、勤め先を通して後から届く。
// 画面とサーバの両方で使う純関数（Claude は呼ばない）。
import { addDays, diffDays } from "./clock";
import type { Situation } from "./situation";

export type TripWhere = "役所" | "勤め先" | "保険が届いたら";

/** 束に入れる届けと、その順番の理由（並びがそのまま行く順） */
export const BIRTH_TRIP: { id: string; reason: string }[] = [
  { id: "birth-registration", reason: "戸籍と住民票ができてから、ほかの届けを受け付ける町が多いので最初に" },
  { id: "health-insurance", reason: "国保の家族は、出生届の後に同じ役所で。会社の保険は勤め先に扶養の届けを頼む" },
  { id: "child-allowance", reason: "生まれた日の翌日から15日を過ぎると、遅れた月の分が戻らない" },
  { id: "child-allowance-change", reason: "上の子の手当に足す届け。15日を過ぎると、遅れた月の分が戻らない" },
  { id: "single-child-support", reason: "申し込んだ次の月の分から。さかのぼらないので早めに" },
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
    items: sorted.map((t, i) => ({ task: t, step: i + 1, reason: BIRTH_TRIP.find((x) => x.id === t.id)!.reason, where: where(t) })),
  };
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
