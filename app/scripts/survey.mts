// アンケート（社長の指示 2026-11-03）: 修正を重ねた後に1回、作った家族たちに「何が不便か・どこが使いづらいか・欲しい機能は何か」を聞く。
//   答えるのは2つ:
//   - 現実の割合から作った1000組（population.ts）。1000日の間にアプリで見た物（日記 = 早送りの検査と同じ関数。sim/out/diary.json）を元に、本人として答える
//   - 画面を実際に触った家族（なりきりの Workflow の journal.jsonl）。押した記録（着いたか・詰まった所）を元に答える
//   答えを束ね、全国に直し（1組 = 年に約671家族）、前回と比べて、報告の HTML を書く。どれも作った家族の声（近似）。
//
//   使い方（.claude/skills/survey/SKILL.md が呼ぶ）:
//     npm run survey -- [--touched <journal.jsonl> ...] [--limit 50] [--model sonnet|opus] [--resume <dir>]
//   費用は lib/spend.ts に記録し、BOSHI_SIM_BUDGET_USD（既定 $50）を超えたら止まる。わが家（app/data）と本番には触らない。
import fs from "node:fs";
import path from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import nextEnv from "@next/env";
import { z } from "zod";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
nextEnv.loadEnvConfig(APP);
process.env.BOSHI_DATA_DIR = path.join(APP, "sim-data");
process.env.BOSHI_SIM_BUDGET_USD ??= "50";

const { checkBudget, recordSpend } = await import("../src/lib/spend");
const { getPopulation } = await import("../src/sim/population");
const { PER_FAMILY } = await import("../src/sim/stats");
type PopFamily = ReturnType<typeof getPopulation>[number];

// ───────── 引数 ─────────
const argv = process.argv.slice(2);
const opt = (k: string) => {
  const i = argv.indexOf(k);
  return i >= 0 ? argv[i + 1] : undefined;
};
const touchedFiles: string[] = [];
argv.forEach((a, i) => a === "--touched" && argv[i + 1] && touchedFiles.push(argv[i + 1]));
const LIMIT = Number(opt("--limit") ?? 1000);
const MODELS: Record<string, string> = { sonnet: "claude-sonnet-5-5", opus: "claude-opus-5-5" };
const ANSWER_MODEL = MODELS[opt("--model") ?? "sonnet"] ?? MODELS.sonnet;
const TOUCHED_MODEL = MODELS.opus;
const JUDGE_MODEL = MODELS.opus;
const CONCURRENCY = Number(opt("--concurrency") ?? 12);

const SURVEY_ROOT = path.join(APP, "sim", "out", "survey");
const stamp = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 16).replace(/[-:T]/g, "").replace(/^(\d{8})/, "$1-");
const DIR = opt("--resume") ?? path.join(SURVEY_ROOT, stamp);
fs.mkdirSync(path.join(DIR, "answers"), { recursive: true });

// ───────── 質問 ─────────
const SUS = [
  "このアプリを、これからもよく使いたいと思う",
  "このアプリは、必要以上に複雑だと思う",
  "このアプリは使いやすいと思う",
  "このアプリを使うには、詳しい人に助けてもらう必要があると思う",
  "このアプリのいろいろな機能は、よくまとまっていると思う",
  "このアプリには、ちぐはぐな所が多いと思う",
  "たいていの人は、このアプリをすぐに使えるようになると思う",
  "このアプリはとても扱いにくいと思う",
  "このアプリを、自信を持って使えた",
  "使い始める前に、たくさんの事を覚える必要があった",
] as const;
const TOOLS = ["紙の母子手帳", "町（自治体）の母子手帳アプリ", "ほかの妊娠・育児アプリ", "LINE・メッセージ", "カレンダー", "メモ・ノート", "家族・友だちに聞く", "ネットで調べる", "特に無い"] as const;

