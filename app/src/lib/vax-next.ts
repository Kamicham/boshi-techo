// 予防接種の次の回を、打った日から数え直す（第1波⑥）。
// 予定の表は月齢で固定だが、1回遅れると後ろが全部ずれる。手帳の接種の記録（日付）から、次の回の「打てる最短日」を出し、
// 予定の始まりの日をそれより早くしない。id は変えない（済み・下書き・状態はそのまま動く）。
// 間隔は定期接種実施要領（厚生労働省・2024年改正）・予防接種法施行令による。「27日以上」は中27日なので、打てる最短日は前の日＋28日。
// 体の判断はしない。標準から外れて始めた子の回数の変化（肺炎球菌・五種混合）は数えず、「小児科で確かめる」と添える。
// 画面とサーバの両方で使う純関数。
import { addDays, addMonths } from "./clock";
import type { Vax } from "./techo-done";

type Hist = Map<Vax, { n: number; date: string; facility?: string }[]>;

interface Need {
  kind: Vax;
  /** この回を打つ */
  dose: number;
  /** 前の回（何回目）から数える */
  from: number;
  days?: number;
  months?: number;
  /** 家族に見せる名前 */
  label: string;
}

/** 予定の id → その日に打つ物と、前の回からの間隔 */
const NEEDS: Record<string, Need[]> = {
  "vaccines-3m": [
    { kind: "hepb", dose: 2, from: 1, days: 28, label: "B型肝炎2回目" },
    { kind: "pcv", dose: 2, from: 1, days: 28, label: "小児用肺炎球菌2回目" },
    { kind: "five", dose: 2, from: 1, days: 21, label: "五種混合2回目" },
    { kind: "rota", dose: 2, from: 1, days: 28, label: "ロタ2回目" },
  ],
  "vaccines-4m": [
    { kind: "pcv", dose: 3, from: 2, days: 28, label: "小児用肺炎球菌3回目" },
    { kind: "five", dose: 3, from: 2, days: 21, label: "五種混合3回目" },
  ],
  "vaccines-7m": [{ kind: "hepb", dose: 3, from: 1, days: 140, label: "B型肝炎3回目" }],
  "five-booster": [{ kind: "five", dose: 4, from: 3, months: 6, label: "五種混合の追加" }],
  "vaccines-18m": [{ kind: "var", dose: 2, from: 1, months: 3, label: "水ぼうそう2回目" }],
  "je-vaccine-1-booster": [{ kind: "je", dose: 3, from: 2, months: 6, label: "日本脳炎の追加" }],
};

/** 間隔の言い方（中27日・6か月など） */
function gapWord(n: Need): string {
  return n.months ? `${n.months}か月` : `中${(n.days ?? 0) - 1}日`;
}

export interface Retime {
  /** 打てる最短日（予定の表の日より遅い時だけ） */
  start: string;
  /** なぜその日か（例: 11月5日のB型肝炎1回目から中27日） */
  note: string;
  /** 打つ物 */
  doses: string[];
  /** 前の回（数えた元） */
  lastDate: string;
  lastFacility?: string;
}

/** 予定の id ごとに、表の日より遅らせる日（記録が無い・遅れていない時は入れない） */
export function vaxRetime(hist: Hist, schedule: { id: string; startDate: string }[]): Record<string, Retime> {
  const out: Record<string, Retime> = {};
  for (const m of schedule) {
    const needs = NEEDS[m.id];
    if (!needs) continue;
    let best: { date: string; need: Need; prev: string; facility?: string } | null = null;
    const doses: string[] = [];
    let fac: string | undefined;
    for (const n of needs) {
      const list = hist.get(n.kind) ?? [];
      if (list.some((x) => x.n >= n.dose)) continue; // もう打った
      const prev = list.find((x) => x.n === n.from);
      if (!prev) continue; // 前の回の記録が無い（数えられない）
      doses.push(n.label);
      fac = fac ?? prev.facility;
      const d = n.months ? addMonths(prev.date, n.months) : addDays(prev.date, n.days ?? 0);
      if (!best || d > best.date) best = { date: d, need: n, prev: prev.date, facility: prev.facility };
    }
    if (best && best.date > m.startDate) {
      const [, mo, da] = best.prev.split("-").map(Number);
      out[m.id] = { start: best.date, note: `${mo}月${da}日の${best.need.label.replace(/\d回目|の追加/, "")}${best.need.from}回目から${gapWord(best.need)}`, doses, lastDate: best.prev, ...((best.facility ?? fac) ? { lastFacility: best.facility ?? fac } : {}) };
    }
  }
  return out;
}

/** 予定に当てはめる: 始まりを最短日に、期限は同じ幅だけ後ろへ（期限より始まりが遅くならないように） */
export function applyRetime<T extends { id: string; startDate: string; deadlineDate?: string }>(schedule: T[], r: Record<string, Retime>): T[] {
  return schedule.map((m) => {
    const x = r[m.id];
    if (!x) return m;
    const shift = Math.round((Date.parse(x.start) - Date.parse(m.startDate)) / 86_400_000);
    return { ...m, startDate: x.start, deadlineDate: m.deadlineDate ? addDays(m.deadlineDate, shift) : undefined, retimeNote: x.note, retime: { doses: x.doses, lastDate: x.lastDate, lastFacility: x.lastFacility } };
  });
}

/** 予約の電話メモ（Claude を呼ばずに組み立てる。体の言葉は入れない。電話番号は作らない） */
export function callMemo(o: { childName?: string; birthDate?: string; plain: string; start: string; doses: string[]; lastDate?: string; lastFacility?: string }): string {
  const jp = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return `${y}年${m}月${d}日`;
  };
  return [
    `予防接種の予約の電話メモ`,
    `子の名前: ${o.childName || "（子の名前）"}${o.birthDate ? `（${jp(o.birthDate)}生まれ）` : ""}`,
    `受けたい物: ${o.doses.length ? o.doses.join("・") : o.plain}`,
    `打てる最短日: ${jp(o.start)}から`,
    o.lastDate ? `前回: ${jp(o.lastDate)}${o.lastFacility ? `（${o.lastFacility}）` : ""}` : "",
    "持ち物: 母子手帳・予診票・保険の資格が分かる物・子どもの医療証（町で確かめる）",
    "回数や間隔が標準と違う時は、小児科で確かめる",
  ]
    .filter(Boolean)
    .join("\n");
}
