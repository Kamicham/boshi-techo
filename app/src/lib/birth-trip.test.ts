import { describe, expect, it } from "vitest";
import { babyInsuranceOf, mergeBring, planBirthTrip, tripWhere } from "./birth-trip";
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
  it("16日目と、残りが1件の時は出さない", () => {
    expect(planBirthTrip(at("2027-05-17"), "2027-05-17", "2027-05-01", undefined)).toBeNull();
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
