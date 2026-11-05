// 言葉の切り替え（lib/i18n）の試験: 選び方・辞書のそろい・日付と週数の書き分け（日本語は前と1字も変えない）
import { describe, expect, it } from "vitest";
import { jpDay } from "@/components/techo/labels";
import { jpDate, jpShort } from "@/components/today/dates";
import { clockAt, clockShort } from "@/lib/clock";
import { currentLang, detectLang, fill, langFromCookieHeader, setLocale, t, translate, withLang } from ".";
import { AREAS, DICTS, langOf, tFor } from "./dicts";

describe("言葉の選び方", () => {
  it("クッキーが先。無ければブラウザの言葉（従う時だけ）。zh-* は简体字", () => {
    expect(detectLang("zh", "en-US", true)).toBe("zh");
    expect(detectLang(undefined, "zh-CN,zh;q=0.9", true)).toBe("zh");
    expect(detectLang(undefined, "zh-TW", true)).toBe("zh");
    expect(detectLang(undefined, "en-GB,en;q=0.9", true)).toBe("en");
    expect(detectLang(undefined, "ja,en;q=0.8", true)).toBe("ja");
    expect(detectLang(undefined, "ko-KR,en;q=0.5", true)).toBe("en");
    expect(detectLang(undefined, "fr-FR", true)).toBe("ja");
    expect(detectLang("xx", null, true)).toBe("ja");
  });
  it("ブラウザの言葉に従わない間は、選んだ人（クッキー）だけ", () => {
    expect(detectLang(undefined, "zh-CN", false)).toBe("ja");
    expect(detectLang("en", "zh-CN", false)).toBe("en");
  });
  it("Cookie の頭から読む", () => {
    expect(langFromCookieHeader("a=1; boshi_lang=en; b=2")).toBe("en");
    expect(langFromCookieHeader("boshi_lang=zh")).toBe("zh");
    expect(langFromCookieHeader("xboshi_lang=en")).toBe(null);
    expect(langFromCookieHeader("boshi_lang=fr")).toBe(null);
    expect(langFromCookieHeader(null)).toBe(null);
  });
  it("API の頼みの言葉（route() が使う）", () => {
    expect(langOf(new Request("http://x/api", { headers: { cookie: "a=1; boshi_lang=zh" } }))).toBe("zh");
    expect(langOf(new Request("http://x/api"))).toBe("ja");
    expect(langOf(undefined)).toBe("ja");
  });
  it("サーバ（window の無い所）では画面の言葉を決めない（頼みをまたいで混ざらない）", () => {
    setLocale("zh", { 急ぎの時: "紧急时" });
    expect(currentLang()).toBe("ja");
    expect(t("急ぎの時")).toBe("急ぎの時");
  });
});

describe("引き方", () => {
  it("訳の無い文は日本語のまま。差し込みと、英語の数の形", () => {
    const en = { "あと{n}日": "{n} {n:day|days} left" };
    expect(translate({}, "ほかの時期")).toBe("ほかの時期");
    expect(translate(undefined, "あと{n}日", { n: 3 })).toBe("あと3日");
    expect(translate(en, "あと{n}日", { n: 1 })).toBe("1 day left");
    expect(translate(en, "あと{n}日", { n: 3 })).toBe("3 days left");
    expect(fill("{a}と{b}", { a: "母" })).toBe("母と{b}");
    expect(withLang("en", () => t("あと{n}日", { n: 2 }), en)).toBe("2 days left");
    expect(t("あと{n}日", { n: 2 })).toBe("あと2日");
  });
});

