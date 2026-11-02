// ⑥ 家族が育てる地図: 町ごとの「窓口の知恵」。
// 町の中の家族で共有するので、family_id は `city:${city}` に置く（個人を特定できる事は入れない）。
import "server-only";
import { get, list, put, type Doc } from "./db";

export interface Wisdom {
  city: string;
  place: string;
  milestoneId: string | null;
  tip: string;
  /** 確かめた家族の数 */
  confirmations: number;
  /** 確かめた家族（同じ家族が二度数えないため。手帳の id だけ） */
  confirmedBy: string[];
  lastConfirmed: string;
  /** デモ用の種（実在の窓口の情報ではない） */
  demo: boolean;
}

export type WisdomDoc = Doc<Wisdom>;

export const cityKey = (city: string) => `city:${city}`;

/** 町の知恵。milestoneId を渡すと、その手続きの物だけ。確かめた数の多い順 */
export function wisdomFor(city: string, milestoneId?: string): WisdomDoc[] {
  return list<Wisdom>(cityKey(city), "wisdom")
    .filter((d) => !milestoneId || d.data.milestoneId === milestoneId)
    .sort((a, b) => b.data.confirmations - a.data.confirmations || b.data.lastConfirmed.localeCompare(a.data.lastConfirmed));
}

export function addWisdom(w: Omit<Wisdom, "confirmations" | "confirmedBy" | "lastConfirmed" | "demo">, familyId: string, today: string): WisdomDoc {
  return put<Wisdom>(cityKey(w.city), "wisdom", { ...w, confirmations: 1, confirmedBy: [familyId], lastConfirmed: today, demo: false }, { date: today });
}

/** 「私も確かめた」。同じ家族は1回だけ数える */
export function confirmWisdom(id: string, familyId: string, today: string): { doc: WisdomDoc; already: boolean } | null {
  const cur = get<Wisdom>(id);
  if (!cur || cur.type !== "wisdom") return null;
  if (cur.data.confirmedBy.includes(familyId)) return { doc: cur, already: true };
  const data: Wisdom = {
    ...cur.data,
    confirmations: cur.data.confirmations + 1,
    confirmedBy: [...cur.data.confirmedBy, familyId],
    lastConfirmed: today > cur.data.lastConfirmed ? today : cur.data.lastConfirmed,
  };
  return { doc: put<Wisdom>(cur.familyId, "wisdom", data, { id, date: data.lastConfirmed }), already: false };
}

/**
 * デモ用の種（さいたま市）。すべて作った例で、実在の窓口の具体的な事実ではない。
 * 中身はどの町でも言える一般的な知恵に留める。
 */
const SEED: { place: string; milestoneId: string | null; tip: string; confirmations: number; lastConfirmed: string }[] = [
  { place: "区役所の戸籍の窓口", milestoneId: "birth-registration", tip: "産院で書いてもらった出生証明書つきの届書と、母子手帳を持っていった。行く前に電話で受付の時間を確かめたら一度で済んだ。", confirmations: 7, lastConfirmed: "2026-10-20" },
  { place: "区役所の子育ての窓口", milestoneId: "child-allowance", tip: "出生届と同じ日に回ると往復が一回で済んだ。振込先の口座が分かる物を忘れずに。", confirmations: 6, lastConfirmed: "2026-10-28" },
  { place: "勤め先の健康保険の担当", milestoneId: "health-insurance", tip: "生まれた日のうちにメールで一報を入れておくと、書類のやりとりが早かった。", confirmations: 4, lastConfirmed: "2026-09-15" },
  { place: "区役所の子育ての窓口", milestoneId: "medical-subsidy", tip: "赤ちゃんの保険証が届いてから行く。届く前に行って出直しになった家族がいた。", confirmations: 5, lastConfirmed: "2026-10-02" },
  { place: "保健センター", milestoneId: "birth-notice", tip: "母子手帳と一緒にもらった用紙は、退院したらすぐ出すと訪問の日が早く決まった。", confirmations: 3, lastConfirmed: "2026-08-10" },
  { place: "区役所の妊娠の届出の窓口", milestoneId: "pregnancy-report", tip: "平日の午前の早い時間は待ちが短かった。説明が長いので、時間に余裕を持って。", confirmations: 4, lastConfirmed: "2026-09-05" },
  { place: "保育園の見学", milestoneId: "daycare-research", tip: "見学の電話は、お昼寝の時間を避けて午前中にかけるとつながりやすかった。", confirmations: 2, lastConfirmed: "2026-07-22" },
  { place: "区役所（手続き全般）", milestoneId: null, tip: "抱っこひもで行くと、待ち時間に両手が空いて書類が書きやすかった。", confirmations: 3, lastConfirmed: "2026-09-30" },
];

export const SEED_CITY = "さいたま市";

/** 何度呼んでも重複しない（決まった id で、既にあれば触らない） */
export function seedWisdom(): { added: number; total: number } {
  let added = 0;
  SEED.forEach((s, i) => {
    const id = `wisdom:seed:${SEED_CITY}:${i}`;
    if (get(id)) return;
    put<Wisdom>(cityKey(SEED_CITY), "wisdom", { city: SEED_CITY, ...s, confirmedBy: [], demo: true }, { id, date: s.lastConfirmed });
    added++;
  });
  return { added, total: SEED.length };
}
