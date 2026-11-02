import { describe, expect, it } from "vitest";
import { advisorMoments, detectTriggers, trimAdvice, type AdvisorInput } from "./advisor";
import { DEMO_FAMILY, type Family } from "./demo-family";

const at = (today: string, family: Family = DEMO_FAMILY, done: string[] = [], isDemo = true): AdvisorInput => ({ family, today, done: new Set(done), isDemo });
const first = (i: AdvisorInput) => detectTriggers(i)[0];

describe("参謀の気づき: きっかけを機械で見つける", () => {
  it("何も無い日は空", () => {
    expect(detectTriggers(at("2026-10-01"))).toEqual([]);
  });

  it("予定より2週間早く生まれた翌日: 組み直し（産後休業・育休の始まりがずれる）", () => {
    const t = first(at("2027-04-27"));
    expect(t.kind).toBe("birth-early");
    expect(t.facts[0]).toContain("14日早く");
    expect(t.facts.join("\n")).toContain("6月22日"); // 母の育休が始まる日（生まれた日 + 57日）
    expect(t.to?.role).toBe("職場の上司");
  });

  it("早く生まれた気づきは、生まれてから3日まで", () => {
    expect(detectTriggers(at("2027-04-30")).some((t) => t.kind === "birth-early")).toBe(false);
  });

  it("予定日とのずれが7日より小さければ気づかない", () => {
    const f = { ...DEMO_FAMILY, birthDate: "2027-05-08" };
    expect(detectTriggers(at("2027-05-09", f)).some((t) => t.kind.startsWith("birth"))).toBe(false);
  });

  it("予定より遅く生まれた時も組み直す", () => {
    const f = { ...DEMO_FAMILY, birthDate: "2027-05-20" };
    expect(first(at("2027-05-21", f)).kind).toBe("birth-late");
  });

  it("パートナーの担当が2件止まっている: 祖父母に頼む", () => {
    const t = first(at("2027-05-01"));
    expect(t.kind).toBe("partner-stalled");
    expect(t.key).toBe("partner-stalled:shota:birth-registration,child-allowance");
    expect(t.to).toEqual({ memberId: "kazuko", role: "和子" });
  });

  it("片方を済ませたら止まっていない", () => {
    expect(detectTriggers(at("2027-05-01", DEMO_FAMILY, ["birth-registration"])).some((t) => t.kind === "partner-stalled")).toBe(false);
  });

  it("祖父母がいない家族は、外の手を調べる前提で", () => {
    const f = { ...DEMO_FAMILY, members: DEMO_FAMILY.members.filter((m) => m.role !== "祖父母") };
    const t = first(at("2027-05-01", f));
    expect(t.kind).toBe("partner-stalled");
    expect(t.to?.role).toBe("町の窓口");
    expect(t.facts.join("\n")).toContain("産前産後ヘルパー");
  });

  it("祖父母が来る7日前から、割り振りを出す（止まっている事より先）", () => {
    const kinds = detectTriggers(at("2027-05-12")).map((t) => t.kind);
    expect(kinds[0]).toBe("grandparents");
    expect(first(at("2027-05-12")).key).toBe("grandparents:kazuko:2027-05-15:2027-05-29");
    expect(detectTriggers(at("2027-05-07")).some((t) => t.kind === "grandparents")).toBe(false);
  });

  it("引っ越してから30日、前の町との差に気づく（調べに行く）", () => {
    const t = first(at("2027-01-19"));
    expect(t.kind).toBe("moved");
    expect(t.research).toEqual({ from: "神奈川県横浜市", to: "埼玉県さいたま市", phase: "妊娠24週0日" });
    expect(detectTriggers(at("2027-02-18")).some((x) => x.kind === "moved")).toBe(false);
  });

  it("同じ状況なら同じ鍵（Claude を呼び直さない）", () => {
    expect(first(at("2027-05-01")).key).toBe(first(at("2027-05-02")).key);
  });

  it("デモの早送りのボタンの日に、それぞれの気づきが一番上に出る", () => {
    const m = advisorMoments(DEMO_FAMILY);
    expect(m.map((x) => x.label)).toEqual(["引っ越した", "早く生まれた", "生まれて5日", "和子が来る前"]);
    expect(m.map((x) => first(at(x.date)).kind)).toEqual(["moved", "birth-early", "partner-stalled", "grandparents"]);
  });

  it("文字数の約束を守らせる", () => {
    const a = trimAdvice({ title: "あ".repeat(40), why: "", plan: ["い".repeat(50), "う", "え", "お"] });
    expect(a.title.length).toBe(30);
    expect(a.plan).toHaveLength(3);
    expect(a.plan[0].length).toBe(40);
  });
});
