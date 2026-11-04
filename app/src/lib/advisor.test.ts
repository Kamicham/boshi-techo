import { describe, expect, it } from "vitest";
import { adviceSender, advisorMoments, birthWindowStart, detectTriggers, trimAdvice, type AdvisorInput } from "./advisor";
import { DEMO_FAMILY, type Family } from "./demo-family";

const at = (today: string, family: Family = DEMO_FAMILY, done: string[] = [], isDemo = true): AdvisorInput => ({ family, today, done: new Set(done), isDemo });
const first = (i: AdvisorInput) => detectTriggers(i)[0];

describe("気づいた事: きっかけを機械で見つける", () => {
  it("何も無い日は空", () => {
    expect(detectTriggers(at("2026-10-01"))).toEqual([]);
  });

  it("予定より2週間早く生まれた翌日: 組み直し（産後休業・育休の始まりがずれる）", () => {
    const t = first(at("2027-04-27"));
    expect(t.kind).toBe("birth-early");
    expect(t.facts[0]).toContain("予定日との差 14日");
    expect(t.facts[0]).not.toMatch(/早く生まれ|遅く生まれ/); // 体の評価に聞こえる言い方をしない（安心のデザイン #8）
    expect(t.facts.join("\n")).toContain("6月22日"); // 母の育休が始まる日（生まれた日 + 57日）
    expect(t.to?.role).toBe("職場の上司");
  });

  it("早く生まれた気づきは、生まれた日から14日まで（生まれた日を入れた日を持たない家族＝見本・作った家族・11/5 より前に入れた家族）", () => {
    // 見本の家族は 4/26 生まれ。14日目の 5/10 までは出て、5/11 からは出ない（見直し C10④。前は3日まで）
    expect(detectTriggers(at("2027-04-30")).some((t) => t.kind === "birth-early")).toBe(true);
    expect(detectTriggers(at("2027-05-10")).some((t) => t.kind === "birth-early")).toBe(true);
    expect(detectTriggers(at("2027-05-11")).some((t) => t.kind === "birth-early")).toBe(false);
  });

  it("生まれた日を入れた日がある家族は、入れた日から14日（退院してから日を入れた家族にも出る）", () => {
    const f = { ...DEMO_FAMILY, birthKnownOn: "2027-05-03" };
    expect(birthWindowStart(f)).toBe("2027-05-03");
    expect(detectTriggers(at("2027-05-12", f)).some((t) => t.kind === "birth-early")).toBe(true);
    expect(detectTriggers(at("2027-05-17", f)).some((t) => t.kind === "birth-early")).toBe(true);
    expect(detectTriggers(at("2027-05-18", f)).some((t) => t.kind === "birth-early")).toBe(false);
    // 生まれた日より前の「入れた日」は読まない（生まれた日から数える）
    expect(birthWindowStart({ ...DEMO_FAMILY, birthKnownOn: "2027-04-01" })).toBe("2027-04-26");
    // 生まれる前の日は出さない
    expect(detectTriggers(at("2027-04-25", f)).some((t) => t.kind.startsWith("birth"))).toBe(false);
  });

  it("予定日とのずれが7日より小さければ気づかない", () => {
    const f = { ...DEMO_FAMILY, birthDate: "2027-05-08" };
    expect(detectTriggers(at("2027-05-09", f)).some((t) => t.kind.startsWith("birth"))).toBe(false);
  });

  it("予定より遅く生まれた時も組み直す", () => {
    const f = { ...DEMO_FAMILY, birthDate: "2027-05-20" };
    expect(first(at("2027-05-21", f)).kind).toBe("birth-late");
  });

  it("引っ越してから30日、前の町との差に気づく（調べに行く）", () => {
    const t = first(at("2027-01-19"));
    expect(t.kind).toBe("moved");
    expect(t.research).toEqual({ from: "神奈川県横浜市", to: "埼玉県さいたま市", phase: "妊娠24週0日" });
    expect(detectTriggers(at("2027-02-18")).some((x) => x.kind === "moved")).toBe(false);
  });

  it("同じ状況なら同じ鍵（Claude を呼び直さない）", () => {
    expect(first(at("2027-04-27")).key).toBe(first(at("2027-04-28")).key);
  });

  it("生まれて15日たてば、もう気づきは出ない（担当が止まっている・祖父母が来る、は見ない）", () => {
    expect(detectTriggers(at("2027-05-11"))).toEqual([]);
    expect(detectTriggers(at("2027-05-12"))).toEqual([]);
  });

  it("閉じた気づきを開き直す時の、文面を送る人（決まりのきっかけは母・見渡した気づきは決めない）", () => {
    expect(adviceSender("birth-early", DEMO_FAMILY)).toEqual({ memberId: "misaki", name: "美咲" });
    expect(adviceSender("moved", DEMO_FAMILY)?.memberId).toBe("misaki");
    expect(adviceSender("look", DEMO_FAMILY)).toBeUndefined();
    // 気づいた時と同じ人（detectTriggers の from）
    expect(first(at("2027-04-27")).from).toEqual(adviceSender("birth-early", DEMO_FAMILY));
  });

  it("デモの早送りのボタンの日に、それぞれの気づきが一番上に出る", () => {
    const m = advisorMoments(DEMO_FAMILY);
    expect(m.map((x) => x.label)).toEqual(["引っ越した", "生まれた日"]);
    expect(m.map((x) => first(at(x.date)).kind)).toEqual(["moved", "birth-early"]);
  });

  it("文字数の約束を守らせる", () => {
    const a = trimAdvice({ title: "あ".repeat(40), why: "", plan: ["い".repeat(50), "う", "え", "お"] });
    expect(a.title.length).toBe(30);
    expect(a.plan).toHaveLength(3);
    expect(a.plan[0].length).toBe(40);
  });
});

describe("lookBucket（見渡す時期）", async () => {
  const { lookBucket } = await import("./advisor");
  const base = { id: "t", city: "さいたま市", prefecture: "埼玉県", dueDate: "2027-05-10", members: [] } as unknown as Parameters<typeof lookBucket>[0];
  it("授かる前は見渡さない", () => expect(lookBucket(base, "2026-07-01")).toBeNull());
  it("妊娠中は4週ごと", () => {
    expect(lookBucket(base, "2026-09-01")).toBe("w4"); // 最終月経（8月3日）から4週1日
    expect(lookBucket(base, "2026-09-30")).toBe("w8");
  });
  it("生まれてからは1か月ごと・2歳を過ぎたら見渡さない", () => {
    const born = { ...base, birthDate: "2027-05-01" };
    expect(lookBucket(born, "2027-05-01")).toBe("m0");
    expect(lookBucket(born, "2027-06-05")).toBe("m1");
    expect(lookBucket(born, "2029-06-01")).toBeNull();
  });
  it("先の生まれた日は、まだ生まれていない扱い", () => {
    expect(lookBucket({ ...base, birthDate: "2027-05-01" }, "2027-01-10")?.startsWith("w")).toBe(true);
  });
});
