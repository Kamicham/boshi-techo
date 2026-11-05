// 健診で見せる記録の、共有の文（lib/share-text.ts・家族の声②の C・2026-11-05）。
// 病院あてなので日本語。既定は要約の1行（と足元の文）。表の全部は選んだ時だけ。名前・評価の言葉を書かない。記録はすべて作った物
import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "./demo-family";
import { SHARE_BUNDLES, shareView, type ShareSheet } from "./share-view";
import { ageText, SHARE_FOOT, shareFull, shareSummary, weekText } from "./share-text";
import { seedTecho } from "./techo-seed";

const JUDGE = /異常|正常|大丈夫|順調|増えすぎ|多い|少ない|注意|良い|悪い/;
const ALL = SHARE_BUNDLES.map((b) => b.id);

const SHEET: ShareSheet = {
  bundles: ALL,
  hideCounts: false,
  body: {
    heightCm: 158,
    preWeightKg: 50,
    bmi: 20,
    multiple: false,
    checkups: [
      { date: "2027-03-20", week: 33, day: 0, fundusCm: 30, weightKg: 58.4, bpHigh: 112, bpLow: 70, edema: "−", urineProtein: "−", urineSugar: "−" },
      { date: "2027-04-17", week: 37, day: 0, fundusCm: 33.5, weightKg: 60.1, bpHigh: 118, bpLow: 72, edema: "±", urineProtein: "−", urineSugar: "−" },
    ],
    home: [{ date: "2027-04-10", week: 36, day: 0, weightKg: 59.8, bpHigh: 115, bpLow: 71 }],
  },
  growth: [],
  checkups: [{ date: "2027-04-17", kind: "pregnancy", week: 37, day: 0 }],
  vaccines: [{ date: "2027-03-06", vaccine: "RSウイルス（母子免疫）", dose: "妊娠31週", mother: true }],
  next: { date: "2027-04-24", time: "10:00" },
  questions: [
    { forChild: false, text: "お産の入院の持ち物" },
    { forChild: false, text: "里帰りの時期" },
  ],
  motherHealth: { heightCm: 158, preWeightKg: 50, allergy: "卵" },
};

describe("共有の文（健診で見せる記録）", () => {
  it("要約は1行と足元の文の2行。いちばん新しい健診の数字・次の予約・聞きたい事の数", () => {
    const s = shareSummary(SHEET, "2027-04-18");
    const lines = s.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("健診で見せる記録（2027年4月18日）: 妊婦健診 4/17（37週） 体重 60.1kg・血圧 118/72・子宮底長 33.5cm。次の予約 4/24 10:00。健診で聞きたい事 2件");
    expect(lines[1]).toBe(SHARE_FOOT);
  });

  it("表の全部は、1枚と同じ並びで、足元の文で終わる", () => {
    const s = shareFull(SHEET, "2027-04-18");
    const order = ["■ 妊娠前", "■ 妊娠中の経過", "■ 家で測った物", "■ 予防接種", "■ 次の予約", "■ 健診で聞きたい事", "■ 妊婦の健康状態"].map((h) => s.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(s).toContain("4/17 37週 33.5cm 60.1kg 118/72 ± − −");
    expect(s).toContain("4/10 36週 体重 59.8kg・血圧 115/71");
    expect(s).toContain("3/6 （ママ）RSウイルス（母子免疫） 妊娠31週");
    expect(s.endsWith(SHARE_FOOT)).toBe(true);
    // 身長と妊娠前の体重は、体の束にあるので健康状態の所に2回書かない
    expect(s.match(/158/g)).toHaveLength(1);
  });

  it("妊婦健診の日は、妊娠中の経過の表がある時は省く（同じ日を2回書かない）。表が無ければ書く", () => {
    expect(shareFull(SHEET, "2027-04-18")).not.toContain("■ 健診の日");
    expect(shareFull({ ...SHEET, body: undefined }, "2027-04-18")).toContain("■ 健診の日\n4/17 妊婦健診（37週）");
  });

  it("体の束が無い時は、身長と妊娠前の体重を健康状態の所に書く", () => {
    const s = shareFull({ ...SHEET, body: undefined }, "2027-04-18");
    expect(s).toContain("身長: 158cm");
    expect(s).toContain("妊娠前の体重: 50kg");
  });

  it("つらい別れの家族には週数を書かない", () => {
    // 妊娠中の RS の回（妊娠週数）は、shareView がつらい別れの家族には入れない
    const quiet: ShareSheet = { ...SHEET, hideCounts: true, vaccines: [{ date: "2027-03-06", vaccine: "RSウイルス（母子免疫）", mother: true }] };
    expect(weekText(quiet, 37, 2)).toBe("");
    expect(shareSummary(quiet, "2027-04-18")).not.toMatch(/\d+週/);
    expect(shareFull(quiet, "2027-04-18")).not.toMatch(/\d+週/);
  });

  it("数字が無い時も、何も無いと分かる1行と足元の文", () => {
    const s = shareSummary({ bundles: ALL, hideCounts: false, body: null, growth: [], checkups: [], vaccines: [], next: null, questions: [], motherHealth: null }, "2027-04-18");
    expect(s).toBe(`健診で見せる記録（2027年4月18日）: 数字はまだありません\n${SHARE_FOOT}`);
  });

  it("双子は「1人目」「2人目」で分ける（名前は書かない）", () => {
    const twins: ShareSheet = {
      bundles: ALL,
      hideCounts: false,
      growth: [
        { child: 1, points: [{ date: "2027-05-26", ageDays: 30, weightKg: 3.9 }] },
        { child: 2, points: [{ date: "2027-05-26", ageDays: 30, weightKg: 3.6 }] },
      ],
    };
    expect(shareSummary(twins, "2027-05-27").split("\n")[0]).toBe("健診で見せる記録（2027年5月27日）: 1人目 体重 3.9kg（5/26・生後30日）。2人目 体重 3.6kg（5/26・生後30日）");
    expect(shareFull(twins, "2027-05-27")).toContain("■ 2人目 身長・体重・頭囲");
  });

  it("生後の言い方（30日まで日・その後はか月）", () => {
    expect(ageText(0)).toBe("生後0日");
    expect(ageText(30)).toBe("生後30日");
    expect(ageText(92)).toBe("生後3か月");
  });

  it("見本の家族の37週と生後3か月: 名前・評価の言葉が入らない", () => {
    for (const today of ["2027-04-18", "2027-07-26"]) {
      const entries = seedTecho(DEMO_FAMILY, today);
      const sheet = shareView({ entries, plan: null, family: DEMO_FAMILY, today }, { viewer: "mother", bundles: ALL });
      for (const s of [shareSummary(sheet, today), shareFull(sheet, today)]) {
        expect(s, today).not.toMatch(JUDGE);
        for (const m of DEMO_FAMILY.members) expect(s, `${today} ${m.name}`).not.toContain(m.name);
        if (DEMO_FAMILY.childName) expect(s).not.toContain(DEMO_FAMILY.childName);
      }
      expect(shareSummary(sheet, today), today).toMatch(today === "2027-04-18" ? /妊婦健診 \d+\/\d+（3\d週/ : /体重 \d+(\.\d)?kg（\d+\/\d+・生後\d+か月）/);
    }
  });
});
