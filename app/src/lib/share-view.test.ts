// 健診で見せる1枚の、出してよい物の決まり（lib/share-view.ts・家族の声②の C・2026-11-05）。
// 記録はすべて作った物（名前・日付・値は見本）。わざと題・元の言葉・メモ・施設名・ロット・医師・id・お金を入れて、1枚に出ない事を見る
import { describe, expect, it } from "vitest";
import type { TechoEntry } from "./techo";
import type { VisitPlan } from "./visit";
import { recordViewerOf } from "./mother-records";
import { SHARE_BUNDLES, shareChoices, shareView, shareViewerOf, type ShareBundle, type ShareInput } from "./share-view";

const TODAY = "2026-11-05";
const ALL: ShareBundle[] = SHARE_BUNDLES.map((b) => b.id);

const entry = (page: string, date: string, values: Record<string, string | number>, more: Partial<TechoEntry> = {}): TechoEntry =>
  ({ page, date, title: "題の字", values, source: "text", note: "元の言葉の字", captureId: "try-cap1", ...more }) as TechoEntry;

const ENTRIES: TechoEntry[] = [
  entry("mother-health", "2025-09-20", { heightCm: 158, weightKg: 50, history: "これまでの病気の字", allergy: "卵", medicine: "なし", pastBirths: "初めて", smoking: "吸わない" }, { who: "みさき" }),
  entry(
    "pregnancy-checkup",
    "2026-01-10",
    { week: "19週", weightKg: 55.2, bpHigh: 112, bpLow: 70, fundusCm: 18, edema: "−", urineProtein: "−", urineSugar: "−", memo: "メモの字", facility: "産院の名前の字" },
    { who: "みさき", source: "photo" },
  ),
  entry("pregnancy-checkup", "2026-04-01", { weightKg: 99.9 }, { pending: true }),
  entry("home", "2026-01-15", { weightKg: 56.4, tempC: 36.7 }, { who: "みさき" }),
  entry("pregnancy-test", "2026-01-10", { test: "血液型", result: "検査の結果の字" }),
  entry("feeling", "2026-02-01", { text: "気持ちの字" }),
  entry("postpartum", "2026-06-10", { days: 16, text: "産後の気分の字", care: "産後ケアの字" }),
  entry("consult", "2026-06-10", { whom: "相談の相手の字" }),
  entry("stool", "2026-06-05", { colorNo: 3 }),
  entry("development", "2026-09-01", { item: "寝返り" }),
  entry("birth", "2026-05-25", { week: "39週0日", weightG: 3000, heightCm: 49, headCm: 33, chestCm: 32, method: "お産のしかたの字", place: "生まれた場所の字" }),
  entry("growth", "2026-06-25", { weightKg: 4.1, heightCm: 53, headCm: 36.5 }),
  entry("growth", "2026-12-01", { weightKg: 12.3 }),
  entry("child-checkup", "2026-06-26", { checkup: "1か月健診", result: "健診の結果の字", weightKg: 4.2, heightCm: 54, memo: "子のメモの字" }),
  entry("vaccine", "2026-07-25", { vaccine: "ヒブ", dose: "1回目", lot: "ロットの字L123", facility: "接種の施設の字", doctor: "医師の名前の字" }),
  entry("vaccine", "2026-03-24", { vaccine: "RSウイルス（母子免疫）", dose: "妊娠30週2日", lot: "ロットの字L999" }),
];

const PLAN: VisitPlan = {
  kind: "plan",
  next: { date: "2026-11-20", time: "10:30", source: "visit", visitId: "try-visit1", said: "先生の言葉の字" },
  concerns: [
    { id: "try-c1", text: "ママの気がかりの字", date: "2026-11-01", for: "mother" },
    { id: "try-c2", text: "子の気がかりの字", date: "2026-11-01", for: "child" },
    { id: "try-c3", text: "印の無い気がかりの字", date: "2026-11-01" },
  ],
  tickets: 14,
  paid: [{ id: "try-p1", date: "2026-01-10", yen: 5432 }],
};

