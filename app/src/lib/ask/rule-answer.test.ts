import { describe, expect, it } from "vitest";
import { RULE_MARK, ruleAnswer, ruleKind, type PlanRow, type PlanView } from "./rule-answer";

const row = (id: string, やさしい題: string, 状態 = "今やる", extra: Partial<PlanRow> = {}): PlanRow => ({ id, やさしい題, 正式な名前: やさしい題, 担当: "母（美咲）", 状態, 始まり: "11月1日", 目安の日: "11月20日（あと16日）", ...extra });
const plan: PlanView = {
  今やる事: [row("pregnancy-report", "役所に妊娠を届ける", "期限切れ"), row("tell-work", "職場に妊娠を伝える"), row("partner-leave", "育休の段取りを決める", "今やる", { 担当: "パートナー（翔太）" }), row("x", "4つ目")],
  まだ先の事: [row("vaccines-start", "予防接種を始める", "まだ先", { 始まり: "2027年7月20日（あと258日）" }), row("checkup-3-4m", "3〜4か月健診", "まだ先"), row("daycare-apply", "保育園を申し込む", "まだ先")],
};

describe("手帳に聞く: 決まりの答え", () => {
  it("問いの種類を見分ける", () => {
    expect(ruleKind("次にやる事は何？")).toBe("next");
    expect(ruleKind("次の予防接種と健診はいつ？")).toBe("checkups");
    expect(ruleKind("この画面では何ができる？")).toBe("screen");
    expect(ruleKind("保育園の申し込みはいつ？")).toBe("topic");
    expect(ruleKind("産休と育休はいつから？")).toBe("topic");
    // 健診で聞く事は Claude に任せる・体の言葉は決まりで答えない
    expect(ruleKind("次の健診で何を聞けばいい？")).toBeNull();
    expect(ruleKind("お腹が痛いけど、次にやる事は？")).toBeNull();
    expect(ruleKind("今日はいい天気")).toBeNull();
  });
  it("次にやる事: 上位3つを、予定表の日付のまま並べ、窓口のボタンを付ける", () => {
    const r = ruleAnswer("next", "次にやる事は何？", plan)!;
    expect(r.text.startsWith(RULE_MARK)).toBe(true);
    expect(r.text).toContain("いまやる事は4つです");
    expect(r.text).toContain("・役所に妊娠を届ける — 目安 11月20日（あと16日）");
    expect(r.text).toContain("育休の段取りを決める（パートナー（翔太）の番）");
    expect(r.text).toContain("ほかに1つ");
    expect(r.actions).toHaveLength(3);
    expect(r.actions[0]).toEqual({ type: "milestone", milestoneId: "pregnancy-report", label: "役所に妊娠を届ける" });
  });
  it("今やる事は、期限の近い順に並べる（「いま」の画面と同じ）", () => {
    const r = ruleAnswer("next", "次にやる事は？", { 今やる事: [row("far", "遠い事", "今やる", { 目安の日: "2029年3月14日（あと627日）" }), row("near", "近い事", "今やる", { 目安の日: "7月26日（あと30日）" }), row("late", "過ぎた事", "期限切れ", { 目安の日: "6月1日（3日過ぎた）" })], まだ先の事: [] })!;
    expect(r.actions.map((a) => (a.type === "milestone" ? a.milestoneId : ""))).toEqual(["late", "near", "far"]);
  });
  it("今やる事が無い時は、次の1つを始まりの日で言う", () => {
    const r = ruleAnswer("next", "次にやる事は？", { 今やる事: [], まだ先の事: plan.まだ先の事 })!;
    expect(r.text).toContain("今すぐやる事はありません。次は「予防接種を始める」で、2027年7月20日（あと258日）からです");
  });
  it("「いま」の画面と同じ物を言う: 始める前に過ぎた事と、健診の予約", () => {
    const r = ruleAnswer("next", "次にやる事は？", { 今やる事: [], まだ先の事: plan.まだ先の事, 過ぎた事: ["役所に妊娠を届ける"], 健診の予約: { when: "今日ごろ" } })!;
    expect(r.text).toContain("いまやる事は1つです");
    expect(r.text).toContain("・次の妊婦健診を予約する — 今日ごろ");
    expect(r.text).toContain("始める前に目安が過ぎた事: 役所に妊娠を届ける");
    expect(r.text).not.toContain("今すぐやる事はありません");
    expect(r.actions).toEqual([{ type: "open", href: "/visit", label: "予約した日を入れる" }]);
    const q = ruleAnswer("next", "次にやる事は？", { 今やる事: [], まだ先の事: plan.まだ先の事, 過ぎた事: ["役所に妊娠を届ける"] })!;
    expect(q.text).toContain("ほかに今すぐやる事はありません");
  });
  it("健診と予防接種・関係する事・画面の案内", () => {
    expect(ruleAnswer("checkups", "次の予防接種は？", plan)!.actions.map((a) => (a.type === "milestone" ? a.milestoneId : ""))).toEqual(["vaccines-start", "checkup-3-4m"]);
    expect(ruleAnswer("topic", "保育園の申し込みはいつ？", plan)!.text).toContain("保育園を申し込む");
    expect(ruleAnswer("topic", "児童手当は？", plan)).toBeNull();
    expect(ruleAnswer("screen", "この画面では何ができる？", plan, "/book")!.text).toContain("この画面（");
  });
  it("判定の言葉を使わない", () => {
    for (const k of ["next", "checkups", "topic", "screen"] as const) {
      const r = ruleAnswer(k, "次にやる事 予防接種 保育園", plan, "/");
      expect(r?.text ?? "").not.toMatch(/大丈夫|心配ない|正常|異常/);
    }
  });
});
