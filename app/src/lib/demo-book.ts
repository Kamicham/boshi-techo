// 見本の家族の一冊（2026-11-04・UX「見本の一冊を本物にする」）。
// 見本の家族（すべて作った家族）の記録から、本番と同じ作り方で Claude に実際に書かせた一冊を、リポジトリに入れて持たせる。
// 審査の人・公開版で初めて開いた人が、鍵を作る前でも「子どもへの本になる」ことを一目で見られるように。
// - 書いたのは scripts/make-demo-books.mts（妊娠30週・生後2か月・2歳の3冊）。中身は demo-books.json
// - 写真と声は、Claude が選んだ番号（P1・V1）と、その番号の写真の日付・一言（声は日付・題）で持つ。
//   写真の id は世帯ごとに違う（公開版の写しも）ので、読む時に今の候補から同じ日付・一言の物を探して結び直す
// - 見本の家族（demo）だけ。家族が作り直した一冊があれば、そちらが先（latestBook）
import "server-only";
import { conceptionDate, secondBirthday } from "./clock";
import type { Family } from "./demo-family";
import { getFamily, madeFamilyKind } from "./family";
import { BOOK_RULES, gather, settlePhotos, settleVoices, type Book, type BookContent, type PhotoKey, type VoiceKey } from "./book";
import { bookPhotoCandidates, bookVoiceCandidates } from "./media";
import seeds from "./demo-books.json";

export interface DemoBookSeed {
  /** この日までの記録で書いた */
  asOf: string;
  /** Claude が書いた時 */
  generatedAt: string;
  /** 使った記録の数 */
  sourceCount: number;
  /** Claude の答え（写真と声は番号のまま） */
  raw: BookContent;
  /** 番号 → 写真の日付と一言 */
  photos: Record<string, { date: string; caption?: string }>;
  /** 番号 → 声の日付と題 */
  voices: Record<string, { date: string; title: string }>;
}

export const DEMO_BOOKS = seeds as unknown as DemoBookSeed[];

/** その日までに書けた、一番新しい見本の一冊の種 */
export function demoBookSeed(today: string): DemoBookSeed | null {
  return [...DEMO_BOOKS].filter((b) => b.asOf <= today).sort((a, b) => b.asOf.localeCompare(a.asOf))[0] ?? null;
}

/** 見本の家族の一冊（見本の家族でない・記録がまだ無い・その日までの種が無い時は null） */
export function demoBook(family: Family | string, today: string): Book | null {
  const id = typeof family === "string" ? family : family.id;
  if (madeFamilyKind(id) !== "demo") return null;
  const f = typeof family === "string" ? getFamily(id) : family;
  if (!f) return null;
  const seed = demoBookSeed(today);
  if (!seed) return null;
  // 記録をまだ入れていない見本は、「作った記録を入れる」から（記録の無い一冊は出さない）
  if (gather(id, today, f).length === 0) return null;

  const photos = bookPhotoCandidates(f, seed.asOf);
  const keys: PhotoKey[] = Object.entries(seed.photos).flatMap(([key, p]) => {
    const hit = photos.find((c) => c.date === p.date && (c.caption ?? "") === (p.caption ?? ""));
    return hit ? [{ key, photo: hit }] : [];
  });
  const voices = bookVoiceCandidates(f, seed.asOf);
  const vkeys: VoiceKey[] = Object.entries(seed.voices).flatMap(([key, v]) => {
    const hit = voices.find((c) => c.date === v.date && c.title === v.title);
    return hit ? [{ key, voice: hit }] : [];
  });
  const content = settleVoices(settlePhotos(seed.raw, keys), keys, vkeys);
  return {
    ...content,
    familyId: id,
    asOf: seed.asOf,
    generatedAt: seed.generatedAt,
    sourceCount: seed.sourceCount,
    photoCount: Object.keys(seed.photos).length,
    voiceCount: Object.keys(seed.voices).length,
    range: { start: conceptionDate(f), end: secondBirthday(f) },
    childName: f.childName ?? "あなた",
    rules: BOOK_RULES,
    bundled: true,
  };
}
