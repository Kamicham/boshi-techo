// からだの記録の並び（lib/body-series.ts）。拾う物・外す物・週の数え直し・双子・つらい別れ・体重の目安の幅。
import { describe, expect, it } from "vitest";
import { bodySeries, gainGuide } from "./body-series";
import { addMonths } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import type { TechoEntry } from "./techo";
import { seedTecho } from "./techo-seed";
import { SIM_FAMILIES } from "@/sim/families";

// 予定日 2027-05-10 → 最終月経 2026-08-03。生まれた日 2027-04-26
const F = { dueDate: "2027-05-10", birthDate: "2027-04-26", childName: "ひなた", situation: {} };
const TODAY = "2027-06-01";
const e = (page: TechoEntry["page"], date: string, values: TechoEntry["values"], more: Partial<TechoEntry> = {}): TechoEntry => ({ page, date, title: "", values, source: "text", ...more });

describe("ママの妊婦健診", () => {
  it("週は日付と予定日から数え直す（保存された週の字は見ない）。OK 待ち・今日より後・生まれた日以後の健診は外す", () => {
    const s = bodySeries(
      [
        e("pregnancy-checkup", "2026-10-26", { week: "30週", weightKg: 53.4, bpHigh: 108, bpLow: 66 }),
        e("pregnancy-checkup", "2027-01-18", { weightKg: 58.2, fundusCm: 21, urineProtein: "−", urineSugar: "−", edema: "−" }),
        e("pregnancy-checkup", "2027-02-01", { weightKg: 59 }, { pending: true }),
        e("pregnancy-checkup", "2027-04-26", { weightKg: 64 }),
        e("pregnancy-checkup", "2027-05-03", { weightKg: 60 }),
        e("pregnancy-checkup", "2027-06-05", { weightKg: 59 }),
      ],
      F,
      TODAY,
    )!;
    expect(s.mother.checkups).toEqual([
      { date: "2026-10-26", week: 12, day: 0, weightKg: 53.4, bpHigh: 108, bpLow: 66 },
      { date: "2027-01-18", week: 24, day: 0, weightKg: 58.2, fundusCm: 21, urineProtein: "−", urineSugar: "−", edema: "−" },
    ]);
  });

  it("同じ日の記録は1行に（先に入っている値を残し、空の欄だけ埋める）。字の数も読む", () => {
    const s = bodySeries([e("pregnancy-checkup", "2027-01-18", { weightKg: "58.2" }), e("pregnancy-checkup", "2027-01-18", { weightKg: 59, bpHigh: 112, bpLow: 70 })], F, TODAY)!;
    expect(s.mother.checkups).toEqual([{ date: "2027-01-18", week: 24, day: 0, weightKg: 58.2, bpHigh: 112, bpLow: 70 }]);
  });

  it("身長と妊娠前の体重は、いちばん新しく書いた値。両方そろえば BMI（小数1桁）", () => {
    const s = bodySeries([e("mother-health", "2026-10-26", { heightCm: 158, weightKg: 52 }), e("mother-health", "2026-11-20", { weightKg: 53 })], F, TODAY)!;
    expect(s.mother).toMatchObject({ heightCm: 158, preWeightKg: 53, bmi: 21.2, multiple: false });
    expect(bodySeries([e("mother-health", "2026-10-26", { weightKg: 52 })], F, TODAY)!.mother.bmi).toBeUndefined();
  });
});

describe("家で測った物（page home）", () => {
  it("1日に何回あってもそのまま並べる。週は妊娠中の物だけ。数が1つも無い物は外す", () => {
    const s = bodySeries(
      [e("home", "2027-01-20", { weightKg: 58.5 }), e("home", "2027-01-20", { bpHigh: 114, bpLow: 72, tempC: 36.6 }), e("home", "2027-05-01", { bpHigh: 120, bpLow: 80 }), e("home", "2027-01-21", {})],
      F,
      TODAY,
    )!;
    expect(s.mother.home).toEqual([
      { date: "2027-01-20", week: 24, day: 2, weightKg: 58.5 },
      { date: "2027-01-20", week: 24, day: 2, bpHigh: 114, bpLow: 72, tempC: 36.6 },
      { date: "2027-05-01", bpHigh: 120, bpLow: 80 },
    ]);
    // 健診の行には入らない（受診券の残りに数えない）
    expect(s.mother.checkups).toEqual([]);
  });
});

