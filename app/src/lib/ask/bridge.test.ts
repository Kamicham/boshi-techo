// 橋の床: 急ぎ・心の危機の言葉に、必ず連絡先が付くか。ふつうの問いには付かないか。
import { describe, expect, it } from "vitest";
import { STOOL_ASIDE, STOOL_NOTE } from "../techo";
import { bridgeFor, N8000_ALT_NOTE, stripLeadRepeats, sureUrgent, telHref, urgentLead } from "./bridge";

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
  it("便色の時、「」の中は手帳の原文（府令様式 p.19）だけ。「迷う時は #8000。」は「」の外", () => {
    const s = bridgeFor("便の色が3番っぽい", "child");
    const quoted = s.lead?.match(/便色カードには「(.+)」と書いてあります。/)?.[1];
    expect(quoted).toBe(STOOL_NOTE);
    expect(quoted).not.toMatch(/#8000|迷う/);
    expect(s.lead).toContain(`」と書いてあります。${STOOL_ASIDE}${N8000_ALT_NOTE}`);
  });
});

describe("返事の頭の繰り返しを除く", () => {
  const lead = bridgeFor("便の色が3番っぽい", "child").lead;
  const keep = "かかりつけの小児科へ電話してください。番号を選んで記録もできます。";
  it("手帳の引用を、まるごと・1文だけ・終わりの。無しで繰り返しても除き、ほかの文は残す", () => {
    expect(stripLeadRepeats(`母子手帳の便色カードには「${STOOL_NOTE}」と書いてあります。${keep}`, lead).trim()).toBe(keep);
    expect(
      stripLeadRepeats(`手帳には「どちらかが当てはまるときは、胆道閉鎖症などの病気の可能性がありますので、1日も早く小児科医、小児外科医等の診察を受けてください」とあります。${keep}`, lead).trim(),
    ).toBe(keep);
    expect(stripLeadRepeats(`生後4か月くらいまでは、うんちの色に注意が必要です。${keep}`, lead).trim()).toBe(keep);
  });
  it("短い切れ端・引用の無い頭（急ぎ）・頭が無い時は、何も除かない", () => {
    const own = "『1番～3番に近い色だと思う』に当てはまるか、明るいところで見比べてください。";
    expect(stripLeadRepeats(own, lead)).toBe(own);
    expect(stripLeadRepeats("今すぐ電話してください。", bridgeFor("高熱でぐったりしている", "child").lead)).toBe("今すぐ電話してください。");
    expect(stripLeadRepeats(keep, null)).toBe(keep);
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

// 話す・撮るの床（2026-11-05 監査 llm-2）: 確度の高い言葉だけ。記録が急ぎになると次の健診の聞く事に並ばなくなるので、聞くの床より狭い
describe("話す・撮るの床（確度の高い言葉だけ）", () => {
  it.each([
    "出血が少し",
    "朝から少し出血がある",
    "トイレで血が出た",
    "破水したかもしれない",
    "赤ちゃんがけいれんしている",
    "手足がけいれんしている",
    "息をしていない",
    "胎動が少ない気がする",
    "胎動を感じない",
    "胎動が感じられない",
    "強い痛みがある",
    "つわりで水も飲めない",
    "39度の熱が出た",
    "熱が40度ある",
    "高熱が続いている",
    "熱があってぐったりしている",
    "子どもがぐったりしている",
    "唇が紫になっている",
    "ボタン電池を飲み込んだ",
    "のどに詰まらせた",
    "産後の出血量が多い",
    "悪露の出血が多い",
    "悪露に塊がまじって出血が止まらない",
    "生理のような出血があった",
  ])("急ぎ: %s", (t) => {
    expect(sureUrgent(t)).toBe(true);
    // 聞くの床（広い表）も必ず拾う
    expect(bridgeFor(t, "child").urgent).toBe(true);
  });

  it.each([
    "少し眠い",
    "夜に足がつる",
    "足がけいれんする",
    "まぶたがけいれんする",
    "歯ぐきから血が出る",
    "歯みがきの時に出血する",
    "鼻から血が出た",
    "出血はない",
    "健診で出血もなかった",
    "破水したらすぐ電話するように言われた",
    "高熱ではない",
    "誤飲しないように気をつける",
    "誤飲防止のグッズを買った",
    "胎動を感じた",
    "胎動が感じられるようになった",
    "寝不足で疲れてぐったり",
    "お腹が張る",
    "お腹が痛い",
    "38度の熱",
    "お風呂は40度にした",
    "ベッドから落ちた",
    "鼻が詰まった",
    "出産の時の出血量は500mlだった",
    "悪露の出血がまだ少しある",
    "生理が来て出血がある",
  ])("急ぎにしない: %s", (t) => {
    expect(sureUrgent(t)).toBe(false);
  });

  it("聞くの床は今までどおり広い（落ちた・お腹が張って・38度も拾う）。話す・撮るの言葉（水も飲めない）も拾う", () => {
    for (const t of ["ベッドから落ちた", "お腹が張って痛い", "38度の熱", "つわりで水も飲めない"]) expect(bridgeFor(t, "pregnant").urgent).toBe(true);
  });

  it("急ぎの頭の1文は、聞くと話す・撮るで同じ", () => {
    expect(bridgeFor("出血がある", "pregnant").lead).toBe(urgentLead("pregnant"));
    expect(bridgeFor("けいれんしている", "child").lead).toBe(urgentLead("child"));
  });
});

describe("iPhone のまるいアポストロフィ（’）", () => {
  it.each([
    ["my baby can’t breathe", "urgent"],
    ["my son can‘t breathe", "urgent"],
    ["I don’t want to live", "crisis"],
    ["I can’t go on anymore", "crisis"],
    ["I don＇t want to live", "crisis"],
  ] as const)("%s → %s（まっすぐの ' と同じに当たる）", (text, kind) => {
    expect(bridgeFor(text, "other")[kind]).toBe(true);
    expect(bridgeFor(text.replace(/[‘’＇]/g, "'"), "other")[kind]).toBe(true);
  });

  it("日本語の床と、当たらない英語は今までどおり", () => {
    expect(bridgeFor("I’m fine, the baby’s doing well", "child").urgent).toBe(false);
    expect(bridgeFor("I’m fine, the baby’s doing well", "child").crisis).toBe(false);
    expect(sureUrgent("出血はない")).toBe(false);
    expect(sureUrgent("出血がある")).toBe(true);
  });
});

describe("話す・撮るの床: 軽い所でも数える時と、どの表にも当たらなかった出血の言い方（2026-11-05 夜・UX が見つけた穴と監査の確かめ）", () => {
  it.each([
    "口と鼻から血が出た",
    "赤ちゃんの口と鼻から血が出ています",
    "鼻から血が出て止まらない",
    "けがをして血が止まらない",
    "血がたくさん出た",
    "転んで血がでてる",
    "手と足がけいれんしている",
    "熱があって、足がけいれんしている",
    "赤ちゃんの足がけいれんしている",
    "悪露が急に真っ赤になって出血している",
    "悪露に鮮血が混じって出血が続く",
  ])("%s → 急ぎ（聞くの床も）", (t) => {
    expect(sureUrgent(t)).toBe(true);
    expect(bridgeFor(t, "child").urgent).toBe(true);
  });

  it.each([
    "歯みがきの時に歯ぐきから血が出た",
    "歯ぐきから血がちょっと出た",
    "鼻血が出た",
    "夜に足がけいれんして目が覚めた",
    "まぶたがけいれんする",
    "悪露の出血がまだ少しある",
    "出血はない",
    "血が止まらないときは病院へ",
  ])("%s → 話す・撮るの床では数えない（今までどおり）", (t) => {
    expect(sureUrgent(t)).toBe(false);
  });
});
