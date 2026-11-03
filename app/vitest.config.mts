// テストでも、アプリと同じ「@/」（= src/）の読み込みを使えるようにする（tsconfig の paths と同じ）。
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
});
