// 守りのヘッダ（next.config.mjs・2026-11-07）。取り込みのぶつかりなどで消えた時に気づけるよう、設定そのものを読む。
// 組み立てた版の頭に本当に出るかは、next build → next start の後に curl -sI で見る（このファイルでは見られない）。
// .ts ではなく .mjs に置く: .ts から next.config.mjs を読み込むと tsc の範囲に入り、手元の部品の版（Next 15.5.4）が
// 知らない experimental.middlewareClientMaxBodySize で型の検査が落ちる（tsconfig の include は .mjs を見ない＝前と同じ範囲のまま）
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config.mjs";

describe("守りのヘッダ", () => {
  it("すべての道に4つの頭を付け、x-powered-by を出さない", async () => {
    expect(nextConfig.poweredByHeader).toBe(false);
    const rules = (await nextConfig.headers?.()) ?? [];
    const all = rules.find((r) => r.source === "/:path*");
    expect(Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]))).toEqual({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy": "frame-ancestors 'self' https://kamicham.github.io",
      "Strict-Transport-Security": "max-age=31536000",
    });
  });

  it("録音とカメラを止める頭・許す先を書けない枠の頭は付けない", async () => {
    const keys = ((await nextConfig.headers?.()) ?? []).flatMap((r) => r.headers.map((h) => h.key.toLowerCase()));
    expect(keys).not.toContain("permissions-policy");
    expect(keys).not.toContain("x-frame-options");
  });
});
