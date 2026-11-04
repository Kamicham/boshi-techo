// 気をつける事の札: いつ・誰に・1枚だけ出るか（守る線）と、中身が国の資料の引用と出典だけか
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addDays, addMonths, lmpFromDue } from "./clock";
import { CAUTION_IDS, CRY_LINES, cautionFor, cautionShareText, devDatesOf, type Caution, type CautionCtx, type CautionFamily, type CautionSeen } from "./cautions";
import { DEMO_FAMILY } from "./demo-family";

const MOM: CautionCtx = { role: "母", busy: false, birthFiled: false };
const PARTNER: CautionCtx = { role: "パートナー", busy: false, birthFiled: false };
const NONE: CautionSeen = { ids: [] };
const B = DEMO_FAMILY.birthDate!;
const PREG: CautionFamily = { ...DEMO_FAMILY, birthDate: undefined };
const lmp = lmpFromDue(DEMO_FAMILY.dueDate);
const wk = (n: number) => addDays(lmp, n * 7);

/** 毎日開いて、出た札をその日に「読んだ」人の、札の並び（日と id） */
function walk(f: CautionFamily, from: string, to: string, ctx: CautionCtx): { day: string; c: Caution }[] {
  const seen: { ids: string[]; day?: string } = { ids: [] };
  const out: { day: string; c: Caution }[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const c = cautionFor(f, day, seen, ctx);
    if (!c) continue;
    out.push({ day, c });
    seen.ids.push(c.id);
    seen.day = day;
  }
  return out;
}
const firstDay = (xs: { day: string; c: Caution }[], id: string) => xs.find((x) => x.c.id === id)?.day;

