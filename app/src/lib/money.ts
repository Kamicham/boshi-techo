/**
 * お金の1000日: 出したお金の手続きが、届くまでを見張る。
 * 申請を「済んだ」にすると、その手続きが「届いたか確かめる」1件（id は paid-〈申請の id〉）に変わる。
 * 届く見込みの窓を過ぎても「済んだ」（＝届いた）が無ければ、期限切れとして確かめ先を出す。額は出さない・もらえるかの判断はしない。
 * 見込みは近似（町・健康保険・ハローワークで違う）。出典と年は basis に残す。
 */
import { addDays, addMonths } from "./clock";
import { endOfMonth } from "./leave-money";
import type { Milestone, MilestoneDef } from "./milestones";

export interface MoneyDef {
  /** 画面の短い呼び名 */
  name: string;
  /** 今日の画面の題に使う短い呼び名（無ければ name） */
  short?: string;
  /** 確かめ先 */
  ask: string;
  /** 申請から何日〜何日で届く見込みか（児童手当は振込の月で数えるので無し） */
  window?: [number, number];
  basis: string;
}

export const MONEY: Record<string, MoneyDef> = {
  "pregnancy-support-2": { name: "支援給付の2回目", ask: "町の窓口", window: [30, 60], basis: "妊婦のための支援給付（子ども・子育て支援法・2025年4月から）。振込は申請から1〜2か月ほど（町ごとに違う・近似）" },
  "maternity-allowance-apply": { name: "出産手当金", ask: "勤め先か健康保険", window: [30, 60], basis: "出産手当金（健康保険法第102条）。振込は申請から1〜2か月ほど（健康保険ごとに違う・近似）" },
  "childcare-benefit-first": { name: "育休の給付の初回", short: "育休の給付", ask: "勤め先かハローワーク", window: [14, 45], basis: "育児休業給付（雇用保険法第61条の7）。勤め先がハローワークに申請し、支給が決まってから1週間ほどで振り込まれる（近似）。2025年4月からの出生後休業支援給付（同法第61条の10）も一緒に届く事が多い" },
  "partner-childcare-benefit": { name: "パパの育休の給付", ask: "パパの勤め先", window: [14, 45], basis: "出生時育児休業給付・出生後休業支援給付（雇用保険法第61条の8・第61条の10）。支給が決まってから1週間ほどで振り込まれる（近似）" },
  "child-allowance": { name: "児童手当の最初の振込", short: "児童手当", ask: "町の窓口", basis: "公務員は勤め先に確かめる。児童手当法第8条（申請の月の翌月分から。生まれた日の翌日から15日以内なら生まれた月の翌月分から）。2024年10月から、振込は偶数月の年6回で、前の2か月分（振込の日は町ごと）" },
  "lump-sum-diff": { name: "一時金の差額", ask: "健康保険", window: [30, 60], basis: "出産育児一時金（健康保険法第101条）。直接支払で費用が一時金より少なかった時の差額。振込は申請から1〜2か月ほど（近似）" },
  "medical-deduction": { name: "医療費控除の還付", ask: "税務署", window: [30, 45], basis: "医療費控除（所得税法第73条）。確定申告の還付は、申告から1か月〜1か月半ほど（国税庁・e-Tax はもう少し早い事が多い・近似）" },
};

/** 届いたか確かめる1件の id */
export const paidId = (src: string) => `paid-${src}`;
export const isPaidId = (id: string) => id.startsWith("paid-") && id.slice(5) in MONEY;

/** 児童手当の最初の振込の月（YYYY-MM-01）。申請の日と生まれた日から */
export function childAllowanceFirstPay(applied: string, birth?: string): string {
  // 生まれた日の翌日から15日以内に申請すれば、生まれた月の翌月分から（児童手当法第8条第3項）
  const from = birth && applied <= addDays(birth, 15) ? birth : applied;
  const first = addMonths(`${from.slice(0, 7)}-01`, 1);
  const m = Number(first.slice(5, 7));
  return addMonths(first, m % 2 === 1 ? 1 : 2);
}

/** 届く見込みの窓（申請の日から） */
export function payWindow(src: string, applied: string, birth?: string): { start: string; deadline: string } | null {
  const d = MONEY[src];
  if (!d) return null;
  if (src === "child-allowance") {
    const pay = childAllowanceFirstPay(applied, birth);
    return { start: pay, deadline: endOfMonth(pay) };
  }
  if (!d.window) return null;
  return { start: addDays(applied, d.window[0]), deadline: addDays(applied, d.window[1]) };
}

/** 届いたか確かめる1件の骨組み（下書きの口が id から引けるように、日付の無い形も出す） */
export function paidDef(src: string): MilestoneDef | null {
  const d = MONEY[src];
  if (!d) return null;
  return {
    id: paidId(src),
    title: `${d.name}が届いたか確かめる（届く時期を過ぎたら${d.ask}に確かめる）`,
    plain: `${d.short ?? d.name}が届いたか見る`,
    hint: `届いたら「済んだ」。まだなら${d.ask}に`,
    kind: "手続き",
    who: "家族",
    anchor: "birth",
    start: { days: 0 },
    deadlineKind: "目安",
    basis: `${d.basis}。額は手帳に残さない。届かない時は、遅れの理由を決めつけず確かめ先に聞く`,
    needsLocal: false,
  };
}

/**
 * 申請が済んだお金の手続きから、「届いたか確かめる」の件を作る。
 * appliedOn: 申請を済んだにした日（無ければ申請の期限の日、それも無ければ始まりの日で置く＝近似）
 */
export function moneyWatch(schedule: Milestone[], done: Set<string>, appliedOn: Record<string, string>, birth?: string): Milestone[] {
  const out: Milestone[] = [];
  for (const m of schedule) {
    if (!(m.id in MONEY) || !done.has(m.id)) continue;
    const applied = appliedOn[m.id] ?? m.deadlineDate ?? m.startDate;
    const w = payWindow(m.id, applied, birth);
    const def = paidDef(m.id);
    if (!w || !def) continue;
    out.push({ ...def, startDate: w.start, deadlineDate: w.deadline });
  }
  return out;
}
