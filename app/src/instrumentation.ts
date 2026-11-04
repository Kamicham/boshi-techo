// サーバが立った時に1度だけ動く（Next.js の instrumentation）。
// 公開版（体験）: 7日たった写しを、立った時と、その後1日1回消す（2026-11-05 体験版を API なしで開ける前に）。
// 写しを新しく作る時にも消している（lib/trial.ts の ensureTrial）が、新しい人が来ない日にも消えるように。
// 組み立て（next build）の間と、体験版でない置き場では何もしない
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.BOSHI_PUBLIC !== "1" || process.env.NEXT_PHASE === "phase-production-build") return;
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