describe("辞書", () => {
  const names = (s: string) => [...new Set([...s.matchAll(/\{(\w+)(?::[^}]*)?\}/g)].map((m) => m[1]))].sort().join(",");
  const all = Object.entries(AREAS).flatMap(([area, entries]) => Object.entries(entries).map(([key, e]) => ({ area, key, e })));

  it("同じ鍵が2つの場所に無い", () => {
    const seen = new Map<string, string>();
    const dup: string[] = [];
    for (const { area, key } of all) {
      const was = seen.get(key);
      if (was) dup.push(`${key}（${was} と ${area}）`);
      seen.set(key, area);
    }
    expect(dup).toEqual([]);
  });

  it("訳の差し込みの名前が日本語の鍵とそろう・空の訳が無い・訳にかなが残らない（括弧で並べた日本語は除く）", () => {
    const bad: string[] = [];
    for (const { area, key, e } of all)
      for (const lang of ["zh", "en"] as const) {
        const v = e[lang];
        if (v === undefined) continue;
        if (!v.trim()) bad.push(`${area}: 「${key}」の ${lang} が空`);
        else if (names(v) !== names(key)) bad.push(`${area}: 「${key}」の ${lang} の差し込み {${names(v)}} が鍵の {${names(key)}} と違う`);
        else if (/[぀-ヿ]/.test(v.replace(/（[^）]*）|\([^)]*\)/g, ""))) bad.push(`${area}: 「${key}」の ${lang} にかなが残る`);
      }
    expect(bad).toEqual([]);
  });

  it("言葉ごとの1冊にまとまる（日本語は鍵のまま）", () => {
    expect(DICTS.ja).toEqual({});
    expect(tFor("zh", "うまくいきませんでした")).toBe("没有成功");
    expect(tFor("en", "Claude の呼び出しに失敗しました（{status}）", { status: 502 })).toBe("Couldn't reach Claude (502)");
    expect(tFor("ja", "Claude の呼び出しに失敗しました（{status}）", { status: 502 })).toBe("Claude の呼び出しに失敗しました（502）");
    expect(tFor("zh", "辞書に無い文")).toBe("辞書に無い文");
  });
});

describe("日付の言い方", () => {
  it("日本語は前と同じ", () => {
    expect(jpDate("2026-11-23")).toBe("11月23日（月）");
    expect(jpDate("2027-11-23", "2026-11-05")).toBe("2027年11月23日（火）");
    expect(jpShort("2026-11-23", "2026-11-05")).toBe("11/23（月）");
    expect(jpShort("2029-01-26", "2026-11-05")).toBe("2029/1/26（金）");
    expect(jpDay("2026-11-03")).toBe("2026年11月3日");
  });
  it("中文: 同じ並びで曜日を「周一」", () =>
    withLang("zh", () => {
      expect(jpDate("2026-11-23")).toBe("11月23日（周一）");
      expect(jpDate("2027-11-23", "2026-11-05")).toBe("2027年11月23日（周二）");
      expect(jpShort("2026-11-22")).toBe("11/22（周日）");
      expect(jpDay("2026-11-03")).toBe("2026年11月3日");
    }));
  it("English", () =>
    withLang("en", () => {
      expect(jpDate("2026-11-23")).toBe("Mon, Nov 23");
      expect(jpDate("2027-11-23", "2026-11-05")).toBe("Tue, Nov 23, 2027");
      expect(jpShort("2026-11-23")).toBe("Mon, 11/23");
      expect(jpShort("2029-01-26", "2026-11-05")).toBe("Fri, 1/26/2029");
      expect(jpDay("2026-11-03")).toBe("Nov 3, 2026");
    }));
});

describe("週数・月齢の言い方（外国語版の母子健康手帳に合わせる）", () => {
  const born = { dueDate: "2026-01-01", birthDate: "2026-01-01" };
  const pregnant = { dueDate: "2026-12-01" };
  const days = ["2026-01-01", "2026-01-02", "2026-01-13", "2026-04-05", "2027-01-01", "2027-04-05"];
  const labels = () => days.map((d) => clockAt(born, d).label);
  const shorts = () => {
    const c = clockAt(pregnant, "2026-11-05");
    return [c.label, clockShort(c), clockShort(c, true), clockAt(pregnant, "2026-01-01").label];
  };

  it("日本語は前と同じ", () => {
    expect(labels()).toEqual(["生まれた日", "生後1日", "生後12日", "生後3か月", "1歳", "1歳3か月"]);
    expect(shorts()).toEqual(["妊娠36週2日", "妊娠36週", "36週", "授かる前"]);
    // 生まれた後は短くしない
    expect(clockShort(clockAt(born, "2026-04-05"), true)).toBe("生後3か月");
  });
  it("中文", () =>
    withLang("zh", () => {
      expect(labels()).toEqual(["出生当天", "出生后1天", "出生后12天", "出生后3个月", "1岁", "1岁3个月"]);
      expect(shorts()).toEqual(["妊娠36周2天", "妊娠36周", "36周", "怀孕前"]);
    }));
  it("English", () =>
    withLang("en", () => {
      expect(labels()).toEqual(["Day of birth", "1 day old", "12 days old", "3 months old", "1 year old", "1 year 3 months old"]);
      expect(shorts()).toEqual(["36 weeks 2 days pregnant", "36 weeks pregnant", "Week 36", "Before pregnancy"]);
    }));
});
