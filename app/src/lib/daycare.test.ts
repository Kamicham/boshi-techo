import { describe, expect, it } from "vitest";
import { daycarePlan, entryYear, scheduleFor } from "./milestones";

const work = { motherWork: "会社員・公務員" as const, partnerWork: "会社員・公務員" as const };

describe("保育園の入る4月（仕事に戻りたい時期から）", () => {
  it("決めていない時は、生後6か月を過ぎて最初の4月（前からの近似）", () => {
    expect(entryYear("2026-06-10")).toBe(2027);
    expect(entryYear("2026-11-10")).toBe(2028);
  });
  it("1歳まで: 1歳の誕生日までの最後の4月。生後57日に満たなければ次の4月", () => {
    expect(entryYear("2026-06-10", "1歳まで")).toBe(2027);
    expect(entryYear("2026-11-10", "1歳まで")).toBe(2027);
    // 2027-03-01 生まれ: 1歳の誕生日までの最後の4月は 2027-04-01（生後31日）なので、次の 2028-04-01
    expect(entryYear("2027-03-01", "1歳まで")).toBe(2028);
    // 4月1日生まれは、1歳の誕生日のその日の4月に入れる
    expect(entryYear("2026-04-01", "1歳まで")).toBe(2027);
  });
  it("1歳を過ぎて: 1歳の誕生日の後の最初の4月（1歳児クラス）", () => {
    expect(entryYear("2026-06-10", "1歳を過ぎて")).toBe(2028);
    expect(entryYear("2026-11-10", "1歳を過ぎて")).toBe(2028);
  });
  it("延長の申し出は1歳の誕生日の2週間前まで、2回目は1歳6か月の2週間前まで", () => {
    const p = daycarePlan("2026-06-10", "1歳まで");
    expect(p.extend.deadline).toBe("2027-05-27");
    expect(p.extend.start).toBe("2027-02-01");
    expect(p.extend2.deadline).toBe("2027-11-26");
    // 1歳を過ぎて: 結果（2028-02）は期限より後なので、期限の60日前から
    expect(daycarePlan("2026-06-10", "1歳を過ぎて").extend.start).toBe("2027-03-28");
  });
});

describe("予定の表", () => {
  const at = (returnAt?: "1歳まで" | "1歳を過ぎて") =>
    scheduleFor({ dueDate: "2026-11-10", birthDate: "2026-11-10", situation: { ...work, ...(returnAt ? { returnAt } : {}) } }, "2026-12-01");
  it("答えで申し込みの日が動く", () => {
    expect(at().find((m) => m.id === "daycare-apply")?.startDate).toBe("2027-10-01");
    expect(at("1歳まで").find((m) => m.id === "daycare-apply")?.startDate).toBe("2026-12-10");
    expect(at("1歳を過ぎて").find((m) => m.id === "daycare-apply")?.startDate).toBe("2027-10-01");
  });
  it("2回目の延長は1歳を過ぎてからの家族だけ。入る前の準備は入る4月の45日前から", () => {
    expect(at("1歳まで").some((m) => m.id === "daycare-extend-2")).toBe(false);
    expect(at("1歳を過ぎて").some((m) => m.id === "daycare-extend-2")).toBe(true);
    expect(at("1歳まで").find((m) => m.id === "daycare-prep")?.startDate).toBe("2027-02-15");
  });
  it("ママが辞める家族には、延長も準備も出ない", () => {
    const s = scheduleFor({ dueDate: "2026-11-10", situation: { motherWork: "出産で辞める" } }, "2026-12-01");
    expect(s.some((m) => m.id.startsWith("daycare-") && m.id !== "daycare-research")).toBe(false);
  });
});
