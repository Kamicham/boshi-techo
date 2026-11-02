import { describe, expect, it } from "vitest";
import type { Member } from "../../lib/demo-family";
import { scheduleFor, statusOf } from "../../lib/milestones";
import { planToday, shownDays, whenDate, whoLabel, type Task } from "./task";

// 予定日 2026-12-21 の家族を、33週ごろ（11/2）で見る
const fam = { dueDate: "2026-12-21" };
const mama = { id: "m", name: "ママ", role: "母" } as Member;
const papa = { id: "p", name: "パパ", role: "パートナー" } as Member;

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
    const p = planToday(tasksAt(today, ["pregnancy-report", "tell-work", "direct-payment", "partner-leave"]), today, papa);
    const shown = [p.top, ...p.rest].filter(Boolean).map((t) => t!.id);
    expect(shown).not.toContain("birth-registration");
    expect(p.upcoming.map((t) => t.id)).toContain("birth-registration");
  });

  it("生まれた後は、妊娠中だけの事を出さない。目安の物は「済みましたか？」でも聞かない", () => {
    const today = "2026-12-01";
    const s = new Set<string>(["pregnancy-report", "tell-work"]);
    const tasks = scheduleFor({ ...fam, birthDate: "2026-11-25" }).map((m) => ({ ...m, status: statusOf(m, today, s) }));
    const p = planToday(tasks, today, mama);
    const shown = [p.top, ...p.rest, ...p.upcoming].filter(Boolean).map((t) => t!.id);
    for (const id of ["direct-payment", "maternity-leave"]) expect(shown).not.toContain(id);
    expect(p.stale).toEqual([]);
  });

  it("期限を30日より多く過ぎた事は、一番上と「このあと」から外して stale へ", () => {
    const today = "2027-02-10";
    const tasks = scheduleFor({ ...fam, birthDate: fam.dueDate }).map((m) => ({ ...m, status: statusOf(m, today, new Set()) }));
    const p = planToday(tasks, today, papa);
    const shown = [p.top, ...p.rest].filter(Boolean).map((t) => t!.id);
    expect(shown).not.toContain("birth-registration");
    expect(p.stale.map((t) => t.id)).toContain("birth-registration");
    // 目安の日を過ぎた事（保険証を作る）は、畳むが聞かない
    expect(shown).not.toContain("health-insurance");
    expect(p.stale.map((t) => t.id)).not.toContain("health-insurance");
  });
});

describe("言い方", () => {
  it("「家族」の事は担当名を出さない（空文字）", () => {
    const fv = { members: [mama, papa] } as Parameters<typeof whoLabel>[1];
    expect(whoLabel({ who: "家族" }, fv, mama)).toBe("");
    expect(whoLabel({ who: "母" }, fv, mama)).toBe("あなた");
    expect(whoLabel({ who: "パートナー" }, fv, mama)).toBe("パパ");
  });

  it("30日より先は「あと◯日」を出さず日付で。年が違えば年も", () => {
    const today = "2026-11-02";
    const tasks = tasksAt(today);
    const near = tasks.find((t) => t.id === "maternity-leave")!; // 11/9 から
    expect(shownDays(near, today)).toBe(7);
    expect(whenDate(near, today)).toBe("11月9日から");
    const leave = tasks.find((t) => t.id === "partner-leave")!; // 期限 12/7
    expect(shownDays(leave, today)).toBeNull(); // あと35日
    expect(whenDate(leave, today)).toBe("12月7日まで");
    const later = scheduleFor({ ...fam, birthDate: fam.dueDate }).map((m) => ({ ...m, status: statusOf(m, today, new Set()) }));
    const bcg = later.find((t) => t.id === "bcg")!;
    expect(shownDays(bcg, today)).toBeNull();
    expect(whenDate(bcg, today)).toBe("2027年5月21日から");
  });
});
