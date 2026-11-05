// 多言語①②の確かめ（作り手の OK の後に1回だけ回す・11/6〜）: 中文・English の画面で、
//   ① 話す・撮る・書くの返事は画面の言葉・記録は家族が話した・書いた言葉のまま（撮った紙は紙の言葉）
//   ② 健診のまとめを、家族の言葉（family）でも書く
// を、本物の Claude で確かめる。切り替えの印は、この台本の中だけ on（BOSHI_CLAUDE_LANG。本番・体験版・なりきりの置き場には入れない＝試験が見る）。
//
//   cd app && NODE_OPTIONS=--conditions=react-server npx tsx scripts/lang-check.mts --dry     # Claude を呼ばず、頼む形と字数だけ（台本の試し）
//   cd app && ANTHROPIC_API_KEY="$(<鍵を読む命令>)" NODE_OPTIONS=--conditions=react-server npx tsx scripts/lang-check.mts [--only capture|visit]
//   node scripts/spend.mjs                                                                     # 今回・今日・残り
//
// 鍵は、検査のワークスペースの上限つきの鍵を、その時だけ渡す（.env.local に写さない・命令の文に鍵の字を書かない）。
// DB はこの作業場の app/sim-data（わが家の app/data・本番に触らない）。回す前に sim-data/run-start を書き、1回の上限は BOSHI_SIM_BUDGET_USD（既定 $2）。
// 見込み（11/5 統括へ送った）: ① 16回（Sonnet 5.5）約 $0.3・② 3回（Opus 5.5）約 $0.25〜0.40。上限に達すると見本の答えに落ちるので、そこで止める。
// 結果は app/sim/out/lang-check.md（git の外）。機械で見る ○× と、人が読む全文を並べる（言葉の質は人が読む）。
import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
import { chromium } from "playwright";

const APP = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
nextEnv.loadEnvConfig(APP);
const DRY = process.argv.includes("--dry");
const ONLY = (() => {
  const i = process.argv.indexOf("--only");
  return i > 0 ? process.argv[i + 1] : null;
})();
const DATA = path.join(APP, "sim-data");
process.env.BOSHI_DATA_DIR = DATA;
process.env.BOSHI_CLAUDE_LANG = "capture,visit";
process.env.BOSHI_SIM_BUDGET_USD ??= "2";
delete process.env.BOSHI_PUBLIC;
fs.mkdirSync(DATA, { recursive: true });
if (!DRY) {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("鍵がありません（ANTHROPIC_API_KEY を、その時だけ渡す）。Claude を呼ばずに試すなら --dry");
    process.exit(1);
  }
  fs.writeFileSync(path.join(DATA, "run-start"), `${new Date().toISOString().replace(/\.\d+Z$/, "Z")}\n`);
}

const { capture, capturePromptText } = await import("../src/lib/capture");
type CaptureInput = Parameters<typeof capture>[0];
const { sendingAs, imageBlock } = await import("../src/lib/claude");
const { DEMO_FAMILY } = await import("../src/lib/demo-family");
const { CALL_119 } = await import("../src/lib/i18n/claude-lang");
const { SAMPLE_MARK } = await import("../src/lib/samples");
const { createVisit, isRunning, requireVisit, startFinish } = await import("../src/app/api/visit/_lib/server");
const { DEMO_AGENDA, DEMO_TRANSCRIPT } = await import("../src/components/visit/demoTranscript");
const { familyOf, segmentsFromText } = await import("../src/lib/visit");
const { organizeCall } = await import("../src/lib/visit-organize");

/** 送る印: シミュレーションの世帯（同意は要らない・費用は sim-data に残る） */
const who = { householdId: "sim-lang-check", kind: "sim" as const, accountId: null, subjectIds: [] as string[], legacy: true };
/** 見本の家族（予定日 2027-05-10）の写し。記録はこの作業場の sim-data にだけ残る */
let seq = 0x1c0000 + Math.floor(Date.now() / 1000) % 0xffff;
const tid = () => `try-${(seq++).toString(16).padStart(32, "0")}`;
const TODAY = "2027-02-20"; // 妊娠28週5日
const VISIT_DAY = "2027-02-15"; // 妊娠28週（見本の録音の週）
const MEMBERS = DEMO_FAMILY.members.map((m) => `${m.name}（${m.role}）`);

