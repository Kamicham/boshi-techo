import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 家の Mac で動かし、家族の iPhone から Tailscale の https の住所で開く（開発サーバのまま使うため）
  allowedDevOrigins: ["*.ts.net"],
  // better-sqlite3 はネイティブの部品なので、束ねずにそのまま読む
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
