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
    // 読むだけの頼み・API の外・長さの無い送り方は、門では止めない（長さの無い送り方は Next.js の写しの上限で切れる）
    expect(bodyTooBig("GET", "/api/done", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("DELETE", "/api/done", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("POST", "/login", String(BIG_BODY * 2))).toBeNull();
    expect(bodyTooBig("POST", "/api/done", null)).toBeNull();
    expect(bodyTooBig("POST", "/api/done", "abc")).toBeNull();
  });

  it("Next.js が middleware のために写す中身の上限を、写真と声の上限（32MB）と揃えている（既定の 10MB だと途中で切れる）", () => {
    const cfg = fs.readFileSync(path.join(process.cwd(), "next.config.mjs"), "utf8");
    expect(cfg).toMatch(/middlewareClientMaxBodySize:\s*32 \* 1024 \* 1024/);
    expect(BIG_BODY).toBe(32 * 1024 * 1024);
  });
});