// 決まりの文（記録の detail の最後。日本語のこの字のまま＝画面が家族の言葉で出す）
const FIXED = ["次の健診で聞く", "その日のうちに産院へ電話", "その日のうちにかかりつけへ電話。迷ったら #8000"];
const KANA = /[぀-ヿ]/;
const HAN = /\p{Script=Han}/u;
/** 括弧と引用の中を外す（家族の言葉の文に、日本語の字や窓口の言葉を括弧で並べてよい） */
const outside = (s: string) => s.replace(/「[^」]*」|『[^』]*』|（[^）]*）|\([^)]*\)|“[^”]*”|"[^"]*"/g, "");
const noFixed = (s: string) => FIXED.reduce((x, f) => x.split(f).join(""), s);
type L = "ja" | "zh" | "en";
/** その言葉で書いてあるか（ざっくり。括弧・引用・決まりの文は見ない） */
function inLang(s: string, l: L): boolean {
  const t = outside(noFixed(s)).trim();
  if (!t) return true;
  if (l === "ja") return KANA.test(t) || !/[A-Za-z]{3}/.test(t);
  if (l === "zh") return !KANA.test(t) && HAN.test(t);
  return !KANA.test(t) && !HAN.test(t);
}

// ───────── ① 話す・撮る・書く ─────────

type Cap = {
  name: string;
  screen: "zh" | "en";
  source: "text" | "voice" | "photo";
  text?: string;
  photo?: boolean;
  followUp?: { basis: string; question: string; answer: string };
  /** 記録の言葉（家族が話した・書いた言葉。撮った紙は紙の言葉） */
  rec: L;
  urgent?: boolean;
  worry?: boolean;
  deadline?: boolean;
};
const CAPS: Cap[] = [
  { name: "書いた・メモ", screen: "zh", source: "text", text: "今天下午去公园散步了大约30分钟，感觉不错。", rec: "zh" },
  { name: "書いた・気がかり", screen: "zh", source: "text", text: "最近晚上小腿经常抽筋，一晚上醒好几次，睡不好。", rec: "zh", worry: true },
  { name: "書いた・急ぎ", screen: "zh", source: "text", text: "刚才上厕所发现有出血，量不多，肚子也有点疼。", rec: "zh", urgent: true },
  { name: "書いた・期限", screen: "zh", source: "text", text: "保育园的入园申请要在12月10日之前交到区役所。", rec: "zh", deadline: true },
  { name: "話した", screen: "zh", source: "voice", text: "今天胎动特别多，晚上肚子有点发紧，所以早点躺下休息了。", rec: "zh" },
  { name: "撮った紙", screen: "zh", source: "photo", photo: true, text: "保健中心寄来的通知", rec: "ja", deadline: true },
  {
    name: "聞き返しへの答え",
    screen: "zh",
    source: "text",
    followUp: { basis: "書いた事: 下周要去区役所办儿童补贴的手续", question: "是哪一天去区役所？", answer: "下周三上午" },
    rec: "zh",
  },
  { name: "画面と違う言葉（日本語で書いた）", screen: "zh", source: "text", text: "来週の水曜に、区役所へ児童手当の申請に行く。", rec: "ja" },
  { name: "書いた・メモ", screen: "en", source: "text", text: "Went for a 30-minute walk in the park this afternoon. Felt good.", rec: "en" },
  { name: "書いた・気がかり", screen: "en", source: "text", text: "My calves keep cramping at night lately, and I wake up several times.", rec: "en", worry: true },
  { name: "書いた・急ぎ", screen: "en", source: "text", text: "I just noticed some bleeding when I went to the bathroom. Not much, but my belly hurts a little.", rec: "en", urgent: true },
  { name: "書いた・期限", screen: "en", source: "text", text: "The daycare application has to be submitted to the ward office by December 10.", rec: "en", deadline: true },
  { name: "話した", screen: "en", source: "voice", text: "The baby moved a lot today, and my belly felt tight in the evening, so I lay down early.", rec: "en" },
  { name: "撮った紙", screen: "en", source: "photo", photo: true, text: "This came from the health center.", rec: "ja", deadline: true },
  {
    name: "聞き返しへの答え",
    screen: "en",
    source: "text",
    followUp: { basis: "書いた事: Need to go to the ward office next week for the child allowance", question: "Which day are you going to the ward office?", answer: "Next Wednesday morning" },
    rec: "en",
  },
  { name: "画面と違う言葉（中文で書いた）", screen: "en", source: "text", text: "今天感觉宝宝在肚子里打嗝了。", rec: "zh" },
];

