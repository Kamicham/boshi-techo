// Claude の API を使った額を1回ずつ記録する（社長の指示 2026-11-03「気づかないうちにとんでもない額を使われたら困る」）。
// 置き場は DATA_DIR/spend.jsonl（本番・開発は app/data、シミュレーションは app/sim-data。どちらも git の外）。
// 額は返ってきた usage と単価からの計算（請求の正本は Console）。単価は claude-api の資料 models.md（2026-11 時点）。
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { DATA_DIR } from "./db";
import { HttpError } from "./http-error";

/** 100万トークンあたりのドル（入力・出力・キャッシュ読み）。キャッシュ書きは入力の1.25倍とみなす */
const PRICE: Record<string, { in: number; out: number; cacheRead: number }> = {
  "claude-opus-5-5": { in: 4, out: 20, cacheRead: 0.2 },
  "claude-sonnet-5-5": { in: 2, out: 10, cacheRead: 0.2 },
  "claude-haiku-5-5": { in: 0.1, out: 0.5, cacheRead: 0.01 },
  "claude-fable-5-1": { in: 10, out: 50, cacheRead: 0.25 },
};
const SEARCH_USD = 10 / 1000;

interface Usage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
  server_tool_use?: { web_search_requests?: number | null } | null;
}

export function costOf(model: string, u: Usage): number {
  const p = PRICE[model] ?? PRICE["claude-opus-5-5"];
  const inTok = u.input_tokens ?? 0;
  // Haiku 5.5 は、1回の入力が10万トークンを超えると単価が5倍
  const k = model === "claude-haiku-5-5" && inTok + (u.cache_read_input_tokens ?? 0) > 100_000 ? 5 : 1;
  return (
    ((inTok * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_read_input_tokens ?? 0) * p.cacheRead + (u.cache_creation_input_tokens ?? 0) * p.in * 1.25) * k) / 1e6 +
    (u.server_tool_use?.web_search_requests ?? 0) * SEARCH_USD
  );
}

const file = () => path.join(DATA_DIR, "spend.jsonl");

/** だれの分か（世帯の id と送った人の id）。前の行には無い（scripts/spend.mjs は無い行も読む） */
export type SpendWho = { household?: string; account?: string | null };

/** 1回の呼び出しを記録する（記録に失敗しても、本来の仕事は止めない） */
export function recordSpend(kind: string, model: string, u: Usage, who?: SpendWho): void {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const usd = costOf(model, u);
    fs.appendFileSync(
      file(),
      JSON.stringify({
        at: new Date().toISOString(),
        kind,
        model,
        usd: Math.round(usd * 1e6) / 1e6,
        in: u.input_tokens ?? 0,
        out: u.output_tokens ?? 0,
        cacheRead: u.cache_read_input_tokens ?? 0,
        search: u.server_tool_use?.web_search_requests ?? 0,
        ...(who?.household ? { household: who.household } : {}),
        ...(who?.account ? { account: who.account } : {}),
      }) + "\n",
    );
  } catch (e) {
    console.error("[spend]", e);
  }
}

/** シミュレーションの上限（BOSHI_SIM_BUDGET_USD）。DATA_DIR/run-start の時刻から使った額が上限を超えたら止める */
export function checkBudget(): void {
  const cap = Number(process.env.BOSHI_SIM_BUDGET_USD ?? "");
  if (!cap) return;
  let since = "";
  try {
    since = fs.readFileSync(path.join(DATA_DIR, "run-start"), "utf8").trim();
  } catch {
    return;
  }
  let used = 0;
  try {
    for (const line of fs.readFileSync(file(), "utf8").split("\n")) {
      if (!line) continue;
      const r = JSON.parse(line) as { at: string; usd: number };
      if (r.at >= since) used += r.usd;
    }
  } catch {
    return;
  }
  if (used >= cap) throw new Error(`シミュレーションの上限 $${cap} に達したので、Claude を呼ぶのを止めました（今回 $${used.toFixed(2)}）`);
}

/**
 * 世帯ごとの使い過ぎ止め（BOSHI_HOUSEHOLD_DAILY_USD。入れた時だけ効く）。
 * その世帯が日本時間の今日に使った額が上限を超えたら止める（1つの家族が、ほかの家族の分まで使い切らないように）。
 */
export function checkHouseholdBudget(householdId: string): void {
  const cap = Number(process.env.BOSHI_HOUSEHOLD_DAILY_USD ?? "");
  if (!cap) return;
  const day = (iso: string) => new Date(Date.parse(iso) + 9 * 3600e3).toISOString().slice(0, 10);
  const today = day(new Date().toISOString());
  let used = 0;
  try {
    for (const line of fs.readFileSync(file(), "utf8").split("\n")) {
      if (!line) continue;
      const r = JSON.parse(line) as { at: string; usd: number; household?: string };
      if (r.household === householdId && day(r.at) === today) used += r.usd;
    }
  } catch {
    return;
  }
  if (used >= cap) throw new HttpError(429, `この家族が今日 Claude を使える上限（$${cap}）に達しました。明日また使えます`);
}
