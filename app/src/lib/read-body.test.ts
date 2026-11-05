// 生の中身を読む所（lib/read-body.ts・2026-11-05 監査・統括と決めた形）: 大きすぎる中身と、途中で切れた中身は 413。
// Next.js 15.5.29 は門のために写す中身を 32MB で黙って切るので、切れた声や録音を残さない
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { BIG_BODY } from "./body-limit";

vi.mock("server-only", () => ({}));
import { assertWhole, CUT_TEXT, declaredLength, NEAR_LIMIT, readBytes } from "./read-body";

const MB = 1024 * 1024;
const post = (bytes: number, headers: Record<string, string> = {}) =>
  new Request("http://127.0.0.1/api/media/voice", { method: "POST", headers, body: new Uint8Array(bytes) });
const status = (f: () => unknown) => {
  try {
    f();
    return 200;
  } catch (e) {
    return (e as { status?: number }).status ?? 500;
  }
};

describe("生の中身を読む（readBytes）", () => {
  it("名乗った長さどおりに届いた中身は、そのまま返す", async () => {
    const data = await readBytes(post(2000, { "content-length": "2000" }));
    expect(data.length).toBe(2000);
    // 長さの無い送り方でも、上限から遠ければ返す（HTTP/2 などで長さが付かない頼みを落とさない）
    expect((await readBytes(post(2000))).length).toBe(2000);
  });

  it("名乗った長さが上限を超えたら、読む前に 413（上限は口ごとに渡せる）", async () => {
    await expect(readBytes(post(10, { "content-length": String(BIG_BODY + 1) }))).rejects.toMatchObject({ status: 413 });
    await expect(readBytes(post(10, { "content-length": String(3 * MB) }), { max: 2 * MB, tooBig: "録音が大きすぎます" })).rejects.toMatchObject({
      status: 413,
      message: "録音が大きすぎます",
    });
  });

  it("名乗った長さより短く届いた（途中で切れた）中身は 413", async () => {
    // Next.js 15.5.29 が写しの上限で切った形: 名乗りは 40MB、届いたのは手前まで
    expect(status(() => assertWhole(40 * MB, BIG_BODY - 64 * 1024, BIG_BODY))).toBe(413);
    expect(status(() => assertWhole(2000, 1999, BIG_BODY))).toBe(413);
    try {
      assertWhole(2000, 1000, BIG_BODY);
    } catch (e) {
      expect((e as Error).message).toBe(CUT_TEXT);
    }
    expect(status(() => assertWhole(2000, 2000, BIG_BODY))).toBe(200);
  });

  it("長さの無い送り方: 上限の 1MB 手前より長ければ切れたとみなし、上限を超えれば大きすぎる（どちらも 413）", () => {
    expect(status(() => assertWhole(null, BIG_BODY - NEAR_LIMIT, BIG_BODY))).toBe(200);
    expect(status(() => assertWhole(null, BIG_BODY - NEAR_LIMIT + 1, BIG_BODY))).toBe(413);
    expect(status(() => assertWhole(null, BIG_BODY, BIG_BODY))).toBe(413);
    // 写しに上限の無い 15.5.4 に、長さの無い大きな頼みが届いた形
    expect(status(() => assertWhole(null, BIG_BODY + 1, BIG_BODY))).toBe(413);
  });

  it("名乗った長さは、無い・読めない時は null", () => {
    expect(declaredLength(post(1))).toBeNull();
    expect(declaredLength(post(1, { "content-length": "abc" }))).toBeNull();
    expect(declaredLength(post(1, { "content-length": "12" }))).toBe(12);
  });

  it("生の中身を読む口は、どれも readBytes を通る（req.arrayBuffer() を口で直に呼ばない）", () => {
    const api = path.join(process.cwd(), "src/app/api");
    const routes: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name === "route.ts") routes.push(p);
      }
    };
    walk(api);
    expect(routes.length).toBeGreaterThan(20);
    // 健診の録音の一切れ（visit/[id]/chunk）は、健診の口を世帯の関所へ移す時（監査 #2・11/5 14:30 以降）に readBytes へ揃える
    const LATER = new Set(["visit/[id]/chunk/route.ts"]);
    const direct = routes.map((p) => path.relative(api, p)).filter((r) => !LATER.has(r) && /req\.arrayBuffer\(\)/.test(fs.readFileSync(path.join(api, r), "utf8")));
    expect(direct).toEqual([]);
    for (const r of ["capture/voice/route.ts", "ask/voice/route.ts", "media/voice/route.ts"]) expect(fs.readFileSync(path.join(api, r), "utf8"), r).toContain("readBytes(req");
  });
});
