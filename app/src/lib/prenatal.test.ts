import { describe, expect, it } from "vitest";
import { intervalDays, prenatalState } from "./prenatal";
import { addDays, lmpFromDue } from "./clock";

const due = "2027-06-10";
const lmp = lmpFromDue(due);
const wk = (w: number, d = 0) => addDays(lmp, w * 7 + d);

describe("妊婦健診の目安と受診券（第1波⑧）", () => {
  it("間隔の境目（23週6日・24週0日・35週6日・36週0日）", () => {
    expect(intervalDays(23)).toBe(28);
    expect(intervalDays(24)).toBe(14);
    expect(intervalDays(35)).toBe(14);
    expect(intervalDays(36)).toBe(7);
  });
  it("前回から間隔で次を出し、境目をまたぐ時は境目で止める", () => {
    expect(prenatalState({ dueDate: due }, wk(16, 1), [wk(16)])!.next).toBe(wk(20));
    expect(prenatalState({ dueDate: due }, wk(22, 1), [wk(22)])!.next).toBe(wk(24));
  });
  it("同じ日は1回、8週より前と今日より後は数えない。残りは0より下にならない", () => {
    const s = prenatalState({ dueDate: due }, wk(20), [wk(6), wk(10), wk(10), wk(14), wk(30)])!;
    expect(s.used).toBe(2);
    expect(s.remaining).toBe(12);
    const many = Array.from({ length: 16 }, (_, i) => wk(8 + i));
    const o = prenatalState({ dueDate: due }, wk(30), many, { tickets: 14 })!;
    expect(o.remaining).toBe(0);
    expect(o.over).toBe(true);
  });
  it("券の数は家族が直せる。払った額の合計だけ出す", () => {
    const s = prenatalState({ dueDate: due }, wk(20), [], { tickets: 16, paid: [{ date: wk(12), yen: 3000 }, { date: wk(16), yen: 1500 }] })!;
    expect(s.total).toBe(16);
    expect(s.totalSource).toBe("家族");
    expect(s.paidYen).toBe(4500);
  });
  it("予定日を過ぎたら目安を出さず、生まれた後と授かる前は出さない", () => {
    expect(prenatalState({ dueDate: due }, addDays(due, 1), [wk(39)])!.next).toBeNull();
    expect(prenatalState({ dueDate: due, birthDate: "2027-06-01" }, "2027-06-02", [])).toBeNull();
    expect(prenatalState({ dueDate: due }, addDays(lmp, -3), [])).toBeNull();
  });
});