const Item = z.object({
  text: z.string().describe("本人の言葉で1〜2文。具体的に（どの画面・何が出た・何に困った）"),
  when: z.string().describe("いつ頃か（例: 妊娠13週ごろ・生後10日・1歳半）。見ていない時は「—」"),
  severity: z.enum(["重", "中", "軽"]),
});
const AnswerSchema = z.object({
  q1_worst: Item.describe("一番不便だった事"),
  q2_hard: z.array(Item).describe("使いづらかった所・分からなかった言葉（3つまで）"),
  q3_mismatch: z.array(Item).describe("自分の家族に合っていないと感じた事（3つまで。無ければ空）"),
  q4_wants: z.array(z.object({ text: z.string().describe("欲しい機能を本人の言葉で"), why: z.string().describe("なぜ欲しいか（自分の状況から）") })),
  q5_good: z.array(z.string()).describe("助かった事（2つまで）"),
  q6_sus: z.array(z.number().int()).describe("使いやすさの10問（ちょうど10個）。1=まったくそう思わない〜5=とてもそう思う"),
  q7_recommend: z.number().int().describe("友だちに勧めたいか 0〜10"),
  q8_tools: z.array(z.string()).describe(`このアプリと一緒に使っていた物（次から選ぶ: ${TOOLS.join("・")}）`),
  q9_continue: z.enum(["使い続ける", "たぶん使い続ける", "たぶんやめる", "やめた"]),
  q9_why: z.string().describe("使い続ける／やめる理由と、やめるならいつ頃か（一言）"),
});
type Answer = z.infer<typeof AnswerSchema>;
/** 形を緩めて受け取り、ここで整える（数の上限・範囲・選びの外れで落とさない） */
function tidy(a: Answer): Answer {
  const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));
  const sus = a.q6_sus.slice(0, 10).map((n) => clamp(n, 1, 5));
  while (sus.length < 10) sus.push(3);
  return {
    ...a,
    q2_hard: a.q2_hard.slice(0, 3),
    q3_mismatch: a.q3_mismatch.slice(0, 3),
    q4_wants: a.q4_wants.slice(0, 3),
    q5_good: a.q5_good.slice(0, 2),
    q6_sus: sus,
    q7_recommend: clamp(a.q7_recommend, 0, 10),
    q8_tools: a.q8_tools.filter((t): t is (typeof TOOLS)[number] => (TOOLS as readonly string[]).includes(t)),
  };
}

// アプリの画面の説明（答える人が「あった機能・無かった機能」を取り違えないように）
const APP_GUIDE = `このアプリ「母子手帳を、再発明する」（試作）の画面:
- 今日: 開くと「あなたの今やる1つ」が一番上に大きく出る（届出・健診・職場への連絡など、期限と担当つき）。下に「このあと」「まだ先」「済んだ事」。押すと「なぜ？（根拠の法律・目安）」「どこへ行くか見る（町の窓口と持ち物を、公式ページから調べて出す）」「下書き（職場へのメール・家族への LINE）」「カレンダーに入れる」「済んだ」。
- 参謀の気づき: 予定より早く生まれた・パートナーの手続きが止まっている・町が変わった・祖父母が来る、の時に今日の画面の一番上に「気づいた事」として出て、組み直し案と渡せる文面を出す。
- 健診: ママの妊婦健診の日を入れ、聞きたい事を書き、健診の会話を録音して3行にまとめる。
- 話す・撮る: 気になった事を声や写真で残す。
- 家族: 家族の一人ずつの今週と負担の割合。「考える」で分担の組み替え案。
- 一冊: 1000日の記録を一冊にまとめる。
- 設定: 予定日・住む町・家族（母・パートナー・祖父母）の名前と呼び名。
- 体の判断はしない（数値の良し悪しを言わない。急ぎの時は産院・119・#8000 を案内）。`;

const ANSWER_SYSTEM = `あなたは、日本で子を迎える家族の一人になりきって、アプリの利用者アンケートに答えます。家族は作った家族ですが、状況は日本の公的な統計の割合から作られています。

${APP_GUIDE}

答え方:
- その人の年齢・何人目・仕事・住む所・里帰り・国籍・日本語の力・家族の形の立場から、本人の言葉で答える。日本語に不安がある人は、やさしい言葉で短く。
- 根拠は、渡す「日記」（その人が1000日の間に、このアプリの今日の画面で見た物の記録）と、上の画面の説明だけ。日記に無い事を見た事にしない。見ていない画面の事は「見ていない」と書く。
- この家族は、アプリの一番上に出た事を、出た順にこなした（済んだを押した）とする。
- 遠慮しない。実際の利用者は、合わない・役に立たない物にははっきり不満を言い、すぐやめる。良かった事も、本当に助かった事だけを書く。お世辞は書かない。
- 現実の暮らしに照らす（例: 仕事が無いのに職場の手続きが出る、里帰り先の町の事が出ない、上の子の事が無い、生まれた後に妊娠中の事が残る、など）。アプリの作り手が気づいていない事こそ書く。
- 体や病気の相談はアンケートの対象外。`;

