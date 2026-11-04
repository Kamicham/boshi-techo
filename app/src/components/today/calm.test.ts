// 今やる事が無い日の1枚の言葉（統括の足し 3・UX の見直し C10⑤ の画面の分・2026-11-05）。Claude は呼ばない。
// 24週（引っ越した翌日）に「あなたは今週、急ぐ事はありません」のすぐ下へ、転入の届けの14日の期限の気づきが出て、言う事が食い違っていた。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calmWords } from "./calm";

const here = path.dirname(fileURLToPath(import.meta.url));

describe("今やる事が無い日の1枚", () => {
  it("手帳が気づいた事が出ている日は「急ぐ事はありません」「大丈夫」と言わず、予定表の事だけを言って気づいた事へ向ける", () => {
    for (const before of [0, 2]) {
      for (const others of [0, 3]) {
        for (const advisor of ["above", "below"] as const) {
          const w = calmWords({ before, others, advisor });
          expect(w.title).toContain("予定表");
          expect(w.title).not.toMatch(/急ぐ事はありません|大丈夫|やる事はありません/);
          expect(w.lead).toBe(`${advisor === "above" ? "上" : "下"}の、手帳が気づいた事を先に見てください。`);
        }
      }
    }
    expect(calmWords({ before: 0, others: 3, advisor: "below" }).title).toBe("あなたの予定表に、今週の急ぎはありません");
    expect(calmWords({ before: 0, others: 0, advisor: "below" }).title).toBe("予定表の急ぎはありません");
    expect(calmWords({ before: 2, others: 0, advisor: "above" }).title).toBe("ほかに、予定表の急ぎはありません");
  });

  it("気づいた事が無い日は今までどおり", () => {
    expect(calmWords({ before: 0, others: 0 })).toEqual({ title: "今週は、何もしなくて大丈夫", lead: "" });
    expect(calmWords({ before: 0, others: 2 }).title).toBe("あなたは今週、急ぐ事はありません");
    expect(calmWords({ before: 1, others: 2 }).title).toBe("ほかに、今すぐやる事はありません");
  });

  it("今日の画面は、気づいた事の箱が出る時（数が1以上）に、上か下かを渡す（札から開いた日は上）", () => {
    const techo = fs.readFileSync(path.join(here, "../Techo.tsx"), "utf8");
    expect(techo).toContain('advisor={advisorOpen! > 0 ? (advisorFirst ? "above" : "below") : undefined}');
    expect(techo).toContain("calmWords({");
  });
});
