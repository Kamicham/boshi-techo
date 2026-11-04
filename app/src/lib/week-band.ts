// 今日の画面の一番上の帯（週数・月齢の1行と、1000日の線）の言い方。画面（components/Techo.tsx の WeekBand）と試験で使う純関数（Claude は呼ばない）。
// - 妊娠中は週数と予定日まで（予定日を過ぎても数え上げない＝一番身構える週に、数字を増やさない）
// - 生まれた後は名前と月齢。2歳の誕生日の後は「1000日を一緒に歩きました」（通り過ぎた事ではなく、家族で歩いた事として言う。総点検 1-6・2026-11-04）
// - 1000日の線は、2歳の誕生日の後も消さずに端まで満ちた形で残す
// - つらい別れの間（lib/situation.ts の hideCounts）は帯を出さない
import { clockAt, diffDays, totalDays } from "./clock";
import type { Family } from "./demo-family";
import { hideCounts } from "./situation";

export interface WeekBandText {
  /** 帯の1行（「28週 ・ 予定日まであと84日」「ひなた ・ 生後3か月」「2歳0か月 ・ 1000日を一緒に歩きました」） */
  main: string;
  /** 1000日の線の上の今（0〜1）。授かる前は null（線を出さない） */
  pos: number | null;
  /** 2歳の誕生日を過ぎて、1000日を歩き終えた後か */
  walked: boolean;
}

export function weekBand(family: Pick<Family, "dueDate" | "birthDate" | "childName" | "situation">, today: string): WeekBandText | null {
  if (hideCounts(family)) return null;
  const c = clockAt(family, today);
  const walked = c.phase === "after";
  let main: string;
  if (c.phase === "pregnant") {
    const toDue = diffDays(family.dueDate, today);
    const due = toDue > 0 ? `予定日まであと${toDue}日` : toDue === 0 ? "今日が予定日" : "予定日のころ";
    main = `${c.pregnancyWeek}週 ・ ${due}`;
  } else if (c.phase === "trying") {
    main = "授かる前";
  } else if (walked) {
    main = `${c.label} ・ 1000日を一緒に歩きました`;
  } else {
    main = family.childName ? `${family.childName} ・ ${c.label}` : c.label;
  }
  // 数字（「1000日の282日目」）は意味が通じなかったので、線の上の位置で見せる
  const pos = walked ? 1 : c.dayOf1000 > 0 ? Math.min(1, c.dayOf1000 / totalDays(family)) : null;
  return { main, pos, walked };
}