describe("いつ・誰に出すか", () => {
  it("妊娠中: 33週にしなくていい事 → 34週に寝る所 → 36週に出生届出済証明（それより前には出ない）", () => {
    expect(cautionFor(PREG, addDays(wk(33), -1), NONE, MOM)).toBeNull();
    expect(cautionFor(PREG, wk(33), NONE, MOM)?.id).toBe("skip-before");
    expect(cautionFor(PREG, wk(34), { ids: ["skip-before"] }, MOM)?.id).toBe("sleep");
    expect(cautionFor(PREG, addDays(wk(36), -1), { ids: ["skip-before", "sleep"] }, MOM)).toBeNull();
    expect(cautionFor(PREG, wk(36), { ids: ["skip-before", "sleep"] }, PARTNER)?.id).toBe("birth-proof");
    // 34週に初めて開いた人には、命に関わる札（寝る所）を先に
    expect(cautionFor(PREG, wk(34), NONE, MOM)?.id).toBe("sleep");
  });

  it("労働基準法の産休の行は、働いている母の家だけ（仕事なし・自営には出さない）", () => {
    const law = (w: NonNullable<CautionFamily["situation"]>["motherWork"]) =>
      cautionFor({ ...PREG, situation: { ...PREG.situation, motherWork: w } }, wk(33), NONE, MOM)!.quotes.some((q) => q.from.startsWith("労働基準法"));
    expect(law("会社員・公務員")).toBe(true);
    expect(law("パート・派遣")).toBe(true);
    expect(law("仕事なし")).toBe(false);
    expect(law("自営・フリー")).toBe(false);
  });

  it("生まれた日は誰にも出さない。生まれた翌日から14日は母に出さない（招待した祖父母も母として見る）", () => {
    expect(cautionFor(DEMO_FAMILY, B, NONE, MOM)).toBeNull();
    expect(cautionFor(DEMO_FAMILY, B, NONE, PARTNER)).toBeNull();
    for (let i = 1; i <= 14; i++) expect(cautionFor(DEMO_FAMILY, addDays(B, i), NONE, MOM), `生後${i}日`).toBeNull();
    expect(cautionFor(DEMO_FAMILY, addDays(B, 15), NONE, MOM)).not.toBeNull();
  });

  it("パートナーには、生まれてから14日の間、出生届がまだなら出生届出済証明をもう一度（ほかの札より先に）。済んだら出さない", () => {
    expect(cautionFor(DEMO_FAMILY, addDays(B, 6), NONE, PARTNER)?.id).toBe("birth-proof-again");
    expect(cautionFor(DEMO_FAMILY, addDays(B, 13), { ids: ["birth-proof"] }, PARTNER)?.id).toBe("birth-proof-again");
    expect(cautionFor(DEMO_FAMILY, addDays(B, 14), NONE, PARTNER)?.id).not.toBe("birth-proof-again");
    expect(cautionFor(DEMO_FAMILY, addDays(B, 6), NONE, { ...PARTNER, birthFiled: true })?.id).not.toBe("birth-proof-again");
  });

  it("生後15日から3か月: 泣きやまない時（揺さぶらないの1行は赤）と、#8000・0120-189-783", () => {
    const c = cautionFor(DEMO_FAMILY, addDays(B, 15), { ids: ["sleep"] }, MOM)!;
    expect(c.id).toBe("cry");
    expect(c.calls).toEqual(["8000", "189"]);
    expect(c.quotes.find((q) => q.text.includes("揺さぶらない"))?.tone).toBe("alert");
    expect(cautionFor(DEMO_FAMILY, addMonths(B, 3), { ids: ["sleep", "skip-after", "acc-1m"] }, MOM)?.id).not.toBe("cry");
  });

  it("静かにする家族（つらい別れ・入院）・大きな札の日・読んだ日には出さない", () => {
    expect(cautionFor({ ...PREG, situation: { quiet: "loss" } }, wk(34), NONE, MOM)).toBeNull();
    expect(cautionFor({ ...DEMO_FAMILY, situation: { quiet: "nicu" } }, addDays(B, 20), NONE, MOM)).toBeNull();
    expect(cautionFor(PREG, wk(34), NONE, { ...MOM, busy: true })).toBeNull();
    expect(cautionFor(PREG, wk(34), { ids: ["skip-before"], day: wk(34) }, MOM)).toBeNull();
    expect(cautionFor(PREG, addDays(wk(34), 1), { ids: ["skip-before"], day: wk(34) }, MOM)?.id).toBe("sleep");
  });

  it("毎日読むと、1日に1枚ずつ、見本の家族の1000日に15枚より多く出ない（同じ札は二度出ない）", () => {
    for (const ctx of [MOM, PARTNER]) {
      const xs = walk(DEMO_FAMILY, lmp, addMonths(B, 24), ctx);
      const ids = xs.map((x) => x.c.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(new Set(xs.map((x) => x.day)).size).toBe(xs.length);
      expect(ids.length).toBeLessThanOrEqual(15);
    }
  });

  it("月齢の事故: 目安の月か、手帳の「できた日」の早い方から60日（早く寝返りした子には早く出す）", () => {
    const seenAll = { ids: ["sleep", "skip-after", "cry", "acc-1m"] };
    const dev = { 寝返り: addMonths(B, 4) };
    const day = addDays(addMonths(B, 4), 3);
    expect(cautionFor(DEMO_FAMILY, day, seenAll, { ...MOM, dev })?.id).toBe("acc-roll");
    expect(cautionFor(DEMO_FAMILY, day, seenAll, MOM)?.id).not.toBe("acc-roll");
    expect(cautionFor(DEMO_FAMILY, day, seenAll, { ...MOM, dev })?.why[0]).toContain("寝返り");
    // 60日を過ぎたら、その札は出さない（途中から使い始めた家族に、昔の札を並べない）
    expect(cautionFor(DEMO_FAMILY, addDays(addMonths(B, 8), 61), { ids: ["sleep", "sleep-nov-2027"] }, MOM)?.id).not.toBe("acc-crawl");
    const xs = walk(DEMO_FAMILY, addDays(B, 15), addMonths(B, 14), MOM);
    for (const id of ["acc-1m", "acc-5m", "acc-roll", "acc-crawl", "acc-stand", "acc-walk"]) expect(firstDay(xs, id), id).toBeTruthy();
  });

  it("11月: 0歳の子がいる家に、年ごとに1回。1歳を過ぎた11月には出さない", () => {
    const xs = walk(DEMO_FAMILY, addDays(B, 15), addMonths(B, 24), MOM);
    expect(firstDay(xs, "sleep-nov-2027")?.slice(0, 7)).toBe("2027-11");
    expect(firstDay(xs, "sleep-nov-2028")).toBeUndefined();
  });

  it("6月の現況届: 子のいる家に年ごとに1回。上の子のいる家は妊娠中も", () => {
    const xs = walk(DEMO_FAMILY, addDays(B, 15), addMonths(B, 24), MOM);
    expect(firstDay(xs, "skip-june-2027")?.slice(0, 7)).toBe("2027-06");
    expect(firstDay(xs, "skip-june-2028")?.slice(0, 7)).toBe("2028-06");
    const first: CautionFamily = { ...PREG, dueDate: "2027-09-10", situation: { ...PREG.situation, olderChildren: false } };
    const second: CautionFamily = { ...first, situation: { ...first.situation, olderChildren: true } };
    expect(cautionFor(first, "2027-06-10", NONE, MOM)).toBeNull();
    expect(cautionFor(second, "2027-06-10", NONE, MOM)?.id).toBe("skip-june-2027");
  });

  it("里帰り: 住む町に戻る日の前の週に、戻る家の寝る所をもう一度。同じ市の里帰りには出さない", () => {
    const far: CautionFamily = { ...DEMO_FAMILY, situation: { ...DEMO_FAMILY.situation, satogaeri: true, satogaeriPlace: { prefecture: "福岡県", city: "福岡市" }, satogaeriBack: "1か月健診のあと" } };
    const back = addDays(B, 35);
    const seen = { ids: ["sleep", "cry", "skip-after", "acc-1m"] };
    expect(cautionFor(far, addDays(back, -7), seen, MOM)?.id).toBe("sleep-home");
    expect(cautionFor(far, back, seen, MOM)?.id).not.toBe("sleep-home");
    const near: CautionFamily = { ...far, situation: { ...far.situation, satogaeriPlace: { prefecture: "埼玉県", city: "さいたま市" } } };
    expect(cautionFor(near, addDays(back, -7), seen, MOM)?.id).not.toBe("sleep-home");
  });
});

describe("中身", () => {
  const all = new Map<string, Caution>();
  for (const f of [PREG, DEMO_FAMILY, { ...DEMO_FAMILY, situation: { ...DEMO_FAMILY.situation, satogaeri: true, satogaeriPlace: { prefecture: "福岡県", city: "福岡市" } } }])
    for (const ctx of [MOM, PARTNER]) for (const x of walk(f, lmp, addMonths(B, 24), ctx)) all.set(x.c.id, x.c);

  it("出る札がそろう（15種）", () => {
    const kinds = new Set([...all.keys()].map((id) => id.replace(/-\d{4}$/, "")));
    expect([...kinds].sort()).toEqual([...CAUTION_IDS].sort());
    expect(CAUTION_IDS).toHaveLength(15);
  });

  it("どの札も、引用に出典があり、出典のページの URL がある。なぜ今？の1行目は出す時期", () => {
    for (const c of all.values()) {
      expect(c.quotes.length, c.id).toBeGreaterThan(0);
      for (const q of c.quotes) expect(q.from.length, `${c.id}: ${q.text}`).toBeGreaterThan(4);
      expect(c.sources.length, c.id).toBeGreaterThan(0);
      for (const s of c.sources) expect(s.href, c.id).toMatch(/^https:\/\/[a-z0-9.-]+\.(go|or)\.jp\//);
      expect(c.why[0], c.id).toMatch(/^この札を出す時期: /);
    }
  });

  it("引用の外（題・前後の一言）に、体の判断の言葉を書かない。人数は札に出さず、なぜ今？に置く", () => {
    const JUDGE = /異常|正常|大丈夫|心配ない|様子を見て|可能性/;
    for (const c of all.values()) {
      for (const s of [c.title, c.lead ?? "", c.after ?? ""]) expect(s, c.id).not.toMatch(JUDGE);
      for (const q of c.quotes) expect(q.text, c.id).not.toMatch(/\d+名/);
    }
    expect(all.get("sleep")!.why.join("\n")).toContain("59名");
  });

  it("命の橋の赤は、揺さぶらない（急ぎの時の札と同じ）だけ", () => {
    const red = [...all.values()].flatMap((c) => c.quotes.filter((q) => q.tone === "alert").map((q) => q.text));
    expect(red.length).toBeGreaterThan(0);
    for (const t of red) expect(CRY_LINES.find((l) => l.alert)!.says).toContain(t);
  });

  it("家族に送る文は、札の言葉と出典だけ（中の「」は『』）", () => {
    const t = cautionShareText(all.get("sleep")!);
    expect(t).toContain("「1歳になるまでは、『あおむけ』に寝かせましょう」");
    expect(t).toContain("https://www.cfa.go.jp/policies/boshihoken/kenkou/sids/");
    expect(t).not.toContain("59名");
  });

  it("泣きやまない時の言葉は1か所に置く（急ぎの時の画面も CRY_LINES を読む）", () => {
    const page = readFileSync(join(__dirname, "../app/emergency/page.tsx"), "utf8");
    expect(page).toContain("CRY_LINES");
    expect(page).not.toContain("誰が悪いわけでもないのです");
  });
});

describe("手帳のできた日を読む", () => {
  it("OK 済みの発達の記録の、項目ごとの一番早い日だけ（候補・日付の無い記録・ほかの項目は使わない）", () => {
    const got = devDatesOf([
      { id: "1", data: { page: "development", date: "2027-09-20", values: { item: "寝返り" } } },
      { id: "2", data: { page: "development", date: "2027-09-02", values: { item: "寝返り" } } },
      { id: "3", data: { page: "development", date: "2027-08-01", values: { item: "はいはい" }, pending: true } },
      { id: "4", data: { page: "development", date: "2027-08-01", values: { item: "つかまり立ち" }, dateUnsure: "none" } },
      { id: "5", data: { page: "development", date: "2027-10-01", values: { item: "首すわり" } } },
      { id: "6", data: { page: "growth", date: "2027-10-01", values: { item: "ひとり歩き" } } },
      { id: "7", page: "development", date: "2028-04-01", values: { item: "ひとり歩き" } },
      null,
      "x",
    ]);
    expect(got).toEqual({ 寝返り: "2027-09-02", ひとり歩き: "2028-04-01" });
  });
});