function profileText(f: PopFamily): string {
  const p = f.profile;
  const me = f.members.find((m) => m.id === f.persona.meId);
  const lines = [
    `答える人: ${f.persona.who}（日本語・スマホ: ${f.persona.literacy}）`,
    `家族の要約: ${f.persona.label.replace(/^[^・]*・/, "")}`,
    `家族: ${f.members.map((m) => `${m.name}（${m.role}）${m.voice ? `: ${m.voice}` : ""}`).join(" ／ ")}`,
    `住む所: ${f.prefecture}${f.city}（${p.placeType}）${p.move ? `。引っ越し: ${p.move.kind}（${p.move.on}、${p.move.fromPrefecture}${p.move.from}から）` : ""}`,
    `何人目: ${p.order}${p.olderChildrenMonths.length ? `（上の子 ${p.olderChildrenMonths.map((m) => `${Math.floor(m / 12)}歳${m % 12}か月`).join("・")}差）` : ""}${p.twins ? "・双子" : ""}`,
    `出産: ${p.weeks}週・${p.weights.map((g) => `${g}g`).join("と")}${p.nicu ? "・NICU に入院" : ""}${p.cesarean ? "・帝王切開" : ""}${p.art ? "・体外受精など" : ""}`,
    `母の仕事: 妊娠時 ${p.motherWork.atPregnancy} → 産後 ${p.motherWork.after}${p.motherWork.leaveDays ? `（育休 約${Math.round(p.motherWork.leaveDays / 30.4)}か月）` : ""}`,
    p.father ? `パートナーの仕事: ${p.father.work}${p.father.nightShift ? "・夜勤あり" : ""}${p.father.tanshin ? "・単身赴任" : ""}${p.father.leave ? `・育休 ${p.father.leave.days}日${p.father.leave.papa ? "（産後パパ育休）" : ""}` : "・育休なし"}` : `パートナー: いない（${p.marital}）`,
    `祖父母: 母方 ${p.grandma.mother}${p.grandma.father ? `・父方 ${p.grandma.father}` : ""}`,
    `里帰り出産: ${p.satogaeri ? `${p.satogaeri.kind}（${p.satogaeri.prefecture}${p.satogaeri.city}）` : "しない"}`,
    `国籍: ${p.nationality.kind}${p.japaneseAnxious.mother || p.japaneseAnxious.father ? `・日本語に不安（${[p.japaneseAnxious.mother ? "母" : "", p.japaneseAnxious.father ? "パートナー" : ""].filter(Boolean).join("・")}）` : ""}`,
    p.hearing ? `耳が聞こえにくい: ${p.hearing}` : "",
    `答える人の役: ${me?.role ?? "母"}`,
  ];
  return lines.filter(Boolean).join("\n");
}

// ───────── Claude ─────────
const client = new Anthropic({ maxRetries: 8 });

async function ask<S extends z.ZodType>(model: string, schema: S, system: string, content: string, kind: string, maxTokens = 8000): Promise<z.infer<S>> {
  checkBudget();
  const res = await client.beta.messages.parse({
    model,
    max_tokens: maxTokens,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
    output_config: { format: betaZodOutputFormat(schema), effort: "medium" },
  });
  recordSpend(kind, res.model ?? model, res.usage);
  if (res.parsed_output == null) throw new Error(`答えの形が読めませんでした（${res.stop_reason}）`);
  return res.parsed_output as z.infer<S>;
}

async function pool<T>(items: T[], n: number, fn: (x: T, i: number) => Promise<void>) {
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        await fn(items[i], i);
        done++;
        if (done % 50 === 0 || done === items.length) console.log(`  ${done}/${items.length}`);
      }
    }),
  );
}

// ───────── 1. 1000組が答える ─────────
interface Saved {
  id: string;
  source: "pop" | "touched";
  label: string;
  answer: Answer;
}
const answerPath = (id: string) => path.join(DIR, "answers", `${id}.json`);

