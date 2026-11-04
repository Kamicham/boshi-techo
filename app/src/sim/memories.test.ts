// 思い出の早送り: 作った30家族の1000日を毎日たどり、節目の写真の一言（PhotoNudge と同じ memoryNudgeFor）が
// - 静かにする（つらい別れ・赤ちゃんの入院）を選んだ家族には、1日も出ない
// - 選んでいない家族には、生まれた後の節目（お七夜〜2歳の7つ）でだけ出て、生まれる前には出ない
// を確かめる。30家族はそのまま・loss にした写し・nicu にした写しの3通りで通す（作った家族だけ。Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { addDays, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import { memoryNudgeFor, PHOTO_MILESTONES } from "../lib/media-shared";
import type { Quiet } from "../lib/situation";
import { SIM_FAMILIES } from "./families";

function days(f: { dueDate: string; birthDate?: string }): string[] {
  const start = lmpFromDue(f.dueDate);
  const end = addDays(secondBirthday(f as Parameters<typeof secondBirthday>[0]), 30);
  const n = diffDays(end, start);
  return Array.from({ length: n + 1 }, (_, i) => addDays(start, i));
}

describe("思い出の一言（節目の写真）", () => {
  it("30家族: 生まれる前は出ず、生まれた後は節目の日だけ出る", () => {
    let shown = 0;
    for (const f of SIM_FAMILIES) {
      for (const d of days(f)) {
        const m = memoryNudgeFor(f, d);
        if (!m) continue;
        shown++;
        expect(f.birthDate && d >= f.birthDate, `${f.id} ${d} 生まれる前に出た`).toBe(true);
        expect(PHOTO_MILESTONES.some((x) => x.id === m.id)).toBe(true);
      }
    }
    expect(shown).toBeGreaterThan(0);
  });

  for (const quiet of ["loss", "nicu"] as Quiet[]) {
    it(`静かにする（${quiet}）を選んだ30家族の写し: 1000日のどの日にも出ない`, () => {
      for (const f0 of SIM_FAMILIES) {
        const f = { ...f0, situation: { ...f0.situation, quiet } };
        for (const d of days(f)) expect(memoryNudgeFor(f, d), `${f.id} ${d}`).toBeNull();
      }
    });
  }
});
