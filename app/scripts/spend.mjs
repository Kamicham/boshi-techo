#!/usr/bin/env node
// Claude の API を使った額と残りを出す（検査・シミュレーションの後に毎回）。
//   node scripts/spend.mjs [--since 2026-11-03T01:00:00Z] [--label 今回]
// 残りは、Console の残高（BOSHI_CREDIT_USD と、それを見た時刻 BOSHI_CREDIT_AT。app/.env.local）から、
// その時刻より後に使った額（本番・開発の app/data と、シミュレーションの app/sim-data）を引いた見込み。請求の正本は Console。
import fs from "node:fs";
import path from "node:path";

const root = path.join(path.dirname(new URL(import.meta.url).pathname), "..");
const YEN = 150;
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const env = {};
try {
  for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^(BOSHI_CREDIT_USD|BOSHI_CREDIT_AT)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
} catch {}
const read = (dir) => {
  try {
    return fs
      .readFileSync(path.join(root, dir, "spend.jsonl"), "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => ({ ...JSON.parse(l), place: dir }));
  } catch {
    return [];
  }
};
const all = [...read("data"), ...read("sim-data")];
let since = arg("--since");
if (!since) {
  try {
    since = fs.readFileSync(path.join(root, "sim-data", "run-start"), "utf8").trim();
  } catch {
    since = "";
  }
}
const sum = (rows) => rows.reduce((a, r) => a + r.usd, 0);
const usd = (x) => `$${x.toFixed(2)}（約${Math.round(x * YEN).toLocaleString()}円）`;
const now = all.filter((r) => !since || r.at >= since);
const label = arg("--label") ?? "今回";
console.log(`【Claude API のクレジット】`);
console.log(`${label}: ${usd(sum(now))}　呼び出し ${now.length}回（シミュレーション ${now.filter((r) => r.place === "sim-data").length}・本番と開発 ${now.filter((r) => r.place === "data").length}）`);
const today = new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const todays = all.filter((r) => new Date(Date.parse(r.at) + 9 * 3600e3).toISOString().slice(0, 10) === today);
console.log(`今日: ${usd(sum(todays))}　記録を始めてからの合計: ${usd(sum(all))}`);
if (env.BOSHI_CREDIT_USD) {
  const after = all.filter((r) => !env.BOSHI_CREDIT_AT || r.at >= env.BOSHI_CREDIT_AT);
  const left = Number(env.BOSHI_CREDIT_USD) - sum(after);
  console.log(`残り（見込み）: ${usd(left)}　← Console の残高 $${env.BOSHI_CREDIT_USD}（${env.BOSHI_CREDIT_AT ?? "時刻なし"}）から`);
} else {
  console.log("残り: まだ分かりません（Console の残高を app/.env.local の BOSHI_CREDIT_USD に入れると出ます）");
}