const diaryFile = path.join(APP, "sim", "out", "diary.json");
if (!fs.existsSync(diaryFile)) throw new Error("日記がありません。先に SIM_DIARY=1 npx vitest run src/sim/fastforward.test.ts を流してください");
const diaries = JSON.parse(fs.readFileSync(diaryFile, "utf8")) as Record<string, { diary: string[] }>;
const pop = getPopulation().slice(0, LIMIT);

console.log(`1000組のアンケート: ${pop.length}組（${ANSWER_MODEL}・${CONCURRENCY}本ずつ）→ ${DIR}`);
let failed = 0;
await pool(pop, CONCURRENCY, async (f) => {
  if (fs.existsSync(answerPath(f.id))) return;
  const d = diaries[f.id]?.diary ?? [];
  const content = `【あなた】\n${profileText(f)}\n\n【日記: 1000日の間に、今日の画面で見た物（画面が変わった日だけ）】\n${d.join("\n")}\n\nこの1000日を振り返って、アンケートに答えてください。`;
  try {
    const answer = tidy(await ask(ANSWER_MODEL, AnswerSchema, ANSWER_SYSTEM, content, "survey-answer"));
    const saved: Saved = { id: f.id, source: "pop", label: f.persona.label, answer };
    fs.writeFileSync(answerPath(f.id), JSON.stringify(saved));
  } catch (e) {
    failed++;
    console.log(`  ${f.id} 失敗: ${(e as Error).message.slice(0, 120)}`);
    if (/上限|budget/i.test((e as Error).message)) throw e;
  }
});
if (failed) console.log(`  答えられなかった家族: ${failed}組（--resume ${DIR} でもう一度流すと、その家族だけ聞き直す）`);

// ───────── 2. 画面を触った家族が答える ─────────
interface Touched {
  family: string;
  label: string;
  goals: { want: string; reached: boolean; taps: number; note?: string }[];
  findings: { level: string; screen: string; what: string; why?: string }[];
  good: string[];
}
const touched: Touched[] = [];
for (const file of touchedFiles) {
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      const j = JSON.parse(line);
      let v = j.type === "result" ? (j.value ?? j.result) : null;
      if (typeof v === "string") v = JSON.parse(v);
      if (v && Array.isArray(v.findings) && v.family) touched.push(v);
    } catch {}
  }
}
if (touched.length) {
  console.log(`画面を触った家族: ${touched.length}家族（${TOUCHED_MODEL}）`);
  await pool(touched, 4, async (t) => {
    const id = `touched-${t.family}`;
    if (fs.existsSync(answerPath(id))) return;
    const popF = getPopulation().find((f) => f.id === t.family);
    const content = `【あなた】\n${popF ? profileText(popF) : t.label}\n\n【あなたが実際にアプリの画面を触った記録（iPhone の大きさ）】\n目的:\n${t.goals.map((g) => `- ${g.want} → ${g.reached ? "着いた" : "着けなかった"}（${g.taps}回押した）${g.note ? `: ${g.note}` : ""}`).join("\n")}\n困った事:\n${t.findings.map((x) => `- [${x.level}] ${x.screen}: ${x.what}`).join("\n")}\n良かった事:\n${t.good.map((g) => `- ${g}`).join("\n")}\n\n実際に触った人として、アンケートに答えてください（日記の代わりに、この記録が根拠）。`;
    const answer = tidy(await ask(TOUCHED_MODEL, AnswerSchema, ANSWER_SYSTEM, content, "survey-touched"));
    fs.writeFileSync(answerPath(id), JSON.stringify({ id, source: "touched", label: t.label, answer } satisfies Saved));
  });
}

// ───────── 3. 似た声を束ねる ─────────
const all: Saved[] = fs
  .readdirSync(path.join(DIR, "answers"))
  .filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(fs.readFileSync(path.join(DIR, "answers", f), "utf8")) as Saved);
const popAns = all.filter((a) => a.source === "pop");
const touchedAns = all.filter((a) => a.source === "touched");
if (!popAns.length) throw new Error("答えが1つもありません");

type Kind = "pain" | "want";
interface Voice {
  key: string;
  id: string;
  kind: Kind;
  text: string;
  severity?: string;
}
const voices: Voice[] = [];
for (const a of all) {
  const x = a.answer;
  const pains = [x.q1_worst, ...x.q2_hard, ...x.q3_mismatch];
  pains.forEach((p, i) => voices.push({ key: `${a.id}:p${i}`, id: a.id, kind: "pain", text: p.text, severity: p.severity }));
  x.q4_wants.forEach((w, i) => voices.push({ key: `${a.id}:w${i}`, id: a.id, kind: "want", text: `${w.text}（${w.why}）` }));
}

