// #7119 の表: 消防庁の一覧（2026-10-23・42地域）のとおりに、出す町・出さない町が分かれるか。
// #8000・#7119 につながらない時のふつうの番号（厚生労働省の表・消防庁の一覧の「♯7119 又は」）が、家族の県・町に合うか
import { describe, expect, it } from "vitest";
import { line7119, line8000, N7119, N8000, normPref, PREFECTURES, telLink } from "./emergency-lines";

describe("#7119 の実施地域", () => {
  it("表にあるのは42都道府県（全域39・一部3）で、無いのは未実施の5県だけ", () => {
    expect(PREFECTURES).toHaveLength(47);
    expect(new Set(PREFECTURES).size).toBe(47);
    expect(PREFECTURES.filter((p) => !N7119[p])).toEqual(["三重県", "島根県", "佐賀県", "宮崎県", "鹿児島県"]);
    const onlySome = PREFECTURES.filter((p) => {
      const a = N7119[p];
      return a && "only" in a;
    });
    expect(onlySome).toEqual(["北海道", "愛知県", "和歌山県"]);
  });

  it.each([
    ["三重県", "津市"],
    ["島根県", "松江市"],
    ["佐賀県", "佐賀市"],
    ["宮崎県", "宮崎市"],
    ["鹿児島県", "鹿児島市"],
  ])("未実施の県には出さない: %s%s", (p, c) => {
    expect(line7119(p, c)).toBeNull();
  });

  it.each([
    ["北海道", "札幌市"],
    ["北海道", "札幌市中央区"],
    ["北海道", "江別市"],
    ["北海道", "石狩郡当別町"],
    ["愛知県", "名古屋市"],
    ["愛知県", "名古屋市中区"],
    ["和歌山県", "田辺市"],
    ["和歌山県", "西牟婁郡白浜町"],
    ["和歌山県", "日高川町"],
  ])("一部だけの県は、その町に出す: %s%s", (p, c) => {
    expect(line7119(p, c)).toMatchObject({ hours: null, tel: "#7119" });
  });

  it.each([
    ["北海道", "函館市"],
    ["北海道", "東川町"],
    ["北海道", "上川郡東川町"],
    ["愛知県", "豊田市"],
    ["和歌山県", "和歌山市"],
    ["和歌山県", "和歌山県和歌山市"],
    ["北海道", ""],
    ["愛知県", undefined],
  ])("一部だけの県の、ほかの町（町が分からない時も）には出さない: %s%s", (p, c) => {
    expect(line7119(p, c)).toBeNull();
  });

  it.each([
    ["東京都", "八丈町"],
    ["東京都", "東京都八丈町"],
    ["東京都", "小笠原村"],
    ["東京都", "大島町"],
    ["広島県", "大崎上島町"],
    ["広島県", "豊田郡大崎上島町"],
    ["山口県", "萩市"],
    ["山口県", "阿武郡阿武町"],
    ["沖縄県", "与那国町"],
    ["沖縄県", "八重山郡与那国町"],
    ["沖縄県", "北大東村"],
  ])("全域の県でも、外れる町には出さない: %s%s", (p, c) => {
    expect(line7119(p, c)).toBeNull();
  });

  it.each([
    ["東京都", "世田谷区"],
    ["東京都", "八王子市"],
    ["埼玉県", "さいたま市"],
    ["埼玉県", "埼玉県さいたま市"],
    ["奈良県", "大和郡山市"],
    ["沖縄県", "那覇市"],
    ["沖縄県", "南大東村"],
    ["福岡県", ""],
  ])("全域の県の町に出す（町が分からなくても）: %s%s", (p, c) => {
    expect(line7119(p, c)).toMatchObject({ hours: null, tel: "#7119" });
  });

  it("一覧に別の番号が書かれた町は、その番号にかける", () => {
    expect(line7119("山口県", "岩国市")?.tel).toBe("082-246-2000");
    expect(line7119("山口県", "玖珂郡和木町")?.tel).toBe("082-246-2000");
    expect(line7119("山口県", "山口市")?.tel).toBe("#7119");
    expect(line7119("京都府", "相楽郡笠置町")?.tel).toBe("0570-00-7119");
    expect(line7119("京都府", "南山城村")?.tel).toBe("0570-00-7119");
    expect(line7119("京都府", "京都市")?.tel).toBe("#7119");
  });

  it("24時間でない9県は、受付の時間を添える", () => {
    expect(line7119("山形県", "山形市")).toEqual({ hours: "毎日 午後6時〜翌午前8時", tel: "#7119", alt: "023-633-0799" });
    expect(line7119("香川県", "高松市")?.hours).toBe("毎日 午後7時〜翌午前8時");
    expect(PREFECTURES.filter((p) => N7119[p]?.hours)).toEqual(["秋田県", "山形県", "栃木県", "新潟県", "富山県", "長野県", "徳島県", "香川県", "大分県"]);
  });

  it("都道府県は、都・府・県の無い書き方でも寄せる。分からない時は出さない", () => {
    expect(normPref("埼玉")).toBe("埼玉県");
    expect(normPref("東京")).toBe("東京都");
    expect(normPref("大阪")).toBe("大阪府");
    expect(normPref("京都")).toBe("京都府");
    expect(normPref("北海道")).toBe("北海道");
    expect(normPref(" 沖縄県 ")).toBe("沖縄県");
    expect(normPref("")).toBeNull();
    expect(normPref("北海")).toBeNull();
    expect(normPref("カリフォルニア")).toBeNull();
    expect(line7119("", "さいたま市")).toBeNull();
    expect(line7119(undefined, undefined)).toBeNull();
    expect(line7119("埼玉", "さいたま市")).toEqual({ hours: null, tel: "#7119", alt: "048-824-4199" });
    expect(line7119("東京", "東京八丈町")).toBeNull();
  });
});

