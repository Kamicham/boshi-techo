// 急ぎの時（/emergency）の辞書だけを、言葉ごとの1冊に（core.ts と dict/emergency.ts の分だけ。画面の荷物に、ほかの画面の辞書を入れない）。
// この画面は作る時に1回だけ組み立てる（通信が無くても開けるよう。app/emergency/layout.tsx の force-static）ので、根の layout はクッキーを読めず、
// 日本語の辞書で描かれる。画面の側で端末の言葉を読み、この辞書で描き直す（app/emergency/EmergencyLang.tsx）。
// この画面で引く鍵は、ほかの画面と同じ鍵でも dict/emergency.ts（書き方の基本は core.ts）に置く（試験 emergency-dict.test.ts）。
import type { Dict, Entries, Lang } from ".";
import core from "./dict/core";
import emergency from "./dict/emergency";

/** この画面の辞書に入る場所（試験も読む） */
export const EMERGENCY_AREAS: readonly Entries[] = [core, emergency];

function pick(lang: "zh" | "en"): Dict {
  const out: Record<string, string> = {};
  for (const entries of EMERGENCY_AREAS) for (const [key, e] of Object.entries(entries)) if (e[lang]) out[key] = e[lang]!;
  return out;
}

export const EMERGENCY_DICTS: Readonly<Record<Lang, Dict>> = { ja: {}, zh: pick("zh"), en: pick("en") };
