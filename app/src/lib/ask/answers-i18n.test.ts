// 手帳に聞くの、機械が書く字（決まりの答え・見本の答え・急ぎの橋）を、画面の言葉で組む（2026-11-05 多言語化③）。
// 日本語の字は前と同じ（rule-answer.test.ts・bridge.test.ts が見る）。ここは、中文・English の問いの見分け方と、答えの形を見る。
// サーバは頼みの言葉の withLang の中で組む（lib/ask/agent.ts）。試験も同じ形で包む
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { withLang, type Lang } from "../i18n";
import { DICTS, tFor } from "../i18n/dicts";
import { STOOL_ASIDE, STOOL_NOTE } from "../techo";
import { bridgeFor, N8000_ALT_NOTE, urgentLead } from "./bridge";
import { ruleAnswer, ruleKind, type PlanRow, type PlanView } from "./rule-answer";

vi.mock("server-only", () => ({}));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-answers-i18n-test-"));
process.env.BOSHI_DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const inLang = <T>(lang: Lang, fn: () => T): T => withLang(lang, fn, DICTS[lang]);
/** 括弧の外にかなが残っていない（窓口の言葉・番号の名前は括弧で並べる） */
const noKana = (s: string) => !/[ぁ-んァ-ヶ]/.test(s.replace(/（[^）]*）|\([^)]*\)/g, ""));

const row = (id: string, やさしい題: string, 状態 = "今やる", extra: Partial<PlanRow> = {}): PlanRow => ({
  id,
  やさしい題,
  正式な名前: やさしい題,
  担当: "母（美咲）",
  状態,
  始まり: "11月1日",
  目安の日: "11月20日（あと16日）",
  ...extra,
});
const plan: PlanView = {
  今やる事: [row("pregnancy-report", "役所に妊娠を届ける", "期限切れ"), row("tell-work", "職場に妊娠を伝える"), row("partner-leave", "育休の段取りを決める", "今やる", { 担当: "パートナー（翔太）" }), row("x", "4つ目")],
  まだ先の事: [row("vaccines-start", "予防接種を始める", "まだ先", { 始まり: "2027年7月20日（あと258日）" }), row("checkup-3-4m", "3〜4か月健診", "まだ先"), row("daycare-apply", "保育園を申し込む", "まだ先")],
};

describe("中文・English の問いを見分ける", () => {
  it("次にやる事・画面の使い方・健診と予防接種・関係する事", () => {
    expect(ruleKind("接下来要做什么？")).toBe("next");
    expect(ruleKind("What should I do next?")).toBe("next");
    expect(ruleKind("这个页面能做什么？")).toBe("screen");
    expect(ruleKind("What can I do on this screen?")).toBe("screen");
    expect(ruleKind("下一次预防接种和健康检查是什么时候？")).toBe("checkups");
    expect(ruleKind("When are the next shots and checkups?")).toBe("checkups");
    expect(ruleKind("保育园什么时候申请？")).toBe("topic");
    expect(ruleKind("When do maternity leave and childcare leave start?")).toBe("topic");
  });
  it("健診で聞く事・体の言葉・ほかの話は、決まりで答えない（橋と Claude に任せる）", () => {
    expect(ruleKind("检查时该问什么？")).toBeNull();
    expect(ruleKind("What should I ask at the checkup?")).toBeNull();
    expect(ruleKind("宝宝发烧了，接下来要做什么？")).toBeNull();
    expect(ruleKind("My baby has a fever. What should I do next?")).toBeNull();
    expect(ruleKind("今天天气很好")).toBeNull();
    expect(ruleKind("It's a nice day")).toBeNull();
  });
});

