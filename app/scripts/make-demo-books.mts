// 見本の家族（すべて作った家族）の一冊を書き、src/lib/demo-books.json に入れる（lib/demo-book.ts が読む）。
// 置き場は渡した BOSHI_DATA_DIR（空の置き場で。わが家の app/data には触らない）。鍵は命令の引数に書かず、環境で渡す。
// ① Claude（API）に、本番と同じ作り方で書かせる（妊娠30週・生後2か月・2歳の3冊。2026-11-04）:
//   BOSHI_DATA_DIR=<空の置き場> NODE_OPTIONS=--conditions=react-server npx tsx scripts/make-demo-books.mts [w30 m2 y1 y2]
// ② API を呼ばずに、書き手が書く（1歳の一冊・2026-11-05。ハッカソン中は API を使わない決まり。書いたのはこの台本を回した Claude Code）:
//   1) BOSHI_DATA_DIR=<空の置き場> NODE_OPTIONS=--conditions=react-server npx tsx scripts/make-demo-books.mts --input y1 <作業の置き場>
//      → <作業の置き場>/y1-input.md（本番で Claude に渡すのと同じ、書き方の決まりと記録・写真と声の候補の文）と y1-keys.json（番号の控え）
//   2) 書き手が <作業の置き場>/y1-answer.json に答えを書く（一冊の型 BookSchema。本番の Claude の答えと同じ形）
//   3) BOSHI_DATA_DIR=<同じ置き場> NODE_OPTIONS=--conditions=react-server npx tsx scripts/make-demo-books.mts --put y1 <作業の置き場> --writer "<書いた者>"
//      → 型・時期の名前・写真と声の番号・出来事の日付（渡した記録の日付だけ）を確かめ、書いた者を種の writer に正直に残して入れる
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
nextEnv.loadEnvConfig(process.env.ENV_DIR ?? APP);
if (!process.env.BOSHI_DATA_DIR) throw new Error("BOSHI_DATA_DIR を指定してください（空の置き場）");
process.env.BOSHI_ACCOUNTS ??= "1";

