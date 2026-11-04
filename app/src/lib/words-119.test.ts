// 119 の言い方を、手帳に聞くの床（lib/ask/bridge.ts）とそろえる（2026-11-05・統括から）。
// 「迷ったら119」と書くと、迷う時の相談先（子どもは #8000・ママの体は産院）より先に119へ向かわせる。
// 言い方は「命が危ないと思ったら、迷わず119」。119 を「息をしていない時だけ」に狭めない。
// 見るのは、急ぎの記録に添える文・画面の地図（手帳に聞くが読む）・手帳に聞くへの指示。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "boshi-words-119-test-"));
process.env.BOSHI_DATA_DIR = dir;
afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

const FLOOR = "命が危ないと思ったら、迷わず119";

describe("119 の言い方は床とそろえる", () => {
  it("急ぎの記録に添える文（ママ・子ども・両方）", async () => {
    const { URGENT_NOTE, URGENT_NOTE_BOTH, URGENT_NOTE_CHILD } = await import("@/components/capture/urgent-note");
    for (const t of [URGENT_NOTE, URGENT_NOTE_CHILD, URGENT_NOTE_BOTH]) {
      expect(t).toContain(FLOOR);
      expect(t).not.toMatch(/迷ったら ?119|息をしていない時だけ/);
    }
  });

  it("画面の地図の「急ぎの時」と、手帳に聞くへの指示", async () => {
    const { guideText } = await import("./app-guide");
    const g = guideText();
    expect(g).toContain(`${FLOOR}。救急車を呼ぶか迷う時は、子どもは #8000、ママの体は産院`);
    expect(g).not.toMatch(/迷ったら ?119/);
    const { ASK_RULES } = await import("./ask/agent");
    expect(ASK_RULES).toContain(FLOOR);
    // 指示の中で「迷ったら119」と書くのは、「書かない」と言う時だけ
    expect(ASK_RULES.replace(/「迷ったら119」とは書かない/g, "")).not.toMatch(/迷ったら ?119/);
  });
});
