import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { LANGS, setLocale } from "./i18n";
import { AREAS, DICTS } from "./i18n/dicts";
import inviteShare from "./i18n/dict/invite-share";
import {
  INVITE_LANG_PARAM,
  inviteCanLines,
  inviteHeadline,
  inviteHeadlineShown,
  inviteLangToSwitch,
  inviteLinkIn,
  inviteMotherItemsLine,
  inviterWord,
  inviteSeeLine,
  inviteShareText,
  inviteShareTextIn,
  inviteShareTitleIn,
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

// 招待のリンクの言葉（11/5 UX・統括 OK）: 送る人が送る文の言葉を選び、リンクにも言葉の印を付け、開いた人の画面もその言葉で開く
describe("招待のリンクの言葉", () => {
  const LINK = "https://boshi.example/invite/inv_abc123";
  const KANA = /[\u3040-\u30ff]/;
  const HAN = /[\u3400-\u9fff]/;
  const read = (f: string) => fs.readFileSync(path.join(__dirname, "..", f), "utf8");

  it("送る文の辞書は3つの鍵だけ。送る文の鍵は inviteShareText の文そのもの（メールあり・なし）と題", () => {
    expect(Object.keys(inviteShare).sort()).toEqual([inviteShareText("{email}", "{link}"), inviteShareText("", "{link}"), "母子手帳への招待"].sort());
    expect(AREAS.inviteShare).toBe(inviteShare);
    // 3つとも中文・English がそろう（片方が無いと、その言葉の送る文が日本語のまま出る）
    for (const [k, e] of Object.entries(inviteShare)) {
      expect(e.zh, k).toBeTruthy();
      expect(e.en, k).toBeTruthy();
    }
  });

  it("日本語の送る文は、前と1字も変わらない（メールあり・なし）", () => {
    for (const mail of ["papa@example.com", " papa@example.com ", ""])
      expect(inviteShareTextIn("ja", mail, LINK)).toBe(inviteShareText(mail, LINK));
    expect(inviteShareTitleIn("ja")).toBe("母子手帳への招待");
  });

  it("中文・English の送る文: 画面の言葉と関わりなく、選んだ言葉で組む。メールとリンクが入り、リンクは最後の行。仮名・漢字が残らない", () => {
    // 画面は日本語のまま（setLocale しない）で、送る文だけ中文・English
    for (const lang of ["zh", "en"] as const) {
      for (const mail of ["papa@example.com", ""]) {
        const text = inviteShareTextIn(lang, mail, LINK);
        expect(text, lang).not.toBe(inviteShareText(mail, LINK));
        expect(text.split("\n").at(-1)).toBe(LINK);
        if (mail) expect(text).toContain(mail);
        expect(text).toMatch(/48/);
        expect(text).not.toMatch(KANA);
        if (lang === "en") expect(text).not.toMatch(HAN);
        expect(text).not.toMatch(/\{(email|link)\}/);
      }
      expect(inviteShareTitleIn(lang)).toBe(lang === "zh" ? DICTS.zh["母子手帳への招待"] : DICTS.en["母子手帳への招待"]);
    }
  });

  it("中文の画面の人が日本語の文を選んでも、日本語の送る文になる（画面の辞書に頼らない）", () => {
    vi.stubGlobal("window", {});
    try {
      setLocale("zh", DICTS.zh);
      expect(inviteShareTextIn("ja", "a@example.com", LINK)).toBe(inviteShareText("a@example.com", LINK));
      expect(inviteShareTextIn("en", "", LINK)).not.toMatch(KANA);
      expect(inviteShareTitleIn("ja")).toBe("母子手帳への招待");
    } finally {
      setLocale("ja", {});
      vi.unstubAllGlobals();
    }
  });

  it("リンクに付けるのは言葉の印だけ（呼び名などは入れない）。道はそのまま", () => {
    for (const lang of LANGS) {
      const u = new URL(inviteLinkIn(LINK, lang));
      expect(u.origin + u.pathname).toBe(LINK);
      expect([...u.searchParams.keys()]).toEqual([INVITE_LANG_PARAM]);
      expect(u.searchParams.get(INVITE_LANG_PARAM)).toBe(lang);
    }
    expect(inviteLinkIn(LINK, "zh")).toBe(`${LINK}?lang=zh`);
    // 選び直しても印は1つ
    expect(inviteLinkIn(inviteLinkIn(LINK, "zh"), "en")).toBe(`${LINK}?lang=en`);
  });

  it("開いた時の順: 本人のクッキー → リンクの言葉 → ブラウザの言葉（根の layout が選んだ今の言葉）", () => {
    // 初めて開いた人（クッキーなし・ログインなし）: リンクの言葉にする
    expect(inviteLangToSwitch("zh", null, false, "ja")).toBe("zh");
    expect(inviteLangToSwitch("ja", null, false, "en")).toBe("ja");
    expect(inviteLangToSwitch("en", null, false, "zh")).toBe("en");
    // 本人が選んだ言葉（クッキー）があれば変えない
    expect(inviteLangToSwitch("zh", "ja", false, "ja")).toBe(null);
    expect(inviteLangToSwitch("ja", "en", false, "en")).toBe(null);
    // ログインしている人（送った本人が確かめに開いた・ほかの手帳ですでに使っている）は変えない
    expect(inviteLangToSwitch("zh", null, true, "ja")).toBe(null);
    // 今の画面と同じ・印が無い・知らない値は変えない（読み直しを繰り返さない）
    expect(inviteLangToSwitch("zh", null, false, "zh")).toBe(null);
    for (const x of [null, undefined, "", "fr", "ZH", "zh-CN", "<script>"]) expect(inviteLangToSwitch(x, null, false, "ja"), String(x)).toBe(null);
  });

  it("画面: 作る画面は同じ言葉で文とリンクを組み、受ける画面はリンクの印・クッキー・ログインの有無で決める", () => {
    const made = read("app/invite/new/page.tsx");
    expect(made).toMatch(/inviteLinkIn\(made\.link, shareLang\)/);
    expect(made).toMatch(/inviteShareTextIn\(shareLang, made\.email, link\)/);
    expect(made).toMatch(/setShareLang\(currentLang\(\)\)/);
    // LINE・コピー・ほかのアプリ・リンクだけ、のどれも同じ文とリンクを送る
    expect(made).toMatch(/lineShareUrl\(text\)/);
    expect(made).toMatch(/<CopyButton text=\{text\}/);
    expect(made).toMatch(/<CopyButton text=\{link\} \/>/);
    expect(made).not.toMatch(/made\.link\}|shareText\(/);
    const accept = read("app/invite/[id]/page.tsx");
    expect(accept).toMatch(/inviteLangToSwitch\(new URLSearchParams\(window\.location\.search\)\.get\(INVITE_LANG_PARAM\), langFromCookieHeader\(document\.cookie\), signedIn, currentLang\(\)\)/);
    // ログインしているかは、招待の中身の返し（signedIn）を待ってから
    expect(accept).toMatch(/const signedIn = inv \? inv\.signedIn : previewFailed && !account \? false : null;/);
    // 上の帯の無い3つの画面に、言葉の1行
    for (const f of ["app/invite/[id]/page.tsx", "app/login/page.tsx", "app/start/page.tsx"]) expect(read(f), f).toMatch(/<LangRow /);
  });
});