describe("最初の問いの例（components/ask/AskSheet.tsx の starters）は、訳しても同じ決まりで答える", () => {
  // 画面は訳した問いをそのまま送るので、中文・English の問いも日本語と同じ種類に分ける（予定表で答える・Claude に任せる）
  const STARTERS = [
    "次にやる事は何？",
    "この画面では何ができる？",
    "健診で何を聞けばいい？",
    "健診の日の録音はどうやるの？",
    "撮った紙はどこで OK するの？",
    "予防接種の控えはどこ？",
    "何を話せば記録になるの？",
    "役所の封筒を撮ったらどうなる？",
    "産休と育休はいつから？",
    "出産でもらえるお金は？",
    "出生届はいつまで？どこに？",
    "児童手当は誰が申し込むの？",
    "次の予防接種と健診はいつ？",
    "保育園の申し込みはいつ？",
    "次の健診はいつ？",
    "これまでの記録を一冊にするには？",
  ];
  it.each(STARTERS)("%s", (ja) => {
    for (const l of ["zh", "en"] as const) {
      const q = tFor(l, ja);
      expect(q, `${l} の訳がある`).not.toBe(ja);
      expect(ruleKind(q), `${l}: ${q}`).toBe(ruleKind(ja));
    }
  });
});

describe("決まりの答えを、画面の言葉で組む", () => {
  it("中文: 札・数・担当・日付とあと◯日・箇条の頭（予定の題は予定の辞書で訳す）", () => {
    const r = inLang("zh", () => ruleAnswer("next", "接下来要做什么？", plan)!);
    expect(r.text.startsWith("（来自手册的日程表，没有使用 Claude）\n")).toBe(true);
    expect(r.text).toContain("现在要做的事有4件。");
    expect(r.text).toContain("（轮到翔太）");
    expect(r.text).toContain("参考 11月20日（还有16天）");
    expect(r.text).toContain("另外还有1件（在“今天”页面上）");
    expect(r.text).not.toContain("・");
    expect(r.text).toContain("• 向市区町村政府申报怀孕 — 参考 11月20日（还有16天）");
    // 試験だけの題（予定に無い題）は日本語のまま出る
    expect(noKana(r.text.replace("育休の段取りを決める", ""))).toBe(true);
    // ボタンの札は日本語のまま残す（画面が t() で引く。前に残った会話の札も訳せる）
    expect(r.actions[0]).toEqual({ type: "milestone", milestoneId: "pregnancy-report", label: "役所に妊娠を届ける" });
  });
  it("English: 数の形・月の名前・文の間の空き", () => {
    const r = inLang("en", () => ruleAnswer("next", "What should I do next?", plan)!);
    expect(r.text.startsWith("(From the handbook's schedule. Claude wasn't used.)\n")).toBe(true);
    expect(r.text).toContain("There are 4 things to do now.");
    expect(r.text).toContain("Around Nov 20 (16 days left)");
    // 見本の家族の名前は English でローマ字（lib/i18n/names.ts）
    expect(r.text).toContain(" (Shota's turn)");
    expect(r.text).toContain("• ");
    const one = inLang("en", () => ruleAnswer("next", "What should I do next?", { 今やる事: [plan.今やる事[1]], まだ先の事: [] })!);
    expect(one.text).toContain("There is 1 thing to do now.");
    const later = inLang("en", () => ruleAnswer("next", "What should I do next?", { 今やる事: [], まだ先の事: plan.まだ先の事 })!);
    expect(later.text).toContain("Nothing to do right now. Next is “");
    expect(later.text).toContain("”, from Jul 20, 2027 (258 days left).");
  });
  it("「授かったら」「生まれたら」の事は日付の形にしない（日本語も「授かったらから」にしない）", () => {
    const p: PlanView = { 今やる事: [], まだ先の事: [row("folic", "葉酸をとり始める", "まだ先", { 始まり: "授かったら", 目安の日: undefined })] };
    expect(ruleAnswer("next", "次にやる事は？", p)!.text).toContain("今すぐやる事はありません。次は、授かったら「葉酸をとり始める」です。");
    expect(inLang("en", () => ruleAnswer("next", "What should I do next?", p)!.text)).toContain("Nothing to do right now. Next, once you're pregnant: “");
    expect(inLang("zh", () => ruleAnswer("checkups", "x", { 今やる事: [], まだ先の事: [row("vaccines-start", "予防接種を始める", "まだ先", { 始まり: "生まれたら", 目安の日: undefined })] })!.text)).toContain(
      " — 出生后",
    );
  });
  it("画面の使い方と、健診の予約の1行", () => {
    const s = inLang("zh", () => ruleAnswer("screen", "这个页面能做什么？", plan, "/")!.text);
    expect(s).toContain("在这个页面（今天）可以做的事：\n• 最上面会大大地显示");
    expect(noKana(s)).toBe(true);
    const en = inLang("en", () => ruleAnswer("screen", "What can I do on this screen?", plan, "/emergency")!.text);
    expect(en).toContain("What you can do on this screen (Emergency):");
    expect(noKana(en)).toBe(true);
    const v = inLang("en", () => ruleAnswer("next", "x", { 今やる事: [], まだ先の事: [], 健診の予約: { when: tFor("en", "あと{n}日ごろ", { n: 3 }) } })!.text);
    expect(v).toContain("• Book the next prenatal checkup — In about 3 days (national guideline.");
  });
  it("日本語は前と同じ字（サーバの既定）", () => {
    const r = ruleAnswer("next", "次にやる事は何？", plan)!;
    expect(r.text).toContain("・役所に妊娠を届ける — 目安 11月20日（あと16日）");
    expect(r.text).toContain("育休の段取りを決める（パートナー（翔太）の番）");
    expect(inLang("ja", () => ruleAnswer("next", "次にやる事は何？", plan)!.text)).toBe(r.text);
  });
});

