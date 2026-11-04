// 思い出の早送り: 作った30家族の1000日を毎日たどり、節目の写真の一言（PhotoNudge と同じ memoryNudgeFor）が
// - 静かにする（つらい別れ・赤ちゃんの入院）を選んだ家族には、1日も出ない
// - 選んでいない家族には、生まれた後の節目（お七夜〜2歳の7つ）でだけ出て、生まれる前には出ない
// を確かめる。30家族はそのまま・loss にした写し・nicu にした写しの3通りで通す（作った家族だけ。Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { addDays, diffDays, lmpFromDue, secondBirthday } from "../lib/clock";
import { letterOpenOn, recentlyOpened, schoolEntry } from "../lib/letters-shared";
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

// 未来の手紙: 30家族それぞれで、開く日が筋の通った日になるか（生まれる前に開かない・小学校は6〜7歳の春・20歳の誕生日）。
// 開いた知らせ（LetterNews と同じ recentlyOpened）は、開く日から2週間だけで、1000日の中で何度も出ない

describe("未来の手紙（30家族）", () => {
  it("開く日: 1歳・小学校・10歳・20歳とも生まれた日より後。小学校は満6歳の次の4月1日", () => {
    for (const f of SIM_FAMILIES) {
      const birth = f.birthDate ?? f.dueDate;
      for (const o of ["1y", "school", "10y", "20y"] as const) {
        const on = letterOpenOn(o, f)!;
        expect(on > birth, `${f.id} ${o} ${on}`).toBe(true);
      }
      const s = schoolEntry(birth);
      const age = Number(s.slice(0, 4)) - Number(birth.slice(0, 4));
      expect(s.endsWith("-04-01") && (age === 6 || age === 7), `${f.id} ${birth} → ${s}`).toBe(true);
      expect(letterOpenOn("20y", f)!.slice(5)).toBe(birth.slice(5) === "02-29" ? "02-28" : birth.slice(5));
    }
  });

  it("1歳の手紙の知らせは、1000日の中で開いた日から2週間だけ出る", () => {
    for (const f of SIM_FAMILIES.filter((x) => x.birthDate)) {
      const on = letterOpenOn("1y", f)!;
      const shown = days(f).filter((d) => recentlyOpened({ openOn: on, opened: d >= on }, d));
      expect(shown.length, f.id).toBe(14);
      expect(shown[0]).toBe(on);
    }
  });
});
