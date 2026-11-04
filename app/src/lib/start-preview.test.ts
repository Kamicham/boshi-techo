import { describe, expect, it } from "vitest";
import { beforeLead, prenatalBookDays, prenatalBookWhen } from "./start-preview";
import { addDays, lmpFromDue } from "./clock";

const due = "2027-06-10";
const lmp = lmpFromDue(due);
const wk = (w: number, d = 0) => addDays(lmp, w * 7 + d);

describe("3つ答えた後の予告（自分の手帳の入口）", () => {
  it("始める前に目安が過ぎた事が無ければ、見出しは出さない", () => {
    expect(beforeLead([], "2026-11-04")).toBeNull();
  });
  it("1件なら名指しだけ。目安の日と「今からでもできます」を添える", () => {
    const l = beforeLead([{ plain: "妊娠の届出をする", deadlineDate: "2026-10-30" }], "2026-11-04")!;
    expect(l.head).toBe("まず、妊娠の届出をする（目安 10/30（金） を過ぎています。今からでもできます）");
    expect(l.more).toBeNull();
  });
  it("2件以上なら、目安の日が一番早い1件を名指しして「ほか◯件」", () => {
    const l = beforeLead(
      [
        { plain: "B", deadlineDate: "2026-11-01" },
        { plain: "A", deadlineDate: "2026-10-20" },
        { plain: "C", deadlineDate: "2026-11-02" },
      ],
      "2026-11-04",
    )!;
    expect(l.head.startsWith("まず、A（目安 10/20")).toBe(true);
    expect(l.more).toBe("ほか2件");
  });
  it("判定の言葉を使わない", () => {
    const l = beforeLead([{ plain: "X", deadlineDate: "2026-10-30" }], "2026-11-04")!;
    expect(l.head).not.toMatch(/大丈夫|異常|正常|問題な/);
  });
});

describe("予告の「次の妊婦健診を予約する」（「いま」と同じ7日の窓）", () => {
  it("記録の無い妊娠中（8週以降）は、目安が今日なので今日ごろ", () => {
    expect(prenatalBookDays({ dueDate: due }, wk(20))).toBe(0);
    expect(prenatalBookWhen(0)).toBe("今日ごろ");
  });
  it("8週の手前は8週の日が目安。7日以内なら出し、それより先は出さない", () => {
    expect(prenatalBookDays({ dueDate: due }, wk(7, 2))).toBe(5);
    expect(prenatalBookWhen(5)).toBe("あと5日ごろ");
    expect(prenatalBookDays({ dueDate: due }, wk(6))).toBeNull();
  });
  it("病院で次の日が決まっている時・生まれた後・予定日を過ぎた後は出さない", () => {
    expect(prenatalBookDays({ dueDate: due }, wk(20), [], true)).toBeNull();
    expect(prenatalBookDays({ dueDate: due, birthDate: wk(39) }, wk(39, 3))).toBeNull();
    expect(prenatalBookDays({ dueDate: due }, addDays(due, 1))).toBeNull();
  });
  it("前回の健診から間隔が先なら出さない（20週に受けた→24週が目安）", () => {
    expect(prenatalBookDays({ dueDate: due }, wk(20, 1), [wk(20)])).toBeNull();
    expect(prenatalBookDays({ dueDate: due }, wk(23), [wk(20)])).toBe(7);
  });
});
