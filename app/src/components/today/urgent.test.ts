// 急ぎの時の入口（UX の見直し C02④・2026-11-05）: 最初の1枚の右上と、産後8週までの「いま」の一番上の札の下。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/clock";
import { SIM_FAMILIES } from "@/sim/families";
import { URGENT_DAYS, urgentNear } from "./urgent";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(here, rel), "utf8");

describe("急ぎの時の入口", () => {
  it("「いま」の上の方に出すのは、生まれた日から55日目まで（産後8週）。生まれる前と、生まれた日の分からない家族には出さない", () => {
    expect(URGENT_DAYS).toBe(56);
    for (const f of SIM_FAMILIES) {
      if (!f.birthDate) continue;
      expect(urgentNear(f.birthDate, addDays(f.birthDate, -1)), f.id).toBe(false);
      expect(urgentNear(f.birthDate, f.birthDate), f.id).toBe(true);
      expect(urgentNear(f.birthDate, addDays(f.birthDate, 55)), f.id).toBe(true);
      expect(urgentNear(f.birthDate, addDays(f.birthDate, 56)), f.id).toBe(false);
    }
    expect(urgentNear(undefined, "2027-05-01")).toBe(false);
  });

  it("最初の1枚（画面いっぱいで上の帯を隠す）にも、急ぎの時の入口がある。ふつうのリンクで /emergency へ", () => {
    const src = read("../Welcome.tsx");
    const dialog = src.slice(src.indexOf('aria-labelledby="welcome-title"'));
    expect(dialog.indexOf('href="/emergency"')).toBeGreaterThan(0);
    // 見出し（h1）より上＝最初に目に入る所
    expect(dialog.indexOf('href="/emergency"')).toBeLessThan(dialog.indexOf('id="welcome-title"'));
  });

  it("今日の画面: 一番上の札のすぐ下に、産後8週まで1行（いつもの下の入口はそのまま）", () => {
    const src = read("../Techo.tsx");
    expect(src).toContain("urgentNear(");
    expect(src.match(/href="\/emergency"/g)?.length).toBe(2);
  });
});
