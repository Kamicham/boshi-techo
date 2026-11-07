// @ts-check
// 組み立ての設定。.ts ではなく .mjs に置く（2026-11-05）: 公開版の像は組み立ての後に npm prune --omit=dev で typescript を消すので、
// next.config.ts のままだと next start のたびに TypeScript を入れ直し、起動に約60秒かかっていた（Fly のログ「Installing TypeScript…」）。
// 型は JSDoc で付ける（エディタと tsc の手がかり）。

// 守りのヘッダ（2026-11-07 作り手が「足す」を選んだ）。体験版・本番のすべての道（ページ・API の口・静的ファイル）に付ける。
// - 枠: X-Frame-Options は許す先を書けないので使わず、CSP の frame-ancestors で自分と作品のページ（GitHub Pages）だけに許す
// - CSP はこの1項目だけ。script-src などは、提出の前に画面を壊す恐れがあるので入れない
// - HSTS は includeSubDomains と preload を付けない（fly.dev のほかの住所や、家の Tailscale の住所を巻き込まない）
// - Permissions-Policy は付けない（録音とカメラを使う）
// 試験: src/lib/security-headers.test.mjs
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self' https://kamicham.github.io" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
];

/** @type {import("next").NextConfig} */
const nextConfig = {
  // 家族の iPhone が使う本番（next start）は .next-prod に分け、開発サーバ（.next）とぶつけない
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // 頭に x-powered-by: Next.js を出さない（使っている部品を外へ名乗らない）
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  // 家の Mac で動かし、家族の iPhone から Tailscale の https の住所で開く（開発サーバのまま使うため）
  allowedDevOrigins: ["*.ts.net"],
  // better-sqlite3 はネイティブの部品なので、束ねずにそのまま読む
  serverExternalPackages: ["better-sqlite3"],
  experimental: {
    // middleware があると、Next.js は口へ渡す中身を middleware のために写す。15.5.29 は写す中身を既定で 10MB に切り、
    // 超えた所から先を黙って捨てる（口には切れた中身が届く）。写真と声の上限（32MB・src/lib/body-limit.ts の BIG_BODY）と揃える。
    // この名前は Next 15.5.29 から効く。15.5.4 は知らない名前として無視し（立つ時に Unrecognized の注意が出る）、上限なしで写す。
    // 名乗った長さが 32MB を超える頼みは門が読む前に止め、生の中身を読む口は切れていないかも見る（src/lib/read-body.ts）
    middlewareClientMaxBodySize: 32 * 1024 * 1024,
  },
};

export default nextConfig;
