// 動かし方（lib/mode.ts）: 危ない組み合わせを、サーバが立つ時に止める（2026-11-05 監査）
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { boshiMode, dataDirOf, homeDataDir, modeProblems } from "./mode";

const OK_DB = { dataDir: "/srv/boshi/data", hasDb: true };
const HOME = { BOSHI_MODE: "home", BOSHI_DATA_DIR: "/srv/boshi/data", ASR_URL: "http://asr.local:8000" };

describe("わが家の置き場か", () => {
  it("BOSHI_MODE=home か、BOSHI_DATA_DIR を指定しない（11/5 までの本番）時だけ", () => {
    expect(homeDataDir({})).toBe(true);
    expect(homeDataDir({ BOSHI_DATA_DIR: "./try-data" })).toBe(false);
    expect(homeDataDir({ BOSHI_MODE: "home", BOSHI_DATA_DIR: "/srv/boshi/data" })).toBe(true);
  });

  it("動かし方の名前: home が先、次に公開版・シミュレーション、ほかは手元の試し", () => {
    expect(boshiMode(HOME)).toBe("home");
    expect(boshiMode({ BOSHI_PUBLIC: "1", BOSHI_DATA_DIR: "/data" })).toBe("public");
    expect(boshiMode({ BOSHI_SIM: "1", BOSHI_DATA_DIR: "sim-data" })).toBe("sim");
    expect(boshiMode({ BOSHI_DATA_DIR: "./try-data" })).toBe("dev");
    expect(boshiMode({})).toBe("dev");
  });
});

describe("立ててよい組み合わせ", () => {
  it.each([
    ["わが家の本番（置き場の絶対パス・boshi.db あり・ASR_URL あり）", HOME],
    ["公開版（置き場は箱の /data）", { BOSHI_PUBLIC: "1", BOSHI_DATA_DIR: "/data" }],
    ["シミュレーション（置き場は sim-data）", { BOSHI_SIM: "1", BOSHI_DATA_DIR: "sim-data" }],
    ["手元の試し（置き場は try-data）", { BOSHI_DATA_DIR: "./try-data" }],
    ["11/5 までの本番の動かし方（置き場を指定しない）", {}],
  ])("%s", (_label, env) => {
    expect(modeProblems(env, OK_DB)).toEqual([]);
  });
});

describe("止める組み合わせ（どれも本物の家族の記録に関わる）", () => {
  it("公開版が、わが家の置き場を開く（置き場の指定忘れ・BOSHI_MODE=home との重ね）", () => {
    expect(modeProblems({ BOSHI_PUBLIC: "1" }, OK_DB).join()).toMatch(/公開版.*わが家の置き場/);
    expect(modeProblems({ ...HOME, BOSHI_PUBLIC: "1" }, OK_DB).join()).toMatch(/公開版.*わが家の置き場/);
  });

  it("シミュレーションが、わが家の置き場を開く", () => {
    expect(modeProblems({ BOSHI_SIM: "1" }, OK_DB).join()).toMatch(/シミュレーション.*わが家の置き場/);
    expect(modeProblems({ ...HOME, BOSHI_SIM: "1" }, OK_DB).join()).toMatch(/シミュレーション.*わが家の置き場/);
  });

  it("わが家の本番で、置き場が絶対パスでない・指定が無い", () => {
    expect(modeProblems({ ...HOME, BOSHI_DATA_DIR: "data" }, OK_DB).join()).toMatch(/絶対パス/);
    expect(modeProblems({ BOSHI_MODE: "home", ASR_URL: "http://a" }, OK_DB).join()).toMatch(/絶対パス/);
  });

  it("わが家の本番で、置き場に boshi.db が無い（道の書き違いで、空の記録で立つのを防ぐ）", () => {
    expect(modeProblems(HOME, { dataDir: "/srv/boshi/data", hasDb: false }).join()).toMatch(/boshi\.db がありません/);
  });

  it("わが家の本番に ASR_URL が無い（本物の健診の録音が文字にならない）", () => {
    expect(modeProblems({ ...HOME, ASR_URL: undefined }, OK_DB).join()).toMatch(/ASR_URL/);
  });

  it("BOSHI_MODE に home 以外の値", () => {
    expect(modeProblems({ BOSHI_MODE: "prod", BOSHI_DATA_DIR: "/x" }, OK_DB).join()).toMatch(/BOSHI_MODE は "home" だけ/);
  });
});

describe("開く置き場（lib/db.ts の DATA_DIR と同じ決まり）", () => {
  it("BOSHI_DATA_DIR か、なければ <今いる所>/data", () => {
    expect(dataDirOf({ BOSHI_DATA_DIR: "/srv/boshi/data" }, "/app")).toBe("/srv/boshi/data");
    expect(dataDirOf({}, "/app")).toBe(path.join("/app", "data"));
  });
});

describe("サーバが立つ時（instrumentation-node の checkMode）", () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });
  const stopExit = () => vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);

  it("危ない組み合わせなら、理由を出して立てずに止まる（process.exit(1)）", async () => {
    const exit = stopExit();
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    Object.assign(process.env, { BOSHI_PUBLIC: "1", BOSHI_MODE: "home", BOSHI_DATA_DIR: path.join(os.tmpdir(), "boshi-no-such-dir") });
    delete process.env.NEXT_PHASE;
    const { checkMode } = await import("../instrumentation-node");
    expect(() => checkMode()).toThrow("exit 1");
    expect(exit).toHaveBeenCalledWith(1);
    expect(String(err.mock.calls[0]?.[0])).toMatch(/公開版/);
  });

  it("わが家の本番（置き場に boshi.db・ASR_URL あり）・組み立ての間・手元の試しでは止まらない", async () => {
    const exit = stopExit();
    const home = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-home-"));
    fs.writeFileSync(path.join(home, "boshi.db"), "");
    const { checkMode } = await import("../instrumentation-node");
    delete process.env.NEXT_PHASE;
    delete process.env.BOSHI_PUBLIC;
    delete process.env.BOSHI_SIM;
    Object.assign(process.env, { BOSHI_MODE: "home", BOSHI_DATA_DIR: home, ASR_URL: "http://asr.local:8000" });
    checkMode();
    Object.assign(process.env, { BOSHI_PUBLIC: "1", NEXT_PHASE: "phase-production-build" });
    checkMode();
    delete process.env.NEXT_PHASE;
    delete process.env.BOSHI_PUBLIC;
    delete process.env.BOSHI_MODE;
    process.env.BOSHI_DATA_DIR = "./try-data";
    checkMode();
    expect(exit).not.toHaveBeenCalled();
  });
});
