// 動かし方（2026-11-05 監査）: どの置き場を、どの動かし方で開くか。危ない組み合わせは、サーバが立つ時に止める。
//
// 動かし方は4つ（docs/ARCHITECTURE.md の「動かし方」の表）:
// - home:   わが家の本番（127.0.0.1:3210）。BOSHI_MODE=home と、置き場の絶対パス（BOSHI_DATA_DIR）を serve-prod.sh が入れる
// - public: 公開版（体験）。BOSHI_PUBLIC=1。置き場は Fly の箱（/data）。わが家の置き場は決して開かない
// - sim:    シミュレーション（作った家族）。BOSHI_SIM=1。置き場は app/sim-data など
// - dev:    手元の試し。置き場は BOSHI_DATA_DIR（.env.example は ./try-data）
//
// 「わが家の置き場」とは: BOSHI_MODE=home、または BOSHI_DATA_DIR を指定しない（＝app/data。11/5 までの本番の動かし方）。
// 純粋な関数だけ（置き場の有無は、呼ぶ側が渡す）。
import path from "node:path";

export type BoshiMode = "home" | "public" | "sim" | "dev";

type Env = Record<string, string | undefined>;

/** 開く置き場（lib/db.ts の DATA_DIR）: BOSHI_DATA_DIR か、なければ <今いる所>/data */
export function dataDirOf(env: Env = process.env, cwd: string = process.cwd()): string {
  return env.BOSHI_DATA_DIR ?? path.join(cwd, "data");
}

/** わが家の置き場を開くか（lib/db.ts の isHomeDataDir と同じ決まり） */
export function homeDataDir(env: Env = process.env): boolean {
  return env.BOSHI_MODE === "home" || !env.BOSHI_DATA_DIR;
}

/** 今の動かし方 */
export function boshiMode(env: Env = process.env): BoshiMode {
  if (env.BOSHI_MODE === "home") return "home";
  if (env.BOSHI_PUBLIC === "1") return "public";
  if (env.BOSHI_SIM === "1") return "sim";
  return "dev";
}

export interface ModeFacts {
  /** 開く置き場（lib/db.ts の DATA_DIR） */
  dataDir: string;
  /** 置き場に boshi.db があるか */
  hasDb: boolean;
}

/**
 * サーバを立ててはいけない組み合わせ（空なら立ててよい）。
 * どれも、間違えると本物の家族の記録が別の人に見える・空の記録で上書きされる・本物の健診にデモの会話が入る物。
 */
export function modeProblems(env: Env, facts: ModeFacts): string[] {
  const out: string[] = [];
  const home = homeDataDir(env);
  if (env.BOSHI_MODE && env.BOSHI_MODE !== "home") {
    out.push(`BOSHI_MODE は "home" だけです（今は "${env.BOSHI_MODE}"）。わが家の本番でなければ BOSHI_MODE を外す`);
  }
  if (env.BOSHI_PUBLIC === "1" && home) {
    out.push("公開版（BOSHI_PUBLIC=1）が、わが家の置き場を開こうとしています。公開版の置き場は BOSHI_DATA_DIR で別に決める（BOSHI_MODE=home を外す）");
  }
  if (env.BOSHI_SIM === "1" && home) {
    out.push("シミュレーション（BOSHI_SIM=1）が、わが家の置き場を開こうとしています。BOSHI_DATA_DIR を app/sim-data などに分ける（BOSHI_MODE=home を外す）");
  }
  if (env.BOSHI_MODE === "home") {
    if (!env.BOSHI_DATA_DIR || !path.isAbsolute(env.BOSHI_DATA_DIR)) {
      out.push("わが家の本番（BOSHI_MODE=home）は、置き場を絶対パスの BOSHI_DATA_DIR で指す（どこから立てても同じ置き場を開くため）");
    } else if (!facts.hasDb) {
      out.push(`わが家の置き場（${facts.dataDir}）に boshi.db がありません。道が違うと、空の記録で立ってしまう。置き場の道を確かめる`);
    }
    if (!env.ASR_URL) {
      out.push("わが家の本番に ASR_URL がありません。このまま立てると、本物の健診の録音が文字にならない（.env.local を確かめる）");
    }
  }
  return out;
}