const prevDir = fs.existsSync(SURVEY_ROOT)
  ? fs
      .readdirSync(SURVEY_ROOT)
      .filter((d) => d !== path.basename(DIR) && fs.existsSync(path.join(SURVEY_ROOT, d, "summary.json")))
      .sort()
      .pop()
  : undefined;
const prev = prevDir ? (JSON.parse(fs.readFileSync(path.join(SURVEY_ROOT, prevDir, "summary.json"), "utf8")) as Summary) : null;

const CatSchema = z.object({
  pain: z.array(z.object({ id: z.string(), name: z.string().describe("短い名前（25字まで）"), desc: z.string() })).max(24),
  want: z.array(z.object({ id: z.string(), name: z.string().describe("短い名前（25字まで）"), desc: z.string() })).max(20),
});
type Cats = z.infer<typeof CatSchema>;

let cats: Cats;
const catsFile = path.join(DIR, "categories.json");
if (fs.existsSync(catsFile)) cats = JSON.parse(fs.readFileSync(catsFile, "utf8"));
else {
  // 束ね方は Opus が全体から作る（多すぎる時は均等に抜き出す）。前回の束があれば、それを引き継いで足りない物だけ足す
  const step = Math.max(1, Math.floor(voices.length / 3000));
  const sample = voices.filter((_, i) => i % step === 0 || voices[i].id.startsWith("touched"));
  const prevText = prev ? `\n\n【前回の束（id と名前はできるだけそのまま使う。合わない物だけ足す・分ける）】\n${JSON.stringify({ pain: prev.pain.map((c) => ({ id: c.id, name: c.name })), want: prev.want.map((c) => ({ id: c.id, name: c.name })) })}` : "";
  console.log(`束ねる: 声 ${voices.length}件から ${sample.length}件を見て、束を作る（${JUDGE_MODEL}）`);
  cats = await ask(
    JUDGE_MODEL,
    CatSchema,
    "アプリの利用者アンケートの自由記述を、作り手が直す順を決められる束に分けます。束は「何が起きているか」で分ける（画面の名前だけで分けない）。pain は不便・使いづらさ・家族に合わない事、want は欲しい機能。id は英小文字とハイフン。",
    `【声】\n${sample.map((v) => `${v.kind}|${v.text}`).join("\n")}${prevText}`,
    "survey-categories",
    16000,
  );
  fs.writeFileSync(catsFile, JSON.stringify(cats, null, 1));
}

const ClassSchema = z.object({ items: z.array(z.object({ key: z.string(), cat: z.string() })) });
const classFile = path.join(DIR, "classes.json");
const classes: Record<string, string> = fs.existsSync(classFile) ? JSON.parse(fs.readFileSync(classFile, "utf8")) : {};
const todo = voices.filter((v) => !classes[v.key]);
const batches: Voice[][] = [];
for (let i = 0; i < todo.length; i += 300) batches.push(todo.slice(i, i + 300));
if (batches.length) console.log(`声を束に振り分ける: ${todo.length}件（${ANSWER_MODEL}・${batches.length}回）`);
const catList = `pain の束:\n${cats.pain.map((c) => `${c.id}: ${c.name} — ${c.desc}`).join("\n")}\n\nwant の束:\n${cats.want.map((c) => `${c.id}: ${c.name} — ${c.desc}`).join("\n")}`;
await pool(batches, 6, async (b) => {
  const r = await ask(
    ANSWER_MODEL,
    ClassSchema,
    `アンケートの声を、決まった束に振り分けます。pain の声は pain の束、want の声は want の束から1つ選ぶ。どれにも合わなければ "other"。すべての key に1つずつ答える。\n\n${catList}`,
    b.map((v) => `${v.key}|${v.kind}|${v.text}`).join("\n"),
    "survey-classify",
    16000,
  );
  for (const it of r.items) classes[it.key] = it.cat;
  fs.writeFileSync(classFile, JSON.stringify(classes));
});

