import { describe, expect, it } from "vitest";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { isLegalDeadline, urgentNoteFor, URGENT_NOTE, URGENT_NOTE_BOTH, URGENT_NOTE_CHILD } from "./urgent-note";

const rec = (date: string, who?: string) => ({ date, createdAt: `${date}T00:00:00Z`, data: { kind: "気がかり" as const, title: "熱", detail: "", source: "voice" as const, urgent: true, who } });

describe("急ぎの記録に添える電話先", () => {
  it("妊娠中は産院", () => expect(urgentNoteFor(rec("2027-01-10", "ひなた"), DEMO_FAMILY)).toBe(URGENT_NOTE));
  it("生まれた後、子の事は小児科と #8000", () => expect(urgentNoteFor(rec("2027-06-10", "ひなた"), DEMO_FAMILY)).toBe(URGENT_NOTE_CHILD));
  it("生まれた後、母の事は産院", () => expect(urgentNoteFor(rec("2027-06-10", "美咲"), DEMO_FAMILY)).toBe(URGENT_NOTE));
  it("誰の事か分からない時は両方", () => expect(urgentNoteFor(rec("2027-06-10"), DEMO_FAMILY)).toBe(URGENT_NOTE_BOTH));
});

describe("法の期限らしいか", () => {
  it("出生届は法の期限", () => expect(isLegalDeadline({ isDeadline: true, title: "出生届を出す", detail: "" })).toBe(true));
  it("お宮参りは法の期限ではない", () => expect(isLegalDeadline({ isDeadline: true, title: "お宮参り", detail: "神社" })).toBe(false));
  it("期限の印が無ければ違う", () => expect(isLegalDeadline({ title: "児童手当", detail: "" })).toBe(false));
});
