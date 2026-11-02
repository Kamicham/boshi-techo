import { describe, expect, it } from "vitest";
import type { Member } from "../../lib/demo-family";
import { scheduleFor, statusOf } from "../../lib/milestones";
import { planToday, type Task } from "./task";

// 予定日 2026-12-21 の家族を、33週ごろ（11/2）で見る
const fam = { dueDate: "2026-12-21" };
const mama: Member = { id: "m", name: "ママ", role: "母", voice: "" };
const papa: Member = { id: "p", name: "パパ", role: "パートナー", voice: "" };

function tasksAt(today: string, done: string[] = []): Task[] {
  const s = new Set(done);
  return scheduleFor(fam).map((m) => ({ ...m, status: statusOf(m, today, s) }));
}

describe("planToday", () => {
  const today = "2026-11-02";
  const tasks = tasksAt(today, ["pregnancy-report", "tell-work", "direct-payment"]);

  it("ママの時、パパの番は一番上に来ず、自分の近い事を「もうすぐ」で出す", () => {
    const p = planToday(tasks, today, mama);
    expect(p.top?.who === "母" || p.top?.who === "家族").toBe(true);
    expect(p.topIsSoon).toBe(true);
    expect(p.top?.id).toBe("maternity-leave");
    expect(p.rest.map((t) => t.id)).toContain("partner-leave");
    expect(p.rest.map((t) => t.id)).toContain("hospital-bag");
    expect(p.upcoming.map((t) => t.id)).not.toContain("hospital-bag");
  });

  it("パパの時、一番上はパパの事", () => {
    const p = planToday(tasks, today, papa);
    expect(p.top?.id).toBe("partner-leave");
    expect(p.topIsSoon).toBe(false);
  });

  it("このあとは、あと何日の順だけ", () => {
    const later = tasksAt("2026-12-24", ["birth-registration"]);
    const p = planToday(later, "2026-12-24", null);
    const days = p.rest.map((t) => (t.status === "まだ先" ? t.startDate : (t.deadlineDate ?? "9999")));
    expect(days).toEqual([...days].sort());
  });
});

describe("時期を過ぎた事を畳む", () => {
  it("まだ生まれていない間は、予定日を過ぎても出生届を今やる・もうすぐにしない", () => {
    const today = "2026-12-28";
    const p = planToday(tasksAt(today, ["pregnancy-report", "tell-work", "direct-payment", "hospital-bag", "partner-leave"]), today, papa);
    const shown = [p.top, ...p.rest].filter(Boolean).map((t) => t!.id);
    expect(shown).not.toContain("birth-registration");
    expect(p.upcoming.map((t) => t.id)).toContain("birth-registration");
  });

  it("生まれた後は、妊娠中だけの事を出さず、済んでいない物を stale に回す", () => {
    const today = "2026-12-01";
    const s = new Set<string>(["pregnancy-report", "tell-work"]);
    const tasks = scheduleFor({ ...fam, birthDate: "2026-11-25" }).map((m) => ({ ...m, status: statusOf(m, today, s) }));
    const p = planToday(tasks, today, mama);
    const shown = [p.top, ...p.rest].filter(Boolean).map((t) => t!.id);
    for (const id of ["hospital-bag", "direct-payment", "maternity-leave", "checkup-weekly"]) expect(shown).not.toContain(id);
    expect(p.stale.map((t) => t.id)).toEqual(["direct-payment", "hospital-bag"]);
  });

  it("期限を30日より多く過ぎた事は、一番上と「このあと」から外して stale へ", () => {
    const today = "2027-02-10";
    const tasks = scheduleFor({ ...fam, birthDate: fam.dueDate }).map((m) => ({ ...m, status: statusOf(m, today, new Set()) }));
    const p = planToday(tasks, today, papa);
    const shown = [p.top, ...p.rest].filter(Boolean).map((t) => t!.id);
    expect(shown).not.toContain("birth-registration");
    expect(p.stale.map((t) => t.id)).toContain("birth-registration");
  });
});
