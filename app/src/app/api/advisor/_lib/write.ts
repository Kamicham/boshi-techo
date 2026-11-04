// 気づいた事: 機械で見つけたきっかけ（lib/advisor.ts）から、Claude に気づき1つ＋次にする事＋文面を書かせる。
// 町が変わった時だけ、旧と新の町の公式ページを調べてから書く（出典つき）。
// lookAround: きっかけが無い時、時期ごとに1回、家族の今（形・予定・記録・健診）を見渡して、決まりに無い事を Claude が自分で見つける。
import "server-only";
import { MODEL, research, sampleMode, structured } from "@/lib/claude";
import { clockAt } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { workOf, worksByMember } from "@/lib/whose";
import { isOfficial } from "@/lib/local";
import { AdviceSchema, LookSchema, situationFacts, trimAdvice, type Advice, type AdvisorInput, type Trigger } from "@/lib/advisor";
import { notebookSnapshot, planSnapshot } from "@/lib/ask/tools";

const SYSTEM = `あなたの役割: 期限表（リマインダー）には無い事を、この家族の今の状況から1つ気づき、数え直した期限と、そのまま渡せる文面を用意する。
- 渡された「機械で確かめた事」を土台にする。日付・件数・人の名前はそこから使い、作らない。
- title は「気づいた事」。期限を知らせるだけの言い方（◯◯の期限です）にしない。状況が変わった事と、間に合う道を一文で言う。このきっかけの事だけを言う。
- title に「早く」「遅く」「このままだと」「失う」「もらえない」「損」を使わない（夜中にひとりで読む親を脅さない）。生まれた日のきっかけでは「生まれた日に合わせて、日付を数え直しました」の調子にする。損をする話は why の中に事実だけ1行。
- plan は次にする事を3つまで。何を・いつまでに。誰がやるかの割り振りはしない。産後の母に手続きや外出を寄せない。
- message は1通だけ。相手と目的に合わせる:
  - 職場の上司へ: 丁寧なメール（via=mail・subject あり）。会社名・上司の名前・自分の名前が分からなければ【会社名】【上司の名前】【名前】の空欄。
  - 町の窓口へ: 問い合わせのメール（via=mail）。
- 「家族の形」に書かれた事を使う。書かれていない事は決めつけず「確かめる」。仕事のない人に職場の話をしない。上の子がいれば上の子の事も入れる。
- 文面は「文面を送る人」の名前で書く（最後に名前。会社名など分からない所だけ【 】）。
- 体や赤ちゃんの状態の良し悪しは書かない。予定日との差を体の話にしない（段取りの話だけ）。
- 法律や制度は、渡された根拠か調べた文章にある事だけ言い切る。分からない事は「確かめる」と書く。`;

const ROLE_HINT: Record<Trigger["kind"], string> = {
  "birth-early": "きっかけ: 予定より早く生まれた。産休・育休・手続きの期限を、生まれた日で数え直す。職場への連絡（育休の始まる日の直し）が早まる事に気づき、職場の上司への連絡文を用意する。",
  "birth-late": "きっかけ: 予定より遅く生まれた。産休・育休・手続きの期限を、生まれた日で数え直す。職場への連絡（育休の始まる日の直し）に気づき、職場の上司への連絡文を用意する。",
  look: "きっかけ: 決まりのきっかけは無い。家族の今を見渡して気づく（lookAround で使う）。",
  moved: "きっかけ: 町が変わった（引っ越し）。前の町から引き継がれない助成・受診券（妊婦健診の補助券）などの扱いの差を、調べた文章から出す。新しい町の窓口への問い合わせ文を用意する（要らなければ省く）。",
};

/** 町が変わった時の調べ（旧と新の公式ページ） */
async function researchMove(t: NonNullable<Trigger["research"]>) {
  const q = `${t.from} から ${t.to} へ引っ越した家族（引っ越した時: ${t.phase}）です。
前の町から引き継がれない物・新しい町で手続きし直す物の差を、両方の町の公式サイトを優先して調べてください。
知りたい事:
1. 妊婦健診の受診票（補助券）: 前の町の物は使えるか。新しい町での交換・再交付のやり方と窓口
2. 前の町で使えなくなる・新しい町で申し込み直す助成（子ども医療費助成・出産の応援給付など）
3. 母子健康手帳はそのまま使えるか
4. 転入の届出の時に一緒にする事
出典のページを示してください。分からない事は「確かめる」と書いてください。`;
  return research(
    "あなたの役割: 引っ越した家族のために、前の町と新しい町の子育ての制度の差を、市区町村の公式サイト（.lg.jp・city.〇〇.jp）を最優先に調べる係。まとめサイトや個人のブログは根拠にしない。日本語で短く。",
    q,
  );
}