// ───────── 4. 数える・全国に直す・前回と比べる ─────────
interface CatRow {
  id: string;
  name: string;
  desc: string;
  families: number;
  nation: number;
  heavy: number;
  touched: number;
  examples: string[];
  who: string[];
}
interface Summary {
  at: string;
  model: string;
  n: number;
  nTouched: number;
  sus: number;
  nps: number;
  continueRate: number;
  pain: CatRow[];
  want: CatRow[];
  susBy: { group: string; n: number; sus: number; nps: number }[];
  tools: { name: string; n: number }[];
  quit: { why: string; id: string }[];
  good: { text: string; id: string }[];
}

const susOf = (s: number[]) => s.reduce((n, v, i) => n + (i % 2 === 0 ? v - 1 : 5 - v), 0) * 2.5;
const npsOf = (xs: number[]) => Math.round(((xs.filter((x) => x >= 9).length - xs.filter((x) => x <= 6).length) / Math.max(1, xs.length)) * 100);
const avg = (xs: number[]) => Math.round((xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)) * 10) / 10;
const popById = new Map(getPopulation().map((f) => [f.id, f]));

function tagOf(id: string): string[] {
  const f = popById.get(id);
  if (!f) return [];
  const p = f.profile;
  return [
    p.order === "第1子" ? "第1子" : "第2子以降",
    `母: ${p.motherWork.after === "仕事なし" || p.motherWork.after === "退職" ? "仕事なし・退職" : p.motherWork.after === "育休" ? "育休" : "育休なしで働く"}`,
    p.satogaeri ? `里帰り（${p.satogaeri.kind}）` : "里帰りしない",
    p.marital === "ひとり親" ? "ひとり親" : "",
    p.nationality.kind.startsWith("父母とも日本") ? "" : "外国籍の親",
    p.father?.nightShift ? "父が夜勤" : "",
    p.twins ? "双子" : "",
    p.nicu ? "NICU" : "",
    f.persona.meId === "haha" ? "答えた人: 母" : "答えた人: パートナー",
    p.placeType,
  ].filter(Boolean);
}

function rows(kind: Kind): CatRow[] {
  const list = kind === "pain" ? cats.pain : cats.want;
  const out: CatRow[] = [...list, { id: "other", name: "そのほか", desc: "どの束にも入らない声" }].map((c) => {
    const vs = voices.filter((v) => v.kind === kind && (classes[v.key] ?? "other") === c.id);
    const fams = new Set(vs.filter((v) => !v.id.startsWith("touched")).map((v) => v.id));
    const tcount = new Set(vs.filter((v) => v.id.startsWith("touched")).map((v) => v.id)).size;
    const tagCount = new Map<string, number>();
    for (const id of fams) for (const t of tagOf(id)) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
    // 全体より多い層（3割以上・全体の割合の1.5倍以上）
    const base = new Map<string, number>();
    for (const a of popAns) for (const t of tagOf(a.id)) base.set(t, (base.get(t) ?? 0) + 1);
    const who = [...tagCount.entries()]
      .filter(([t, n]) => fams.size >= 5 && n / fams.size >= 0.3 && n / fams.size >= 1.5 * ((base.get(t) ?? 0) / popAns.length))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([t, n]) => `${t} ${Math.round((n / fams.size) * 100)}%`);
    const ex = vs.filter((v) => v.severity !== "軽").slice(0, 40);
    return {
      id: c.id,
      name: c.name,
      desc: c.desc,
      families: fams.size,
      nation: fams.size * PER_FAMILY,
      heavy: new Set(vs.filter((v) => v.severity === "重" && !v.id.startsWith("touched")).map((v) => v.id)).size,
      touched: tcount,
      examples: [ex[0], ex[Math.floor(ex.length / 2)], vs.find((v) => v.id.startsWith("touched"))].filter((v, i, a): v is Voice => !!v && a.indexOf(v) === i).map((v) => `${v.text}（${v.id.replace("touched-", "触った ")}）`),
      who,
    };
  });
  return out.filter((r) => r.families || r.touched).sort((a, b) => b.families - a.families);
}

