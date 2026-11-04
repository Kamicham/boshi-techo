// 急ぎの時の入口を、「いま」の一番上の札のすぐ下にも出す時期（UX の見直し C02④・2026-11-05）。
// 産後8週（生まれた日から56日）の間だけ。体の判断はしない。行き先は /emergency（手当の手順と、119・#8000・産院への橋。中身は触らない）。
import { diffDays } from "@/lib/clock";

/** 生まれた日から数えて、この日数の間（0〜55日目＝産後8週）は「いま」の上の方に出す */
export const URGENT_DAYS = 56;

/** 今日、「いま」の一番上の札の下に急ぎの時の1行を出すか */
export function urgentNear(birthDate: string | undefined, today: string): boolean {
  if (!birthDate || today < birthDate) return false;
  return diffDays(today, birthDate) < URGENT_DAYS;
}