describe("急ぎの橋と見本の答え", () => {
  it("急ぎの1文は意味を変えずに訳した文が出る（日本語は前と同じ）", () => {
    expect(urgentLead("child")).toContain("今すぐ電話してください。命が危ないと思ったら、迷わず119。");
    const zh = inLang("zh", () => bridgeFor("赤ちゃんがぐったりしている", "child"));
    expect(zh.lead).toContain("请现在就打电话。如果觉得有生命危险，请毫不犹豫地拨打119。");
    expect(zh.lead).toContain("如果打不通 #8000");
    expect(noKana(zh.lead!)).toBe(true);
    const en = inLang("en", () => bridgeFor("赤ちゃんがぐったりしている", "pregnant"));
    expect(en.lead).toBe("Call your maternity clinic right now (even at night). If you think a life is in danger, call 119 without hesitation.");
    // 番号のボタンは日本語の札のまま（画面が t() で引く）。番号は変えない
    expect(en.actions.map((a) => (a.type === "call" ? a.tel : a.type))).toEqual(["open", "119"]);
  });
  it("便色カードの注意書きと心の危機の1文も訳す（鍵が手帳の字と同じか）", () => {
    for (const k of [STOOL_NOTE, STOOL_ASIDE, N8000_ALT_NOTE]) for (const l of ["zh", "en"] as const) expect(tFor(l, k), `${l}: ${k.slice(0, 20)}`).not.toBe(k);
    const stool = inLang("zh", () => bridgeFor("うんちが白っぽい", "child"));
    expect(stool.lead).toContain("母子健康手册的大便颜色卡上写着：“");
    expect(stool.lead).toContain("胆道闭锁症");
    expect(noKana(stool.lead!)).toBe(true);
    const crisis = inLang("en", () => bridgeFor("もう限界、死にたい", "other"));
    expect(crisis.lead).toContain("Thank you for telling me. You don't have to carry this alone.");
    expect(noKana(crisis.lead!)).toBe(true);
  });
  it("見本の答え（体験版でも鍵の無い見本の家族でも、画面の言葉で）", async () => {
    const { sampleAskReply } = await import("../samples");
    const ja = sampleAskReply();
    expect(ja.startsWith("（見本の答え）")).toBe(true);
    const zh = inLang("zh", () => sampleAskReply());
    expect(zh.startsWith("（示例回答）")).toBe(true);
    expect(noKana(zh)).toBe(true);
    const en = inLang("en", () => sampleAskReply());
    expect(en.startsWith("(Sample answer) ")).toBe(true);
    expect(en).toContain("\nEven with sample answers, the schedule, deadlines, and emergency contacts work as usual.");
    expect(noKana(en)).toBe(true);
  });
});
