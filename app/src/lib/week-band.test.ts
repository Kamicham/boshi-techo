// 今日の画面の一番上の帯（lib/week-band.ts）の試験。作った家族だけ（Claude は呼ばない）。
import { describe, expect, it } from "vitest";
import { addDays, addMonths } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import { weekBand } from "./week-band";

const f = DEMO_FAMILY; // 予定日 2027-05-10・生まれた日 2027-04-26・ひなた
const second = addMonths(f.birthDate!, 24);

describe("週の帯", () => {
  it("妊娠中は週数と予定日まで。おなかの赤ちゃんの呼び名が決まっていたら名前で呼ぶ。予定日を過ぎても数え上げない", () => {
    const named = { ...f, birthDate: undefined };
    expect(weekBand(named, "2027-02-15")).toMatchObject({ main: "28週 ・ ひなたの予定日まで あと84日", walked: false });
    expect(weekBand(named, f.dueDate)!.main).toBe("40週 ・ 今日がひなたの予定日");
    expect(weekBand(named, addDays(f.dueDate, 5))!.main).toBe("40週 ・ ひなたの予定日のころ");
    // 呼び名がまだ無い家族（空白だけも）は、今までどおり
    for (const childName of [undefined, " "]) {
      const plain = { ...named, childName };
      expect(weekBand(plain, "2027-02-15")!.main).toBe("28週 ・ 予定日まであと84日");
      expect(weekBand(plain, f.dueDate)!.main).toBe("40週 ・ 今日が予定日");
      expect(weekBand(plain, addDays(f.dueDate, 5))!.main).toBe("40週 ・ 予定日のころ");
    }
  });

  it("2歳の誕生日の後は「1000日を一緒に歩きました」（「過ぎました」と言わない）。線は消さず、端まで満ちた形で残す", () => {
    expect(weekBand(f, second)).toEqual({ main: "ひなた ・ 2歳", pos: 1, walked: false });
    const after = weekBand(f, addDays(second, 1))!;
    expect(after).toEqual({ main: "2歳 ・ 1000日を一緒に歩きました", pos: 1, walked: true });
    expect(weekBand(f, addMonths(second, 7))!.main).toBe("2歳7か月 ・ 1000日を一緒に歩きました");
    for (const d of [second, addDays(second, 1), addMonths(second, 7)]) expect(weekBand(f, d)!.main).not.toMatch(/過ぎました/);
  });

  it("線の上の今は 0〜1 の間で進む。授かる前は線を出さない", () => {
    const a = weekBand(f, "2026-10-01")!.pos!;
    const b = weekBand(f, "2027-10-01")!.pos!;
    expect(a).toBeGreaterThan(0);
    expect(b).toBeGreaterThan(a);
    expect(b).toBeLessThan(1);
    expect(weekBand({ ...f, birthDate: undefined }, "2026-07-01")).toEqual({ main: "授かる前", pos: null, walked: false });
  });

  it("つらい別れの間は帯を出さない。入院（nicu）の間は今までどおり出す。家族の形を入れていない家族（11/4 までの形）も読める", () => {
    expect(weekBand({ ...f, situation: { quiet: "loss" } }, addDays(second, 1))).toBeNull();
    expect(weekBand({ ...f, situation: { quiet: "nicu" } }, "2027-05-01")!.main).toBe("ひなた ・ 生後5日");
    expect(weekBand({ dueDate: f.dueDate, birthDate: f.birthDate }, addDays(second, 1))!.walked).toBe(true);
    expect(weekBand({ dueDate: f.dueDate, birthDate: f.birthDate }, "2027-05-01")!.main).toBe("生後5日");
  });
});
