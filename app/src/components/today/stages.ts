// 見本の家族の時期の札（入口の1枚と、上の帯の「時期を変える」で使う。画面は StagePicker.tsx）。
// 札の一言は、その日の1画面目に出る事と合わせる（UX の見直し C36・2026-11-05）。試験から読めるよう、JSX の無いこのファイルに置く。
import { addDays, addMonths, conceptionDate, diffDays, totalDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { advisorMoments } from "@/lib/advisor";
import { ADVISOR } from "./stage-focus";

/** focus: 札から開いた時だけ一番上に出す物（予定の id か ADVISOR＝手帳が気づいた事。stage-focus.ts）。札の一言と1画面目を合わせる（UX の見直し C36） */
export type Stage = { key: string; label: string; what: string; date: string; tone?: "sky"; focus?: string };

/**
 * 見本の家族の時期（日付はその家族の予定日・生まれた日から）。札の一言は、その日の1画面目に出る事と合わせる（UX の見直し C36）。
 * 同じ画面になる札は1枚にまとめる: 28週と30週（一番上が同じ「産休・育休のお金」）・生まれた翌日と「もしも: 早く生まれた」（同じ日）
 */
export function demoStages(family: Family): Stage[] {
  const start = conceptionDate(family);
  const birth = family.birthDate ?? family.dueDate;
  const lmp = addDays(family.dueDate, -280);
  // 予定どおりに行かなかった日（早く生まれた・引っ越した）に、手帳が気づいて組み直す所
  const moments = advisorMoments(family);
  // 予定と違う日に生まれた気づきは、生まれた翌日（同じ日）の札にまとめ、開くと気づいた事を一番上に
  const shifted = moments.find((m) => m.label === "生まれた日");
  const early = family.birthDate ? diffDays(family.dueDate, family.birthDate) : 0;
  const how = early > 0 ? `${Math.round(early / 7)}週早く生まれて` : "予定と違う日に生まれて";
  const stages: Stage[] = [
    { key: "w8", label: "妊娠8週", what: "母子手帳をもらう・最初の届け出", date: addDays(lmp, 8 * 7) },
    { key: "w28", label: "妊娠28週", what: "産休・育休のお金の手続き・次の健診の予約", date: addDays(lmp, 28 * 7) },
    { key: "w37", label: "妊娠37週", what: "生まれたら、ここから（押すと生まれた日へ）", date: addDays(lmp, 37 * 7) },
    shifted
      ? { key: "born", label: "生まれた翌日", what: `出生届・14日以内の手続き。${how}、手帳が予定を組み直した日`, date: addDays(birth, 1), focus: ADVISOR }
      : { key: "born", label: "生まれた翌日", what: "出生届・14日以内の手続き", date: addDays(birth, 1) },
    { key: "m2", label: "生後2か月", what: "初めての予防接種・児童手当が届いたか", date: addDays(birth, 61), focus: "vaccines-start" },
    { key: "y1", label: "1歳の誕生日", what: "おなかにいた頃の手紙が開く・この1年の一冊", date: addMonths(birth, 12) },
    { key: "y2", label: "2歳", what: "1000日の記録から、子どもへの一冊", date: addDays(birth, 731) },
  ];
  for (const m of moments) {
    if (m === shifted) continue;
    stages.push({ key: `adv-${m.date}`, label: `もしも: ${m.label}`, what: "手帳が気づいて、予定を組み直す", date: m.date, tone: "sky", focus: ADVISOR });
  }
  const total = totalDays(family);
  return stages.map((s) => ({ ...s, date: addDays(start, Math.max(1, Math.min(total, diffDays(s.date, start) + 1)) - 1) }));
}

/** 見本の家族を、札を選ぶ前に開いた時の日（一覧の最初の札と同じ日。前は授かった日＋41日＝7週6日で、一覧の「妊娠8週」と帯の「7週」がずれた） */
export function demoFirstDay(family: Family): string {
  return demoStages(family)[0].date;
}
