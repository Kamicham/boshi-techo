// サーバが立った時に1度だけ動く（Next.js の instrumentation）。node と edge の両方で組み立てられる。
// node の部品（DB）は instrumentation-node.ts に分け、NEXT_RUNTIME が "nodejs" の時だけ読む
// （NEXT_RUNTIME は組み立ての時に字に置き換わるので、edge の組み立てからはこの読み込みごと消える。
//  早めに return する書き方だと消えずに edge へ束ねられ、next build が落ちた。2026-11-05）
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { sweepTrials } = await import("./instrumentation-node");
    sweepTrials();
  }
}
