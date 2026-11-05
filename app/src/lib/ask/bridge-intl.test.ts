// 急ぎの言葉の床の中文・English（2026-11-05 作り手の決め事④。形は全体監査と決めた: lib/ask/bridge.ts の URGENT_SURE_INTL）
// - 確度の高い言葉は、話す・撮るの床（sureUrgent）と聞くの床（bridgeFor）の両方が拾う。広めの言葉は聞くだけ
// - 打ち消し・もしもで外すのは出来事の語（出血・流血・破水・抽搐・痉挛・bleeding・seizure・convulsion）だけ。打ち消しの形の急ぎの言葉は当たり続ける
// - 日本語の床と同じ「数えない」: 牙龈・鼻の出血、眼皮・腿の抽搐、恶露・月经の出血（多い・血块は数える）、误吞・噎住を防ぐ話
// - 見本の答え（鍵の無い時）も同じ表。中文・English の気がかりは、日本語と同じく次の健診の聞く事へ
// Claude には一度もつながない（表と見本の答えだけ）。
import { describe, expect, it, vi } from "vitest";
import { URGENT_SURE_INTL, bridgeFor, sureUrgent } from "./bridge";

vi.mock("server-only", () => ({}));

const tels = (text: string) => bridgeFor(text, "child").actions.flatMap((a) => (a.type === "call" ? [a.tel] : []));

describe("確度の高い言葉は、話す・撮ると聞くの両方が拾う", () => {
  it.each([
    // 中文（简体）
    "怀孕30周，今天早上开始流血",
    "今天见红了",
    "好像羊水破了",
    "宝宝抽搐了",
    "孩子痉挛不止",
    "孩子发烧时惊厥了",
    "宝宝没有呼吸",
    "孩子突然不呼吸了",
    "喘不上气",
    "宝宝叫不醒",
    "孩子没有反应",
    "孩子失去意识了",
    "嘴唇发紫",
    "嘴唇有点发紫",
    "宝宝噎住了",
    "东西卡在喉咙里了",
    "孩子误吞了纽扣电池",
    "宝宝吞了一颗电池",
    "宝宝不小心吞了磁铁",
    "感觉胎动减少了",
    "这两天胎动变少了",
    "感觉不到胎动",
    "肚子剧痛",
    "孕吐很严重，水都喝不下",
    "宝宝发高烧",
    "发烧39.5度",
    "孩子瘫软",
    // 中文（繁体）
    "寶寶沒有呼吸",
    "孩子沒有反應",
    "誤吞了電池",
    "感覺不到胎動",
    "無法呼吸",
    "失去意識",
    "嘴唇發紫",
    "寶寶發高燒",
    "胎動減少",
    // English
    "I'm bleeding",
    "I'm spotting this morning",
    "I think my water is breaking",
    "My water broke an hour ago",
    "my baby had a seizure",
    "he is convulsing",
    "my baby is not breathing",
    "she stopped breathing for a moment",
    "he can't breathe",
    "he can’t breathe",
    "she has trouble breathing",
    "the baby is unresponsive",
    "he won't wake up",
    "I can't wake her up",
    "she passed out",
    "his lips are turning blue",
    "blue lips",
    "she is choking",
    "my son swallowed a button battery",
    "the baby is moving less",
    "fewer movements than usual",
    "I can't feel the baby move",
    "the baby hasn't moved today",
    "he is turning blue",
    "severe abdominal pain",
    "I can't keep water down",
    "high fever",
    "fever of 39.5",
    "a 104 F fever",
    "the baby is limp",
  ])("%s", (t) => {
    expect(sureUrgent(t), "話す・撮る").toBe(true);
    expect(bridgeFor(t, "pregnant").urgent, "聞く（妊娠中）").toBe(true);
    expect(tels(t), "聞く（子ども）").toContain("119");
  });
});

