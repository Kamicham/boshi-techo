import { describe, expect, it } from "vitest";
import { babyInsuranceOf, foldTrip, mergeBring, planBirthTrip, tripDue, tripScreen, tripWhere } from "./birth-trip";
import { scheduleFor, statusOf } from "./milestones";
import type { Situation } from "./situation";

const both = [{ role: "母" }, { role: "パートナー" }];
const at = (today: string, s?: Situation, done: string[] = [], birthDate = "2027-05-01") => {
  const d = new Set(done);
  return scheduleFor({ dueDate: "2027-05-10", birthDate, situation: s, members: both }, today).map((m) => ({ ...m, status: statusOf(m, today, d) }));
};

describe("生まれた届けの束（第1波②）", () => {
  it("出生届が最初で、期限は生まれた日を含めて14日目", () => {
    const t = planBirthTrip(at("2027-05-02"), "2027-05-02", "2027-05-01", undefined)!;
    expect(t.items[0].task.id).toBe("birth-registration");
    expect(t.deadline).toBe("2027-05-14");
  });
  it("束の期限は、14日目が役所の休みなら次の開庁日（出生届の期限と同じ。見本の家族の 2027-04-26 生まれ: 5/9（日）→ 5/10（月）・見直し①）", () => {
    const t = planBirthTrip(at("2027-04-27", undefined, [], "2027-04-26"), "2027-04-27", "2027-04-26", undefined)!;
    expect(t.deadline).toBe("2027-05-10");
    expect(t.items.find((i) => i.task.id === "birth-registration")?.task.deadlineDate).toBe("2027-05-10");
  });
  it("会社の保険なら、医療証は「保険が届いたら」で、保険は勤め先", () => {
    const s: Situation = { partnerWork: "会社員・公務員" };
    const t = planBirthTrip(at("2027-05-02", s), "2027-05-02", "2027-05-01", s)!;
    expect(t.items.find((i) => i.task.id === "medical-subsidy")?.where).toBe("保険が届いたら");
    expect(t.items.find((i) => i.task.id === "health-insurance")?.where).toBe("勤め先");
  });
  it("国保なら、保険も医療証も役所で、保険は14日の期限", () => {
    const s: Situation = { babyInsurance: "国保" };
    const t = planBirthTrip(at("2027-05-02", s), "2027-05-02", "2027-05-01", s)!;
    const hi = t.items.find((i) => i.task.id === "health-insurance")!;
    expect(hi.where).toBe("役所");
    expect(hi.task.deadlineDate).toBe("2027-05-14");
    expect(t.items.find((i) => i.task.id === "medical-subsidy")?.where).toBe("役所");
  });
  it("公務員なら、児童手当は勤め先", () => {
    expect(tripWhere("child-allowance", { publicServant: true })).toBe("勤め先");
    expect(tripWhere("child-allowance", {})).toBe("役所");
  });
  it("16日目と、残りが1件の時は出さない。15日目が役所の休みなら、次の開庁日まで出す（児童手当の期限と同じ・見直し①）", () => {
    // 2027-04-26 生まれ: 15日目の 5/11 は火曜なので、16日目の 5/12 から出さない
    expect(planBirthTrip(at("2027-05-11", undefined, [], "2027-04-26"), "2027-05-11", "2027-04-26", undefined)).not.toBeNull();
    expect(planBirthTrip(at("2027-05-12", undefined, [], "2027-04-26"), "2027-05-12", "2027-04-26", undefined)).toBeNull();
    // 2027-05-01 生まれ: 15日目の 5/16 は日曜なので、児童手当の期限は 5/17（月）。束は 5/17 まで出し、5/18 から出さない
    expect(at("2027-05-17").find((m) => m.id === "child-allowance")?.deadlineDate).toBe("2027-05-17");
    expect(planBirthTrip(at("2027-05-17"), "2027-05-17", "2027-05-01", undefined)).not.toBeNull();
    expect(planBirthTrip(at("2027-05-18"), "2027-05-18", "2027-05-01", undefined)).toBeNull();
    const all = ["birth-registration", "child-allowance", "health-insurance", "medical-subsidy"];
    expect(planBirthTrip(at("2027-05-03", undefined, all), "2027-05-03", "2027-05-01", undefined)).toBeNull();
  });
  it("生まれる前は出さない", () => {
    expect(planBirthTrip(at("2027-04-20", undefined, [], undefined as unknown as string), "2027-04-20", undefined, undefined)).toBeNull();
  });
  it("自営どうしの家族は国保、働き方が分からなければ決めない", () => {
    expect(babyInsuranceOf({ motherWork: "自営・フリー", partnerWork: "自営・フリー" })).toBe("国保");
    expect(babyInsuranceOf(undefined)).toBeUndefined();
  });
  it("持ち物は揺れをそろえて1行にし、どの届けの分かを残す。書かれていない物は足さない", () => {
    const m = mergeBring([
      { title: "出生届", bring: ["母子健康手帳", "印鑑（認印）"] },
      { title: "児童手当", bring: ["母子手帳", "振込先の通帳", "マイナンバーカード"] },
    ]);
    expect(m.find((x) => x.item === "母子手帳")?.for).toEqual(["出生届", "児童手当"]);
    expect(m.length).toBe(4);
  });
});

