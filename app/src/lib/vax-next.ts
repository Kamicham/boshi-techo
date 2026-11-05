// 予防接種の次の回を、打った日から数え直す（第1波⑥）。
// 予定の表は月齢で固定だが、1回遅れると後ろが全部ずれる。手帳の接種の記録（日付）から、次の回の「打てる最短日」を出し、
// 予定の始まりの日をそれより早くしない。id は変えない（済み・下書き・状態はそのまま動く）。
// 公費（定期接種）で受けられる年齢の期限（予防接種法施行令第3条の表。期限の行）は動かさない。越える見込みは確かめる先を添えるだけ（applyRetime）。
// 間隔は定期接種実施要領（厚生労働省・2024年改正）・予防接種法施行令による。「27日以上」は中27日なので、打てる最短日は前の日＋28日。
// 体の判断はしない。標準から外れて始めた子の回数の変化（肺炎球菌・五種混合）は数えず、「小児科で確かめる」と添える。
// 画面とサーバの両方で使う純関数。
import { addDays, addMonths } from "./clock";
import { currentLang, t } from "./i18n";
import { deadlineKindOf } from "./milestones";
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

/** 月と日（日本語・中文は「11月5日」、English は「Nov 5」） */
function monthDay(iso: string): string {
  const [, mo, da] = iso.split("-").map(Number);
  if (currentLang() === "en") return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(Date.UTC(2000, mo - 1, da));
  return `${mo}月${da}日`;
}

/**
 * なぜその日か（例: 11月5日のB型肝炎1回目から中27日・11月1日の水ぼうそう1回目から3か月）。
 * サーバ（app/api/done）は頼みの言葉の withLang の中で呼ぶ。名前は回の数を外した物を辞書で引く
 */
function retimeWords(n: Need, prev: string): string {
  const vars = { date: monthDay(prev), vaccine: t(n.label.replace(/\d回目|の追加/, "")), dose: n.from };
  return n.months ? t("{date}の{vaccine}{dose}回目から{n}か月", { ...vars, n: n.months }) : t("{date}の{vaccine}{dose}回目から中{n}日", { ...vars, n: (n.days ?? 0) - 1 });
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
      out[m.id] = { start: best.date, note: retimeWords(best.need, best.prev), doses, lastDate: best.prev, ...((best.facility ?? fac) ? { lastFacility: best.facility ?? fac } : {}) };
    }
  }
  return out;
}

/** 公費（定期接種）で受けられる年齢の期限を過ぎる見込みの一言（判断はしない。確かめる先だけ添える） */
function beyondPublicWord(deadline: string): string {
  return t("公費で受けられる年齢（{date}まで）を過ぎる見込み。小児科・保健センターに確かめる", { date: monthDay(deadline) });
}

/**
 * 予定に当てはめる: 始まりを最短日に。
 * - 目安の行（標準の時期。vaccines-3m など）: 期限も同じ幅だけ後ろへ（期限より始まりが遅くならないように）
 * - 期限の行（deadlineKindOf が「期限」＝B型肝炎の3回目・水痘の2回目）: 期限は公費で受けられる年齢の上限（予防接種法施行令第3条の表）なので動かさない。
 *   数え直した始まりがその日を越える時は、始まりはそのまま出し、retimeNote に「公費で受けられる年齢（◯月◯日まで）を過ぎる見込み」と確かめる先を足し、beyondPublic を付ける
 */
export function applyRetime<T extends { id: string; startDate: string; deadlineDate?: string; deadlineKind?: "目安" | "期限" }>(schedule: T[], r: Record<string, Retime>): T[] {
  return schedule.map((m) => {
    const x = r[m.id];
    if (!x) return m;
    const retime = { doses: x.doses, lastDate: x.lastDate, lastFacility: x.lastFacility };
    if (deadlineKindOf(m) === "期限") {
      const beyond = !!m.deadlineDate && x.start > m.deadlineDate;
      return { ...m, startDate: x.start, retimeNote: beyond ? `${x.note}${currentLang() === "en" ? ". " : "。"}${beyondPublicWord(m.deadlineDate!)}` : x.note, retime, ...(beyond ? { beyondPublic: true } : {}) };
    }
    const shift = Math.round((Date.parse(x.start) - Date.parse(m.startDate)) / 86_400_000);
    return { ...m, startDate: x.start, deadlineDate: m.deadlineDate ? addDays(m.deadlineDate, shift) : undefined, retimeNote: x.note, retime };
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
