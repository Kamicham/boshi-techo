// 字と主ボタンの4色（rose・sky・ok・warn）が、紙・白・淡い札の上で読みやすさの目安（WCAG AA 4.5:1）に届く事
// （2026-11-05 作り手が見比べて決めた・技術監査 6⑤。正本は src/app/globals.css の :root）
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(path.join(process.cwd(), "src/app/globals.css"), "utf8");
const color = (name: string): string => {
  const m = css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6});`, "i"));
  if (!m) throw new Error(`globals.css に --${name} がありません`);
  return m[1];
};
/** WCAG 2.x の相対輝度とコントラスト比 */
const luminance = (hex: string): number => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (hi + 0.05) / (lo + 0.05);
};

describe("字と主ボタンの色の読みやすさ", () => {
  it("rose・sky・ok・warn は、白い字のボタンにしても、紙・白・淡い札の上の字にしても 4.5 以上", () => {
    for (const fg of ["rose", "sky", "ok", "warn"])
      for (const bg of ["card", "paper", "rose-soft", "sky-soft"]) expect(ratio(color(fg), color(bg)), `${fg} × ${bg}`).toBeGreaterThanOrEqual(4.5);
  });

  it("印刷の一冊と映画の字も、画面と同じ色（前の淡い色が残っていない）", () => {
    for (const f of ["src/app/book/print/page.tsx", "scripts/film.mjs"]) {
      const src = fs.readFileSync(path.join(process.cwd(), f), "utf8");
      expect(src, f).not.toMatch(/#c2557a|#3f7fa6|#2f7d5b|#b5650d/i);
    }
  });
});