const groups: Record<string, string[]> = {};
for (const a of popAns) for (const t of ["全体", ...tagOf(a.id)]) (groups[t] ??= []).push(a.id);
const ansById = new Map(all.map((a) => [a.id, a.answer]));
const summary: Summary = {
  at: stamp,
  model: ANSWER_MODEL,
  n: popAns.length,
  nTouched: touchedAns.length,
  sus: avg(popAns.map((a) => susOf(a.answer.q6_sus))),
  nps: npsOf(popAns.map((a) => a.answer.q7_recommend)),
  continueRate: Math.round((popAns.filter((a) => a.answer.q9_continue.includes("使い続ける")).length / popAns.length) * 100),
  pain: rows("pain"),
  want: rows("want"),
  susBy: Object.entries(groups)
    .filter(([, ids]) => ids.length >= 10)
    .map(([group, ids]) => ({ group, n: ids.length, sus: avg(ids.map((id) => susOf(ansById.get(id)!.q6_sus))), nps: npsOf(ids.map((id) => ansById.get(id)!.q7_recommend)) }))
    .sort((a, b) => a.sus - b.sus),
  tools: TOOLS.map((name) => ({ name, n: popAns.filter((a) => (a.answer.q8_tools as string[]).includes(name)).length })).sort((a, b) => b.n - a.n),
  quit: popAns.filter((a) => a.answer.q9_continue.includes("やめ")).slice(0, 12).map((a) => ({ id: a.id, why: a.answer.q9_why })),
  good: all.flatMap((a) => a.answer.q5_good.map((text) => ({ text, id: a.id }))).filter((_, i) => i % 37 === 0).slice(0, 10),
};
fs.writeFileSync(path.join(DIR, "summary.json"), JSON.stringify(summary, null, 1));

// ───────── 5. 報告の HTML ─────────
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const nat = (n: number) => (n >= 10000 ? `約${(n / 10000).toFixed(1)}万` : `約${n.toLocaleString("ja-JP")}`);
const delta = (cur: number, before: number | undefined, unit = "", better: "up" | "down" = "up") => {
  if (before == null) return "";
  const d = Math.round((cur - before) * 10) / 10;
  if (!d) return `<small>（前回と同じ）</small>`;
  const good = better === "up" ? d > 0 : d < 0;
  return `<small class="${good ? "good" : "bad"}">（前回 ${before}${unit} → ${d > 0 ? "+" : ""}${d}）</small>`;
};
const prevRow = (kind: Kind, id: string) => prev?.[kind].find((r) => r.id === id);
const catTable = (kind: Kind, rs: CatRow[]) =>
  `<table><tr><th>声</th><th>1000組</th><th>全国（年）</th></tr>${rs
    .slice(0, 12)
    .map((r) => {
      const p = prevRow(kind, r.id);
      return `<tr><td><b>${esc(r.name)}</b>${r.touched ? ` <span class="tag">触った ${r.touched}</span>` : ""}<br><small>${esc(r.desc)}</small>${r.who.length ? `<br><small>多い層: ${esc(r.who.join("・"))}</small>` : ""}${r.examples.map((e) => `<div class="voice">「${esc(e)}」</div>`).join("")}</td><td>${r.families}${kind === "pain" && r.heavy ? `<br><small>うち重 ${r.heavy}</small>` : ""}${p ? `<br>${delta(r.families, p.families, "", kind === "pain" ? "down" : "up")}` : prev ? "<br><small>新しい束</small>" : ""}</td><td>${nat(r.nation)}</td></tr>`;
    })
    .join("")}</table>`;

