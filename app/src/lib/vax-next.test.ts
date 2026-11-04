import { describe, expect, it } from "vitest";
import { vaxHistory } from "./techo-done";
import { applyRetime, callMemo, vaxRetime } from "./vax-next";
import { scheduleFor } from "./milestones";

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
  it("当てはめた後も id は変わらず、期限は同じ幅だけ後ろへ", () => {
    const h = vaxHistory([v("2027-04-20", "B型肝炎", "1回目"), v("2027-04-20", "小児用肺炎球菌", "1回目"), v("2027-04-20", "五種混合", "1回目")], "2027-05-01");
    const before = sched.find((m) => m.id === "vaccines-3m")!;
    const after = applyRetime(sched, vaxRetime(h, sched)).find((m) => m.id === "vaccines-3m")!;
    expect(after.id).toBe(before.id);
    const w0 = Date.parse(before.deadlineDate!) - Date.parse(before.startDate);
    expect(Date.parse(after.deadlineDate!) - Date.parse(after.startDate)).toBe(w0);
  });
  it("電話メモは、子の名前が無ければ空欄・体の言葉と電話番号を含まない", () => {
    const m = callMemo({ plain: "予防接種の2回目", start: "2027-05-18", doses: ["B型肝炎2回目"] });
    expect(m).toContain("（子の名前）");
    expect(m).not.toMatch(/熱|副反応|\d{2,4}-\d{2,4}-\d{3,4}/);
  });
});
