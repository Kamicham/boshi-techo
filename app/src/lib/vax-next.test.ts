import { describe, expect, it } from "vitest";
import { withLang } from "./i18n";
import { DICTS } from "./i18n/dicts";
import { vaxHistory } from "./techo-done";
import { applyRetime, callMemo, vaxRetime } from "./vax-next";
import { deadlineKindOf, scheduleFor } from "./milestones";

const birth = "2027-01-10";
const sched = scheduleFor({ dueDate: "2027-01-15", birthDate: birth, members: [{ role: "母" }, { role: "パートナー" }] }, "2027-06-01");
const v = (date: string, vaccine: string, dose?: string, facility?: string) => ({ page: "vaccine" as const, date, values: { vaccine, ...(dose ? { dose } : {}), ...(facility ? { facility } : {}) } });

describe("予防接種の数え直し（第1波⑥）", () => {
  it("1回目が遅れたら、2回目は中27日（＋28日）より早くならない", () => {
    const h = vaxHistory([v("2027-04-20", "B型肝炎", "1回目"), v("2027-04-20", "小児用肺炎球菌", "1回目"), v("2027-04-20", "五種混合", "1回目", "みどり小児科")], "2027-05-01");
    const r = vaxRetime(h, sched);
    expect(r["vaccines-3m"].start).toBe("2027-05-18");
    expect(r["vaccines-3m"].note).toContain("中27日");
    expect(r["vaccines-3m"].lastFacility).toBe("みどり小児科");
  });
  it("B型肝炎の3回目は、1回目から中139日（＋140日）", () => {
    const h = vaxHistory([v("2027-05-01", "B型肝炎", "1"), v("2027-06-01", "B型肝炎", "2")], "2027-07-01");
    expect(vaxRetime(h, sched)["vaccines-7m"].start).toBe("2027-09-18");
  });
  it("標準どおりに打った子は、表の日のまま（遅らせない）", () => {
    const h = vaxHistory([v("2027-03-10", "B型肝炎"), v("2027-03-10", "小児用肺炎球菌"), v("2027-03-10", "五種混合")], "2027-03-20");
    expect(vaxRetime(h, sched)["vaccines-3m"]).toBeUndefined();
  });
  it("五種混合の追加は3回目から6か月", () => {
    const h = vaxHistory([v("2027-03-10", "五種混合"), v("2027-04-10", "五種混合"), v("2027-09-01", "五種混合")], "2027-10-01");
    expect(vaxRetime(h, sched)["five-booster"].start).toBe("2028-03-01");
  });
  it("候補（まだ OK していない）と今日より後の記録は数えない", () => {
    const h = vaxHistory([{ ...v("2027-04-20", "B型肝炎"), pending: true }, v("2027-08-01", "五種混合")], "2027-05-01");
    expect(h.size).toBe(0);
  });
  it("当てはめた後も id は変わらず、目安の行（2回目）は期限も同じ幅だけ後ろへ", () => {
    const h = vaxHistory([v("2027-04-20", "B型肝炎", "1回目"), v("2027-04-20", "小児用肺炎球菌", "1回目"), v("2027-04-20", "五種混合", "1回目")], "2027-05-01");
    const before = sched.find((m) => m.id === "vaccines-3m")!;
    expect(deadlineKindOf(before)).toBe("目安");
    const after = applyRetime(sched, vaxRetime(h, sched)).find((m) => m.id === "vaccines-3m")!;
    expect(after.id).toBe(before.id);
    const w0 = Date.parse(before.deadlineDate!) - Date.parse(before.startDate);
    expect(Date.parse(after.deadlineDate!) - Date.parse(after.startDate)).toBe(w0);
    expect(after.beyondPublic).toBeUndefined();
  });
  // 期限の行は、公費（定期接種）で受けられる年齢の上限（予防接種法施行令第3条の表。「至るまで」は誕生日の前日まで）。数え直しても動かさない
  const retimed = (h: ReturnType<typeof vaxHistory>, id: string) => applyRetime(sched, vaxRetime(h, sched)).find((m) => m.id === id)!;
  it("B型肝炎の3回目（1歳に至るまで）: 数え直しても期限は1歳の誕生日の前日のまま。越える見込みは確かめる先を添える", () => {
    const before = sched.find((m) => m.id === "vaccines-7m")!;
    expect(deadlineKindOf(before)).toBe("期限");
    expect(before.deadlineDate).toBe("2028-01-09"); // 2027-01-10 生まれ
    // 1回目が 5/1: 3回目の最短は 9/18（39日遅い）。前は期限も39日ずれて 2028-02-17（1歳を過ぎた日）を出していた
    const within = retimed(vaxHistory([v("2027-05-01", "B型肝炎", "1"), v("2027-06-01", "B型肝炎", "2")], "2027-07-01"), "vaccines-7m");
    expect(within.startDate).toBe("2027-09-18");
    expect(within.deadlineDate).toBe("2028-01-09");
    expect(within.retimeNote).toBe("5月1日のB型肝炎1回目から中139日");
    expect(within.beyondPublic).toBeUndefined();
    // 1回目が 9/1: 3回目の最短は 2028-01-19 で、1歳の誕生日を越える。始まりはそのまま出し、期限も動かさず、確かめる先を添える（判断はしない）
    const beyond = retimed(vaxHistory([v("2027-09-01", "B型肝炎", "1"), v("2027-10-01", "B型肝炎", "2")], "2027-10-15"), "vaccines-7m");
    expect(beyond.startDate).toBe("2028-01-19");
    expect(beyond.deadlineDate).toBe("2028-01-09");
    expect(beyond.retimeNote).toBe("9月1日のB型肝炎1回目から中139日。公費で受けられる年齢（1月9日まで）を過ぎる見込み。小児科・保健センターに確かめる");
    expect(beyond.beyondPublic).toBe(true);
  });
  it("水痘の2回目（生後12月から36月に至るまで）: 数え直しても期限は3歳の誕生日の前日のまま。越える見込みは確かめる先を添える", () => {
    const before = sched.find((m) => m.id === "vaccines-18m")!;
    expect(deadlineKindOf(before)).toBe("期限");
    expect(before.deadlineDate).toBe("2030-01-09"); // 2027-01-10 生まれ
    // 1回目が 2028-06-01: 2回目の最短は3か月後の 2028-09-01（表の 2028-07-10 より遅い）。期限は動かさない
    const within = retimed(vaxHistory([v("2028-06-01", "水痘", "1")], "2028-06-15"), "vaccines-18m");
    expect(within.startDate).toBe("2028-09-01");
    expect(within.deadlineDate).toBe("2030-01-09");
    expect(within.beyondPublic).toBeUndefined();
    // 1回目が 2029-11-01: 2回目の最短は 2030-02-01 で、3歳の誕生日を越える
    const beyond = retimed(vaxHistory([v("2029-11-01", "水ぼうそう", "1")], "2029-11-15"), "vaccines-18m");
    expect(beyond.startDate).toBe("2030-02-01");
    expect(beyond.deadlineDate).toBe("2030-01-09");
    expect(beyond.retimeNote).toBe("11月1日の水ぼうそう1回目から3か月。公費で受けられる年齢（1月9日まで）を過ぎる見込み。小児科・保健センターに確かめる");
    expect(beyond.beyondPublic).toBe(true);
  });
  it("電話メモは、子の名前が無ければ空欄・体の言葉と電話番号を含まない", () => {
    const m = callMemo({ plain: "予防接種の2回目", start: "2027-05-18", doses: ["B型肝炎2回目"] });
    expect(m).toContain("（子の名前）");
    expect(m).not.toMatch(/熱|副反応|\d{2,4}-\d{2,4}-\d{3,4}/);
  });
});

