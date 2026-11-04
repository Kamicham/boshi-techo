// 下書きが同意の前で断られた時の一番上の札の1行（見直し C38 の「いま」の分・2026-11-05）。Claude は呼ばない。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { consentHref, consentLine } from "./consent-line";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (f: string) => fs.readFileSync(path.join(here, f), "utf8");

describe("同意がまだの時の、一番上の札の1行", () => {
  it("黙って消さず、何を作るかを言う。ママの分が要る時は、ママを手帳に入れる道", () => {
    expect(consentLine("書く事のメモ", false)).toBe("同意を1つすると、手帳が書く事のメモを作ります");
    expect(consentLine("職場へのメール", true)).toBe("ママが手帳に入って同意すると、手帳が職場へのメールを作ります");
  });

  it("行き先: 同意の画面は読んで決めた後に今の画面へ戻る。ママの分は招く画面", () => {
    expect(consentHref("fam 1", false, "/")).toBe("/account/consent/claude?familyId=fam%201&next=%2F");
    expect(consentHref("fam 1", true, "/")).toBe("/invite/new?familyId=fam%201");
  });

  it("下書きが同意の前で断られた時だけ出す（usePrep が見分け、一番上の札と束の1行目の PrepBox が出す）。同意を取らずに作る道は作らない", () => {
    const use = read("usePrep.ts");
    expect(use).toContain("isClaudeConsentError(");
    expect(read("NowCard.tsx")).toContain("<PrepConsent");
    // 作るのは今までどおり POST /api/draft だけ（サーバが同意を確かめる）。同意を飛ばす印を送らない
    expect(use).not.toMatch(/skipConsent|noConsent|consent:\s*false/);
    // 下の「◯を作る」から同意へ行って戻った時は、そちらが作る（ここで2回目を作らない・中を組み直さない）
    expect(use).toContain("waitingDraftFor(sessionStorage.getItem(draftConsentWaitKey(family.id)), t.id");
    expect(use).toMatch(/v\.draft \|\| wait \? v :/);
  });
});
