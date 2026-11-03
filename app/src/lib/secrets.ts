// 秘密（鍵）を環境変数から読む。値は決して記録・画面に出さない。
// - 本番（NODE_ENV=production）で鍵が無ければ、起動を止める（開発用の鍵で本物の家族を守らない）
// - 開発・試験で鍵が無ければ、はっきり警告を出して開発用の鍵に倒れる
import "server-only";
import { createHash } from "node:crypto";

const warned = new Set<string>();

/**
 * 環境変数の鍵を読む。無い時は、本番なら例外、開発なら `dev:<name>` から作った決まった値を返す。
 * 開発用の値は公開リポジトリから誰でも作れるので、本物の家族のデータには使えない。
 */
export function requireSecret(name: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name} が設定されていません。app/.env.local に足してから起動してください（本番は開発用の鍵では動かしません）`);
  }
  if (!warned.has(name)) {
    warned.add(name);
    console.warn(`⚠️ ${name} が無いので、開発用の鍵で動かします。本物の家族のデータには使えません（app/.env.local に足す）`);
  }
  return createHash("sha256").update(`boshi-techo:dev:${name}`).digest("hex");
}
