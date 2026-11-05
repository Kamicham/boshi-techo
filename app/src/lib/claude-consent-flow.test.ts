import { describe, expect, it } from "vitest";
import { tFor } from "./i18n/dicts";
import {
  afterConsentReturn,
  afterDraftConsentReturn,
  CLAUDE_CONSENT_MARK,
  CONSENT_REQUIRED_TEXT,
  consentWaitKey,
  DRAFT_WAIT_MS,
  draftConsentWaitKey,
  draftWaitValue,
  isClaudeConsentError,
  mayTrySend,
  readConsentState,
} from "./claude-consent-flow";

describe("Claude に送る同意の順番", () => {
  it("サーバの ConsentRequiredError の文を見分ける", () => {
    expect(isClaudeConsentError("話した事・撮った紙を手帳の欄に分けるのに、米国の Claude に送る同意が要ります（まだの人がいます）")).toBe(true);
    expect(isClaudeConsentError(`${CLAUDE_CONSENT_MARK}`)).toBe(true);
    expect(isClaudeConsentError("通信できませんでした")).toBe(false);
    expect(isClaudeConsentError(null)).toBe(false);
  });

  it("同意の状態を読む（形が違えば読めなかった扱い）", () => {
    expect(readConsentState({ claude: "ok" })).toBe("ok");
    expect(readConsentState({ claude: "needed" })).toBe("needed");
    expect(readConsentState({ claude: true })).toBe(null);
    expect(readConsentState(null)).toBe(null);
  });

  it("まだと分かっている時だけ送らない。読めない時は送ってみる", () => {
    expect(mayTrySend("needed")).toBe(false);
    expect(mayTrySend("ok")).toBe(true);
    expect(mayTrySend(null)).toBe(true);
  });

  it("同意から戻った時: 待っていて、控えがあり、同意が済んでいれば1回送る", () => {
    expect(afterConsentReturn({ draft: "来週の火曜に保育園の見学", waiting: true, state: "ok" })).toBe("send");
    expect(afterConsentReturn({ draft: "来週の火曜に保育園の見学", waiting: true, state: "needed" })).toBe("ask");
    expect(afterConsentReturn({ draft: "来週の火曜に保育園の見学", waiting: true, state: null })).toBe("ask");
  });

  it("同意を待っていない控え（ただの書きかけ）は勝手に送らない", () => {
    expect(afterConsentReturn({ draft: "書きかけ", waiting: false, state: "ok" })).toBe("none");
    expect(afterConsentReturn({ draft: "  ", waiting: true, state: "ok" })).toBe("none");
    expect(afterConsentReturn({ draft: null, waiting: true, state: "ok" })).toBe("none");
  });

  it("待っている印は家族ごとに分ける", () => {
    expect(consentWaitKey("a")).not.toBe(consentWaitKey("b"));
    expect(draftConsentWaitKey("a")).not.toBe(draftConsentWaitKey("b"));
  });

  it("同意がまだの文は1つ。どの仕事にも合う言い方で、画面が同意の知らせと見分けられる（見直し C38 ③）", () => {
    expect(isClaudeConsentError(CONSENT_REQUIRED_TEXT)).toBe(true);
    expect(CONSENT_REQUIRED_TEXT).toContain("書く・答える・分ける");
    expect(CONSENT_REQUIRED_TEXT).not.toMatch(/話した事・撮った紙を/);
  });

  it("同意がまだの文の全文は辞書に入れない（route() が訳すと、中文・English の画面で見分けが外れる。画面は全文を出さず、見分けて訳した札を出す）", () => {
    for (const l of ["zh", "en"] as const) {
      const said = tFor(l, CONSENT_REQUIRED_TEXT);
      expect(said, l).toBe(CONSENT_REQUIRED_TEXT);
      expect(isClaudeConsentError(said), l).toBe(true);
    }
    // 札の太字の言葉は訳す（全文とは別の鍵）
    expect(tFor("en", CLAUDE_CONSENT_MARK)).toBe("consent to send data to Claude in the US");
  });
});

describe("下書きが同意の前で止まった時（見直し C38 ①）", () => {
  const now = Date.parse("2027-05-01T09:00:00+09:00");
  const raw = draftWaitValue("tell-work", now);

  it("戻って同意が済んでいれば、待っていた事の下書きを作る", () => {
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now + 60_000, state: "ok" })).toBe("make");
  });

  it("同意がまだ・読めない時は作らず、同じ案内を出す（同意を取らずに作らない）", () => {
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now + 60_000, state: "needed" })).toBe("ask");
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now + 60_000, state: "mother" })).toBe("ask");
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now + 60_000, state: null })).toBe("ask");
  });

  it("ほかの事・古い控え・壊れた控えでは何もしない", () => {
    expect(afterDraftConsentReturn({ raw, milestoneId: "birth-registration", now: now + 60_000, state: "ok" })).toBe("none");
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now + DRAFT_WAIT_MS, state: "ok" })).toBe("none");
    expect(afterDraftConsentReturn({ raw, milestoneId: "tell-work", now: now - 1, state: "ok" })).toBe("none");
    expect(afterDraftConsentReturn({ raw: "{", milestoneId: "tell-work", now, state: "ok" })).toBe("none");
    expect(afterDraftConsentReturn({ raw: null, milestoneId: "tell-work", now, state: "ok" })).toBe("none");
  });
});
