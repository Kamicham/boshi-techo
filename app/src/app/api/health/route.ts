// 見張りの口（fly.toml の [[http_service.checks]]・15秒ごと。2026-11-05）。
// 札を配らず（middleware.ts）、体験の写しも作らず、記録には触らない。
// 返すのは、動いている事と、記録の置き場の空き（0〜1。20%を切ると新しい写しを作らない＝lib/trial.ts）だけ
import { dataFree } from "@/lib/trial";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true, free: Math.round(dataFree() * 100) / 100 }, { headers: { "cache-control": "no-store" } });
}
