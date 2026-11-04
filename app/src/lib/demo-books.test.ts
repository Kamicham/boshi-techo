// 見本の家族に同梱した一冊（demo-books.json。Claude が書いた答え）が、一冊の決まりを満たすか
import { describe, expect, it } from "vitest";
import { addDays } from "./clock";
import { DEMO_FAMILY } from "./demo-family";
import { PERIODS } from "./media-shared";
import seeds from "./demo-books.json";

type Seed = {
  asOf: string;
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

  it("妊娠30週・生後2か月・2歳の3冊がある", () => {
    expect(BOOKS.map((b) => b.asOf)).toEqual([addDays(lmp, 30 * 7), addDays(birth, 61), addDays(birth, 731)]);
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