describe("「#」につながらない時のふつうの番号", () => {
  const TEL = /^0\d{1,4}-\d{1,4}-\d{3,4}$/;
  const digits = (t: string) => t.replace(/\D/g, "").length;

  it("#8000 は47都道府県すべてに1つ（厚生労働省の表・令和8年5月22日現在）。番号の形と、かけるリンク", () => {
    expect(Object.keys(N8000)).toEqual([...PREFECTURES]);
    for (const p of PREFECTURES) {
      expect(N8000[p], p).toMatch(TEL);
      expect([10, 11], p).toContain(digits(N8000[p]));
      expect(telLink(N8000[p]), p).toMatch(/^tel:0\d{9,10}$/);
    }
    // 表から何か所か（東京・埼玉・沖縄・高知・県の外の番号で受ける群馬と島根）
    expect(N8000["東京都"]).toBe("03-5285-8898");
    expect(N8000["埼玉県"]).toBe("048-833-7911");
    expect(N8000["沖縄県"]).toBe("098-888-5230");
    expect(N8000["高知県"]).toBe("088-873-3090");
    expect(N8000["群馬県"]).toBe("03-6735-8835");
    expect(N8000["島根県"]).toBe("03-3478-1060");
  });

  it("#8000 は家族の都道府県で決める（都・府・県の無い書き方も）。分からない時は出さない", () => {
    expect(line8000("埼玉")).toEqual({ tel: "048-833-7911", prefecture: "埼玉県" });
    expect(line8000("京都府")).toEqual({ tel: "075-661-5596", prefecture: "京都府" });
    // #7119 の無い県にも #8000 はある
    expect(line8000("三重県")?.tel).toBe("059-232-9955");
    expect(line8000("")).toBeNull();
    expect(line8000(undefined)).toBeNull();
    expect(line8000("カリフォルニア")).toBeNull();
  });

  it("#7119 は42地域すべてに、一覧の「♯7119 又は」の後の番号がある", () => {
    for (const p of PREFECTURES) {
      const a = N7119[p];
      if (!a) continue;
      if (typeof a.alt === "string") {
        expect(a.alt, p).toMatch(TEL);
        expect(telLink(a.alt), p).toMatch(/^tel:0\d{9,10}$/);
      } else expect(p).toBe("東京都");
    }
    expect(line7119("神奈川県", "横浜市")?.alt).toBe("045-232-7119");
    expect(line7119("北海道", "札幌市中央区")?.alt).toBe("011-272-7119");
    expect(line7119("愛知県", "名古屋市")?.alt).toBe("052-951-7119");
    expect(line7119("和歌山県", "西牟婁郡白浜町")?.alt).toBe("0739-22-0119");
    expect(line7119("広島県", "広島市")?.alt).toBe("082-246-2000");
    expect(line7119("熊本県", "熊本市")?.alt).toBe("03-6456-3290");
  });

  it.each([
    ["世田谷区", "03-3212-2323"],
    ["東京都千代田区", "03-3212-2323"],
    ["北区", "03-3212-2323"],
    ["八王子市", "042-521-2323"],
    ["西東京市", "042-521-2323"],
    ["西多摩郡瑞穂町", "042-521-2323"],
    ["檜原村", "042-521-2323"],
  ])("東京都は23区と多摩地区で番号が違う: %s", (c, alt) => {
    expect(line7119("東京都", c)?.alt).toBe(alt);
  });

  it("東京都で町が分からない・当たらない時は、ふつうの番号を出さない（#7119 のボタンは出す）", () => {
    expect(line7119("東京都", "")).toEqual({ hours: null, tel: "#7119", alt: null });
    expect(line7119("東京都", "新宿")).toEqual({ hours: null, tel: "#7119", alt: null });
  });

  it("かける番号がもうふつうの番号の町（笠置町・南山城村・岩国市・和木町）は、ふつうの番号を重ねない", () => {
    expect(line7119("京都府", "相楽郡笠置町")).toEqual({ hours: null, tel: "0570-00-7119", alt: null });
    expect(line7119("京都府", "京都市")).toEqual({ hours: null, tel: "#7119", alt: "0570-00-7119" });
    expect(line7119("山口県", "岩国市")).toEqual({ hours: null, tel: "082-246-2000", alt: null });
    expect(line7119("山口県", "玖珂郡和木町")?.alt).toBeNull();
    expect(line7119("山口県", "山口市")?.alt).toBe("083-921-7119");
  });
});
