// 町の調べ物の試験: 同じ町・同じ手続きは、2家族目から Claude を呼ばない（町×手続きで使い回す）。
// 1回の重さを抑える: 調べ物は Sonnet（RESEARCH_MODEL）・web 検索は4回まで（2026-11-03、調べ物が1回 $0.49・費用の3割だったため）。
// Claude は呼ばない（偽の答えを返す）。DB は一時フォルダに作る（わが家の app/data には触らない）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const researchCalls: { question: string; opts: unknown }[] = [];
vi.mock("./claude", async () => {
  const actual = await vi.importActual<typeof import("./claude")>("./claude");
  return {
    ...actual,
    research: vi.fn(async (_system: string, question: string, opts: unknown) => {
      researchCalls.push({ question, opts });
      return { text: "窓口は町役場1階の住民課。", sources: [{ title: "町の公式", url: "https://www.town.example.lg.jp/a" }] };
    }),
    structured: vi.fn(async () => ({
      summary: "町役場で出します。",
      where: "町役場1階 住民課",
      office: "例町役場",
      address: "",
      bring: ["届出書"],
      online: "確かめる",
      deadline: "生まれた日を入れて14日以内",
      extras: "確かめる",
      caution: "確かめる",
    })),
  };
});

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-local-test-"));
process.env.BOSHI_DATA_DIR = dir;
delete process.env.BOSHI_SIM;

describe("町の調べ物", () => {
  it("同じ町・同じ手続きは2家族目から調べ直さず、調べる時は Sonnet・検索4回まで", async () => {
    const { fetchLocal } = await import("./local");
    const { RESEARCH_MODEL } = await import("./claude");
    const { DEMO_FAMILY } = await import("./demo-family");
    const { MILESTONES } = await import("./milestones");
    const m = MILESTONES.find((x) => x.id === "birth-registration") ?? MILESTONES[0];
    const a = { ...DEMO_FAMILY, id: "local-test-a", prefecture: "北海道", city: "東川町" };
    const b = { ...DEMO_FAMILY, id: "local-test-b", prefecture: "北海道", city: "東川町" };

    const first = await fetchLocal(a, m);
    expect(first.cached).toBe(false);
    expect(researchCalls).toHaveLength(1);
    expect(researchCalls[0].opts).toMatchObject({ model: RESEARCH_MODEL, maxUses: 4 });
    expect(RESEARCH_MODEL).toMatch(/sonnet/);

    const second = await fetchLocal(b, m);
    expect(second.cached).toBe(true);
    expect(second.local.where).toBe("町役場1階 住民課");
    expect(researchCalls).toHaveLength(1);
  });
});

describe("6番目の問い（その事だけに聞く）", () => {
  const home = { prefecture: "東京都", city: "江東区" };
  it("今夜足した3つ（RS ウイルス・産後ケア・産婦健診）は、町の仕組みを聞く", async () => {
    const { extraQuestion } = await import("./local");
    const rsv = extraQuestion("rsv-maternal", "東川町", home);
    for (const w of ["受けられる医療機関", "予診票", "費用"]) expect(rsv).toContain(w);
    const care = extraQuestion("postpartum-care", "東川町", home);
    for (const w of ["宿泊", "日帰り", "訪問", "妊娠中から申し込めるか", "費用"]) expect(care).toContain(w);
    const check = extraQuestion("postpartum-checkup-2w", "東川町", home);
    for (const w of ["受診票", "使える回数", "使える医療機関"]) expect(check).toContain(w);
  });

  it("前からの問いはそのまま・ほかの事には6番目を付けない", async () => {
    const { extraQuestion } = await import("./local");
    expect(extraQuestion("pregnancy-support-2", "東川町", home)).toMatch(/^2回目の面談の予約の仕方/);
    expect(extraQuestion("satogaeri-local", "霧島市", home)).toContain("ほかの町（東京都江東区）に住む人が、霧島市に里帰りして産む時");
    expect(extraQuestion("birth-registration", "東川町", home)).toBe("");
  });

  it("調べる問いに6番目が入り、家族の事（子の名前・予定日）は入らない（町×事で使い回すため）", async () => {
    const { fetchLocal } = await import("./local");
    const { DEMO_FAMILY } = await import("./demo-family");
    const { MILESTONES } = await import("./milestones");
    const m = MILESTONES.find((x) => x.id === "rsv-maternal")!;
    expect(m).toBeTruthy();
    const f = { ...DEMO_FAMILY, id: "local-test-rsv", prefecture: "北海道", city: "美瑛町" };
    await fetchLocal(f, m);
    const q = researchCalls[researchCalls.length - 1].question;
    expect(q).toContain("6. RSウイルスの母子免疫ワクチン");
    expect(q).toContain("美瑛町");
    expect(q).not.toContain(DEMO_FAMILY.childName ?? "（子の名前なし）");
    expect(q).not.toContain(DEMO_FAMILY.dueDate);
  });
});
