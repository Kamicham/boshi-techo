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
