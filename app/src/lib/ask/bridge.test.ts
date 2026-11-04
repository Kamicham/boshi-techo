// 橋の床: 急ぎ・心の危機の言葉に、必ず連絡先が付くか。ふつうの問いには付かないか。
import { describe, expect, it } from "vitest";
import { bridgeFor, N8000_ALT_NOTE, telHref } from "./bridge";

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

  // 言えない時の橋（C02）: 今まで拾えなかった言い方
  it.each(["死にたくなる", "夜になると死にたくなってしまう", "消えてしまいたい", "もう無理", "泣き止まなくて揺さぶってしまいそう", "強く揺さぶった"])(
    "心の危機（言い方を足した）: %s",
    (t) => {
      const b = bridgeFor(t, "child");
      expect(b.crisis).toBe(true);
      expect(tels(t)).toContain("0570-064-556");
      expect(b.lead).toMatch(/ひとりで抱えなくていい/);
    },
  );

  it("揺さぶってしまいそうな時は児童相談所も出す", () => {
    expect(tels("泣き止まなくて揺さぶってしまいそう")).toContain("0120-189-783");
    expect(tels("ゆさぶっちゃいそうで怖い")).toContain("0120-189-783");
  });

  it.each(["夫に殴られた", "パートナーからの暴力が怖い", "首を絞められた", "旦那に蹴られた", "DVを受けている気がする", "My husband hits me"])("暴力: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.crisis).toBe(true);
    expect(tels(t)).toContain("0120-279-889");
    expect(tels(t)).toContain("110");
    expect(b.lead).toMatch(/110番/);
    expect(b.note).toMatch(/相手に知らせる・話し合う事を勧めない/);
  });

  it("暴力と死にたいが一緒の時は、心の相談先も出す", () => {
    const t = tels("夫に殴られて、もう死にたい");
    expect(t).toContain("0120-279-889");
    expect(t).toContain("0570-064-556");
  });

  it.each([
    "揺さぶられ症候群が心配",
    "抱っこで揺らすと揺さぶったらダメ？",
    "お産で死にたくない、こわい",
    "赤ちゃんにお腹を蹴られる",
    "2歳の子に叩かれる",
    "DVDを見ながら寝かしつけ",
    "揺さぶりってどのくらいから危ないの？",
  ])("言えない時の言葉に似た、ふつうの文には付けない: %s", (t) => {
    const b = bridgeFor(t, "child");
    expect(b.crisis).toBe(false);
    expect(b.actions).toEqual([]);
  });

  it("急ぎの返事の頭と119のボタンは「迷ったら119」と言わない（迷う時は #8000・産院）", () => {
    for (const phase of ["pregnant", "child", "other"] as const) {
      const b = bridgeFor("出血が止まらない", phase);
      expect(b.lead).toMatch(/命が危ないと思ったら、迷わず119/);
      expect(b.lead).not.toMatch(/迷ったら119/);
      expect(b.note).not.toMatch(/迷ったら119 を/);
      const call119 = b.actions.find((a) => a.type === "call" && a.tel === "119");
      expect(call119 && call119.type === "call" ? call119.label : null).toBe("命が危ない時は119");
    }
    expect(bridgeFor("39度の熱でぐったり", "child").lead).toMatch(/救急車を呼ぶか迷う時は、子どもの事はかかりつけか #8000/);
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
  it("#8000 を出す所には、つながらない時の県の番号は急ぎの時の画面にあると添える（床は県を知らないので番号は書かない）", () => {
    const u = bridgeFor("高熱でぐったりしている", "child");
    expect(u.lead).toContain(N8000_ALT_NOTE);
    expect(u.lead).not.toMatch(/\d{2,4}-\d{2,4}-\d{4}/);
    expect(u.actions.some((a) => a.type === "open" && a.href === "/emergency")).toBe(true);
    const s = bridgeFor("便の色が3番っぽい", "child");
    expect(s.lead).toContain(N8000_ALT_NOTE);
    // 便の色の時は一言だけ。ボタンは今夜の前と同じ2つのまま（一番目立つのは #8000 の電話。聞く画面は /emergency へのボタンを大きく出すので、足さない）
    expect(s.actions).toEqual([
      { type: "call", label: "子どもの急な病気の相談 #8000", tel: "#8000" },
      { type: "open", href: "/techo#page-stool", label: "便色カードを開く" },
    ]);
    expect(s.actions.some((a) => a.type === "open" && a.href.startsWith("/emergency"))).toBe(false);
    // 妊娠中の急ぎは #8000 を出さないので、添えない
    expect(bridgeFor("出血がある", "pregnant").lead).not.toContain("#8000");
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
