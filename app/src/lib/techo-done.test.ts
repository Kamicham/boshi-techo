import { describe, expect, it } from "vitest";
import { checkupMonths, doneFromTecho, doseOf, vaxKind } from "./techo-done";

type R = Parameters<typeof doneFromTecho>[0][number];
const v = (date: string, vaccine: string, dose?: string, pending = false): R => ({ page: "vaccine", date, values: { vaccine, ...(dose != null ? { dose } : {}) }, pending });
const c = (date: string, checkup: string, pending = false): R => ({ page: "child-checkup", date, values: { checkup }, pending });
const run = (es: R[], today = "2030-01-01") => [...doneFromTecho(es, today)].sort();

describe("呼び方の揺れ", () => {
  it("接種の名前", () => {
    expect(vaxKind("水ぼうそう")).toBe("var");
    expect(vaxKind("水痘")).toBe("var");
    expect(vaxKind("麻しん風しん（MR）")).toBe("mr");
    expect(vaxKind("ＭＲ")).toBe("mr");
    expect(vaxKind("麻疹風疹混合")).toBe("mr");
    expect(vaxKind("ヒブ")).toBe("five");
    expect(vaxKind("四種混合")).toBe("five");
    expect(vaxKind("５種混合")).toBe("five");
    expect(vaxKind("Ｂ型肝炎")).toBe("hepb");
    expect(vaxKind("ｂｃｇ")).toBe("bcg");
    expect(vaxKind("ロタウイルス")).toBe("rota");
    expect(vaxKind("小児用肺炎球菌")).toBe("pcv");
    expect(vaxKind("日本脳炎")).toBe("je");
    expect(vaxKind("おたふくかぜ")).toBeNull();
  });
  it("回の書き方", () => {
    for (const d of ["1回目", "第1期", "1期", "1", "１回目", "一回目", "第１回"]) expect(doseOf("pcv", d), d).toBe(1);
    expect(doseOf("pcv", "4回目（追加）")).toBe(4);
    expect(doseOf("five", "追加")).toBe(4);
    expect(doseOf("mr", "第2期")).toBe(2);
    expect(doseOf("mr", "1期")).toBe(1);
    expect(doseOf("je", "1期 2回目")).toBe(2);
    expect(doseOf("je", "1期追加")).toBe(3);
    expect(doseOf("je", "2期")).toBe(0);
    expect(doseOf("je", "1期")).toBeNull();
    expect(doseOf("pcv", "")).toBeNull();
  });
  it("健診の名前", () => {
    expect(checkupMonths("1か月児健診")).toBe(1);
    expect(checkupMonths("１ヶ月健診")).toBe(1);
    expect(checkupMonths("3〜4か月児健診")).toBe(3);
    expect(checkupMonths("3～4ヵ月健診")).toBe(3);
    expect(checkupMonths("9〜10か月児健診")).toBe(9);
    expect(checkupMonths("1歳6か月児健診")).toBe(18);
    expect(checkupMonths("1歳半健診")).toBe(18);
    expect(checkupMonths("3歳児健診")).toBe(36);
  });
});

describe("手帳の記録から済み", () => {
  it("作った記録の形（techo-seed の VACCINES・CHILD_CHECKUPS）で、2歳までの接種と健診がみな済み", () => {
    const es: R[] = [
      ...["B型肝炎", "ロタウイルス", "小児用肺炎球菌", "五種混合"].map((n) => v("2027-07-12", n, "1回目")),
      ...["B型肝炎", "ロタウイルス", "小児用肺炎球菌", "五種混合"].map((n) => v("2027-08-12", n, "2回目")),
      v("2027-09-12", "小児用肺炎球菌", "3回目"),
      v("2027-09-12", "五種混合", "3回目"),
      v("2027-10-12", "BCG"),
      v("2027-12-12", "B型肝炎", "3回目"),
      v("2028-05-12", "麻しん風しん（MR）", "1期"),
      v("2028-05-12", "水痘", "1回目"),
      v("2028-11-12", "水痘", "2回目"),
      c("2027-06-12", "1か月児健診"),
      c("2027-08-12", "3〜4か月児健診"),
      c("2027-10-12", "6〜7か月児健診"),
      c("2028-02-12", "9〜10か月児健診"),
      c("2028-11-12", "1歳6か月児健診"),
    ];
    expect(run(es)).toEqual(
      ["bcg", "checkup-18m", "checkup-3-4m", "checkup-9-10m", "first-birthday-vaccines", "one-month-checkup", "vaccines-18m", "vaccines-3m", "vaccines-4m", "vaccines-7m", "vaccines-start"].sort(),
    );
  });

  it("候補（pending）と今日より後の記録は数えない", () => {
    expect(run([v("2027-10-12", "BCG", undefined, true)])).toEqual([]);
    expect(run([v("2027-10-12", "BCG")], "2027-10-11")).toEqual([]);
    expect(run([c("2027-06-12", "1か月児健診", true)])).toEqual([]);
  });

  it("麻しん風しん（MR）1期だけでは1歳の接種を済みにしない（水ぼうそうの1回目を隠さない）", () => {
    expect(run([v("2028-05-12", "MR", "1期")])).toEqual([]);
    expect(run([v("2028-05-12", "MR", "1期"), v("2028-05-20", "水ぼうそう", "1回目")])).toEqual(["first-birthday-vaccines"]);
  });

  it("回が書いていない時は、日付の順に数える（同じ日の四種混合とヒブは1回）", () => {
    const es = [v("2028-05-12", "水痘"), v("2028-11-12", "水ぼうそう"), v("2028-05-12", "麻しん風しん")];
    expect(run(es)).toEqual(["first-birthday-vaccines", "vaccines-18m"]);
    const four = ["2027-07-01", "2027-08-01", "2027-09-01"].flatMap((d) => [v(d, "四種混合"), v(d, "ヒブ"), v(d, "小児用肺炎球菌")]);
    expect(run(four)).toEqual(["vaccines-4m"]);
  });

  it("1回目の日だけ足りない（B型肝炎が無い）時は、2か月の接種を済みにしない", () => {
    expect(run([v("2027-07-12", "五種混合", "1回目"), v("2027-07-12", "小児用肺炎球菌", "1回目")])).toEqual([]);
  });

  it("3歳から先: 3歳児健診・日本脳炎・MR 2期", () => {
    const es = [c("2030-06-01", "3歳児健診"), v("2030-06-01", "日本脳炎", "1期 1回目"), v("2030-06-20", "日本脳炎", "1期 2回目"), v("2033-06-01", "麻しん風しん", "第2期")];
    expect(run(es, "2034-01-01")).toEqual(["checkup-3y", "je-vaccine-1", "mr-vaccine-2"]);
    expect(run([...es, v("2031-06-01", "日本脳炎", "1期追加")], "2034-01-01")).toContain("je-vaccine-1-booster");
  });

  it("予定の id はみな milestones にある", async () => {
    const { MILESTONES } = await import("./milestones");
    const known = new Set(MILESTONES.map((m) => m.id));
    const all = ["vaccines-start", "vaccines-3m", "vaccines-4m", "vaccines-7m", "bcg", "first-birthday-vaccines", "vaccines-18m", "mr-vaccine-2", "je-vaccine-1", "je-vaccine-1-booster", "one-month-checkup", "checkup-3-4m", "checkup-9-10m", "checkup-18m", "checkup-3y"];
    for (const id of all) expect(known.has(id), id).toBe(true);
  });
});
