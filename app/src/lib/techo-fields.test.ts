// 手で入れる欄（techo-fields）が、保存の決まり（cleanValues）で捨てられないか
import { describe, expect, it, vi } from "vitest";
import { TECHO_FORMS, formValues } from "./techo-fields";
import type { TechoPageId } from "./techo";

vi.mock("server-only", () => ({}));
const { cleanEntry } = await import("./techo-store");

describe("手で入れる欄", () => {
  for (const [page, form] of Object.entries(TECHO_FORMS) as [
    TechoPageId,
    NonNullable<(typeof TECHO_FORMS)[TechoPageId]>,
  ][]) {
    it(`${page}: どの欄も保存の決まりに残る`, () => {
      const raw = Object.fromEntries(
        form.fields.map((f) => [f.key, f.unit ? "12" : "あ"]),
      );
      const v = formValues(form, raw)!;
      const e = cleanEntry(
        { page, date: "2026-11-04", title: form.title(v), values: v },
        { today: "2026-11-04" },
      );
      expect(e).not.toBeNull();
      expect(Object.keys(e!.values).sort()).toEqual(
        form.fields.map((f) => f.key).sort(),
      );
    });
  }
  it("空・必須が無い時は送らない", () => {
    expect(formValues(TECHO_FORMS.birth!, { weightG: " " })).toBeNull();
    expect(
      formValues(TECHO_FORMS["pregnancy-test"]!, { result: "A型" }),
    ).toBeNull();
    expect(formValues(TECHO_FORMS.birth!, { weightG: "3120" })).toEqual({
      weightG: "3120",
    });
  });
  it("健診の見出しに週数", () => {
    expect(TECHO_FORMS["pregnancy-checkup"]!.title({ week: "24週" })).toBe(
      "妊娠24週の健診",
    );
  });
});