describe("なぜその日かの一言を、画面の言葉で（2026-11-05 多言語化）", () => {
  // サーバ（app/api/done）は頼みの言葉の withLang の中で数え直し、画面は今の言葉で applyRetime する。ここは両方を同じ言葉で包む
  const at = (lang: "zh" | "en", fn: () => string | undefined) => withLang(lang, fn, DICTS[lang]);
  const note = (h: ReturnType<typeof vaxHistory>, id: string) => applyRetime(sched, vaxRetime(h, sched)).find((m) => m.id === id)!.retimeNote;
  it("中文・English: 日付・名前・回・間隔と、公費の年齢を越える見込みの一言（日本語は上の試験のまま）", () => {
    const hepb = vaxHistory([v("2027-09-01", "B型肝炎", "1"), v("2027-10-01", "B型肝炎", "2")], "2027-10-15");
    expect(at("zh", () => note(hepb, "vaccines-7m"))).toBe("9月1日打的乙型肝炎第1次之后，中间隔满139天。预计会超过可以公费接种的年龄（到1月9日为止）。请向儿科或保健中心确认");
    expect(at("en", () => note(hepb, "vaccines-7m"))).toBe(
      "139 full days after dose 1 of hepatitis B on Sep 1. Likely to pass the age for publicly funded shots (until Jan 9). Check with a pediatrician or the health center",
    );
    const vari = vaxHistory([v("2028-06-01", "水痘", "1")], "2028-06-15");
    expect(at("en", () => note(vari, "vaccines-18m"))).toBe("3 months after dose 1 of chickenpox on Jun 1");
    expect(at("zh", () => note(vari, "vaccines-18m"))).toBe("6月1日打的水痘第1次之后3个月");
  });
});
