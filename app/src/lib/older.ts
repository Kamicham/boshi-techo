// 上の子の予定（第2波①）。上の子の生まれた日から、健診と予防接種を、赤ちゃんの予定と同じ決まり（milestones.ts）で数える。
// 出すのは、赤ちゃんの1000日（最終月経〜2歳の誕生日）に重なる分だけ。小学生の上の子は手帳の範囲（妊娠〜2歳）の外なので出さない。
// 期限を過ぎた上の子の健診・接種は出さない（上の子の母子手帳が正。使い始める前に済んでいる事が多い）。
// id は older1-<もとの id>（済みの口の id の形に合わせて「-」でつなぐ）。赤ちゃんの済みの印とは分かれる。

import { addDays, addMonths, lmpFromDue } from "./clock";
import type { Milestone, MilestoneDef } from "./milestones";
import type { OlderKid, Situation } from "./situation";

export const OLDER_ID = /^older(\d)-(.+)$/;

/** 上の子の予定の id か（もとの id と何人目か） */
export function olderOf(id: string): { index: number; baseId: string } | null {
  const m = OLDER_ID.exec(id);
  return m ? { index: Number(m[1]) - 1, baseId: m[2] } : null;
}

/** 上の子の今の年（3歳・8か月）。年月だけの子は1日と見なす（近似） */
export function ageWord(birth: string, today: string): string {
  const [by, bm, bd] = birth.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm) - (td < bd ? 1 : 0);
  if (months < 0) months = 0;
  return months >= 12 ? `${Math.floor(months / 12)}歳` : `${months}か月`;
}

/** 上の子の呼び方（呼び名があればそれ。無ければ「上の子」。2人以上なら何人目か）＋今の年 */
export function olderLabel(kid: OlderKid, index: number, count: number, today: string): string {
  const who = kid.name ? kid.name : count > 1 ? `上の子${index + 1}` : "上の子";
  return `${who}（${ageWord(kid.birthDate, today)}）`;
}

/** 上の子の予定に使う、もとの予定（生まれた日から数える健診・予防接種。家族の形で絞る物は使わない） */
export function olderDefs(all: MilestoneDef[]): MilestoneDef[] {
  return all.filter((d) => d.kind === "健診" && d.anchor === "birth" && !d.only);
}

/**
 * 上の子の健診・予防接種を、赤ちゃんの予定と同じ形（Milestone）で出す。
 * today が無い時（計算だけの時）は、今日の代わりに赤ちゃんの最終月経の日を使う。
 */
export function olderSchedule(
  f: { dueDate: string; birthDate?: string; situation?: Situation },
  defs: MilestoneDef[],
  today?: string,
): Milestone[] {
  const s = f.situation;
  if (s?.olderChildren !== true || !s.olderKids?.length) return [];
  const lmp = lmpFromDue(f.dueDate);
  const end = addMonths(f.birthDate ?? f.dueDate, 24);
  const now = today ?? lmp;
  const kids = s.olderKids;
  const out: Milestone[] = [];
  kids.forEach((kid, i) => {
    // 赤ちゃんより後に生まれた日・今日より先の日は読めない（入れ間違い）。小学生は出さない
    if (!kid.birthDate || kid.birthDate >= lmp || kid.birthDate > now || kid.care === "小学校") return;
    const label = olderLabel(kid, i, kids.length, now);
    for (const d of defs) {
      const fixed = d.dates?.(kid.birthDate);
      const startDate = fixed ? fixed.start : addDays(addMonths(kid.birthDate, d.start.months ?? 0), d.start.days ?? 0);
      const deadlineDate = fixed ? fixed.deadline : d.deadline ? addDays(addMonths(kid.birthDate, d.deadline.months ?? 0), d.deadline.days ?? 0) : undefined;
      const last = deadlineDate ?? addDays(startDate, 14);
      if (last < now || startDate > end) continue;
      out.push({
        ...d,
        id: `older${i + 1}-${d.id}`,
        title: `${label}の${d.title}`,
        plain: `${label}の${d.plain}`,
        hint: kid.monthOnly ? `${d.hint}（生まれた日は月の1日として数えた目安）` : d.hint,
        // 上の子の町の案内は、上の子の手帳と町の通知で届く。調べ物は赤ちゃんの分だけにする（費用）
        needsLocal: false,
        startDate,
        deadlineDate,
        older: { index: i, label },
      });
    }
  });
  return out;
}
