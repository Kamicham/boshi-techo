// ママの記録の見分け方と、読むだけの人に見せてよい形（lib/mother-records.ts・家族の声②の C・2026-11-05）。
// 記録はすべて作った物（名前・日付・値は見本）
import { describe, expect, it } from "vitest";
import { isMaternalVaccine, isMotherEntry, MOTHER_PAGES, readerEntry, recordViewerOf } from "./mother-records";
import { TECHO_PAGE_IDS, type TechoEntry } from "./techo";

const entry = (page: string, date: string, values: Record<string, string | number>, more: Partial<TechoEntry> = {}): TechoEntry =>
  ({ page, date, title: "題の字", values, source: "text", ...more }) as TechoEntry;

describe("ママの記録の見分け方（1枚・手帳の一覧・書き出しで同じ）", () => {
  it("ママの頁（家で測った物を含む）がママの記録。子の頁と相談の頁は、頁だけではママの記録にしない", () => {
    for (const page of MOTHER_PAGES) expect(isMotherEntry({ page, values: {} }), page).toBe(true);
    expect(isMotherEntry({ page: "home", values: {} })).toBe(true);
    for (const page of ["birth", "newborn", "stool", "growth", "development", "child-checkup", "consult", "vaccine"]) expect(isMotherEntry({ page, values: {} }), page).toBe(false);
    // 手帳の頁が増えた時に、どちらに入れるかを決め忘れない（ママの頁でも子の頁でもない物を足したら、ここを直す）
    const decided = new Set([...MOTHER_PAGES, "birth", "newborn", "stool", "growth", "development", "child-checkup", "consult", "vaccine"]);
    expect(TECHO_PAGE_IDS.filter((p) => !decided.has(p))).toEqual([]);
  });

  it("妊娠中に母が受けたワクチンの行はママの記録（回の欄の妊娠週数・名前・RS で始まる行）。子の RS の抗体の注射と、ほかの子のワクチンは子の記録", () => {
    const vax = (vaccine: string, dose?: string) => ({ page: "vaccine", values: dose ? { vaccine, dose } : { vaccine } });
    expect(isMaternalVaccine(vax("RSウイルス", "妊娠30週2日"))).toBe(true);
    expect(isMaternalVaccine(vax("アブリスボ"))).toBe(true);
    expect(isMaternalVaccine(vax("RSウイルス（母子免疫）"))).toBe(true);
    expect(isMaternalVaccine(vax("ＲＳウイルス"))).toBe(true); // 全角
    expect(isMaternalVaccine(vax("RSウイルス", "1回目"))).toBe(true); // 手帳の画面は「RSウイルス（妊娠中）」にまとめる
    expect(isMaternalVaccine(vax("インフルエンザ", "妊娠中"))).toBe(true);
    expect(isMaternalVaccine(vax("RSウイルスの抗体（ベイフォータス）", "1回目"))).toBe(false);
    expect(isMaternalVaccine(vax("シナジス", "1回目"))).toBe(false);
    expect(isMaternalVaccine(vax("ヒブ", "1回目"))).toBe(false);
    expect(isMaternalVaccine(vax("BCG"))).toBe(false);
    expect(isMaternalVaccine({ page: "growth", values: { vaccine: "RSウイルス", dose: "妊娠30週2日" } })).toBe(false);
    expect(isMotherEntry(vax("RSウイルス", "妊娠30週2日"))).toBe(true);
    expect(isMotherEntry(vax("ヒブ", "1回目"))).toBe(false);
  });

  it("読むだけの人に見せる形: ママの記録は無し。出産の頁は、お産のしかたと元の言葉を外す。ほかの子の記録はそのまま", () => {
    expect(readerEntry(entry("pregnancy-checkup", "2026-01-10", { weightKg: 55.2 }))).toBeNull();
    expect(readerEntry(entry("home", "2026-01-15", { weightKg: 56.4 }))).toBeNull();
    expect(readerEntry(entry("vaccine", "2026-03-24", { vaccine: "RSウイルス", dose: "妊娠30週2日" }))).toBeNull();
    const birth = entry("birth", "2026-05-25", { week: "39週0日", weightG: 3000, heightCm: 49, method: "お産のしかたの字", place: "生まれた場所の字" }, { note: "元の言葉の字" });
    const shown = readerEntry(birth)!;
    expect(shown.values).toEqual({ week: "39週0日", weightG: 3000, heightCm: 49, place: "生まれた場所の字" });
    expect(shown.note).toBeUndefined();
    expect(JSON.stringify(shown)).not.toMatch(/お産のしかたの字|元の言葉の字/);
    // 元の記録は書き換えない
    expect(birth.values.method).toBe("お産のしかたの字");
    expect(birth.note).toBe("元の言葉の字");
    const growth = entry("growth", "2026-06-25", { weightKg: 4.1 });
    expect(readerEntry(growth)).toBe(growth);
  });
});

describe("記録を見る人の見分け方（関所の結果から）", () => {
  const subjects = [
    { kind: "mother", accountId: "acc-mama" },
    { kind: "partner", accountId: "acc-papa" },
    { kind: "child", accountId: null },
  ];
  it("家（合言葉）と作った家族はママ本人。アカウントのある世帯は、本人の種類が mother の人だけがママ本人で、member と知らない役は読むだけ", () => {
    expect(recordViewerOf({ legacy: true, role: "owner", account: null })).toBe("mother");
    expect(recordViewerOf({ legacy: false, role: "guest", account: null })).toBe("mother");
    expect(recordViewerOf({ legacy: false, role: "owner", account: { id: "acc-mama" }, ctx: { subjects } })).toBe("mother");
    expect(recordViewerOf({ legacy: false, role: "admin", account: { id: "acc-mama" }, ctx: { subjects } })).toBe("mother");
    expect(recordViewerOf({ legacy: false, role: "owner", account: { id: "acc-papa" }, ctx: { subjects } })).toBe("writer");
    expect(recordViewerOf({ legacy: false, role: "admin", account: { id: "acc-papa" }, ctx: { subjects } })).toBe("writer");
    expect(recordViewerOf({ legacy: false, role: "owner", account: null, ctx: { subjects } })).toBe("writer");
    expect(recordViewerOf({ legacy: false, role: "member", account: { id: "acc-mama" }, ctx: { subjects } })).toBe("reader");
    expect(recordViewerOf({ legacy: false, role: "viewer", account: { id: "acc-mama" }, ctx: { subjects } })).toBe("reader");
  });
});
