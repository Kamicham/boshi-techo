// 見本の家族に同梱した一冊（demo-books.json。Claude が書いた答え）が、一冊の決まりを満たすか
import { describe, expect, it, vi } from "vitest";
import { demoStages } from "@/components/today/stages";
import { addDays, addMonths } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import { PERIODS } from "./media-shared";
import seeds from "./demo-books.json";

vi.mock("server-only", () => ({}));

type Seed = {
  asOf: string;
  writer?: string;
  sourceCount: number;
  raw: {
    title: string;
    dedication: string;
    closing: string;
    cover: string;
    chapters: { period: string; title: string; text: string; moments: { date: string; text: string }[]; photos: { mediaId: string; line: string }[]; voices: { voiceId: string; line: string }[] }[];
    film: { mediaId: string; voiceId: string; caption: string; sec: number }[];
  };
  photos: Record<string, { date: string; caption?: string }>;
  voices: Record<string, { date: string; title: string }>;
};
const BOOKS = seeds as unknown as Seed[];

// 気がかりの記録（lib/capture.ts の見本の種）。一冊には入れない約束（BOOK_RULES 2）
const WORRIES = ["つわり", "足がつる", "夕方になるとよく泣く", "言葉がまだ少ない"];

describe("見本の一冊（demo-books.json）", () => {
  const birth = DEMO_FAMILY.birthDate!;
  const lmp = addDays(DEMO_FAMILY.dueDate, -280);

  it("妊娠30週・生後2か月・1歳・2歳の4冊がある", () => {
    expect(BOOKS.map((b) => b.asOf)).toEqual([addDays(lmp, 30 * 7), addDays(birth, 61), addMonths(birth, 12), addDays(birth, 731)]);
  });

  it("時期の札「1歳の誕生日」の日に開くと、1歳の一冊が出る（前は生後2か月の一冊が開いた。2026-11-05）", async () => {
    const { demoBookSeed } = await import("./demo-book");
    const y1 = demoStages(DEMO_FAMILY).find((s) => s.key === "y1")!;
    expect(y1.what).toContain("この1年の一冊");
    expect(demoBookSeed(y1.date)?.asOf).toBe(addMonths(birth, 12));
    // ほかの札の日も、その日までに書けた一番新しい一冊（2歳の札は2歳の一冊）
    const y2 = demoStages(DEMO_FAMILY).find((s) => s.key === "y2")!;
    expect(demoBookSeed(y2.date)?.asOf).toBe(addDays(birth, 731));
  });

  it("1歳の一冊は API を呼ばず Claude Code が書いた事を、種に正直に残す。今の書き方の決まり（子どもからの呼び名がある人は呼び名で）に沿う", () => {
    const y1 = BOOKS.find((b) => b.asOf === addMonths(birth, 12))!;
    expect(y1.writer).toMatch(/^Claude Code/);
    expect(y1.writer).toContain("API は呼ばず");
    // ほかの3冊は台本から Claude（API）に書かせた物（writer 無し）
    expect(BOOKS.filter((b) => !b.writer)).toHaveLength(3);
    const text = [y1.raw.dedication, y1.raw.closing, ...y1.raw.chapters.map((c) => c.text)].join("\n");
    expect(text).toContain("ママ");
    expect(text).toContain("パパ");
    expect(text).not.toMatch(/美咲|翔太/);
  });

  for (const b of BOOKS) {
    describe(b.asOf, () => {
      const text = [b.raw.title, b.raw.dedication, b.raw.closing, ...b.raw.chapters.flatMap((c) => [c.title, c.text, ...c.moments.map((m) => m.text)])].join("\n");

      it("章がある・時期の名前は決まった物・moments は記録の日付（その日まで）", () => {
        expect(b.raw.chapters.length).toBeGreaterThan(0);
        for (const c of b.raw.chapters) {
          expect(PERIODS as readonly string[]).toContain(c.period);
          expect(c.text.length).toBeGreaterThan(40);
          for (const m of c.moments) expect(m.date <= b.asOf).toBe(true);
        }
      });

      it("写真と声の番号は、渡した候補の番号だけ", () => {
        const photoIds = [b.raw.cover, ...b.raw.chapters.flatMap((c) => c.photos.map((p) => p.mediaId)), ...b.raw.film.map((x) => x.mediaId)].filter(Boolean);
        for (const id of photoIds) expect(Object.keys(b.photos)).toContain(id.trim());
        const voiceIds = [...b.raw.chapters.flatMap((c) => c.voices.map((v) => v.voiceId)), ...b.raw.film.map((x) => x.voiceId)].filter(Boolean);
        for (const id of voiceIds) expect(Object.keys(b.voices)).toContain(id.trim());
        for (const p of Object.values(b.photos)) expect(p.date <= b.asOf).toBe(true);
      });

      it("気がかりの記録を書かない・体の良し悪しを言わない", () => {
        for (const w of WORRIES) expect(text).not.toContain(w);
        expect(text).not.toMatch(/正常|異常|発達が(早|遅)/);
      });

      it("作った家族の呼び名だけ（ひなた・美咲・翔太）", () => {
        expect(text).toContain("ひなた");
      });
    });
  }
});