describe("赤ちゃん", () => {
  it("体重・身長・頭囲を who ごとに。出生・新生児の g は kg に。同じ日は成長 → 乳幼児健診 → 新生児 → 出生の順の値を先に。who の無い記録は子の名前の線へ", () => {
    const s = bodySeries(
      [
        e("growth", "2027-04-20", { weightKg: 3 }),
        e("birth", "2027-04-26", { weightG: 3120, heightCm: 49.5, headCm: 33 }, { who: "ひなた" }),
        e("newborn", "2027-05-01", { weightG: 3000 }, { who: "ひなた" }),
        e("child-checkup", "2027-05-26", { weightKg: 4.3, headCm: 37 }, { who: "ひなた" }),
        e("growth", "2027-05-26", { weightKg: 4.2, heightCm: 53 }),
        e("child-checkup", "2027-05-27", { checkup: "1か月児健診" }, { who: "ひなた" }),
      ],
      F,
      TODAY,
    )!;
    expect(s.babies).toEqual([
      {
        who: "ひなた",
        points: [
          { date: "2027-04-26", ageDays: 0, weightKg: 3.12, heightCm: 49.5, headCm: 33 },
          { date: "2027-05-01", ageDays: 5, weightKg: 3 },
          { date: "2027-05-26", ageDays: 30, weightKg: 4.2, heightCm: 53, headCm: 37 },
        ],
      },
    ]);
  });

  it("生まれる前の日（時計を戻した見本の家族）は、赤ちゃんの線を作らない", () => {
    expect(bodySeries([e("growth", "2027-05-26", { weightKg: 4.2 })], F, "2027-03-01")!.babies).toEqual([]);
  });

  it("双子は線を分ける（多胎の印も立つ）", () => {
    const s = bodySeries(
      [e("birth", "2027-04-26", { weightG: 2400 }, { who: "あお（2人目）" }), e("birth", "2027-04-26", { weightG: 2500 }, { who: "あお（1人目）" })],
      { ...F, childName: "あお", situation: { babies: 2 } },
      TODAY,
    )!;
    expect(s.babies.map((b) => b.who)).toEqual(["あお（1人目）", "あお（2人目）"]);
    expect(s.mother.multiple).toBe(true);
  });
});

describe("つらい別れの家族", () => {
  it("数を出さない（null）", () => {
    expect(bodySeries([e("pregnancy-checkup", "2026-10-26", { weightKg: 53 })], { ...F, situation: { quiet: "loss" } }, TODAY)).toBeNull();
  });
});

describe("作った家族の記録（techo-seed）から", () => {
  it("見本の家族: 点の数は今日までの妊婦健診の数と同じ。未来の点は無く、週は増えていく", () => {
    for (const today of ["2026-12-01", "2027-04-10", "2028-04-28"]) {
      const es = seedTecho(DEMO_FAMILY, today);
      const s = bodySeries(es, DEMO_FAMILY, today)!;
      const want = es.filter((x) => x.page === "pregnancy-checkup" && !x.pending && x.date <= today && x.date < DEMO_FAMILY.birthDate!).length;
      expect(s.mother.checkups.length, today).toBe(want);
      expect(s.mother.checkups.every((r) => r.date <= today && r.weightKg !== undefined)).toBe(true);
      const weeks = s.mother.checkups.map((r) => r.week * 7 + r.day);
      expect(weeks).toEqual([...weeks].sort((a, b) => a - b));
      expect(s.babies.flatMap((b) => b.points).every((p) => p.date <= today && p.ageDays >= 0)).toBe(true);
    }
  });

  it("30家族の双子（sim-07）は、生まれた後に線が2本", () => {
    const f = SIM_FAMILIES.find((x) => x.id === "sim-07")!;
    expect(f.situation?.babies).toBe(2);
    const today = addMonths(f.birthDate!, 12);
    const s = bodySeries(seedTecho(f, today), f, today)!;
    expect(s.babies).toHaveLength(2);
    expect(s.babies.every((b) => b.points.length > 1)).toBe(true);
    expect(s.mother.multiple).toBe(true);
  });
});

describe("体重の目安（日本産科婦人科学会 2021年3月8日）", () => {
  it("妊娠前の BMI で幅を決める。30以上は個別対応、多胎と BMI が無い時は出さない", () => {
    expect(gainGuide(18.4, false)).toEqual({ kind: "range", lowKg: 12, highKg: 15 });
    expect(gainGuide(18.5, false)).toEqual({ kind: "range", lowKg: 10, highKg: 13 });
    expect(gainGuide(24.9, false)).toEqual({ kind: "range", lowKg: 10, highKg: 13 });
    expect(gainGuide(25, false)).toEqual({ kind: "range", lowKg: 7, highKg: 10 });
    expect(gainGuide(29.9, false)).toEqual({ kind: "range", lowKg: 7, highKg: 10 });
    expect(gainGuide(30, false)).toEqual({ kind: "individual" });
    expect(gainGuide(21, true)).toBeNull();
    expect(gainGuide(undefined, false)).toBeNull();
  });
});
