// 作った家族の体格と、出産までに増える量が、現実の割合に近い事（家族の声②・プランの B の8・2026-11-05）。
// 元: こども家庭庁「令和5年乳幼児身体発育調査」結果の概要 p.21 の表14（母のふだんの BMI）・表15（BMI 別の出産直前とふだんの体重の差。
// 病院調査・単胎・正期産）。見本の家族 demo-sato は前のまま（動画と見本の画面を変えない）。
import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "./demo-family";
import { BMI_SHARE, bodyOf, GAIN_SHARE, seedTecho } from "./techo-seed";

const IDS = Array.from({ length: 2000 }, (_, i) => `pop-${String(i + 1).padStart(4, "0")}`);
const classOf = (bmi: number) => BMI_SHARE.findIndex((b) => bmi >= b.lo && bmi < b.hi);
const share = (rows: readonly { p: number }[]) => {
  const sum = rows.reduce((n, r) => n + r.p, 0);
  return rows.map((r) => (r.p / sum) * 100);
};

describe("作った家族の体格と増え方（令和5年乳幼児身体発育調査 表14・表15）", () => {
  it("BMI の区分の割合が表14に近い（不詳を除いて割り直した値の ±2.5 ポイント）", () => {
    const want = share(BMI_SHARE);
    const n = BMI_SHARE.map(() => 0);
    for (const id of IDS) n[classOf(bodyOf(id).bmi)]++;
    BMI_SHARE.forEach((_, k) => expect(Math.abs((n[k] / IDS.length) * 100 - want[k]), `区分 ${k}（${n[k]}人）`).toBeLessThan(2.5));
  });

  it("ふつうの体格（18.5〜25）の増え方の割合が表15に近い（10kg 未満・10〜13kg・13kg 超。±4 ポイント）", () => {
    const want = share(GAIN_SHARE[1]);
    const gains = IDS.map(bodyOf).filter((b) => classOf(b.bmi) === 1).map((b) => b.gainKg);
    const n = [gains.filter((g) => g < 10).length, gains.filter((g) => g >= 10 && g < 13).length, gains.filter((g) => g >= 13).length];
    n.forEach((c, k) => expect(Math.abs((c / gains.length) * 100 - want[k]), `幅 ${k}（${c}人）`).toBeLessThan(4));
  });

  it("どの家族も、区分の幅の中の値（BMI 16.5〜35・増え方 0〜18kg）", () => {
    for (const id of IDS) {
      const { bmi, gainKg } = bodyOf(id);
      expect(bmi).toBeGreaterThanOrEqual(16.5);
      expect(bmi).toBeLessThan(35);
      expect(gainKg).toBeGreaterThanOrEqual(0);
      expect(gainKg).toBeLessThan(18);
    }
  });

  it("見本の家族 demo-sato は前のまま（BMI 21±1.8・増え方 10〜13kg・子宮底長は週数−3 で揺らぎなし）", () => {
    const { bmi, gainKg } = bodyOf("demo-sato");
    expect(bmi).toBeGreaterThanOrEqual(19.2);
    expect(bmi).toBeLessThanOrEqual(22.8);
    expect(gainKg).toBeGreaterThanOrEqual(10);
    expect(gainKg).toBeLessThanOrEqual(13);
    for (const e of seedTecho(DEMO_FAMILY, "2027-04-25")) {
      if (e.page !== "pregnancy-checkup" || e.values.fundusCm === undefined) continue;
      const w = parseInt(String(e.values.week), 10);
      expect(e.values.fundusCm, e.title).toBe(Math.min(33, w - 3));
    }
  });

  it("作った家族の子宮底長は 0.5cm 刻みで、週数−3（33cm まで）の ±1.5cm の中", () => {
    let seen = 0;
    let moved = 0;
    for (const id of IDS.slice(0, 200)) {
      for (const e of seedTecho({ ...DEMO_FAMILY, id }, "2027-04-25")) {
        if (e.page !== "pregnancy-checkup" || e.values.fundusCm === undefined) continue;
        const v = Number(e.values.fundusCm);
        const base = Math.min(33, parseInt(String(e.values.week), 10) - 3);
        expect(v * 2, e.title).toBe(Math.round(v * 2));
        expect(Math.abs(v - base), `${id} ${e.title}`).toBeLessThanOrEqual(1.5);
        seen++;
        if (v !== base) moved++;
      }
    }
    expect(seen).toBeGreaterThan(1000);
    // 揺らぎが本当に入っている（どれも週数−3 のままではない）
    expect(moved / seen).toBeGreaterThan(0.5);
  });
});