const FAMILY: ShareInput["family"] = { dueDate: "2026-06-01", birthDate: "2026-05-25", childName: "あおい" };
const INPUT: ShareInput = { entries: ENTRIES, plan: PLAN, family: FAMILY, today: TODAY };
/** 次の予約を本人が入れた（source "manual"）家族。1枚の「次の予約」に出るのは、この形だけ */
const MANUAL: ShareInput = { ...INPUT, plan: { ...PLAN, next: { date: "2026-11-20", time: "10:30", source: "manual" } } };

/** どの束にも出てはいけない字（名前・題・元の言葉・メモ・施設名・ロット・医師・外した頁・お金・id・候補・未来の記録） */
const NEVER = [
  "try-",
  "みさき",
  "あおい",
  "題の字",
  "元の言葉の字",
  "メモの字",
  "産院の名前の字",
  "ロットの字",
  "接種の施設の字",
  "医師の名前の字",
  "検査の結果の字",
  "気持ちの字",
  "産後の気分の字",
  "産後ケアの字",
  "相談の相手の字",
  "お産のしかたの字",
  "生まれた場所の字",
  "健診の結果の字",
  "先生の言葉の字",
  "寝返り",
  "5432",
  "99.9",
  "12.3",
];

/** 1枚に出てよい欄の名前（これより増やす時は、出してよいかを決めてから足す） */
const KEYS = new Set([
  "bundles", "hideCounts",
  "body", "heightCm", "preWeightKg", "bmi", "multiple", "checkups", "home",
  "date", "week", "day", "fundusCm", "weightKg", "bpHigh", "bpLow", "edema", "urineProtein", "urineSugar", "tempC",
  "growth", "child", "points", "ageDays", "headCm",
  "kind", "name",
  "vaccines", "vaccine", "dose", "mother",
  "next", "time",
  "questions", "forChild", "text",
  "motherHealth", "history", "allergy", "medicine", "pastBirths", "smoking",
]);

function keysOf(v: unknown, out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) for (const x of v) keysOf(x, out);
  else if (v && typeof v === "object")
    for (const [k, x] of Object.entries(v)) {
      out.add(k);
      keysOf(x, out);
    }
  return out;
}

