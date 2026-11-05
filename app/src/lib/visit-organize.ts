// ⑤ 健診の整理の頼み（Claude に送る字と、受け取る形）。サーバ（app/api/visit/_lib/server.ts）が使い、試験が字を守る（visit-family-words.test.ts）。
// ここには DB・ファイル・Claude を呼ぶ処理を置かない（試験で直接読めるように）。
// 統括の決まり（11/5 17:4x）: 日本語の画面の頼み（ORGANIZE_SYSTEM・organizePrompt の字）と受け取る形（OrganizedSchema）は1字も変えない
// （ORGANIZE_SYSTEM と organizePrompt は server.ts から字を変えずに移した）。
// 作り手の決め事②「健診のまとめを、家族の言葉（简体中文・English）でも書く」は、切り替えの印 CLAUDE_LANG.visit（lib/i18n/claude-lang.ts・今は off）の裏。
// on で、整理を頼んだ人の画面の言葉が zh・en の時だけ、頼みの最後に organizeLangNote を足し、受け取る形に family を足す（lib/visit.ts の FamilyWordsSchema）。
import type { Lang } from "./i18n";
import { claudeLangOf, claudeLangOn, organizeLangNote } from "./i18n/claude-lang";
import {
  OrganizedSchema,
  OrganizedWithFamilySchema,
  familyFits,
  transcriptForPrompt,
  type FamilyLang,
  type FamilyWords,
  type Organized,
  type VisitData,
  type VisitResult,
} from "./visit";

export const ORGANIZE_SYSTEM = `あなたの役目: 妊婦健診・乳幼児健診の録音の文字起こしを、家族があとで読み返せる形に整理する。
- 文字起こしは機械によるもので、話し手の名前は付いていない。言い方から、先生・家族・看護師を見分ける。聞き間違いらしい所は前後から元の言葉を推し量るが、推し量った時は引用をそのまま残す。
- said: 先生が言った事。point は短い要点、quote は文字起こしのままの引用（直さない）。
- todo: 先生が「次までに」「〜してきてください」と言った物だけ。自分で足さない。
- nextAppointment: 次の予約を言った時だけ。言われた形のまま、月日・「◯週間後」・曜日・時刻に分けて入れる（日付の計算はしない）。言っていなければ null。
- numbers: 話に出た数値を、言われたとおりの値と単位で。正常・異常・多い・少ない・順調などの評価は書かない。
- terms: 家族が分からなかったかもしれない専門用語（子宮頸管長・頭位・推定体重など）。plain は「それが何か／何を測るものか」だけを、中学生に話すような言葉で1〜2文。今回の値が良いか悪いか、心配かどうかは書かない。
- questions: 話の中で意味が残った所（説明が途中で終わった・理由が言われなかった・家族が聞き返しそびれた）を、次に家族が先生へ聞ける質問の形にする。体の判断を求める形ではなく「〜はどういう意味ですか」「〜の時はどうすればいいですか」のように。
- answered: 「今日聞く予定だった事」の一つずつに、録音の中の先生の答えを対応させる。答えが無ければ answer と quote を null に。
- summary: 家族への3行（3つまで）。1行目=何をした健診か、2行目=先生が伝えた一番大事な事、3行目=次までにやる事（無ければ2行でよい）。次の予約の日付は summary に書かない（nextAppointment に入れる。家族が確かめてから画面に出す）。1つは一文で40字まで（スマホで1行）。数値を並べない。専門の言葉（子宮頸管長・頭位・尿蛋白など）は使わず「赤ちゃんは頭が下」「子宮の出口の長さ」のように言い換える（元の言葉は terms に入れる）。安心させる言葉や評価（順調・問題なし など）は、先生がそう言った時だけ、引用として書く。`;

export function organizePrompt(v: VisitData, members: string[]): string {
  const t = v.transcript!;
  const agenda = v.agenda?.length ? v.agenda.map((a) => `- ${a.text}`).join("\n") : "（なし）";
  return `健診の日: ${v.date}（${v.label}）
家族: ${members.join("、") || "（未設定）"}
今日聞く予定だった事:
${agenda}

文字起こし${t.source === "asr" ? "（[分:秒] は録音の時刻）" : ""}:
${transcriptForPrompt(t)}`;
}

/** 整理の頼み1回分: 受け取る形・頼みの字・家族の言葉（家族の言葉を頼まない時は null） */
export type OrganizeCall =
  | { schema: typeof OrganizedSchema; prompt: string; lang: null }
  | { schema: typeof OrganizedWithFamilySchema; prompt: string; lang: FamilyLang };

/**
 * 整理の頼みを組む。lang は整理を頼んだ人の画面の言葉（app/api/visit/[id]/finish の langOf(req)。やり直しは、やり直しを押した人の言葉）。
 * 日本語の画面・印が off の時は、受け取る形は OrganizedSchema そのもの・頼みは organizePrompt の字のまま（前と1字も同じ）。
 * zh・en で印が on の時だけ、受け取る形に family を足し、頼みの最後に家族の言葉の段（organizeLangNote）を足す
 */
export function organizeCall(v: VisitData, members: string[], lang: Lang | null | undefined, on: boolean = claudeLangOn("visit")): OrganizeCall {
  const prompt = organizePrompt(v, members);
  const l = claudeLangOf(lang, on);
  if (!l) return { schema: OrganizedSchema, prompt, lang: null };
  return { schema: OrganizedWithFamilySchema, prompt: prompt + organizeLangNote(l, on), lang: l };
}

/**
 * Claude の答えを、保存する形にする。家族の言葉を頼まなかった時は、受け取ったまま（前と同じ）。
 * 頼んだ時は、family の数が日本語の欄とそろう時だけ family と lang を残す（そろわない時は family を捨て、日本語だけで出す）
 */
export function organizedResult(raw: Organized & { family?: FamilyWords }, lang: FamilyLang | null): VisitResult {
  if (!lang) return raw;
  const { family, ...ja } = raw;
  return family && familyFits(ja, family) ? { ...ja, family, lang } : ja;
}
