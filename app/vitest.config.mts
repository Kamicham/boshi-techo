// テストでも、アプリと同じ「@/」（= src/）の読み込みを使えるようにする（tsconfig の paths と同じ）。
// - setupFiles: 試験の置き場を一時の置き場にする（わが家の記録の置き場 app/data に触れない。vitest.setup.ts）
// - testTimeout: 1つの試験の上限は、手元も CI も同じ20秒（CI の機械は手元より遅い）。
//   30家族×1000日を回す重い試験は、その試験の中で60秒〜を付ける（prep.test.ts・trip.test.ts・sim/ など）
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 20_000,
  },
});