describe("健診で見せる1枚の決まり（lib/share-view.ts）", () => {
  it("ママ本人がすべての束を選んだ1枚: 出してよい欄だけで、id・名前・題・元の言葉・メモ・施設名・ロット・医師・お金・候補・未来の記録が無い", () => {
    const sheet = shareView(INPUT, { viewer: "mother", bundles: ALL });
    const json = JSON.stringify(sheet);
    for (const bad of NEVER) expect(json, bad).not.toContain(bad);
    expect([...keysOf(sheet)].filter((k) => !KEYS.has(k))).toEqual([]);

    expect(sheet.bundles).toEqual(ALL);
    expect(sheet.body?.heightCm).toBe(158);
    expect(sheet.body?.preWeightKg).toBe(50);
    expect(sheet.body?.checkups).toEqual([
      { date: "2026-01-10", week: 19, day: 5, fundusCm: 18, weightKg: 55.2, bpHigh: 112, bpLow: 70, edema: "−", urineProtein: "−", urineSugar: "−" },
    ]);
    expect(sheet.body?.home).toEqual([{ date: "2026-01-15", week: 20, day: 3, weightKg: 56.4, tempC: 36.7 }]);
    expect(sheet.growth).toHaveLength(1);
    expect(sheet.growth?.[0].child).toBe(1);
    expect(sheet.growth?.[0].points.map((p) => p.weightKg)).toEqual([3, 4.1, 4.2]);
    expect(sheet.checkups?.map((c) => [c.date, c.kind])).toEqual([
      ["2026-01-10", "pregnancy"],
      ["2026-06-26", "child"],
    ]);
    expect(sheet.vaccines).toEqual([
      { date: "2026-03-24", vaccine: "RSウイルス（母子免疫）", dose: "妊娠30週2日", mother: true },
      { date: "2026-07-25", vaccine: "ヒブ", dose: "1回目" },
    ]);
    // 録音から聞こえた日（source "visit"）は出さない（下の「次の予約」の試験）
    expect(sheet.next).toBeNull();
    expect(sheet.questions).toEqual([
      { forChild: false, text: "ママの気がかりの字" },
      { forChild: true, text: "子の気がかりの字" },
      { forChild: false, text: "印の無い気がかりの字" },
    ]);
    expect(sheet.motherHealth).toEqual({ heightCm: 158, preWeightKg: 50, history: "これまでの病気の字", allergy: "卵", medicine: "なし", pastBirths: "初めて", smoking: "吸わない" });
  });

  it("ママ本人でない人（パートナー・読むだけの人）には、ママの束を頼んでも入らず、束の中のママの行（健診の日・RS・ママの健診で聞く事）も入らない。読むだけの人には健診の記録の束（次の予約・聞きたい事）も入らない", () => {
    for (const viewer of ["writer", "reader"] as const) {
      const sheet = shareView(MANUAL, { viewer, bundles: ALL });
      const json = JSON.stringify(sheet);
      const own = viewer === "writer" ? ["growth", "checkups", "vaccines", "next", "questions"] : ["growth", "checkups", "vaccines"];
      expect(sheet.bundles, viewer).toEqual(own);
      expect(sheet.body).toBeUndefined();
      expect(sheet.motherHealth).toBeUndefined();
      expect(sheet.checkups?.map((c) => c.kind)).toEqual(["child"]);
      expect(sheet.vaccines?.map((v) => v.vaccine)).toEqual(["ヒブ"]);
      if (viewer === "writer") {
        expect(sheet.questions).toEqual([{ forChild: true, text: "子の気がかりの字" }]);
        expect(sheet.next).toEqual({ date: "2026-11-20", time: "10:30" });
      } else {
        // C の3: 読むだけの人には健診の口（次の予約・気がかり）を開かないので、1枚にも入れない（子の気がかりも）
        expect(sheet.questions).toBeUndefined();
        expect(sheet.next).toBeUndefined();
        for (const bad of ["子の気がかり", "2026-11-20"]) expect(json, `reader: ${bad}`).not.toContain(bad);
      }
      for (const bad of [...NEVER, "55.2", "56.4", "36.7", "卵", "ママの気がかり", "印の無い気がかり", "妊娠30週", "RSウイルス"]) expect(json, `${viewer}: ${bad}`).not.toContain(bad);
      expect(shareChoices(viewer).map((c) => c.id), viewer).toEqual(own);
    }
  });

  it("選んだ束だけが入る（選ばない束の欄は1枚に無い）", () => {
    const sheet = shareView(MANUAL, { viewer: "mother", bundles: ["next"] });
    expect(sheet).toEqual({ bundles: ["next"], hideCounts: false, next: { date: "2026-11-20", time: "10:30" } });
    // 過ぎた予定は出さない
    expect(shareView({ ...MANUAL, today: "2026-11-21" }, { viewer: "mother", bundles: ["next"] }).next).toBeNull();
  });

  it("次の予約は、本人が入れた日（manual）だけ。録音から聞こえた日（visit）は、だれが作る1枚にも出さない（聞き違いの件・手帳の外へは本人の［大丈夫］の後だけ）", () => {
    for (const viewer of ["mother", "writer"] as const) {
      expect(shareView(INPUT, { viewer, bundles: ["next"] }).next, viewer).toBeNull();
      expect(shareView(MANUAL, { viewer, bundles: ["next"] }).next, viewer).toEqual({ date: "2026-11-20", time: "10:30" });
    }
    expect(JSON.stringify(shareView(INPUT, { viewer: "mother", bundles: ALL }))).not.toContain("2026-11-20");
    // 本人が結果の画面で確かめた日（口が nextChecked を付ける）は出る。印が false・無い時は出ない
    expect(shareView({ ...INPUT, nextChecked: true }, { viewer: "mother", bundles: ["next"] }).next).toEqual({ date: "2026-11-20", time: "10:30" });
    expect(shareView({ ...INPUT, nextChecked: false }, { viewer: "mother", bundles: ["next"] }).next).toBeNull();
  });

  it("つらい別れの家族には、週数を出さない（体の図の束は空・RS の回の妊娠週数も出さない）", () => {
    const sheet = shareView({ ...INPUT, family: { ...FAMILY, situation: { quiet: "loss" } } }, { viewer: "mother", bundles: ALL });
    expect(sheet.hideCounts).toBe(true);
    expect(sheet.body).toBeNull();
    expect(sheet.growth).toEqual([]);
    expect(keysOf(sheet).has("week")).toBe(false);
    expect(keysOf(sheet).has("day")).toBe(false);
    expect(JSON.stringify(sheet)).not.toContain("週");
    expect(sheet.vaccines?.find((v) => v.mother)).toEqual({ date: "2026-03-24", vaccine: "RSウイルス（母子免疫）", mother: true });
  });

  it("双子は名前ではなく何人目かの番号で分ける（成長は bodySeries の順・接種と健診の日も同じ番号）", () => {
    const twins = [
      entry("growth", "2026-06-25", { weightKg: 2.9 }, { who: "ひなた（1人目）" }),
      entry("growth", "2026-06-25", { weightKg: 2.7 }, { who: "みなと（2人目）" }),
      entry("vaccine", "2026-07-25", { vaccine: "ヒブ", dose: "1回目" }, { who: "みなと（2人目）" }),
      entry("child-checkup", "2026-06-26", { checkup: "1か月健診" }, { who: "ひなた（1人目）" }),
    ];
    const sheet = shareView(
      { entries: twins, plan: null, family: { ...FAMILY, situation: { babies: 2 } }, today: TODAY },
      { viewer: "reader", bundles: ["growth", "vaccines", "checkups"] },
    );
    expect(sheet.growth?.map((g) => [g.child, g.points[0].weightKg])).toEqual([
      [1, 2.9],
      [2, 2.7],
    ]);
    expect(sheet.vaccines?.map((v) => v.child)).toEqual([2]);
    expect(sheet.checkups?.map((c) => c.child)).toEqual([1]);
    const json = JSON.stringify(sheet);
    for (const name of ["ひなた", "みなと", "人目"]) expect(json).not.toContain(name);
  });

  it("長い文は上限で切る（短いはずの欄に長い文が入っていても、1枚に流さない）", () => {
    const long = "あ".repeat(500);
    const sheet = shareView(
      { ...INPUT, entries: [entry("vaccine", "2026-07-25", { vaccine: long, dose: long })], plan: { next: null, concerns: [{ id: "c", text: long, date: TODAY, for: "child" }] } },
      { viewer: "mother", bundles: ["vaccines", "questions"] },
    );
    expect(sheet.vaccines?.[0].vaccine.length).toBe(40);
    expect(sheet.vaccines?.[0].dose?.length).toBe(20);
    expect(sheet.questions?.[0].text.length).toBe(300);
  });

  it("束の並びと既定: 妊婦の健康状態だけ既定でオフ。ママの束は body と motherHealth", () => {
    expect(shareChoices("mother")).toEqual([
      { id: "body", on: true },
      { id: "growth", on: true },
      { id: "checkups", on: true },
      { id: "vaccines", on: true },
      { id: "next", on: true },
      { id: "questions", on: true },
      { id: "motherHealth", on: false },
    ]);
    expect(SHARE_BUNDLES.filter((b) => b.mother).map((b) => b.id)).toEqual(["body", "motherHealth"]);
  });
});

describe("1枚を作る人", () => {
  it("手帳の一覧・書き出しと同じ決まり（lib/mother-records.ts の recordViewerOf。試験は mother-records.test.ts）", () => {
    expect(shareViewerOf).toBe(recordViewerOf);
  });
});