describe("打ち消しの形の急ぎの言葉は、当たり続ける（打ち消しで外すのは出来事の語だけ）", () => {
  it.each([
    "没有呼吸",
    "沒有呼吸",
    "没呼吸了",
    "不呼吸",
    "无法呼吸",
    "喘不上气",
    "没有反应",
    "沒有反應",
    "没反应",
    "叫不醒",
    "没有意识",
    "沒有意識",
    "感觉不到胎动",
    "没有胎动",
    "not breathing",
    "he isn't breathing",
    "not responding",
    "can't breathe",
    "cannot breathe",
    "won't wake up",
    "no fetal movements today",
    "no kicks since this morning",
    "I can't feel the baby move",
    "I don't feel the baby kick",
    // 同じ文に打ち消した出来事の語があっても、ほかの急ぎの言葉は数える
    "没有出血，但是宝宝没有呼吸",
    "No bleeding, but he is not breathing",
  ])("%s", (t) => {
    expect(sureUrgent(t)).toBe(true);
    expect(bridgeFor(t, "child").urgent).toBe(true);
  });
});

describe("話す・撮るの床で数えない（日本語の床と同じ考え方）", () => {
  it.each([
    // 出来事の語の打ち消し・もしも
    "没有出血",
    "沒有出血",
    "今天没出血",
    "检查时未见出血",
    "没有见红",
    "如果出血就去医院",
    "万一破水怎么办",
    "要是抽搐了要马上打119",
    "出血的话马上打电话",
    "no bleeding",
    "There was no bleeding today",
    "I haven't had any bleeding",
    "no spotting",
    "no seizures",
    "He has never had a seizure",
    "If bleeding starts, call the clinic",
    "in case of bleeding",
    // よくある軽い所
    "刷牙时牙龈出血",
    "鼻子出血了",
    "my gums bleed when I brush",
    "nose bleeding again",
    "眼皮抽搐",
    "小腿抽搐",
    "眼皮抽搐，手机看太多了",
    "bleeding gums",
    "bleeding from the nose",
    // 産後の悪露・生理が戻った時
    "恶露还有一点出血",
    "来月经了，有出血",
    "lochia, still a little bleeding",
    "my period came back, light bleeding",
    // 防ぐ話
    "买了防止误吞的安全锁",
    "为了避免噎住，把葡萄切小",
    "checked the toys for choking hazards",
    "how to prevent choking",
    // ふつうの言葉
    "胎动很多",
    "宝宝吃奶很好",
    "I got choked up at the ultrasound",
    "高热量的食物",
    "the baby kicks a lot",
    "the bath was 40 degrees",
  ])("%s", (t) => {
    expect(sureUrgent(t)).toBe(false);
  });

  it.each([
    // 量が多い・塊・止まらない、妊娠中の「月经みたいな出血」は数える
    "恶露很多，有血块，一直出血",
    "my period came back and the bleeding is heavy with clots",
    "像来月经一样出血",
    "bleeding like a period",
    // 「手脚」「四肢」は数える
    "手脚抽搐",
    "宝宝四肢抽搐",
    // うっかり（不小心）は数える
    "不小心误吞了电池",
    // 止まらない出血・止まらないけいれんは数える
    "won't stop bleeding",
    "流血不止",
    // 軽い所の言葉があっても、ほかの所・熱・全身があれば数える（UX 11/5 夜に洗った穴）
    "宝宝嘴和鼻子出血",
    "bleeding from the mouth and nose",
    "恶露突然变成鲜红色，出血",
    "lochia suddenly turned bright red, bleeding",
    "宝宝手和腿在抽搐",
    "发烧，腿在抽搐",
    "没能防止宝宝误吞",
    // 打ち消しの語が近くにあっても、打ち消していない出血は数える
    "无痛出血",
    "无缘无故出血",
    "没想到出血了",
    "未满月的宝宝抽搐",
    "no idea why I'm bleeding",
    "not sure if it's bleeding",
    "it hasn't stopped bleeding",
  ])("数える: %s", (t) => {
    expect(sureUrgent(t)).toBe(true);
  });
});

