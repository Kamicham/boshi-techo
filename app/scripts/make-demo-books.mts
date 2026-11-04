// 見本の家族（すべて作った家族）の一冊を、本番と同じ作り方で Claude に書かせ、src/lib/demo-books.json に入れる（lib/demo-book.ts が読む）。
// 置き場は渡した BOSHI_DATA_DIR（空の置き場で。わが家の app/data には触らない）。鍵は命令の引数に書かず、環境で渡す。
//   BOSHI_DATA_DIR=<空の置き場> NODE_OPTIONS=--conditions=react-server npx tsx scripts/make-demo-books.mts [w30 m2 y2]
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
nextEnv.loadEnvConfig(process.env.ENV_DIR ?? APP);
if (!process.env.BOSHI_DATA_DIR) throw new Error("BOSHI_DATA_DIR を指定してください（空の置き場）");
if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY が要ります（環境で渡す）");
process.env.BOSHI_ACCOUNTS ??= "1";

const { DEMO_FAMILY } = await import("../src/lib/demo-family");
const { addDays } = await import("../src/lib/clock");
const { seedDemo } = await import("../src/lib/capture");
const { seedDemoMedia } = await import("../src/lib/demo-media");
const { withHousehold } = await import("../src/lib/access");
const { draftBook } = await import("../src/lib/book");
const { sendingAs } = await import("../src/lib/claude");

const f = DEMO_FAMILY;
const birth = f.birthDate!;
const lmp = addDays(f.dueDate, -280);
// 見本の時期（components/today/StagePicker.tsx の demoStages と同じ日）
const STAGES: Record<string, string> = { w30: addDays(lmp, 30 * 7), m2: addDays(birth, 61), y2: addDays(birth, 731) };
const want = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(STAGES);

const ctx = await withHousehold(new Request("http://local/"), f.id, "media:write");
seedDemo(f.id);
console.log(`写真と声を入れました: ${await seedDemoMedia(ctx)}`);

const OUT = path.join(APP, "src/lib/demo-books.json");
const books: { asOf: string }[] = JSON.parse(fs.readFileSync(OUT, "utf8"));
for (const k of want) {
  const today = STAGES[k];
  if (!today) throw new Error(`知らない時期: ${k}`);
  const t0 = Date.now();
  const { raw, keys, vkeys, entries } = await sendingAs({ householdId: f.id, kind: "demo", accountId: null, subjectIds: [] }, () => draftBook(f, today));
  const seed = {
    asOf: today,
    generatedAt: new Date().toISOString(),
    sourceCount: entries.length,
    raw,
    photos: Object.fromEntries(keys.map((x) => [x.key, { date: x.photo.date, ...(x.photo.caption ? { caption: x.photo.caption } : {}) }])),
    voices: Object.fromEntries(vkeys.map((x) => [x.key, { date: x.voice.date, title: x.voice.title }])),
  };
  const i = books.findIndex((b) => b.asOf === today);
  if (i >= 0) books[i] = seed;
  else books.push(seed);
  books.sort((a, b) => a.asOf.localeCompare(b.asOf));
  fs.writeFileSync(OUT, `${JSON.stringify(books, null, 1)}\n`);
  console.log(`${k} ${today}: 記録 ${entries.length} 件・写真 ${keys.length}・声 ${vkeys.length} → 章 ${raw.chapters.length}「${raw.title}」（${((Date.now() - t0) / 1000).toFixed(0)}秒）`);
}
