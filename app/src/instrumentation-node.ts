// サーバが立った時の仕事（node の時だけ。読むのは instrumentation.ts）
import fs from "node:fs";
import path from "node:path";
import { dataDirOf, modeProblems } from "./lib/mode";

/**
 * 動かし方の確かめ（2026-11-05 監査）: 公開版やシミュレーションがわが家の置き場を開く・わが家の本番の置き場の道が違う
 * （boshi.db が無い）・わが家の本番に ASR_URL が無い、の時は、サーバを立てずに止める（lib/mode.ts）。
 * 間違えたまま立つと、本物の記録が別の人に見える・空の記録で立つ・本物の健診にデモの会話が入る。どれもエラーが出ないため。
 * 組み立て（next build）の間は見ない。
 */
export function checkMode(): void {
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const dataDir = dataDirOf();
  const problems = modeProblems(process.env, { dataDir, hasDb: fs.existsSync(path.join(dataDir, "boshi.db")) });
  if (!problems.length) return;
  console.error(`[動かし方] このままではサーバを立てられません:\n${problems.map((p) => `- ${p}`).join("\n")}`);
  process.exit(1);
}

// 公開版（体験）: 7日たった写しを、サーバが立った時と、その後1日1回消す（2026-11-05 体験版を API なしで開ける前に）。
// 写しを新しく作る時にも消している（lib/trial.ts の ensureTrial）が、新しい人が来ない日にも消えるように。
// 組み立て（next build）の間と、体験版でない置き場では何もしない
export function sweepTrials(): void {
  if (process.env.BOSHI_PUBLIC !== "1" || process.env.NEXT_PHASE === "phase-production-build") return;
  // 掃除が動かなくても、サーバは立てる（写しを作る時の掃除は残る）
  const sweep = () =>
    import("./lib/trial")
      .then(({ purgeExpiredTrials }) => purgeExpiredTrials())
      .then((n) => {
        if (n) console.log(`[体験] 7日たった写しを ${n} 件消しました`);
      })
      .catch((e: unknown) => console.error("[体験] 7日たった写しを消せませんでした", e));
  // 立ち上がりを待たせない（消すのは裏で）
  void sweep();
  setInterval(() => void sweep(), 86_400_000).unref();
}
