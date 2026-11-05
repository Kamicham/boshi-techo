// 試験が、わが家の記録の置き場（app/data）を開かない（2026-11-05 監査: 置き場の1行を忘れた試験が ~/…/app で回ると本物の DB に書く）。
// この試験自身も本物の置き場に触れないよう、「今いる所」を一時の置き場に置き換えてから確かめる。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const saved = process.env.BOSHI_DATA_DIR;
afterEach(() => {
  process.env.BOSHI_DATA_DIR = saved;
  vi.restoreAllMocks();
  vi.resetModules();
});

/** 「今いる所」を一時の置き場にして、db を読み込み直す（その下の data/ が「わが家の置き場」に当たる） */
async function dbAt(dataDir: (cwd: string) => string | undefined) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-guard-"));
  vi.spyOn(process, "cwd").mockReturnValue(cwd);
  const d = dataDir(cwd);
  if (d === undefined) delete process.env.BOSHI_DATA_DIR;
  else process.env.BOSHI_DATA_DIR = d;
  vi.resetModules();
  return { cwd, db: await import("./db") };
}

describe("試験の置き場", () => {
  it("試験の置き場は、試験の始めに一時の置き場に決まっている（app/data ではない）", () => {
    expect(process.env.BOSHI_DATA_DIR).toBeTruthy();
    expect(path.resolve(process.env.BOSHI_DATA_DIR!)).not.toBe(path.resolve(process.cwd(), "data"));
  });

  it("置き場を決めずに（＝app/data）DB を開こうとすると止まり、置き場の中に何も作らない", async () => {
    const { cwd, db } = await dbAt(() => undefined);
    expect(db.DATA_DIR).toBe(path.join(cwd, "data"));
    expect(() => db.get("x")).toThrow(/わが家の記録の置き場/);
    expect(() => db.filesDir("demo-sato")).toThrow(/わが家の記録の置き場/);
    expect(fs.existsSync(path.join(cwd, "data"))).toBe(false);
  });

  it("BOSHI_DATA_DIR で app/data を指しても止まる（書き方が違っても同じ所なら止める）", async () => {
    const { cwd, db } = await dbAt((c) => path.join(c, "x", "..", "data"));
    expect(() => db.put("demo-sato", "record", { a: 1 })).toThrow(/わが家の記録の置き場/);
    expect(fs.existsSync(path.join(cwd, "data"))).toBe(false);
  });

  it("一時の置き場なら開ける。わが家の置き場の振る舞いを試すために BOSHI_DATA_DIR を後から消しても、開くのは一時の置き場のまま", async () => {
    const { cwd, db } = await dbAt((c) => path.join(c, "tmp-data"));
    db.put("demo-sato", "record", { a: 1 }, { id: "guard-1" });
    delete process.env.BOSHI_DATA_DIR;
    expect(db.isHomeDataDir()).toBe(true);
    expect(db.get<{ a: number }>("guard-1")?.data.a).toBe(1);
    expect(fs.existsSync(path.join(cwd, "tmp-data", "boshi.db"))).toBe(true);
    expect(fs.existsSync(path.join(cwd, "data"))).toBe(false);
  });
});