describe("広めの言葉は聞くだけ（日本語の「落ちた・お腹が痛い・38度」と同じ）", () => {
  it.each([
    "he fell off the bed",
    "she swallowed something",
    "he burned his hand",
    "从床上摔下来了",
    "宝宝吞下了什么东西",
    "孩子吞了药",
    "喉咙卡了鱼刺",
    "宝宝很蔫",
    "肚子很痛",
    "stomach pain",
    "it's hard to breathe",
    "38.5°C",
    "胎动少吗？",
  ])("%s", (t) => {
    expect(bridgeFor(t, "pregnant").urgent).toBe(true);
    expect(sureUrgent(t)).toBe(false);
  });
});

describe("日本語の床は前のまま", () => {
  it("中文の見分けは、かなのある文には当てない", () => {
    // 「鼻水と出血」: 日本語の MILD_BLEED（鼻から・鼻が）に当たらないので、前のとおり急ぎ
    expect(sureUrgent("鼻水と出血がある")).toBe(true);
    expect(sureUrgent("未明に出血があった")).toBe(true);
    expect(sureUrgent("出血はない")).toBe(false);
    expect(sureUrgent("出血がある")).toBe(true);
  });

  it("表の中の日本語は、日本語の床の言葉と同じ意味（呼吸困難・呼吸停止・誤食は、日本語の文でも急ぎ）", () => {
    for (const t of ["呼吸困難になった", "呼吸停止", "アレルギーの食べ物を誤食した"]) expect(sureUrgent(t), t).toBe(true);
    expect(sureUrgent("誤食しないように気をつける")).toBe(false);
  });

  it("英字は語の頭で区切る（heartburn・bleachers・seizes の一部には当てない）。大文字でも当たる", () => {
    expect(URGENT_SURE_INTL.test("I have heartburn")).toBe(false);
    expect(URGENT_SURE_INTL.test("BLEEDING")).toBe(true);
    expect(URGENT_SURE_INTL.test("unbleeding")).toBe(false);
  });
});

describe("見本の答え（鍵の無い時）も同じ表", () => {
  const prompt = (said: string) => `今日: 2027-02-20（土）\n家族の時計: 妊娠28週5日\n\n書いた事:\n${said}`;

  it.each([
    ["肚子有点疼，有点担心", "気がかり", false],
    ["I'm worried about the swelling in my feet", "気がかり", false],
    ["I’m worried about my cough", "気がかり", false],
    ["宝宝没有呼吸", "気がかり", true],
    ["my water broke", "気がかり", true],
    ["今天去散步了", "メモ", false],
    ["Went for a walk today", "メモ", false],
    ["没有出血", "メモ", false],
  ] as const)("%s → %s（急ぎ %s）", async (said, kind, urgent) => {
    const { sampleAnswer } = await import("../samples");
    const out = sampleAnswer("capture", prompt(said)) as { records: { kind: string; urgent: boolean }[] };
    expect(out.records[0].kind).toBe(kind);
    expect(out.records[0].urgent).toBe(urgent);
  });
});

describe("止まらない・多い・子どもの足は、軽い所でも数える。出血の字が続かない言い方も（2026-11-05 夜・監査）", () => {
  it.each([
    "宝宝鼻子流血止不住",
    "宝宝的伤口血止不住",
    "宝宝流了很多血",
    "牙龈出血不止",
    "宝宝的腿在抽搐",
    "孩子眼皮一直抽搐",
    "my baby's nose keeps bleeding and won't stop",
    "my baby’s nose won’t stop bleeding",
    "his nose is bleeding heavily",
    "there is a lot of blood",
  ])("%s → 急ぎ（聞くの床も）", (t) => {
    expect(sureUrgent(t)).toBe(true);
    expect(bridgeFor(t, "child").urgent).toBe(true);
  });

  it.each([
    "刷牙的时候牙龈出血",
    "牙龈出了一点血",
    "牙龈出血，很多孕妇都这样吗",
    "晚上腿抽筋",
    "小腿抽搐",
    "我的血压有点高",
    "my gums bleed when i brush",
    "I need a blood test",
    "a lot of blood work today",
  ])("%s → 話す・撮るの床では数えない", (t) => {
    expect(sureUrgent(t)).toBe(false);
  });
});
