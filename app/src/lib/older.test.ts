import { describe, expect, it } from "vitest";
import { cleanOlderKids } from "./situation";
import { MILESTONES, scheduleFor, statusOf } from "./milestones";
import { ageWord, olderDefs, olderLabel, olderOf, olderSchedule } from "./older";

// 作った家族: 予定日 2027-06-01（最終月経 2026-08-25）、上の子は 2023-09-10 生まれ（今日 2027-01-15 で3歳4か月）
const base = { dueDate: "2027-06-01" };
const kid = { birthDate: "2023-09-10", care: "保育園" as const };
const fam = { ...base, situation: { olderChildren: true, olderKids: [kid] } };

describe("上の子の一覧を確かめる", () => {
  it("読めない日・形の違う物を捨て、3人までにする", () => {
    const out = cleanOlderKids([
      { birthDate: "2023-09-10", name: " はる ", care: "保育園" },
      { birthDate: "2023-13-40" },
      { birthDate: "abc" },
      "x",
      { birthDate: "2021-04-01", monthOnly: true, care: "宇宙" },
      { birthDate: "2020-01-01" },
      { birthDate: "2019-01-01" },
    ]);
    expect(out).toHaveLength(3);
    expect(out[0]).toEqual({ birthDate: "2023-09-10", name: "はる", care: "保育園" });
    expect(out[1]).toEqual({ birthDate: "2021-04-01", monthOnly: true });
  });
});

describe("上の子の予定", () => {
  it("年の言い方", () => {
    expect(ageWord("2023-09-10", "2027-01-15")).toBe("3歳");
    expect(ageWord("2026-05-20", "2027-01-15")).toBe("7か月");
    expect(olderLabel({ birthDate: "2023-09-10" }, 0, 1)).toBe("上の子");
    expect(olderLabel({ birthDate: "2023-09-10" }, 1, 2)).toBe("上の子2");
    expect(olderLabel({ birthDate: "2023-09-10", name: "はるちゃんです" }, 0, 1)).toBe("はるちゃんで");
  });

  it("期限を過ぎた上の子の健診は、期限切れでなく過ぎたにする", () => {
    const c3 = olderSchedule(fam, olderDefs(MILESTONES), "2027-01-15").find((m) => m.id === "older1-checkup-3y")!;
    expect(statusOf(c3, "2027-09-10", new Set())).toBe("過ぎた");
  });

  it("3歳児健診は上の子の生まれた日から数え、赤ちゃんの最終月経より前に終わった1歳半健診は出さない", () => {
    const s = olderSchedule(fam, olderDefs(MILESTONES), "2027-01-15");
    const c3 = s.find((m) => m.id === "older1-checkup-3y");
    expect(c3?.startDate).toBe("2026-09-10");
    expect(c3?.deadlineDate).toBe("2027-09-09");
    expect(c3?.plain).toBe("上の子の3歳児健診");
    expect(c3?.title).toContain("上の子（2023年9月生まれ）の");
    expect(c3?.older).toEqual({ index: 0, label: "上の子" });
    expect(statusOf(c3!, "2027-01-15", new Set())).toBe("今やる");
    expect(s.some((m) => m.id === "older1-checkup-18m")).toBe(false);
    // 日本脳炎の追加（4歳）は赤ちゃんの2歳までに来るので出る。MR の2期（年長＝2029-04-01〜）も2029-06-01 までに始まるので出る
    expect(s.some((m) => m.id === "older1-je-vaccine-1-booster")).toBe(true);
    expect(s.find((m) => m.id === "older1-mr-vaccine-2")?.startDate).toBe("2029-04-01");
  });

  it("id は済みの口の形（英数と-）で、もとの id に戻せる", () => {
    for (const m of olderSchedule(fam, olderDefs(MILESTONES), "2027-01-15")) {
      expect(m.id).toMatch(/^[a-zA-Z0-9_-]{1,80}$/);
      expect(olderOf(m.id)?.index).toBe(0);
    }
    expect(olderOf("checkup-3y")).toBeNull();
  });

  it("出さない時: 上の子がいない・小学生・赤ちゃんより後や今日より先の日", () => {
    const d = olderDefs(MILESTONES);
    expect(olderSchedule(base, d, "2027-01-15")).toEqual([]);
    expect(olderSchedule({ ...base, situation: { olderChildren: true, olderKids: [{ ...kid, care: "小学校" }] } }, d, "2027-01-15")).toEqual([]);
    expect(olderSchedule({ ...base, situation: { olderChildren: true, olderKids: [{ birthDate: "2026-10-01" }] } }, d, "2027-01-15")).toEqual([]);
    expect(olderSchedule({ ...base, situation: { olderChildren: false, olderKids: [kid] } }, d, "2027-01-15")).toEqual([]);
  });

  it("赤ちゃんの予定の表に、赤ちゃんの印と分けて混ざる。まだ生まれていなくても上の子の予定は待たない", () => {
    const all = scheduleFor(fam, "2027-01-15");
    const c3 = all.find((m) => m.id === "older1-checkup-3y")!;
    expect(c3.awaitingBirth).toBeUndefined();
    expect(all.find((m) => m.id === "checkup-3y")?.awaitingBirth).toBe(true);
    expect(statusOf(c3, "2027-01-15", new Set(["checkup-3y"]))).toBe("今やる");
  });

  it("年月だけの子は、目安だと一言に書く", () => {
    const s = olderSchedule({ ...base, situation: { olderChildren: true, olderKids: [{ ...kid, birthDate: "2023-09-01", monthOnly: true }] } }, olderDefs(MILESTONES), "2027-01-15");
    expect(s[0].hint).toContain("目安");
  });
});

describe("上の子の園と送り迎え", () => {
  const ids = (sit: object) => scheduleFor({ ...base, situation: sit }, "2027-01-15").map((m) => m.id);
  it("保育園の上の子がいる時だけ、育休中の継続の申請が出る（予定日の12週前から・生まれて30日が目安）", () => {
    expect(ids({ olderChildren: true, olderKids: [kid] })).toContain("older-daycare-continue");
    expect(ids({ olderChildren: true, olderKids: [{ ...kid, care: "幼稚園" }] })).not.toContain("older-daycare-continue");
    expect(ids({ olderChildren: true })).not.toContain("older-daycare-continue");
    const m = scheduleFor({ ...base, situation: { olderChildren: true, olderKids: [kid] } }, "2027-01-15").find((x) => x.id === "older-daycare-continue")!;
    expect(m.startDate).toBe("2027-03-09");
    expect(m.deadlineDate).toBe("2027-07-01");
  });
  it("園か幼稚園に通う上の子がいる時だけ、送り迎えの担当が出る", () => {
    expect(ids({ olderChildren: true, olderKids: [{ ...kid, care: "幼稚園" }] })).toContain("older-pickup");
    expect(ids({ olderChildren: true, olderKids: [{ ...kid, care: "家" }] })).not.toContain("older-pickup");
    expect(ids({ olderChildren: false })).not.toContain("older-pickup");
  });
});
