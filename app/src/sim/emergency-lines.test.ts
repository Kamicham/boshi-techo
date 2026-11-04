// 30家族と1000組の町で、急ぎの時の #7119 の出し分けが動くか（C02）。
// 都道府県の名が47のどれかに当たる事（当たらないと、実施している町でも出ない）と、島や一部だけの県の家族の出し分けを見る。
// 「#」につながらない時のふつうの番号（#8000 は全員・#7119 は「#7119」にかける家族の全員）が出るかも見る。
import { describe, expect, it } from "vitest";
import { line7119, line8000, normPref } from "../lib/emergency-lines";
import { SIM_FAMILIES } from "./families";
import { getPopulation } from "./population";

describe("急ぎの時の #7119（30家族と1000組）", () => {
  it("30家族と1000組の都道府県は、47の名前のどれかに当たる", () => {
    const all = [...SIM_FAMILIES, ...getPopulation()];
    expect(all.length).toBeGreaterThanOrEqual(1030);
    expect(all.filter((f) => !normPref(f.prefecture)).map((f) => `${f.id}:${f.prefecture}`)).toEqual([]);
  });

  it("東京都の島（八丈町）と北海道東川町（札幌の周りの11市町村の外）の家族には出さない。名古屋市の家族には出す", () => {
    const by = (city: string) => SIM_FAMILIES.filter((f) => f.city.startsWith(city));
    for (const [city, shown] of [
      ["八丈町", false],
      ["東川町", false],
      ["名古屋市", true],
    ] as const) {
      const fams = by(city);
      expect(fams.length, city).toBeGreaterThan(0);
      for (const f of fams) expect(line7119(f.prefecture, f.city) !== null, `${f.id}:${f.prefecture}${f.city}`).toBe(shown);
    }
  });

  it("1000組では、出す家族と出さない家族の両方がいる（未実施の5県・一部だけの3道県の外の町）", () => {
    const pop = getPopulation();
    const none = pop.filter((f) => !line7119(f.prefecture, f.city));
    expect(none.length).toBeGreaterThan(0);
    expect(none.length / pop.length).toBeLessThan(0.3);
    // 出さない家族は、未実施の県か、一部だけの県（北海道・愛知・和歌山）か、外れる町のどれか
    const why = new Set(["三重県", "島根県", "佐賀県", "宮崎県", "鹿児島県", "北海道", "愛知県", "和歌山県", "東京都", "広島県", "山口県", "沖縄県"]);
    expect(none.filter((f) => !why.has(f.prefecture)).map((f) => `${f.id}:${f.prefecture}${f.city}`)).toEqual([]);
  });

  it("#8000 のふつうの番号は、30家族と1000組の全員に出る（47都道府県すべてにある）", () => {
    const all = [...SIM_FAMILIES, ...getPopulation()];
    expect(all.filter((f) => !line8000(f.prefecture)).map((f) => `${f.id}:${f.prefecture}`)).toEqual([]);
  });

  it("「#7119」にかける家族の全員に、つながらない時のふつうの番号が出る（東京都の家族は23区か多摩地区に当たる）", () => {
    const all = [...SIM_FAMILIES, ...getPopulation()];
    const lines = all.map((f) => ({ f, l: line7119(f.prefecture, f.city) })).filter((x) => x.l?.tel === "#7119");
    expect(lines.length).toBeGreaterThan(500);
    expect(lines.filter((x) => !x.l?.alt).map((x) => `${x.f.id}:${x.f.prefecture}${x.f.city}`)).toEqual([]);
  });
});
