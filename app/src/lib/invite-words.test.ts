import { describe, expect, it, vi } from "vitest";
import { setLocale } from "./i18n";
import { DICTS } from "./i18n/dicts";
import {
  inviteCanLines,
  inviteHeadline,
  inviteHeadlineShown,
  inviteMotherItemsLine,
  inviterWord,
  inviteSeeLine,
  inviteShareText,
  lineShareUrl,
  maskEmail,
  periodWord,
} from "./invite-words";

const BODY = /大丈夫|正常|異常|心配(ない|いらない)/;

describe("招待の言葉", () => {
  it("時期: 妊娠中は週、生まれた後は生後、予定日が無い・2歳を過ぎたら出さない", () => {
    expect(periodWord({ dueDate: "2027-05-10" }, "2026-10-20")).toBe("妊娠11週"); // 最終月経 2026-08-03 から 78日
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2027-08-10")).toBe("生後3か月");
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2027-05-08")).toBe("生後0日");
    expect(periodWord({ dueDate: "2027-05-10", birthDate: "2027-05-08" }, "2029-06-01")).toBeNull();
    expect(periodWord({ dueDate: "2027-05-10" }, "2026-07-01")).toBeNull();
    expect(periodWord(null, "2026-10-29")).toBeNull();
  });

  it("見出し: 呼び名と時期。取れない物は作らない", () => {
    expect(inviteHeadline("美咲", "妊娠11週")).toBe("美咲から、妊娠11週の母子手帳への招待です");
    expect(inviteHeadline(null, null)).toBe("ご家族から、母子手帳への招待です");
    expect(inviteHeadline("  ", "生後3か月")).toBe("ご家族から、生後3か月の母子手帳への招待です");
    expect(inviteHeadline("翔太", null)).toBe("翔太から、母子手帳への招待です");
  });

  // 受ける画面は、サーバが分けて返す呼び名（inviterWord）と時期（periodWord）から、画面の言葉で組む（11/5 UX。日本語の見出しを読み直さない）
  const CASES: [string | null, string | null][] = [
    ["美咲", "妊娠11週"],
    [null, null],
    ["  ", "生後3か月"],
    ["翔太", null],
    ["母", "生後0日"],
    ["パートナー", "1歳2か月"],
  ];
  it("見出しを画面の言葉で組む: 日本語はサーバの見出しと同じ字", () => {
    expect(inviterWord("母")).toBe("ママ");
    expect(inviterWord(" ")).toBe("ご家族");
    for (const [name, period] of CASES) expect(inviteHeadlineShown(inviterWord(name), period)).toBe(inviteHeadline(name, period));
    // サーバの返しが古い（呼び名が無い）時は「ご家族から」
    expect(inviteHeadlineShown(undefined, undefined)).toBe("ご家族から、母子手帳への招待です");
  });

  it("見出しを画面の言葉で組む: 中文・English に日本語が残らない（見本の家族の名前は English でローマ字）", () => {
    // 画面の言葉はブラウザでだけ決まる（lib/i18n の setLocale）ので、この試験の間だけ window を置く
    vi.stubGlobal("window", {});
    try {
      for (const lang of ["zh", "en"] as const) {
        setLocale(lang, DICTS[lang]);
        for (const [name, period] of CASES) {
          const s = inviteHeadlineShown(inviterWord(name), period);
          // 中文は名前（美咲・翔太）を日本語の字のまま出すので、名前を外してから見る
          const rest = lang === "zh" ? s.replace(/美咲|翔太/g, "") : s;
          expect(rest, s).not.toMatch(lang === "en" ? /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u : /[\p{Script=Hiragana}\p{Script=Katakana}]/u);
          // 時期の数がそろう（生後0日は「出生当天」「birth day」のように数を使わない言い方）
          if (period && period !== "生後0日") expect(s, s).toMatch(/\d/);
        }
        expect(inviteHeadlineShown("美咲", "妊娠11週")).toContain(lang === "en" ? "Misaki" : "美咲");
      }
    } finally {
      setLocale("ja", {});
      vi.unstubAllGlobals();
    }
  });

  it("メールは一部を伏せ、全体を出さない", () => {
    expect(maskEmail("papa@example.com")).toBe("p…@e…");
    expect(maskEmail("papa@example.com")).not.toContain("example");
    expect(maskEmail("")).toBe("");
    expect(maskEmail("x")).toBe("x…");
  });

  it("入ると何ができるか: 共同の管理と読むだけで分ける。体の判断の言葉を使わない", () => {
    expect(inviteCanLines("admin")).toHaveLength(3);
    expect(inviteCanLines("admin")[0]).toContain("二人で分け");
    expect(inviteCanLines("member").join()).toContain("足す・直すはできません");
    // 読むだけの人にも手帳の記録が見える（「子の記録だけ」と少なく言わない）
    expect(inviteCanLines("member")[0]).toBe("手帳の記録と子の写真を見られます");
    for (const l of [...inviteCanLines("admin"), ...inviteCanLines("member")]) expect(l).not.toMatch(BODY);
  });

  it("受ける画面の見られる物: 共同の管理は全部。読むだけにも、今は母の記録を含む文字の記録が見える事を隠さない", () => {
    expect(inviteSeeLine("admin", [])).toContain("母の記録も");
    expect(inviteSeeLine("member", [])).toBe(
      "見られる物: 子の手帳の記録と、子の写真・声（手帳のママの頁と健診は見えません。話した記録や一冊などには、今は母の記録も入ります。記録を足す・直すはできません）",
    );
    // 母が項目を1つでも選ぶと、写真・声は母の分も見える（lib/access.ts の visibleSubjects）
    expect(inviteSeeLine("member", ["母の写真"])).toContain("子と母の写真・声");
    // 「子の記録だけ」「選んだ項目だけ」と約束しない
    for (const l of [inviteSeeLine("member", []), inviteSeeLine("member", ["母の写真"])]) {
      expect(l).not.toMatch(/子の記録だけ|選んだ項目だけを見/);
      expect(l).not.toMatch(BODY);
    }
  });

  it("母が選んだ項目の注: 選び分けはまだ効かないので「準備中」。共同の管理・項目なしには出さない", () => {
    expect(inviteMotherItemsLine("member", ["母の手帳の記録（妊娠中の経過など）", "母の写真"])).toBe("母が選んだ「母の手帳の記録（妊娠中の経過など）」「母の写真」だけを見せる仕組みは準備中です");
    expect(inviteMotherItemsLine("member", [])).toBeNull();
    expect(inviteMotherItemsLine("admin", ["母の写真"])).toBeNull();
    expect(inviteMotherItemsLine("owner", ["母の写真"])).toBeNull();
  });

  it("送る文: 相手のメール・48時間・リンクを入れ、LINE の URL に包める", () => {
    const t = inviteShareText("papa@example.com", "https://x.example/invite/abc");
    expect(t).toContain("papa@example.com");
    expect(t).toContain("48時間");
    expect(t).toContain("Safari");
    expect(t.endsWith("https://x.example/invite/abc")).toBe(true);
    expect(inviteShareText("", "L")).toContain("招待したメール");
    expect(lineShareUrl(t)).toBe(`https://line.me/R/share?text=${encodeURIComponent(t)}`);
  });
});

describe("招待の見出し: 役の名前のままの呼び名", () => {
  it("「母」は「ママ」と呼ぶ", () => {
    expect(inviteHeadline("母", "妊娠11週")).toBe("ママから、妊娠11週の母子手帳への招待です");
  });
});