describe("生まれた翌日の母の画面を軽く（UX の見直し C08）", () => {
  // 家族みんなの事（「家族」）を、決めた人の番にする（今日の画面の withAssignee と同じ置き換え）
  const assigned = (who: string) => <T extends { who: string }>(t: T): T => (t.who === "家族" ? { ...t, who } : t);
  const day = "2027-05-02";

  it("たたむのは、届けをパートナーの番に決めた家族の母の画面だけ。出生連絡票（母の番）はたたまない", () => {
    const tasks = at(day).map(assigned("パートナー"));
    const trip = planBirthTrip(tasks, day, "2027-05-01", undefined)!;
    const f = foldTrip(trip, tasks, "母", true, day)!;
    expect(f.who).toBe("パートナー");
    expect(f.items.map((t) => t.id)).toContain("birth-registration");
    expect(f.items.some((t) => t.id === "birth-notice")).toBe(false);
    expect(f.items.every((t) => t.who === "パートナー")).toBe(true);
    expect([f.done, f.total]).toEqual([0, f.items.length]);
    expect([f.due?.task.id, f.due?.date, f.due?.left, f.nudge]).toEqual(["birth-registration", "2027-05-14", 12, false]);
    // パートナーの画面・パートナーのいない家族は、たたまない
    expect(foldTrip(trip, tasks, "パートナー", true, day)).toBeNull();
    expect(foldTrip(trip, tasks, "母", false, day)).toBeNull();
    // まだ誰が行くか決めていない家族・母が行く家族・2人で行く家族（「家族」のまま）は、たたまない
    for (const xs of [at(day), at(day).map(assigned("母"))]) expect(foldTrip(planBirthTrip(xs, day, "2027-05-01", undefined)!, xs, "母", true, day)).toBeNull();
  });

  it("法の期限まで5日を切ったら、声をかける文に変える。済んだ数は、その人の番の届けで数える", () => {
    const today = "2027-05-10";
    const tasks = at(today, undefined, ["child-allowance"]).map(assigned("パートナー"));
    const f = foldTrip(planBirthTrip(tasks, today, "2027-05-01", undefined)!, tasks, "母", true, today)!;
    expect([f.due?.task.id, f.due?.left]).toEqual(["birth-registration", 4]);
    expect(f.nudge).toBe(true);
    expect(f.done).toBe(1);
    expect(f.total).toBe(f.items.length + 1);
    // 目安の届けしか残っていない時は、期限で急かさない
    const left = at(today, undefined, ["birth-registration", "child-allowance"]).map(assigned("パートナー"));
    const g = foldTrip(planBirthTrip(left, today, "2027-05-01", undefined)!, left, "母", true, today)!;
    expect([g.due, g.nudge]).toEqual([null, false]);
  });

  it("束を開く画面は、束の1件目が一番上で、束の届けを「このあと」に出さない。たたむ画面は、その人の一番上で、たたんだ届けを出さない", () => {
    const tasks = at(day).map(assigned("パートナー"));
    const trip = planBirthTrip(tasks, day, "2027-05-01", undefined)!;
    const reg = tasks.find((t) => t.id === "birth-registration")!;
    const notice = tasks.find((t) => t.id === "birth-notice")!;
    const mom = tripScreen(trip, tasks, { top: notice, rest: [reg] }, "母", true, day)!;
    expect([mom.full, mom.top?.id, mom.rest.map((t) => t.id)]).toEqual([false, "birth-notice", []]);
    const dad = tripScreen(trip, tasks, { top: reg, rest: [notice] }, "パートナー", true, day)!;
    expect([dad.full, dad.top?.id, dad.rest.map((t) => t.id)]).toEqual([true, "birth-registration", []]);
    expect(tripScreen(null, tasks, { top: reg, rest: [] }, "母", true, day)).toBeNull();
    // まだ誰が行くか決めていない家族で、出生届と児童手当が済み、行く順の先頭が母の出生連絡票になった日: パートナーの一番上は、自分の番の最初の届け
    const later = at("2027-05-05", undefined, ["birth-registration", "child-allowance"]);
    const t2 = planBirthTrip(later, "2027-05-05", "2027-05-01", undefined)!;
    expect(t2.items[0].task.id).toBe("birth-notice");
    const partner = tripScreen(t2, later, { top: null, rest: [] }, "パートナー", true, "2027-05-05")!;
    expect([partner.full, partner.top?.who]).toEqual([true, "家族"]);
    expect(tripScreen(t2, later, { top: null, rest: [] }, "母", true, "2027-05-05")!.top?.id).toBe("birth-notice");
    expect(tripDue([notice], day)).toBeNull();
  });
});