const html = `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>家族アンケート</title>
<style>
:root{--bg:#f7f4ef;--card:#fff;--fg:#151515;--sub:#3a3a3a;--line:#ddd5c8;--accent:#a8432a;--soft:#f6e1d8;--teal:#1e5e5a;--tsoft:#dcece9;--good:#1e6b3a;--bad:#b0302a}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#141312;--card:#1e1c1a;--fg:#f6f4f1;--sub:#d9d4cc;--line:#3b3732;--accent:#ff9070;--soft:#3b231b;--teal:#7fd3c9;--tsoft:#16302d;--good:#7fd39a;--bad:#ff8a80}}
:root[data-theme="dark"]{--bg:#141312;--card:#1e1c1a;--fg:#f6f4f1;--sub:#d9d4cc;--line:#3b3732;--accent:#ff9070;--soft:#3b231b;--teal:#7fd3c9;--tsoft:#16302d;--good:#7fd39a;--bad:#ff8a80}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.75 "Hiragino Sans",system-ui,sans-serif;padding:20px 16px 48px}
main{max-width:760px;margin:0 auto;display:flex;flex-direction:column;gap:22px}h1{font-size:1.5rem;margin:0;line-height:1.4}h2{font-size:1.15rem;margin:0}
p{margin:0;color:var(--sub)}b{color:var(--fg)}section{display:flex;flex-direction:column;gap:10px}
.box{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:13px 14px;display:flex;flex-direction:column;gap:5px}.hero{background:var(--soft);border:2px solid var(--accent)}
.kpi{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.kpi .box b{font-size:1.6rem}@media(max-width:560px){.kpi{grid-template-columns:1fr}}
table{width:100%;border-collapse:collapse;font-size:.88rem}td,th{border-bottom:1px solid var(--line);padding:7px 4px;text-align:left;vertical-align:top}th{color:var(--sub)}
.voice{font-size:.82rem;color:var(--sub);margin-top:3px}.tag{font-size:.72rem;font-weight:800;padding:0 8px;border-radius:999px;background:var(--teal);color:var(--bg)}
small{color:var(--sub)}.good{color:var(--good)}.bad{color:var(--bad)}
</style></head><body><main>
<header><small>母子手帳 ／ 作った家族の声（近似）・${esc(stamp)}</small><h1>家族アンケート</h1></header>
<div class="box hero"><p>現実の統計の割合から作った<b>${summary.n}組</b>が、1000日の間にアプリで見た物を元に答えました（${esc(ANSWER_MODEL)}）。画面を実際に触った<b>${summary.nTouched}家族</b>（${esc(TOUCHED_MODEL)}）の声は「触った」の印で分けています。1組 = 年に約${PER_FAMILY}家族として全国に直しています。${prev ? `前回（${esc(prev.at)}）と比べています。` : "今回が1回目です（次から前回と比べます）。"}</p></div>
<div class="kpi">
<div class="box"><small>使いやすさ（SUS・平均68）</small><b>${summary.sus}</b>${delta(summary.sus, prev?.sus)}</div>
<div class="box"><small>勧めたい度（NPS・−100〜100）</small><b>${summary.nps}</b>${delta(summary.nps, prev?.nps)}</div>
<div class="box"><small>使い続ける</small><b>${summary.continueRate}%</b>${delta(summary.continueRate, prev?.continueRate, "%")}</div>
</div>
<section><h2>不便・使いづらい・家族に合わない（多い順）</h2>${catTable("pain", summary.pain)}</section>
<section><h2>欲しい機能（多い順）</h2>${catTable("want", summary.want)}</section>
<section><h2>使いやすさの低い層</h2><table><tr><th>層</th><th>人数</th><th>SUS</th><th>NPS</th></tr>${summary.susBy
  .slice(0, 12)
  .map((g) => `<tr><td>${esc(g.group)}</td><td>${g.n}</td><td>${g.sus}${delta(g.sus, prev?.susBy.find((x) => x.group === g.group)?.sus)}</td><td>${g.nps}</td></tr>`)
  .join("")}</table></section>
<section><h2>一緒に使っていた物</h2><div class="box"><p>${summary.tools.map((t) => `${esc(t.name)} ${Math.round((t.n / summary.n) * 100)}%`).join("・")}</p></div></section>
<section><h2>やめる・やめた理由（抜き出し）</h2><div class="box">${summary.quit.map((q) => `<p>「${esc(q.why)}」<small>（${q.id}）</small></p>`).join("") || "<p>やめると答えた家族はいませんでした</p>"}</div></section>
<section><h2>助かった事（抜き出し）</h2><div class="box">${summary.good.map((g) => `<p>「${esc(g.text)}」<small>（${esc(g.id)}）</small></p>`).join("")}</div></section>
<p><small>答えは ${esc(path.relative(APP, DIR))}/answers に1家族1ファイル（git の外）。答えたのは作った家族で、日記に無い事は答えない約束です。見つかった事は、次の修正の案として社長に出します。</small></p>
</main></body></html>`;
fs.writeFileSync(path.join(DIR, "report.html"), html);
console.log(`\n報告: ${path.join(DIR, "report.html")}`);
console.log(`SUS ${summary.sus} ／ NPS ${summary.nps} ／ 使い続ける ${summary.continueRate}% ／ 不便の1位: ${summary.pain[0]?.name}（${summary.pain[0]?.families}組）／ 欲しい機能の1位: ${summary.want[0]?.name}（${summary.want[0]?.families}組）`);
