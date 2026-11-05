// 文字起こし（lib/asr.ts）: 機械が無い時、作った家族はデモの文で試せる。本物の世帯は、デモの文を記録に入れずに止める（2026-11-05 監査）
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.resetModules();
});

async function load(env: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return import("./asr");
}

const AUDIO = Buffer.alloc(2000);

describe("文字起こしの機械が無い時", () => {
  it("本物の世帯（わが家の mine・アカウントの世帯）は、デモの文に落とさず 503", async () => {
    const { transcribe } = await load({ ASR_URL: undefined, BOSHI_PUBLIC: undefined });
    for (const id of ["mine", "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"]) {
      await expect(transcribe(AUDIO, undefined, "visit", id)).rejects.toMatchObject({ status: 503 });
      await expect(transcribe(AUDIO, undefined, "note", id)).rejects.toMatchObject({ status: 503 });
    }
  });

  it("見本の家族は、デモの文で最後まで試せる（健診は健診の会話）", async () => {
    const { transcribe } = await load({ ASR_URL: undefined, BOSHI_PUBLIC: undefined });
    const visit = await transcribe(AUDIO, undefined, "visit", "demo-sato");
    expect(visit.demo).toBe(true);
    expect(visit.text.length).toBeGreaterThan(100);
    expect((await transcribe(AUDIO, undefined, "note", "demo-sato")).demo).toBe(true);
  });

  it("世帯を渡さない呼び方は今までどおり（デモの文。返った印で呼ぶ側が記録にしない）", async () => {
    const { transcribe } = await load({ ASR_URL: undefined, BOSHI_PUBLIC: undefined });
    expect((await transcribe(AUDIO)).demo).toBe(true);
  });

  it("公開版（体験）は、だれの声も機械へ送らずデモの文", async () => {
    const { transcribe } = await load({ ASR_URL: "http://127.0.0.1:9", BOSHI_PUBLIC: "1" });
    expect((await transcribe(AUDIO, undefined, "note", "mine")).demo).toBe(true);
  });
});
