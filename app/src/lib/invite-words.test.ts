import { describe, expect, it } from "vitest";
import { inviteCanLines, inviteHeadline, inviteSeeLine, inviteShareText, lineShareUrl, maskEmail, periodWord } from "./invite-words";

const BODY = /大丈夫|正常|異常|心配(ない|いらない)/;

describe("招待の言葉", () => {
  it("時期: 妊娠中は週、生まれた後は生後、予定日が無い・2歳を過ぎたら出さない", () => {
    expect(periodWord({ dueDate: "2027-05-10" }, "2026-10-20")).toBe("妊娠11週"); // 最終月経 2026-08-03 から 78日
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2027-08-10")).toBe("生後3か月");
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2027-05-08")).toBe("生後0日");
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2029-06-01")).toBeNull();
    expect(periodWord({ dueDate: "2027-05-10" }, "2026-07-01")).toBeNull();
    expect(periodWord(null, "2026-10-29")).toBeNull();
  });

  it("見出し: 呼び名と時期。取れない物は作らない", () => {
    expect(inviteHeadline("美咲", "妊娠11週")).toBe("美咲から、妊娠11週の母子手帳への招待です");
    expect(inviteHeadline(null, null)).toBe("ご家族から、母子手帳への招待です");
    expect(inviteHeadline("  ", "生後3か月")).toBe("ご家族から、生後3か月の母子手帳への招待です");
    expect(inviteHeadline("翔太", null)).toBe("翔太から、母子手帳への招待です");
  });

  it("メールは一部を伏せ、全体を出さない", () => {
    expect(maskEmail("papa@example.com")).toBe("p…@e…");
    expect(maskEmail("papa@example.com")).not.toContain("example");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("x")).toBe("x…");
  });

  it("入ると何ができるか: 共同の管理と読むだけで分ける。体の判断の言葉を使わない", () => {
    expect(inviteCanLines("admin")).toHaveLength(3);
    expect(inviteCanLines("admin")[0]).toContain("二人で分け");
    expect(inviteCanLines("member").join()).toContain("足す・直すはできません");
    for (const l of [...inviteCanLines("admin"), ...inviteCanLines("member")]) expect(l).not.toMatch(BODY);
  });

  it("受ける画面の見られる物: 共同の管理は母の記録も含めて全部、読むだけは子の記録と選んだ項目", () => {
    expect(inviteSeeLine("admin", [])).toContain("母の記録も");
    expect(inviteSeeLine("member", [])).toBe("見られる物: 子の記録（足す・直すはできません）");
    expect(inviteSeeLine("member", ["母の写真"])).toContain("子の記録、母の写真");
  });

  it("送る文: 相手のメール・48時間・リンクを入れ、LINE の URL に包める", () => {
    const t = inviteShareText("papa@example.com", "https://x.example/invite/abc");
    expect(t).toContain("papa@example.com");
    expect(t).toContain("48時間");
    expect(t).toContain("Safari");
    expect(t.endsWith("https://x.example/invite/abc")).toBe(true);
    expect(inviteShareText("", "L")).toContain("招待したメール");
    expect(lineShareUrl(t)).toBe(`https://line.me/R/share?text=${encodeURIComponent(t)}`);
  });
});

describe("招待の見出し: 役の名前のままの呼び名", () => {
  it("「母」は「ママ」と呼ぶ", () => {
    expect(inviteHeadline("母", "妊娠11週")).toBe("ママから、妊娠11週の母子手帳への招待です");
  });
});