const args = process.argv.slice(2);
const mode = args[0] === "--input" ? "input" : args[0] === "--put" ? "put" : "api";
if (mode === "api" && !process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY が要ります（環境で渡す）。API を呼ばずに書く時は --input と --put");

const { DEMO_FAMILY } = await import("../src/lib/demo-family");
const { addDays, addMonths } = await import("../src/lib/clock");

const f = DEMO_FAMILY;
const birth = f.birthDate!;
const lmp = addDays(f.dueDate, -280);
// 見本の時期（components/today/stages.ts の demoStages と同じ日）
const STAGES: Record<string, string> = { w30: addDays(lmp, 30 * 7), m2: addDays(birth, 61), y1: addMonths(birth, 12), y2: addDays(birth, 731) };

const OUT = path.join(APP, "src/lib/demo-books.json");
type PhotoNote = { date: string; caption?: string };
type VoiceNote = { date: string; title: string };
type Seed = { asOf: string; generatedAt: string; writer?: string; sourceCount: number; raw: unknown; photos: Record<string, PhotoNote>; voices: Record<string, VoiceNote> };
/** 同じ日の種は置き換え、日付の順に書く */
function save(seed: Seed) {
  const books: Seed[] = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const i = books.findIndex((b) => b.asOf === seed.asOf);
  if (i >= 0) books[i] = seed;
  else books.push(seed);
  books.sort((a, b) => a.asOf.localeCompare(b.asOf));
  fs.writeFileSync(OUT, `${JSON.stringify(books, null, 1)}\n`);
}
function stageOf(k: string | undefined): string {
  const today = k ? STAGES[k] : undefined;
  if (!today) throw new Error(`知らない時期: ${k}（${Object.keys(STAGES).join("・")}）`);
  return today;
}

if (mode === "put") {
  // ② の 3): 書き手の答えを確かめて入れる（置き場の記録は読まない。番号と日付は --input の控えから）
  const [, k, work] = args;
  const w = args.indexOf("--writer");
  const writer = w > 0 ? args[w + 1]?.trim() : "";
  if (!work || !writer) throw new Error('使い方: --put y1 <作業の置き場> --writer "<書いた者>"');
  const today = stageOf(k);
  const { BookSchema } = await import("../src/lib/book");
  const { PERIODS } = await import("../src/lib/media-shared");
  const keys = JSON.parse(fs.readFileSync(path.join(work, `${k}-keys.json`), "utf8")) as { asOf: string; sourceCount: number; entryDates: string[]; photos: Record<string, PhotoNote>; voices: Record<string, VoiceNote> };
  if (keys.asOf !== today) throw new Error(`控えの日（${keys.asOf}）と時期の日（${today}）が違います`);
  const raw = BookSchema.parse(JSON.parse(fs.readFileSync(path.join(work, `${k}-answer.json`), "utf8")));
  const bad: string[] = [];
  const dates = new Set(keys.entryDates);
  const photoIds = [raw.cover, ...raw.chapters.flatMap((c) => c.photos.map((p) => p.mediaId)), ...raw.film.map((x) => x.mediaId)].filter(Boolean);
  const voiceIds = [...raw.chapters.flatMap((c) => c.voices.map((v) => v.voiceId)), ...raw.film.map((x) => x.voiceId)].filter(Boolean);
  for (const id of photoIds) if (!keys.photos[id]) bad.push(`写真の番号 ${id} は候補に無い`);
  for (const id of voiceIds) if (!keys.voices[id]) bad.push(`声の番号 ${id} は候補に無い`);
  for (const c of raw.chapters) {
    if (!(PERIODS as readonly string[]).includes(c.period)) bad.push(`時期の名前「${c.period}」は決まった物でない`);
    for (const m of c.moments) if (!dates.has(m.date)) bad.push(`出来事の日付 ${m.date} は渡した記録に無い`);
  }
  if (bad.length) throw new Error(`入れませんでした:\n- ${bad.join("\n- ")}`);
  save({ asOf: today, generatedAt: new Date().toISOString(), writer, sourceCount: keys.sourceCount, raw, photos: keys.photos, voices: keys.voices });
  console.log(`${k} ${today}: 書いた者「${writer}」・章 ${raw.chapters.length}「${raw.title}」を demo-books.json に入れました`);
} else {
  const { seedDemo } = await import("../src/lib/capture");
  const { seedDemoMedia } = await import("../src/lib/demo-media");
  const { withHousehold } = await import("../src/lib/access");
  const ctx = await withHousehold(new Request("http://local/"), f.id, "media:write");
  seedDemo(f.id);
  console.log(`写真と声を入れました: ${await seedDemoMedia(ctx)}`);

  if (mode === "input") {
    // ② の 1): 本番で Claude に渡すのと同じ文を書き出す（lib/book.ts の draftBook と同じ集め方・同じ番号）
    const [, k, work] = args;
    if (!work) throw new Error("使い方: --input y1 <作業の置き場>");
    const today = stageOf(k);
    const { BOOK_WRITING, bookInput, gather, photoKeys, voiceKeys } = await import("../src/lib/book");
    const { bookPhotoCandidates, bookVoiceCandidates } = await import("../src/lib/media");
    const entries = gather(f.id, today, f);
    const pkeys = photoKeys(bookPhotoCandidates(f, today));
    const vkeys = voiceKeys(bookVoiceCandidates(f, today));
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(path.join(work, `${k}-input.md`), `# 書き方の決まり（lib/book.ts の SYSTEM）\n\n${BOOK_WRITING}\n\n# 渡す文（lib/book.ts の bookInput）\n\n${bookInput(f, today, entries, pkeys, vkeys)}\n`);
    fs.writeFileSync(
      path.join(work, `${k}-keys.json`),
      `${JSON.stringify(
        {
          asOf: today,
          sourceCount: entries.length,
          entryDates: [...new Set(entries.map((e) => e.date))],
          photos: Object.fromEntries(pkeys.map((x) => [x.key, { date: x.photo.date, ...(x.photo.caption ? { caption: x.photo.caption } : {}) }])),
          voices: Object.fromEntries(vkeys.map((x) => [x.key, { date: x.voice.date, title: x.voice.title }])),
        },
        null,
        1,
      )}\n`,
    );
    console.log(`${k} ${today}: 記録 ${entries.length} 件・写真 ${pkeys.length}・声 ${vkeys.length} を ${work} に書き出しました（API は呼んでいません）`);
  } else {
    const { draftBook } = await import("../src/lib/book");
    const { sendingAs } = await import("../src/lib/claude");
    const want = args.length ? args : ["w30", "m2", "y2"];
    for (const k of want) {
      const today = stageOf(k);
      const t0 = Date.now();
      const { raw, keys, vkeys, entries } = await sendingAs({ householdId: f.id, kind: "demo", accountId: null, subjectIds: [] }, () => draftBook(f, today));
      save({
        asOf: today,
        generatedAt: new Date().toISOString(),
        sourceCount: entries.length,
        raw,
        photos: Object.fromEntries(keys.map((x) => [x.key, { date: x.photo.date, ...(x.photo.caption ? { caption: x.photo.caption } : {}) }])),
        voices: Object.fromEntries(vkeys.map((x) => [x.key, { date: x.voice.date, title: x.voice.title }])),
      });
      console.log(`${k} ${today}: 記録 ${entries.length} 件・写真 ${keys.length}・声 ${vkeys.length} → 章 ${raw.chapters.length}「${raw.title}」（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
    }
  }
}
