// @ts-check
// 組み立ての設定。.ts ではなく .mjs に置く（2026-11-05）: 公開版の像は組み立ての後に npm prune --omit=dev で typescript を消すので、
// next.config.ts のままだと next start のたびに TypeScript を入れ直し、起動に約60秒かかっていた（Fly のログ「Installing TypeScript…」）。
// 型は JSDoc で付ける（エディタと tsc の手がかり）。

/** @type {import("next").NextConfig} */
const nextConfig = {
  // 家族の iPhone が使う本番（next start）は .next-prod に分け、開発サーバ（.next）とぶつけない
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 家の Mac で動かし、家族の iPhone から Tailscale の https の住所で開く（開発サーバのまま使うため）
  allowedDevOrigins: ["*.ts.net"],
  // better-sqlite3 はネイティブの部品なので、束ねずにそのまま読む
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // middleware があると、Next.js は口へ渡す中身を middleware のために写し、既定では 10MB で切る（それより大きい写真や声は途中で切れていた）。
    // 公開版の門の上限（写真と声は 32MB・src/lib/body-limit.ts の BIG_BODY）と揃える。長さの無い送り方も、ここで 32MB に収まる
    middlewareClientMaxBodySize: 32 * 1024 * 1024,
  },
};

export default nextConfig;
