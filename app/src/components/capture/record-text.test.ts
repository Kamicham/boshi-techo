// 記録の題と本文の決まった形（record-text.ts）: 日本語は1字も変えず、中文・English では決まった形だけを訳す
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { setLocale, type Lang } from "@/lib/i18n";
import { DICTS } from "@/lib/i18n/dicts";
import { cleanManual, temperatureRecord } from "@/lib/manual-entry";
import { recordDetailShown, recordTitleShown } from "./record-text";

const TODAY = "2026-11-05";
const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", "..", f), "utf8");
// 「打つ」が実際に残す値（保存は日本語のまま）
const temp = temperatureRecord("37.5", TODAY, TODAY);
const plan = cleanManual({ kind: "予定", title: "健診", date: "2026-11-12", time: "09:30" }, TODAY);
const TEMP_TITLE = temp.ok ? temp.value.title : "";
const PLAN_DETAIL = plan.ok ? plan.value.detail : "";
const DEADLINE_DETAIL = "期限。出どころ: 区役所の通知";
const FREE = ["区役所へ出生届", "体温が高い気がする", "10:00から出かける", "期限は来週。出どころ: 不明"];

function inLang<T>(lang: Lang, fn: () => T): T {
  vi.stubGlobal("window", {});
  try {
    setLocale(lang, DICTS[lang]);
    return fn();
  } finally {
    setLocale("ja", {});
    vi.unstubAllGlobals();
  }
}

describe("記録の題と本文の決まった形", () => {
  it("「打つ」が残す値と、話す・撮るの期限の本文は、この形で書かれている（形を変えたら、ここと辞書も直す）", () => {
    expect(TEMP_TITLE).toBe("体温 37.5℃");
    expect(PLAN_DETAIL).toBe("09:30から");
    expect(read("lib/capture.ts")).toContain("detail: `期限。出どころ: ${d.source}`");
  });

  it("日本語の画面: 1字も変えない", () => {
    expect(recordTitleShown(TEMP_TITLE)).toBe(TEMP_TITLE);
    expect(recordDetailShown(PLAN_DETAIL)).toBe(PLAN_DETAIL);
    expect(recordDetailShown(DEADLINE_DETAIL)).toBe(DEADLINE_DETAIL);
    for (const s of FREE) {
      expect(recordTitleShown(s)).toBe(s);
      expect(recordDetailShown(s)).toBe(s);
    }
  });

  it("中文・English: 決まった形だけ訳し、出どころ（読み取った言葉）と家族が書いた文はそのまま", () => {
    inLang("zh", () => {
      expect(recordTitleShown(TEMP_TITLE)).toBe("体温 37.5℃");
      expect(recordDetailShown(PLAN_DETAIL)).toBe("09:30开始");
      expect(recordDetailShown(DEADLINE_DETAIL)).toBe("期限。来源：区役所の通知");
      for (const s of FREE) expect(recordDetailShown(s)).toBe(s);
    });
    inLang("en", () => {
      expect(recordTitleShown(TEMP_TITLE)).toBe("Temperature 37.5°C");
      expect(recordDetailShown(PLAN_DETAIL)).toBe("From 09:30");
      expect(recordDetailShown(DEADLINE_DETAIL)).toBe("Deadline. Source: 区役所の通知");
      for (const s of FREE) expect(recordTitleShown(s)).toBe(s);
    });
  });

  it("気がかりの本文の終わりの決まりの文: 中文・English は文だけ訳し、前の本文（家族の言葉）はそのまま。日本語は1字も変えない", () => {
    const cases = [
      "お腹が張る\n次の健診で聞く",
      "夜に胎動が少ない気がする、次の健診で先生に聞く。",
      "出血があった\nその日のうちに産院（子どもの事ならかかりつけ・迷ったら #8000）へ電話",
      "熱が39度ある。その日のうちにかかりつけへ電話。迷ったら #8000",
      "次の健診で聞く",
    ];
    for (const c of cases) expect(recordDetailShown(c), c).toBe(c);
    inLang("zh", () => {
      expect(recordDetailShown(cases[0])).toBe("お腹が張る\n下次检查时问");
      expect(recordDetailShown(cases[1])).toBe("夜に胎動が少ない気がする\n下次检查时问医生");
      expect(recordDetailShown(cases[2])).toBe("出血があった\n当天打电话给产科医院（孩子的事打给常看的医生，拿不准时拨打 #8000）");
      expect(recordDetailShown(cases[3])).toBe("熱が39度ある\n当天打电话给孩子常看的医生。拿不准时拨打 #8000");
      expect(recordDetailShown(cases[4])).toBe("下次检查时问");
    });
    inLang("en", () => {
      expect(recordDetailShown(cases[0])).toBe("お腹が張る\nAsk at the next checkup");
      expect(recordDetailShown(cases[3])).toBe("熱が39度ある\nCall your child's regular doctor the same day. If you're unsure, call #8000");
      // 途中にあるだけの言葉（終わりでない）は訳さない
      expect(recordDetailShown("次の健診で聞く事を書いた")).toBe("次の健診で聞く事を書いた");
    });
  });

  it("決まりの文は、Claude への頼みと見本の答えが書く文と同じ（片方を変えたら、ここと辞書も直す）", () => {
    const capture = read("lib/capture.ts");
    const samples = read("lib/samples.ts");
    expect(capture).toContain("「次の健診で聞く」");
    expect(capture).toContain("「その日のうちに産院へ電話」");
    expect(capture).toContain("「その日のうちにかかりつけへ電話。迷ったら #8000」");
    expect(samples).toContain("その日のうちに産院（子どもの事ならかかりつけ・迷ったら #8000）へ電話");
    expect(samples).toContain("\\n次の健診で聞く");
  });

  it("記録の一覧（Timeline）は、題・本文・カレンダーへ渡す所の3つで通す", () => {
    const src = read("components/capture/Timeline.tsx");
    expect(src.match(/recordTitleShown\(r\.data\.title\)/g)).toHaveLength(2);
    expect(src.match(/recordDetailShown\(r\.data\.detail\)/g)).toHaveLength(2);
    expect(src).not.toMatch(/\{r\.data\.(title|detail)\}/);
  });
});
