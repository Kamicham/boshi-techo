// 画面の地図（手帳に聞くが使い方を答える正本）の抜けを確かめる。画面を足したら地図も足す。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { guideText, isKnownHref, SCREENS, TABS, TECHO_ANCHORS } from "./app-guide";
import { TECHO_PAGES } from "./techo";

const APP = path.join(__dirname, "..", "app");

describe("画面の地図", () => {
  it("下のタブはすべて地図にある", () => {
    for (const t of TABS) expect(SCREENS.some((s) => s.href === t.href)).toBe(true);
  });

  // 入口の画面（合言葉・ログイン）は、手帳を開く前の画面なので地図の外
  const ENTRY = new Set(["/unlock", "/login"]);
  it("画面のフォルダ（page.tsx がある所）はすべて地図にある（入口の画面を除く）", () => {
    const pages = fs
      .readdirSync(APP, { withFileTypes: true })
      .filter((d) => d.isDirectory() && d.name !== "api" && fs.existsSync(path.join(APP, d.name, "page.tsx")))
      .map((d) => `/${d.name}`)
      .filter((h) => !ENTRY.has(h));
    for (const h of pages) expect(SCREENS.map((s) => s.href), h).toContain(h);
  });

  it("手帳のページへはすべて直に飛べる", () => {
    for (const p of TECHO_PAGES) expect(isKnownHref(`/techo#page-${p.id}`)).toBe(true);
    expect(TECHO_ANCHORS).toHaveLength(TECHO_PAGES.length);
  });

  it("地図に無い行き先は通さない", () => {
    expect(isKnownHref("https://example.com")).toBe(false);
    expect(isKnownHref("/api/ask")).toBe(false);
    expect(isKnownHref("/unlock")).toBe(false);
  });

  it("Claude に渡す文にどの画面も入る", () => {
    const g = guideText();
    for (const s of SCREENS) expect(g).toContain(s.name);
  });
});