/** きっかけ1つから気づきを書かせる */
export async function writeAdvice(t: Trigger, input: AdvisorInput, keep: Keep): Promise<Advice> {
  const f: Family = input.family;
  let found: { text: string; sources: { title: string; url: string }[] } | null = null;
  // 鍵の無い見本の家族では調べない（見本の答えで書く）
  if (t.research && !sampleMode()) found = await researchMove(t.research);

  // 文面を送る人の職場だけ（見直し C09）
  const work = workOf(keep, f, t.from?.memberId);
  const content = [
    `今日: ${input.today}（${clockAt(f, input.today).label}）`,
    `住む町: ${f.prefecture}${f.city}`,
    `出産予定日: ${f.dueDate}${f.birthDate ? `／生まれた日: ${f.birthDate}` : "／まだ生まれていない"}`,
    f.childName ? `子どもの呼び名: ${f.childName}` : "",
    "",
    "家族:",
    ...f.members.map((m) => `- ${m.name}（${m.role}）`),
    ...(situationFacts(f).length ? ["", "家族の形:", ...situationFacts(f).map((x) => `- ${x}`)] : []),
    "",
    ROLE_HINT[t.kind],
    "",
    "機械で確かめた事:",
    ...t.facts,
    "",
    t.to ? `文面の相手: ${t.to.role}` : "",
    t.from ? `文面を送る人: ${t.from.name}` : "",
    t.kind.startsWith("birth") && (work?.company || work?.boss)
      ? `職場（覚えている事）: ${[work.company, work.dept, work.boss && `上司 ${work.boss}`].filter(Boolean).join("・")}`
      : "",
    input.records?.length ? "\n最近の記録:" : "",
    ...(input.records ?? []).map((r) => `- ${r.date ?? ""} ${r.kind}「${r.title}」${r.who ? `（${r.who}）` : ""}`),
    found ? `\n調べた文章（${t.research!.from} → ${t.research!.to}）:\n${found.text}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n");

  const out = trimAdvice(await structured(AdviceSchema, SYSTEM, content, { model: MODEL, effort: "medium", maxTokens: 6000, task: "advice" }));
  const sources = found ? [...found.sources].sort((a, b) => Number(isOfficial(b.url)) - Number(isOfficial(a.url))).slice(0, 6) : undefined;
  return {
    ...out,
    kind: t.kind,
    key: t.key,
    facts: t.facts,
    sources,
    today: input.today,
    createdAt: new Date().toISOString(),
  };
}

const LOOK_SYSTEM = `あなたの役割: この家族の手帳を、今の時期に1回だけ見渡す。予定表（決まりの期限）は別の所が知らせているので、それを繰り返さない。
この家族の形・記録・健診の予約・済んだ事・まだの事を突き合わせて、決まりの予定表では出てこない「この家族ならではの段取りの事」を1つだけ探す。例:
- 家族の形と予定の食い違い（里帰りする家族に、里帰り先での健診の補助券の扱いを確かめる事が無い・上の子の行事や預け先が入院の時期と重なる・双子で手続きが2人分になる）
- 止まっている事（パートナーの番の事が長く済みにならない・OK を待つ候補が溜まっている）
- 記録から分かる段取り（話した記録にある予定・心配を、次の健診で聞く事や手続きにつなげる）
守ること:
- 見つからなければ found=false にする。無理に作らない。「今やる事」に既に出ている事は言わない。
- 「次の健診の予約が手帳に入っていない」「聞く事が入っていない」だけでは気づきにしない（多くの家族は手帳に予約を書かない。予約は産院が決める）。
- 一番大事なのは、家族の形（働き方・上の子・里帰り・双子・祖父母）や記録と、これからの予定との突き合わせ。誰の・いつの・何の段取りかが具体的に言える事を選ぶ。
- 体・赤ちゃんの状態・数値・発達・心・栄養の良し悪しは言わない。記録に体の事があっても、判断せず「次の健診で聞く事にする」段取りだけにする。
- basis には、渡した事の中の言葉をそのまま引く（作らない）。
- title は「気づいた事」を一文で（30字まで）。脅さない（「このままだと」「失う」「損」を使わない）。
- plan は次にする事を3つまで。message は要る時だけ1通（家族あては line、職場・役所は mail。送る人の名前で書く）。
- 法律や制度は、渡された根拠にある事だけ言い切る。分からない事は「確かめる」と書く。`;

/** きっかけが無い時: 時期ごとに1回、家族の今を見渡して、決まりに無い事に気づく（無ければ none） */
export async function lookAround(input: AdvisorInput, keep: Keep, key: string): Promise<Advice> {
  // 作った家族は先の生まれた日を持っている。今日より先の事は見せない（予定表と同じ扱い）
  const f: Family = input.family.birthDate && input.family.birthDate > input.today ? { ...input.family, birthDate: undefined } : input.family;
  const base = { kind: "look" as const, key, today: input.today, createdAt: new Date().toISOString() };
  const content = [
    `今日: ${input.today}（${clockAt(f, input.today).label}）`,
    `住む町: ${f.prefecture}${f.city}`,
    `出産予定日: ${f.dueDate}${f.birthDate ? `／生まれた日: ${f.birthDate}` : "／まだ生まれていない"}`,
    "",
    "家族:",
    ...f.members.map((m) => `- ${m.name}（${m.role}）`),
    ...(situationFacts(f).length ? ["", "家族の形:", ...situationFacts(f).map((x) => `- ${x}`)] : []),
    ...worksByMember(keep, f).map(({ member, work: w }) => `\n${member.name}の職場（覚えている事）: ${[w.company, w.boss && `上司 ${w.boss}`].filter(Boolean).join("・")}`),
    "",
    "予定表（決まりの期限。ここに出ている事は繰り返さない）:",
    JSON.stringify(planSnapshot(f, input.today)),
    "",
    "手帳と記録・健診:",
    JSON.stringify(notebookSnapshot(f, input.today)),
  ]
    .filter((x) => x !== "")
    .join("\n");
  const out = await structured(LookSchema, LOOK_SYSTEM, content, { model: MODEL, effort: "medium", maxTokens: 6000, task: "look" });
  if (!out.found || !out.advice) return { ...base, title: "", why: "", plan: [], facts: [], none: true };
  return { ...trimAdvice(out.advice), ...base, facts: out.basis.slice(0, 3) };
}
