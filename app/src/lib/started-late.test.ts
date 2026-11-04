import { describe, expect, it } from "vitest";
import { scheduleFor } from "./milestones";
import { recentlyPassed, STARTED_LATE_ASK_DAYS } from "./started-late";

describe("手帳を始める前の事", () => {
  const family = { id: "t", city: "川口市", prefecture: "埼玉県", dueDate: "2027-05-20", members: [{ id: "m", name: "あなた", role: "母" as const }] };
  it("11週で始めた人には、目安が過ぎたばかりの母子手帳の届けを聞く", () => {
    const today = "2026-11-04";
    const ids = recentlyPassed(scheduleFor(family, today), today).map((m) => m.id);
    expect(ids).toContain("pregnancy-report");
  });
  it(`${STARTED_LATE_ASK_DAYS}日より前に過ぎた事と、まだ過ぎていない事は聞かない`, () => {
    const today = "2027-03-01";
    for (const m of recentlyPassed(scheduleFor(family, today), today)) {
      expect(m.deadlineDate! < today).toBe(true);
      expect(m.deadlineDate! >= "2026-12-31").toBe(true);
    }
  });
});
