// 決まりで書いた気づきを、頼みの言葉で組み直す（2026-11-05 多言語化③の漏れ）。
// 見本の家族の「生まれた翌日（14日早い）」と「引っ越した翌日（妊娠中）」で、DB に残す日本語は変えず、中文・English の画面にかなが残らない事。
// Claude には一度もつながない（SDK は偽物）。DB は一時フォルダ（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@anthropic-ai/sdk", () => {
  class Anthropic {
    beta = {
      messages: {
        parse: async () => {
          throw new Error("鍵の無い見本では Claude を呼ばない");
        },
        create: async () => {
          throw new Error("鍵の無い見本では Claude を呼ばない");
        },
      },
    };
  }
  return { default: Anthropic };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-advice-lang-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.ANTHROPIC_API_KEY;
delete process.env.BOSHI_PUBLIC;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const demo = { householdId: "demo-sato", kind: "demo" as const, accountId: null, subjectIds: [], legacy: true };

async function stored(today: string) {
  const { DEMO_FAMILY } = await import("@/lib/demo-family");
  const { detectTriggers } = await import("@/lib/advisor");
  const { writeAdvice } = await import("./write");
  const { sendingAs } = await import("@/lib/claude");
  const input = { family: DEMO_FAMILY, today, done: new Set<string>(), isDemo: true };
  const [t] = detectTriggers(input);
  const a = await sendingAs(demo, () => writeAdvice(t, input, {}));
  return { family: DEMO_FAMILY, a };
}

/** 括弧の中（並べた日本語）・名前・町の名前を除いて、かなが残っていないか */
function kanaLeft(s: string): string[] {
  const rest = s
    .replace(/（[^）]*）|\([^)]*\)/g, "")
    .replace(/美咲|翔太|さいたま市|横浜市/g, "")
    .replace(/Claude/g, "");
  return [...new Set(rest.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu) ?? [])];
}

function texts(a: { title: string; why: string; plan: string[]; facts: string[] }) {
  return [a.title, a.why, ...a.plan, ...a.facts];
}

describe("決まりで書いた気づきを、頼みの言葉で組み直す", () => {
  it("生まれた翌日（予定日より14日早い）: 中文・English の題・理由・次にする事・機械で確かめた事に、かなが残らない", async () => {
    const { adviceIn } = await import("./in-lang");
    const { whyParts } = await import("@/components/today/why-parts");
    const { family, a } = await stored("2027-04-27");
    // 日本語は残した物そのまま
    expect(adviceIn(a, family, "ja")).toBe(a);
    expect(a.title).toBe("美咲の育休の始まりを6月22日に数え直しました");
    for (const lang of ["zh", "en"] as const) {
      const x = adviceIn(a, family, lang);
      expect(x.title, lang).not.toBe(a.title);
      for (const s of texts(x)) expect(kanaLeft(s), `${lang}: ${s}`).toEqual([]);
      // 職場の上司あての文面は、相手が読む日本語のまま
      expect(x.message).toEqual(a.message);
      expect(x.facts.length).toBe(a.facts.length);
    }
    const en = adviceIn(a, family, "en");
    expect(en.title).toBe("Misaki's childcare leave now starts on Jun 22");
    expect(whyParts(en.why)[0]).toBe("Born 14 days before the due date.");
    expect(en.plan[0]).toBe("Tell Misaki's workplace that childcare leave now starts on Jun 22");
    // 理由の後ろに足した一言（鍵が無い時）も訳す
    expect(en.why.endsWith("With a Claude key, Claude writes this, also looking at the family's situation (work, older siblings).")).toBe(true);
    const zh = adviceIn(a, family, "zh");
    expect(zh.title).toBe("已把美咲的育儿休假开始日重新算为6月22日");
    expect(whyParts(zh.why)[0]).toBe("比预产期早14天出生。");
  });

  it("引っ越した翌日（妊娠中）: 見本の家族の町の名前も頼みの言葉で（2026-11-07 UX の気づき）、役所あての文面は日本語のまま", async () => {
    const { adviceIn } = await import("./in-lang");
    const { family, a } = await stored("2027-01-19");
    expect(a.kind).toBe("moved");
    for (const lang of ["zh", "en"] as const) {
      const x = adviceIn(a, family, lang);
      for (const s of texts(x)) {
        expect(kanaLeft(s), `${lang}: ${s}`).toEqual([]);
        expect(s, `${lang}: ${s}`).not.toMatch(/横浜市|さいたま市/);
      }
      expect(x.message).toEqual(a.message);
    }
    const en = adviceIn(a, family, "en");
    expect(en.why).toContain("You moved from Yokohama on Jan 18.");
    expect(en.plan[0]).toMatch(/^Moving-in notification: by Feb 1 \(within 14 days of the move\)$/);
    expect(en.facts[0]).toBe("Moved from Yokohama to Saitama City on Jan 18 (at the time: 24 weeks pregnant)");
    const zh = adviceIn(a, family, "zh");
    expect(zh.why).toContain("1月18日从横滨市搬了家。");
    expect(zh.facts[0]).toBe("1月18日从横滨市搬到埼玉市（当时：妊娠24周0天）");
  });

  it("本物の家族が入れた町の名前は、中文・English でも日本語のまま（窓口の書類と同じ字）", async () => {
    const { adviceIn } = await import("./in-lang");
    const { family, a } = await stored("2027-01-19");
    const real = { ...family, id: "h-real-moved" };
    const en = adviceIn(a, real, "en");
    expect(en.why).toContain("You moved from 横浜市 on Jan 18.");
    expect(en.facts[0]).toBe("Moved from 神奈川県横浜市 to 埼玉県さいたま市 on Jan 18 (at the time: 24 weeks pregnant)");
    expect(adviceIn(a, real, "zh").facts[0]).toBe("1月18日从神奈川県横浜市搬到埼玉県さいたま市（当时：妊娠24周0天）");
  });

  it("Claude が書いた気づき（決まりの札が無い物）は、書いたまま", async () => {
    const { adviceIn } = await import("./in-lang");
    const { family, a } = await stored("2027-04-27");
    const claude = { ...a, why: "Claude が書いた理由です。", title: "Claude が書いた題" };
    expect(adviceIn(claude, family, "en")).toBe(claude);
  });
});

describe("決まりの文の日本語は前と同じ", () => {
  it("理由の終わりの2文は RULE_MARK と同じ（残した気づきを見分ける印）", async () => {
    const { RULE_MARK } = await import("@/lib/advisor");
    const { t } = await import("@/lib/i18n");
    expect(t("予定表から数えました。") + t("Claude は使っていません。")).toBe(RULE_MARK);
  });

  it("機械で確かめた事と時期の名前は、日本語の時は何も変えない", async () => {
    const { factsIn } = await import("@/lib/advisor");
    const { relabel } = await import("@/lib/clock");
    const { a } = await stored("2027-04-27");
    expect(factsIn(a.facts)).toEqual(a.facts);
    for (const l of ["妊娠23週6日", "生まれた日", "生後10日", "生後2か月", "1歳", "1歳6か月", "授かる前"]) expect(relabel(l)).toBe(l);
  });
});