/** 撮る紙（作った案内。実在の保健センターではない）を、iPhone で撮った大きさの画像にする */
async function noticePng(): Promise<string> {
  const html = `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#f4f1ea;font-family:'Hiragino Sans','Noto Sans JP',sans-serif">
  <div style="margin:40px;padding:36px 40px;background:#fff;border:1px solid #ccc;box-shadow:0 2px 8px #0002;line-height:1.9;font-size:26px;color:#222">
  <div style="text-align:center;font-size:34px;font-weight:700;margin-bottom:18px">両親学級のご案内</div>
  <div>妊娠中の方とパートナーの方へ。沐浴の練習と、出産までの過ごし方のお話をします。</div>
  <div style="margin-top:14px">日時：令和9年3月14日（日）10:00〜12:00（受付 9:45〜）</div>
  <div>会場：中央区保健センター 2階 集団指導室</div>
  <div>持ち物：母子健康手帳・筆記用具・動きやすい服装</div>
  <div>申込：3月5日（金）までに、保健センターへ電話でお申し込みください。</div>
  <div style="margin-top:14px;font-size:22px;color:#555">※ 作った案内です（確かめ用）</div></div></body>`;
  const b = await chromium.launch({ headless: true });
  try {
    const page = await b.newPage({ viewport: { width: 900, height: 760 } });
    await page.setContent(html);
    return `data:image/png;base64,${(await page.screenshot({ type: "png" })).toString("base64")}`;
  } finally {
    await b.close();
  }
}

type Row = { group: string; name: string; screen: string; ok: boolean; checks: string[]; body: string };
const rows: Row[] = [];
const mark = (ok: boolean) => (ok ? "○" : "×");

