import { describe, expect, it } from "vitest";
import { afterConsentReturn, CLAUDE_CONSENT_MARK, consentWaitKey, isClaudeConsentError, mayTrySend, readConsentState } from "./claude-consent-flow";

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
  });
});
