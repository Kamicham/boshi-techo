// 急ぎの時（/emergency）は、自分の辞書（dict/emergency.ts）だけで描ける事（2026-11-05）。
// この画面は作る時に1回だけ組み立てる（通信が無くても開けるよう）。根の layout はクッキーを読めず日本語の辞書で描くので、
// 画面の側で端末の言葉を読み、lib/i18n/emergency-dict.ts の辞書で描き直す（app/emergency/EmergencyLang.tsx）。
// それまでは、上の帯から移った時も直接開いた時も、中文・English の画面で日本語のまま出ていた（訳は辞書にあったのに届いていなかった）。
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CRY_LINES } from "@/lib/cautions";
import { N7119 } from "@/lib/emergency-lines";
import { AREAS, DICTS } from "./dicts";
import { EMERGENCY_AREAS, EMERGENCY_DICTS } from "./emergency-dict";

const DIR = path.join(process.cwd(), "src/app/emergency");
const read = (f: string) => fs.readFileSync(path.join(DIR, f), "utf8");
const lit = (s: string): string => JSON.parse(`"${s}"`);

/** この画面で引く鍵: t("…") の字・出典の名（page.tsx の SOURCES）・泣きやまない時の引用（CRY_LINES）・#7119 の受付の時間 */
function emergencyKeys(): Set<string> {
  const keys = new Set<string>();
  for (const f of ["page.tsx", "ChokeOrder.tsx"]) for (const m of read(f).matchAll(/\bt\(\s*"((?:[^"\\]|\\.)*)"/g)) keys.add(lit(m[1]));
  for (const m of read("page.tsx").matchAll(/\blabel: "((?:[^"\\]|\\.)*)"/g)) keys.add(lit(m[1]));
  for (const l of CRY_LINES) {
    for (const s of l.says) keys.add(s);
    if (l.after) keys.add(l.after);
  }
  for (const a of Object.values(N7119)) if (a?.hours) keys.add(a.hours);
  return keys;
}

describe("急ぎの時の画面は、自分の辞書だけで描ける", () => {
  const keys = emergencyKeys();

  it("鍵を読めている（読み方が壊れて0件で通るのを防ぐ）", () => {
    expect(keys.size).toBeGreaterThan(60);
    expect(keys.has("119 にかける")).toBe(true);
    expect(keys.has("電話する")).toBe(true);
  });

  // 書き方の基本（「（{x}）」「「{text}」」など）は core.ts、ほかは dict/emergency.ts
  const own = (k: string) => AREAS.emergency[k] ?? AREAS.core[k];

  it("この画面で引く鍵は、すべて dict/emergency.ts（か core.ts）にあり、中文と English がある", () => {
    const missing = [...keys].filter((k) => !own(k)?.zh || !own(k)?.en);
    expect(missing).toEqual([]);
  });

  it("この画面の辞書は core.ts と dict/emergency.ts の分そのまま（まとめた辞書と同じ訳）。日本語は空（鍵のまま出す）", () => {
    expect(EMERGENCY_AREAS).toEqual([AREAS.core, AREAS.emergency]);
    for (const k of keys) {
      expect(EMERGENCY_DICTS.zh[k], k).toBe(DICTS.zh[k]);
      expect(EMERGENCY_DICTS.en[k], k).toBe(DICTS.en[k]);
    }
    expect(EMERGENCY_DICTS.ja).toEqual({});
    // ほかの画面の鍵は入らない（荷物を小さく）
    expect(Object.keys(EMERGENCY_DICTS.zh).length).toBeLessThan(Object.keys(DICTS.zh).length / 4);
  });

  it("画面の荷物に、ほかの画面の辞書を入れない（lib/i18n/dicts.ts を読まない）", () => {
    const src = fs.readFileSync(path.join(process.cwd(), "src/lib/i18n/emergency-dict.ts"), "utf8");
    expect(src).not.toMatch(/from "\.\/dicts"|from "@\/lib\/i18n\/dicts"/);
    for (const f of ["page.tsx", "ChokeOrder.tsx", "EmergencyLang.tsx"]) expect(read(f), f).not.toMatch(/i18n\/dicts"/);
  });

  it("ページは EmergencyLang で包む（端末の言葉で描き直す）", () => {
    expect(read("page.tsx")).toMatch(/<EmergencyLang>\s*<EmergencyBody \/>\s*<\/EmergencyLang>/);
  });
});