async function runCaptures() {
  const notice = await noticePng();
  for (const c of CAPS) {
    const input: CaptureInput = {
      family: { ...DEMO_FAMILY, id: tid() },
      today: TODAY,
      source: c.source,
      text: c.followUp ? undefined : c.text,
      image: c.photo ? imageBlock(notice) : undefined,
      followUp: c.followUp,
      lang: c.screen,
    };
    const prompt = capturePromptText(input);
    if (DRY) {
      const ok = prompt.includes(`画面の言葉: `) && prompt.includes(CALL_119[c.screen]);
      rows.push({ group: "①", name: c.name, screen: c.screen, ok, checks: [`${mark(ok)} 頼みに言葉の段（${prompt.length}字${c.photo ? "＋写真" : ""}）`], body: "" });
      continue;
    }
    const r = await sendingAs(who, () => capture(input));
    if (r.reply.startsWith(SAMPLE_MARK)) {
      rows.push({ group: "①", name: c.name, screen: c.screen, ok: false, checks: ["× 見本の答え（Claude を呼んでいない＝鍵か上限）。ここで止めます"], body: r.reply });
      return false;
    }
    const recs = r.records.map((x) => x.data);
    const checks: string[] = [];
    const say = (ok: boolean, s: string) => checks.push(`${mark(ok)} ${s}`);
    say(inLang(r.reply, c.screen), `返事が画面の言葉（${c.screen}）`);
    if (r.oneQuestion) say(inLang(r.oneQuestion, c.screen), "聞き返しが画面の言葉");
    if (/119/.test(r.reply)) say(r.reply.includes(CALL_119[c.screen]), "119 の文を言い換えない");
    say(recs.length > 0 || r.deadlines.length > 0, "記録か予定ができた");
    say(
      recs.every((x) => inLang(`${x.title}\n${x.detail}`, c.rec)),
      `記録が${c.rec === "ja" ? "日本語（紙・書いた言葉）" : `家族の言葉（${c.rec}）`}のまま`,
    );
    const translatedFixed = recs.some((x) => /下次.*(检查|孕检).*问|ask (at|during) the next (checkup|visit)|call the (maternity )?clinic (the )?same day/i.test(x.detail));
    say(!translatedFixed, "決まりの文を訳さない（日本語のまま）");
    if (c.worry) say(recs.some((x) => x.detail.includes("次の健診で聞く")), "気がかりに「次の健診で聞く」");
    if (c.urgent) say(recs.some((x) => x.urgent), "急ぎの印");
    if (c.deadline) say(r.deadlines.length > 0, "期限が予定に入った");
    if (r.deadlines.length) say(r.deadlines.every((d) => inLang(`${d.title}`, c.rec)), "予定の題も記録と同じ言葉");
    if (r.techo.length) say(r.techo.every((x) => !/[A-Za-z]{4}/.test(JSON.stringify(x)) || KANA.test(JSON.stringify(x))), "母子手帳の欄の候補は前のまま（日本語）");
    const body = [
      `入力: ${c.followUp ? `${c.followUp.question} → ${c.followUp.answer}` : (c.text ?? "")}${c.photo ? "（＋撮った紙）" : ""}`,
      `返事: ${r.reply}`,
      r.oneQuestion ? `聞き返し: ${r.oneQuestion}` : "",
      ...recs.map((x) => `記録［${x.kind}${x.urgent ? "・急ぎ" : ""}］${x.title} ／ ${x.detail.replace(/\n/g, " ⏎ ")}`),
      ...r.deadlines.map((d) => `予定 ${JSON.stringify(d)}`),
      ...r.techo.map((x) => `手帳の候補 ${JSON.stringify(x)}`),
    ]
      .filter(Boolean)
      .join("\n");
    rows.push({ group: "①", name: c.name, screen: c.screen, ok: checks.every((x) => x.startsWith("○")), checks, body });
    console.log(`① ${c.screen} ${c.name}: ${checks.join(" ")}`);
  }
  return true;
}

// ───────── ② 健診のまとめ ─────────

