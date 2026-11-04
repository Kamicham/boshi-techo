// 橋の床: 急ぎ・心の危機の言葉に、必ず連絡先が付くか。ふつうの問いには付かないか。
import { describe, expect, it } from "vitest";
import { bridgeFor, telHref } from "./bridge";

const tels = (text: string, phase: "pregnant" | "child" | "other" = "child") =>
  bridgeFor(text, phase).actions.filter((a) => a.type === "call").map((a) => (a.type === "call" ? a.tel : ""));

describe("橋の床", () => {
  it.each([
    "出血が止まらない",
    "破水したかもしれない",
    "胎動が少ない気がする",
    "子どもが39.5度の熱でぐったりしている",
    "赤ちゃんがけいれんしている",
    "おもちゃを飲み込んだみたい",
    "ベッドから落ちた",
  ])("急ぎ: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.urgent).toBe(true);
    expect(b.actions[0]).toMatchObject({ type: "open", href: "/emergency" });
    expect(tels(t)).toContain("119");
    expect(tels(t)).toContain("#8000");
  });

  it("妊娠中は #8000（子ども専用）を出さない", () => {
    expect(tels("お腹が痛くて出血がある", "pregnant")).toEqual(["119"]);
  });

  it.each(["死にたい", "もう限界で消えたい", "子どもを叩いてしまいそう"])("心の危機: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.crisis).toBe(true);
    expect(tels(t)).toContain("0570-064-556");
  });

  it("手をあげてしまいそうな時は児童相談所も出す", () => {
    expect(tels("手をあげてしまいそうで怖い")).toContain("0120-189-783");
  });

  it.each(["出生届はいつまで？", "児童手当はいくら？", "保育園の申し込みはどこ？", "撮った紙はどこで OK するの？"])("ふつうの問いには付けない: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.actions).toEqual([]);
    expect(b.note).toBeNull();
  });

  it("電話のリンク", () => {
    expect(telHref("#8000")).toBe("tel:%238000");
    expect(telHref("0570-064-556")).toBe("tel:0570064556");
  });
});

describe("返事の頭の1文", () => {
  it("急ぎ・心の危機・便色の1〜3番には必ず付く", () => {
    expect(bridgeFor("出血がある", "pregnant").lead).toMatch(/産院/);
    expect(bridgeFor("消えたい", "child").lead).toMatch(/電話の相談先/);
    const s = bridgeFor("便の色が3番っぽい", "child");
    expect(s.stool).toBe(true);
    expect(s.lead).toMatch(/1日も早く/);
    expect(s.actions.some((a) => a.type === "open" && a.href === "/techo#page-stool")).toBe(true);
  });
  it("ふつうの問い・便の話でも色の番号が無ければ付かない", () => {
    expect(bridgeFor("児童手当はいつ？", "child").lead).toBeNull();
    expect(bridgeFor("便色カードはどこ？", "child").lead).toBeNull();
  });
});

// 日本語以外の言葉でも床が出るか（在留外国人の多い国籍の言葉＋英語の7つ。出入国在留管理庁 2025年6月末）
describe("日本語以外の床", () => {
  it.each([
    ["英語", "My baby is bleeding from the head"],
    ["英語", "I think my water broke"],
    ["英語", "He is choking and can't breathe"],
    ["英語", "she fell off the bed"],
    ["ポルトガル語", "Estou com sangramento e a bolsa rompeu"],
    ["ポルトガル語", "O bebê não está respirando"],
    ["フィリピノ語", "Dumudugo po ako"],
    ["フィリピノ語", "Nabulunan ang anak ko"],
    ["ベトナム語", "Tôi bị chảy máu nhiều"],
    ["ベトナム語", "Em bé co giật"],
    ["中国語（簡体）", "宝宝抽搐了，没有呼吸"],
    ["中国語（繁体）", "孩子發高燒，沒有反應"],
    ["韓国語", "아기가 경련을 해요"],
    ["ネパール語", "बच्चा बेहोस भयो"],
  ])("急ぎ（%s）: %s", (_lang, t) => {
    const b = bridgeFor(t, "child");
    expect(b.urgent).toBe(true);
    expect(tels(t)).toContain("119");
  });

  it.each([
    ["英語", "I want to die"],
    ["英語", "I'm afraid I will hurt my baby"],
    ["ポルトガル語", "Quero morrer"],
    ["フィリピノ語", "Gusto ko nang mamatay"],
    ["ベトナム語", "Tôi muốn chết"],
    ["中国語", "我想死"],
    ["韓国語", "죽고 싶어요"],
    ["ネパール語", "मलाई मर्न मन लाग्यो"],
  ])("心の危機（%s）: %s", (_lang, t) => {
    const b = bridgeFor(t, "child");
    expect(b.crisis).toBe(true);
    expect(tels(t)).toContain("0570-064-556");
  });

  it("子に手をあげそうな時は、英語でも児童相談所を出す", () => {
    expect(tels("I'm scared I might shake my baby")).toContain("0120-189-783");
  });

  it.each([
    "When is the birth registration due?",
    "How do I apply for the child allowance?",
    "I have heartburn at night",
    "She fell asleep after feeding",
    "Quando devo registrar o nascimento?",
    "Tôi cảm thấy không thoải mái",
    "出生登记什么时候办？",
    "출생신고는 언제까지 해요?",
  ])("ふつうの問いには付けない: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.urgent).toBe(false);
    expect(b.crisis).toBe(false);
  });
});
