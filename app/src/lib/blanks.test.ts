import { describe, expect, it } from "vitest";
import { applyBlanks, blankKey, findBlanks, isRoleWord, jpDate } from "./blanks";
import { officeSearch, shortDeadline, shortWhere } from "./local-place";

describe("blankKey", () => {
  it("そう変わらない物を読み分ける", () => {
    expect(blankKey("会社名")).toBe("company");
    expect(blankKey("部署名")).toBe("dept");
    expect(blankKey("上司の名前")).toBe("boss");
    expect(blankKey("上司のメールアドレス")).toBe("email");
    expect(blankKey("人事のご担当者様")).toBe("hr");
    expect(blankKey("担当者名", "（CC: 人事担当")).toBe("hr");
    expect(blankKey("産院の名前")).toBe("hospital");
    expect(blankKey("産院名")).toBe("hospital");
    expect(blankKey("自分の名前")).toBe("myName");
    expect(blankKey("部署名・内線番号")).toBeUndefined();
    expect(blankKey("育休を始める日")).toBeUndefined();
    expect(blankKey("赤ちゃんの名前")).toBeUndefined();
    expect(blankKey("人事部")).toBeUndefined();
    expect(blankKey("上司の名前", "総務部 ")).toBe("boss");
    expect(blankKey("個人のメールアドレス")).toBeUndefined();
    expect(findBlanks({ to: "", title: "【ご報告】出産", body: "" })).toHaveLength(0);
  });
});

describe("findBlanks / applyBlanks", () => {
  const fields = {
    to: "【会社名】【部署名】【上司の名前】様（CC: 人事担当【担当者名】様）",
    title: "育休のご相談",
    body: "【上司の名前】様\n■希望する期間\n2026年【 】月【 】日 〜（【 】日間）\n開始は【育休を始める日】\n【候補日時1】\n【自分の名前】",
  };
  it("名前のある物は1つに、名前の無い物は1つずつ", () => {
    const b = findBlanks(fields);
    expect(b.filter((x) => x.raw === "【上司の名前】")).toHaveLength(1);
    const empty = b.filter((x) => x.at);
    expect(empty).toHaveLength(2);
    expect(empty[0].raw).toBe("2026年【 】月【 】日");
    expect(empty[0].input).toBe("date");
    expect(empty[0].label).toContain("希望する期間");
    expect(empty[1].numeric).toBe(true);
    expect(b.find((x) => x.raw === "【育休を始める日】")?.input).toBe("date");
    expect(b.find((x) => x.raw === "【候補日時1】")?.input).toBe("datetime-local");
    expect(b.find((x) => x.raw === "【担当者名】")?.key).toBe("hr");
    expect(b.find((x) => x.raw === "【担当者名】")?.label).toBe("人事の担当者名");
  });
  it("名前の無い物はその1つだけ埋める", () => {
    const b = findBlanks(fields).filter((x) => x.at);
    const out = applyBlanks(fields, [
      { blank: b[1], value: "14" },
      { blank: b[0], value: "2026年12月5日" },
    ]);
    expect(out.body).toContain("2026年12月5日 〜（14日間）");
  });
  it("日付と役割の言葉", () => {
    expect(jpDate("2027-01-05")).toBe("2027年1月5日");
    expect(jpDate("2027-01-05T14:00")).toBe("1月5日 14:00");
    expect(isRoleWord("パパ")).toBe(true);
    // /start で足した仮の名前（C04①）
    expect(isRoleWord("パートナー")).toBe(true);
    expect(isRoleWord("翔太")).toBe(false);
  });
});

describe("窓口の表示", () => {
  const where =
    "各区役所の区民課（戸籍係）、または各支所（平日8:30〜17:15。大宮駅支所も17:15まで）。夜間・休日は各区役所の休日夜間受付窓口。電話番号は西区048-620-2633";
  it("どこへは1行目だけ", () => {
    expect(shortWhere(where)).toBe("各区役所の区民課、または各支所");
  });
  it("いつまでは日数だけ（法律は外す）", () => {
    expect(shortDeadline("生まれた日を含めて14日以内（戸籍法第49条）。14日目が休日なら休み明けの日まで。")).toBe("生まれた日を含めて14日以内");
    // 第31回: 去年度の受付の始まりを「いつまで」に出さない
    expect(shortDeadline("令和9年度の締切は町のお知らせで確かめる。令和8年度は第1次が11月4日〜11月28日、第2次が2月13日〜3月13日（転入は4月1日まで）だった")).toBe("令和9年度の締切は町のお知らせで確かめる");
    expect(shortDeadline("第1次は11月4日〜11月28日")).toBe("11月28日");
  });
  it("政令市は区役所で探す", () => {
    expect(officeSearch({ prefecture: "埼玉県", city: "さいたま市", office: "さいたま市役所", address: "浦和区常盤6-4-4" })).toBe("埼玉県さいたま市 区役所");
    expect(officeSearch({ prefecture: "埼玉県", city: "さいたま市浦和区" })).toBe("埼玉県さいたま市浦和区役所");
    expect(officeSearch({ prefecture: "奈良県", city: "上牧町", office: "上牧町役場" })).toBe("奈良県上牧町役場");
  });
});

describe("fillFamilyBlanks（家族の情報で分かる空欄）", () => {
  const f = {
    city: "さいたま市",
    prefecture: "埼玉県",
    dueDate: "2027-05-10",
    birthDate: "2027-04-26",
    childName: "ひなた",
    members: [
      { id: "a", name: "美咲", role: "母" },
      { id: "b", name: "パパ", role: "パートナー" },
    ],
  };
  it("町名・都道府県・母の名前・予定日・書き手を埋める", async () => {
    const { fillFamilyBlanks } = await import("./blanks");
    expect(fillFamilyBlanks("【町名】【都道府県】の窓口へ。【母の名前】・予定日【出産予定日】【名前】", f, { writer: "美咲" })).toBe(
      "さいたま市埼玉県の窓口へ。美咲・予定日2027年5月10日美咲",
    );
  });
  it("呼び名が「パパ」のパートナーは埋めず、覚えた名前があれば使う", async () => {
    const { fillFamilyBlanks } = await import("./blanks");
    expect(fillFamilyBlanks("【パートナーの名前】", f)).toBe("【パートナーの名前】");
    expect(fillFamilyBlanks("【パートナーの名前】", f, { names: { b: "佐藤 翔太" } })).toBe("佐藤 翔太");
  });
  it("/start で足した仮の名前「パートナー」「ママ」は、名前の空欄に入れない（C04①）", async () => {
    const { fillFamilyBlanks } = await import("./blanks");
    const started = { ...f, members: [{ id: "m0", name: "ママ", role: "母" }, { id: "m1", name: "パートナー", role: "パートナー" }] };
    expect(fillFamilyBlanks("【パートナーの名前】・【母の名前】", started)).toBe("【パートナーの名前】・【母の名前】");
  });
  it("書き手が分からなければ【名前】は残す", async () => {
    const { fillFamilyBlanks } = await import("./blanks");
    expect(fillFamilyBlanks("【名前】", f)).toBe("【名前】");
  });
});
