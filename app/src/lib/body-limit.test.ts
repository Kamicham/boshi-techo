// 送る中身の大きさの上限（2026-11-05 技術監査 (5)①・lib/body-limit.ts）。門の 413 と、関所を通ってから中身を読む事は lib/trial.test.ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BIG_BODY, SMALL_BODY, bodyLimit, bodyTooBig } from "./body-limit";

describe("送る中身の大きさの上限", () => {
  it("写真と声の口は 32MB、ほかは 1MB", () => {
    for (const p of ["/api/media", "/api/media/voice", "/api/letters", "/api/capture/photo", "/api/capture/voice", "/api/ask/voice", "/api/techo/photo", "/api/visit/v1/chunk"])
      expect(bodyLimit(p), p).toBe(BIG_BODY);
    for (const p of ["/api/done", "/api/capture", "/api/media/abc", "/api/letters/abc", "/api/techo", "/api/family", "/api/media/voice/x"]) expect(bodyLimit(p), p).toBe(SMALL_BODY);
  });

  it("POST・PUT・PATCH の content-length が上限を超えた時だけ止める", () => {
    expect(bodyTooBig("POST", "/api/done", String(SMALL_BODY))).toBeNull();
    expect(bodyTooBig("POST", "/api/done", String(SMALL_BODY + 1))).toContain("1MB");
    expect(bodyTooBig("PATCH", "/api/media/abc", String(SMALL_BODY + 1))).not.toBeNull();
    expect(bodyTooBig("PUT", "/api/family", String(5 * SMALL_BODY))).not.toBeNull();
    expect(bodyTooBig("POST", "/api/media", String(BIG_BODY))).toBeNull();
    expect(bodyTooBig("POST", "/api/media", String(BIG_BODY + 1))).toContain("32MB");
    // 読むだけの頼み・API の外・長さの無い送り方は、門では止めない（長さの無い送り方は、読んだ後に lib/read-body.ts が見る）
    expect(bodyTooBig("GET", "/api/done", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("DELETE", "/api/done", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("POST", "/login", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("POST", "/api/done", null)).toBeNull();
    expect(bodyTooBig("POST", "/api/done", "abc")).toBeNull();
  });

  it("上限を渡せば、道に関わらずその上限で見る（公開版の外の門は 32MB だけ）", () => {
    expect(bodyTooBig("POST", "/api/done", String(5 * SMALL_BODY), BIG_BODY)).toBeNull();
    expect(bodyTooBig("POST", "/api/done", String(BIG_BODY + 1), BIG_BODY)).toContain("32MB");
  });

  it("公開版の外の門も、名乗った長さが 32MB を超える頼みを、中身を読まずに 413（Next.js 15.5.29 は写す中身を 32MB で黙って切るため）", async () => {
    const before = { pub: process.env.BOSHI_PUBLIC, pass: process.env.BOSHI_PASSCODE };
    delete process.env.BOSHI_PUBLIC;
    delete process.env.BOSHI_PASSCODE;
    try {
      const { NextRequest } = await import("next/server");
      const { middleware } = await import("@/middleware");
      const send = (url: string, n: number) => middleware(new NextRequest(`http://127.0.0.1:3210${url}`, { method: "POST", headers: { "content-length": String(n) } }));
      const r = await send("/api/media/voice", BIG_BODY + 1);
      expect(r.status).toBe(413);
      expect(((await r.json()) as { error: string }).error).toContain("32MB");
      expect((await send("/api/done", BIG_BODY + 1)).status).toBe(413);
      // わが家の本番では、写真と声の外の口にも 1MB の上限は掛けない（健診の道案内は写真を JSON で送る）
      expect((await send("/api/visit/v1/guide", 5 * SMALL_BODY)).status).toBe(200);
      expect((await send("/api/media/voice", BIG_BODY)).status).toBe(200);
    } finally {
      if (before.pub !== undefined) process.env.BOSHI_PUBLIC = before.pub;
      if (before.pass !== undefined) process.env.BOSHI_PASSCODE = before.pass;
    }
  });

  it("Next.js が middleware のために写す中身の上限を、写真と声の上限（32MB）と揃えている（15.5.29 の既定の 10MB だと途中で切れる）", () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(cfg).toMatch(/middlewareClientMaxBodySize:\s*32 \* 1024 \* 1024/);
    expect(BIG_BODY).toBe(32 * 1024 * 1024);
  });
});
