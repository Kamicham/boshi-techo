// サーバが立った時の掃除（src/instrumentation.ts）: 体験版の時だけ、7日たった写しを今と1日1回消す
import { afterEach, describe, expect, it, vi } from "vitest";

const purge = vi.fn(async () => 0);
vi.mock("./lib/trial", () => ({ purgeExpiredTrials: purge }));

const env = { ...process.env };
afterEach(() => {
  process.env = { ...env };
  vi.restoreAllMocks();
  purge.mockClear();
});

async function run(vars: Record<string, string | undefined>) {
  // undefined は消す（process.env に入れると "undefined" の字になる）
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  const timer = vi.spyOn(globalThis, "setInterval").mockReturnValue({ unref: () => undefined } as unknown as ReturnType<typeof setInterval>);
  const { register } = await import("./instrumentation");
  await register();
  return timer;
}

describe("サーバが立った時の写しの掃除", () => {
  it("体験版では、立った時に消し、その後1日1回消す", async () => {
    const timer = await run({ NEXT_RUNTIME: "nodejs", BOSHI_PUBLIC: "1", NEXT_PHASE: undefined });
    // 消すのは裏で（立ち上がりを待たせない）
    await vi.waitFor(() => expect(purge).toHaveBeenCalledTimes(1));
    expect(timer).toHaveBeenCalledWith(expect.any(Function), 86_400_000);
  });

  it("体験版でない置き場・組み立ての間・edge では何もしない", async () => {
    for (const vars of [
      { NEXT_RUNTIME: "nodejs", BOSHI_PUBLIC: undefined },
      { NEXT_RUNTIME: "nodejs", BOSHI_PUBLIC: "1", NEXT_PHASE: "phase-production-build" },
      { NEXT_RUNTIME: "edge", BOSHI_PUBLIC: "1" },
    ]) {
      process.env = { ...env };
      const timer = await run({ NEXT_PHASE: undefined, ...vars });
      expect(timer).not.toHaveBeenCalled();
      timer.mockRestore();
    }
    await new Promise((r) => setTimeout(r, 20));
    expect(purge).not.toHaveBeenCalled();
  });
});