async function runVisits() {
  for (const lang of ["ja", "zh", "en"] as const) {
    const v = createVisit(tid(), VISIT_DAY, { demo: true, demoAgenda: DEMO_AGENDA });
    if (DRY) {
      const call = organizeCall({ ...v.data, transcript: { text: DEMO_TRANSCRIPT, segments: segmentsFromText(DEMO_TRANSCRIPT), source: "text" } }, MEMBERS, lang);
      const ok = lang === "ja" ? call.lang === null : call.lang === lang && "family" in call.schema.shape;
      rows.push({ group: "②", name: "健診のまとめ", screen: lang, ok, checks: [`${mark(ok)} 頼みの形（${call.prompt.length}字・family ${call.lang ? "あり" : "なし"}）`], body: "" });
      continue;
    }
    startFinish(requireVisit(v.id), who, DEMO_TRANSCRIPT, lang);
    const t0 = Date.now();
    while (isRunning(v.id) && Date.now() - t0 < 600_000) await new Promise((r) => setTimeout(r, 2000));
    const d = requireVisit(v.id).data;
    const checks: string[] = [];
    const say = (ok: boolean, s: string) => checks.push(`${mark(ok)} ${s}`);
    say(d.status === "done" && !!d.result, `整理が終わった（${d.status}${d.error ? `: ${d.error}` : ""}）`);
    const r = d.result;
    if (r && r.summary.some((s) => s.startsWith(SAMPLE_MARK))) {
      say(false, "見本の答え（Claude を呼んでいない＝鍵か上限）。ここで止めます");
      rows.push({ group: "②", name: "健診のまとめ", screen: lang, ok: false, checks, body: "" });
      return false;
    }
    const f = r ? familyOf(r) : null;
    if (lang === "ja") say(!!r && !r.family && !r.lang, "日本語の画面は family を頼まない（前と同じ形）");
    else if (r) {
      say(!!f && f.lang === lang, `family が残った（数が日本語の欄とそろう・${lang}）`);
      if (f) {
        const w = f.words;
        const all = [...w.summary, ...w.said, ...w.todo.flatMap((x) => [x.what, x.when ?? ""]), ...w.numbers.flatMap((x) => [x.name, x.value]), ...w.terms, ...w.questions, ...w.answered.map((x) => x ?? "")];
        say(all.every((s) => inLang(s, lang)), `family にかなが残らない（${lang}）`);
        const digits = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).join(",");
        say(r.numbers.every((n, i) => digits(n.value) === digits(w.numbers[i].value)), "数値が変わらない");
        const evalWords = lang === "zh" ? /正常|没问题|顺利|很好/ : /\bnormal\b|no problems?|going well|\bhealthy\b/i;
        const jaEval = /順調|問題な|正常/.test(JSON.stringify(r));
        say(jaEval || !all.some((s) => evalWords.test(s)), "評価の言葉を足さない（先生が言った時だけ）");
        say(w.summary.every((s) => !/\d{1,2}\/\d{1,2}|\d{1,2}月\d{1,2}日|(January|February|March|April|May|June|July|August|September|October|November|December) \d/.test(s)), "まとめに次の予約の日付を書かない");
      }
    }
    const body = r
      ? [
          ...r.summary.map((s, i) => `まとめ ${s}${f ? ` ／ ${f.words.summary[i]}` : ""}`),
          ...r.said.map((s, i) => `先生の話 ${s.point}${f ? ` ／ ${f.words.said[i]}` : ""}`),
          ...r.todo.map((s, i) => `次までに ${s.what}（${s.when ?? "―"}）${f ? ` ／ ${f.words.todo[i].what}（${f.words.todo[i].when ?? "―"}）` : ""}`),
          ...r.numbers.map((s, i) => `数値 ${s.name}: ${s.value}${f ? ` ／ ${f.words.numbers[i].name}: ${f.words.numbers[i].value}` : ""}`),
          ...r.terms.map((s, i) => `言葉 ${s.term}: ${s.plain}${f ? ` ／ ${f.words.terms[i]}` : ""}`),
          ...r.questions.map((s, i) => `次に聞く ${s.question}${f ? ` ／ ${f.words.questions[i]}` : ""}`),
          ...r.answered.map((s, i) => `聞いた事 ${s.ask} → ${s.answer ?? "（答えなし）"}${f ? ` ／ ${f.words.answered[i] ?? "（null）"}` : ""}`),
        ].join("\n")
      : "";
    rows.push({ group: "②", name: "健診のまとめ", screen: lang, ok: checks.every((x) => x.startsWith("○")), checks, body });
    console.log(`② ${lang}: ${checks.join(" ")}`);
  }
  return true;
}

const started = new Date();
let go = true;
if (ONLY !== "visit") go = await runCaptures();
if (go && ONLY !== "capture") await runVisits();

const out = path.join(APP, "sim", "out");
fs.mkdirSync(out, { recursive: true });
const md = [
  `# 多言語①②の確かめ${DRY ? "（--dry: Claude を呼んでいない）" : ""}`,
  "",
  `回した時刻: ${started.toISOString()}　台本: app/scripts/lang-check.mts　費用は node scripts/spend.mjs`,
  "",
  `機械で見た ○: ${rows.filter((r) => r.ok).length} / ${rows.length}（言葉の質・言い換えの良し悪しは、下の全文を人が読む）`,
  "",
  "| 段 | 画面 | 場面 | 見た事 |",
  "|---|---|---|---|",
  ...rows.map((r) => `| ${r.group} | ${r.screen} | ${r.name} | ${r.checks.join("<br>")} |`),
  "",
  ...rows.filter((r) => r.body).flatMap((r) => [`## ${r.group} ${r.screen} ${r.name}`, "", "```", r.body, "```", ""]),
].join("\n");
fs.writeFileSync(path.join(out, "lang-check.md"), md);
console.log(`\n${rows.filter((r) => r.ok).length}/${rows.length} ○。全文: app/sim/out/lang-check.md`);
// DB や裏の処理の待ちが残っても、ここで終える（健診の整理は上で終わりまで待っている）
process.exit(0);
