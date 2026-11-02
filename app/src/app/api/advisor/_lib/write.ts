// 参謀の気づき: 機械で見つけたきっかけ（lib/advisor.ts）から、Claude に気づき1つ＋組み直し案＋文面を書かせる。
// 町が変わった時だけ、旧と新の町の公式ページを調べてから書く（出典つき）。
import "server-only";
import { MODEL, research, structured } from "@/lib/claude";
import { clockAt } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { isOfficial } from "@/lib/local";
import { AdviceSchema, trimAdvice, type Advice, type AdvisorInput, type Trigger } from "@/lib/advisor";

const SYSTEM = `あなたの役割: 家族全体の参謀。期限表（リマインダー）には無い事を、この家族の今の状況から1つ気づき、先回りして組み直し、そのまま渡せる文面を用意する。
- 渡された「機械で確かめた事」を土台にする。日付・件数・人の名前はそこから使い、作らない。
- title は「気づいた事」。期限を知らせるだけの言い方（◯◯の期限です）にしない。状況が変わった事・このままだと起きる事を言う。このきっかけの事だけを言い、別のきっかけ（早く生まれた事など）を繰り返さない。
- plan は組み直しの一手を3つまで。誰が・何を・いつまでに。産後の母に手続きや外出を寄せない。
- message は1通だけ。相手と目的に合わせる:
  - 職場の上司へ: 丁寧なメール（via=mail・subject あり）。会社名・上司の名前・自分の名前が分からなければ【会社名】【上司の名前】【名前】の空欄。
  - 祖父母へ: LINE（via=line）。祖父母の言葉で、大きな字で読めるよう1文を短く、5文まで。お願いは1つか2つに絞り、「ありがとう」で終える。専門用語は使わない。
  - 町の窓口へ: 問い合わせのメール（via=mail）。
- 体や赤ちゃんの状態の良し悪しは書かない。早く・遅く生まれた事を体の話にしない（段取りの話だけ）。
- 法律や制度は、渡された根拠か調べた文章にある事だけ言い切る。分からない事は「確かめる」と書く。`;

const ROLE_HINT: Record<Trigger["kind"], string> = {
  "birth-early": "きっかけ: 予定より早く生まれた。産休・育休・手続きの全体を組み直す。職場への連絡（育休の始まる日の直し）が早まる事に気づき、職場の上司への連絡文を用意する。",
  "birth-late": "きっかけ: 予定より遅く生まれた。産休・育休・手続きの全体を組み直す。職場への連絡（育休の始まる日の直し）に気づき、職場の上司への連絡文を用意する。",
  moved: "きっかけ: 町が変わった（引っ越し）。前の町から引き継がれない助成・受診券（妊婦健診の補助券）などの扱いの差を、調べた文章から出す。新しい町の窓口への問い合わせ文を用意する（要らなければ省く）。",
  grandparents: "きっかけ: 祖父母が来る。来る日から任せられる事を割り振る（役所の届出・病院の判断は渡さない。家事・食事・上の子・付き添い・送り迎え・母が眠る時間を作る、など）。祖父母に宛てた LINE を、祖父母の言葉で用意する。",
  "partner-stalled":
    "きっかけ: パートナーの担当が止まっている。title は止まっている事への気づき（早く生まれた事などは繰り返さない）。母に負担を移さない。plan の1つは必ず、祖父母（いなければ外の手）へ移す1件にする。祖父母がいれば、祖父母に頼める1件を切り出し（手続きそのものが無理なら、パートナーの時間を空ける家事・電話での下調べなど）、頼む LINE を用意する。祖父母がいなければ、外の手（自治体の産前産後ヘルパー・家事支援）を「町のページで確かめる」前提で plan に入れ、町の窓口への問い合わせ文を用意する。",
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
  if (t.research) found = await researchMove(t.research);

  const to = t.to?.memberId ? f.members.find((m) => m.id === t.to!.memberId) : undefined;
  const work = keep.work;
  const content = [
    `今日: ${input.today}（${clockAt(f, input.today).label}）`,
    `住む町: ${f.prefecture}${f.city}`,
    `出産予定日: ${f.dueDate}${f.birthDate ? `／生まれた日: ${f.birthDate}` : "／まだ生まれていない"}`,
    f.childName ? `子どもの呼び名: ${f.childName}` : "",
    "",
    "家族:",
    ...f.members.map((m) => `- ${m.name}（${m.role}）。伝え方のヒント: ${m.voice || "なし"}`),
    "",
    ROLE_HINT[t.kind],
    "",
    "機械で確かめた事:",
    ...t.facts,
    "",
    t.to ? `文面の相手: ${to ? `${to.name}（${to.role}）。伝え方のヒント: ${to.voice || "なし"}` : t.to.role}` : "",
    t.kind.startsWith("birth") && (work?.company || work?.boss)
      ? `職場（覚えている事）: ${[work.company, work.dept, work.boss && `上司 ${work.boss}`].filter(Boolean).join("・")}`
      : "",
    input.records?.length ? "\n最近の記録:" : "",
    ...(input.records ?? []).map((r) => `- ${r.date ?? ""} ${r.kind}「${r.title}」${r.who ? `（${r.who}）` : ""}`),
    found ? `\n調べた文章（${t.research!.from} → ${t.research!.to}）:\n${found.text}` : "",
  ]
    .filter((x) => x !== "")
    .join("\n");

  const out = trimAdvice(await structured(AdviceSchema, SYSTEM, content, { model: MODEL, effort: "medium", maxTokens: 6000 }));
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
