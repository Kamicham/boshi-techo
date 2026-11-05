// ⑤ 健診の1日: サーバ側の処理（録音のつなぎ・文字起こし・Claude で整理・道案内）。
// 関所（2026-11-05 監査 #2）: どの口も visitFor（健診を id で引き、その健診の世帯で「セッション → 世帯 → 権限」）か、
// familyFor（家族の id で世帯を指す口）を通る。よその世帯の健診は、在るかどうかも見せずに 404。
// 読むだけの人（祖父母など・member）には、健診を開かない（403。notForReaders。2026-11-05 家族の声②の C の3）。
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { get, list, patch, put, remove, filesDir, type Doc } from "@/lib/db";
import { HttpError, requireFamily } from "@/lib/family";
import type { Perm } from "@/lib/access";
import { MODEL, structured, imageBlock, type SendWho } from "@/lib/claude";
import { transcribe } from "@/lib/asr";
import { getKeep, remember } from "@/lib/keep";
import {
  ASR_HINT,
  GuideSchema,
  OrganizedSchema,
  chunkName,
  isSafeExt,
  mergeTranscripts,
  concernSide,
  nextAgenda,
  orderChunks,
  orderTakeDirs,
  planId,
  resolveAppointmentDate,
  segmentsFromText,
  takeDirName,
  transcriptForPrompt,
  visitLabel,
  nextOfVisit,
  type NextCheck,
  type Take,
  type VisitData,
  type VisitPlan,
} from "@/lib/visit";
import { afterCheck, afterOrganize, planNextAfterDelete } from "@/lib/visit-next";
import { fromDay, toDay } from "@/lib/clock";
import { recordViewerOf } from "@/lib/mother-records";
import { familyFor, type FamilyAccess, type HouseholdAccess } from "../../_lib/household";

export type VisitDoc = Doc<VisitData>;

const NOT_FOUND = "この健診の記録が見つかりません";

/**
 * 読むだけの人（祖父母など・member）には、健診（一覧・1回分・次の予約・受診券・払った額・気がかり）を開かない。
 * 作り手の決め（2026-11-05）「読むだけの人には、ママの記録を見せない」と、招く時の「母の健診の記録」が既定で見せない項目である事に合わせる
 * （選んだ項目を読む所はまだ無いので、選んでも今は見せない）。子の健診も一緒に隠れる（祖父母が赤ちゃんの健診を見る形は、提出の後の案）
 */
export function notForReaders(h: HouseholdAccess): void {
  if (recordViewerOf(h) === "reader") throw new HttpError(403, "健診の記録は、ママと、記録を書ける家族だけが開けます");
}

/** 健診を1つ引く（無ければ 404） */
export function requireVisit(id: string): VisitDoc {
  const d = get<VisitData>(id);
  if (!d || d.type !== "visit" || d.data.kind !== "visit") throw new HttpError(404, NOT_FOUND);
  return d;
}

/**
 * 健診1回分の関所: 健診を id で引き、その健診の世帯について「セッション → 世帯 → 権限」を通す（familyFor → withHousehold）。
 * よその世帯の健診・家族の設定が無い世帯の健診は、在るかどうかも見せずに 404。ログインが要る（401）・権限が無い（403）・そのほかの失敗は、そのまま返す
 * （403 は世帯の一員にだけ出るので、よその人には健診が在るかどうかが漏れない）。
 * 公開版で見本の家族の健診を頼んだ時は、関所がその人の体験の写しに置き換えるので、id が合わず 404（共有の見本の健診は書かせない）。
 * アカウントの仕組みを動かす前（わが家の置き場）は、今までどおり健診の家族の id で通す（api/_lib/household.ts の legacyAccess）。
 */
export async function visitFor(req: Request, id: string, perm: Perm | readonly Perm[]): Promise<{ v: VisitDoc; h: FamilyAccess }> {
  const v = requireVisit(id);
  let h: FamilyAccess;
  try {
    h = await familyFor(req, v.familyId, perm);
  } catch (e) {
    if (e instanceof HttpError && e.status === 404) throw new HttpError(404, NOT_FOUND);
    throw e;
  }
  if (h.id !== v.familyId) throw new HttpError(404, NOT_FOUND);
  notForReaders(h);
  return { v, h };
}

export function visitsOf(familyId: string): VisitDoc[] {
  return list<VisitData>(familyId, "visit").filter((d) => d.data.kind === "visit");
}

export function getPlan(familyId: string): VisitPlan {
  return get<VisitPlan>(planId(familyId))?.data ?? { kind: "plan", concerns: [] };
}

export function savePlan(familyId: string, plan: VisitPlan): VisitPlan {
  return put<VisitPlan>(familyId, "visit", plan, { id: planId(familyId) }).data;
}

/** もう生まれていれば、生まれた日（健診で聞く事の振り分けに使う） */
export function bornOn(fam: { birthDate?: string }, today: string): string | null {
  return fam.birthDate && fam.birthDate <= today ? fam.birthDate : null;
}

/** 新しい健診を作る。前回の質問と気がかりを「今日聞く事」に移す */
export function createVisit(familyId: string, date: string, opts: { demo?: boolean; demoAgenda?: string[] } = {}): VisitDoc {
  const fam = requireFamily(familyId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "健診の日付が読めません");
  const plan = getPlan(familyId);
  const visits = visitsOf(familyId).map((v) => ({ id: v.id, ...v.data, createdAt: v.createdAt }));
  // デモの健診は家族の持ち越しに触らず、渡された気がかりだけを入れる
  const { items, fromVisit } = opts.demo
    ? { items: (opts.demoAgenda ?? []).map((text, i) => ({ id: `demo:${i}`, text, from: "気がかり" as const })), fromVisit: null }
    : nextAgenda(visits, plan, bornOn(fam, date));
  const doc = put<VisitData>(
    familyId,
    "visit",
    {
      kind: "visit",
      date,
      label: visitLabel(fam, date),
      status: "ready",
      agenda: items,
      demo: opts.demo || undefined,
      carried: opts.demo ? undefined : { prevCarriedFrom: plan.carriedFrom, concerns: plan.concerns.filter((c) => concernSide(c, bornOn(fam, date)) === "mother") },
    },
    { date },
  );
  // ママの健診を始めても、子の健診で聞く事・妊娠中のふり返りは残す
  if (!opts.demo) savePlan(familyId, { ...plan, concerns: plan.concerns.filter((c) => concernSide(c, bornOn(fam, date)) !== "mother"), carriedFrom: fromVisit ?? plan.carriedFrom });
  return doc;
}

/** 今日始めた、まだ録音中の健診（デモは除く）。健診を始めた後に足した気がかりは、ここへ入れる */
export function ongoingVisit(familyId: string, today: string | undefined): VisitDoc | null {
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  return visitsOf(familyId).find((v) => v.data.date === today && !v.data.demo && (v.data.status === "ready" || v.data.status === "recording")) ?? null;
}

// ───────── 録音 ─────────

function visitDir(v: VisitDoc, ...sub: string[]) {
  return filesDir(v.familyId, "visits", v.id, ...sub);
}

/** chunk を1つ保存する（同じ seq がもう一度来たら上書き＝送り直しに強い） */
export function saveChunk(v: VisitDoc, take: number, seq: number, ext: string, mime: string, data: Buffer): Take[] {
  if (!Number.isInteger(take) || take < 0 || take > 99) throw new HttpError(400, "録音の番号が読めません");
  if (!Number.isInteger(seq) || seq < 0 || seq > 99999) throw new HttpError(400, "chunk の番号が読めません");
  if (!isSafeExt(ext)) throw new HttpError(400, "録音の形式が読めません");
  if (!data.length) throw new HttpError(400, "録音が空でした");
  if (v.data.status === "transcribing" || v.data.status === "organizing") throw new HttpError(409, "この健診はもう文字起こしを始めています");
  const dir = visitDir(v, takeDirName(take));
  // 頭の一切れがもう一度来た時、続きの切れ端まであるなら別の録音の上書きなので断る
  if (seq === 0 && fs.readdirSync(dir).some((f) => /^chunk-\d+\./.test(f) && !f.startsWith("chunk-0000."))) {
    throw new HttpError(409, "この番号の録音はもう届いています（上書きしません）");
  }
  fs.writeFileSync(path.join(dir, chunkName(seq, ext)), data);
  // 今の v は古いかもしれないので、書く直前に読み直す
  const cur = requireVisit(v.id);
  const takes = [...(cur.data.takes ?? [])];
  while (takes.length <= take) takes.push({ mime, ext, chunks: 0, bytes: 0 });
  const t = takes[take];
  takes[take] = { mime: t.mime || mime, ext: t.ext || ext, chunks: Math.max(t.chunks, seq + 1), bytes: t.bytes + data.length };
  patch<VisitData>(v.id, { takes, status: "recording", consent: true });
  return takes;
}

/** 新しい録音の番号を確保する（空の take を1つ足す） */
export function reserveTake(v: VisitDoc): number {
  if (v.data.status === "transcribing" || v.data.status === "organizing") throw new HttpError(409, "この健診はもう文字起こしを始めています");
  const cur = requireVisit(v.id);
  const takes = [...(cur.data.takes ?? [])];
  if (takes.length > 99) throw new HttpError(400, "録音の数が多すぎます");
  takes.push({ mime: "", ext: "", chunks: 0, bytes: 0 });
  patch<VisitData>(v.id, { takes });
  return takes.length - 1;
}

/** take ごとに chunk を順につないで recording.<拡張子> を作る */
function joinTakes(v: VisitDoc): { file: string; missing: number[] }[] {
  const root = visitDir(v);
  const out: { file: string; missing: number[] }[] = [];
  for (const dirName of orderTakeDirs(fs.readdirSync(root))) {
    const dir = path.join(root, dirName);
    const { files, ext, missing } = orderChunks(fs.readdirSync(dir));
    if (!files.length || !ext) continue;
    const file = path.join(dir, `recording.${ext}`);
    fs.writeFileSync(file, Buffer.concat(files.map((f) => fs.readFileSync(path.join(dir, f)))));
    out.push({ file, missing });
  }
  return out;
}

// ───────── 文字起こし → 整理（サーバの中で続ける） ─────────

const g = globalThis as unknown as { __visitRunning?: Set<string> };
const running = (g.__visitRunning ??= new Set<string>());

export function isRunning(id: string) {
  return running.has(id);
}

/** finish: すぐ返し、処理は裏で続ける。who は Claude に送る時の印（関所の h.who。同意と使った額の記録に使う） */
export function startFinish(v: VisitDoc, who: SendWho, transcriptText?: string): VisitData {
  if (running.has(v.id)) return v.data;
  const now = new Date().toISOString();
  let reuse = false;
  if (transcriptText && transcriptText.trim()) {
    patch<VisitData>(v.id, {
      transcript: { text: transcriptText.trim(), segments: segmentsFromText(transcriptText), source: "text" },
      status: "organizing",
      processingSince: now,
      error: undefined,
      failedAt: undefined,
    });
    reuse = true;
  } else if (v.data.transcript && (v.data.failedAt === "organize" || v.data.status === "done" || v.data.transcript.source === "text")) {
    // 整理だけやり直す
    patch<VisitData>(v.id, { status: "organizing", processingSince: now, error: undefined, failedAt: undefined });
    reuse = true;
  } else {
    if (!v.data.takes?.some((t) => t.chunks > 0)) throw new HttpError(400, "まだ録音が届いていません");
    patch<VisitData>(v.id, { status: "transcribing", processingSince: now, error: undefined, failedAt: undefined });
  }
  running.add(v.id);
  void runPipeline(v.id, reuse, who).finally(() => running.delete(v.id));
  return requireVisit(v.id).data;
}

async function runPipeline(id: string, reuseTranscript: boolean, who: SendWho) {
  let stage: "transcribe" | "organize" = "transcribe";
  try {
    let v = requireVisit(id);
    if (!reuseTranscript) {
      const joined = joinTakes(v);
      if (!joined.length) throw new Error("録音のファイルが見つかりません");
      // 読めない録音（頭の一切れが届かなかった等）があっても、読める録音だけで続ける
      const parts = [];
      const notes: string[] = [];
      let lastErr: unknown = null;
      for (const [i, j] of joined.entries()) {
        try {
          // 家族を渡す: 文字起こしの機械が無い時、本物の世帯はデモの文字起こしを入れずに止める（作った家族だけデモに落とす）
          const t = await transcribe(fs.readFileSync(j.file), ASR_HINT, "visit", v.familyId);
          parts.push(t);
          // 文字起こしの機械が無い環境（審査員の手元など）: 用意したデモの会話を1回だけ使う
          if (t.demo) {
            notes.push("文字起こしの機械（ASR_URL）が無いので、用意したデモの文字起こしを使いました");
            break;
          }
          if (j.missing.length) notes.push(`${i + 1}本目の録音の途中 ${j.missing.length * 10} 秒ほどが届いていません（通信が切れた所）`);
        } catch (e) {
          console.error("[visit] take", i, e);
          lastErr = e;
          notes.push(`${i + 1}本目の録音が読めませんでした（端末に保存した録音があれば「録音ファイルを取り込む」で足せます）`);
        }
      }
      if (!parts.length) throw lastErr instanceof Error ? lastErr : new Error("録音を読めませんでした");
      const transcript = mergeTranscripts(parts);
      if (!transcript.text.trim()) throw new Error("録音から言葉を聞き取れませんでした（マイクが遠い・無音の可能性）");
      v = patch<VisitData>(id, {
        transcript,
        status: "organizing",
        warning: notes.length ? notes.join("。") : undefined,
      })!;
    }
    stage = "organize";
    const fam = requireFamily(v.familyId);
    const result = await structured(OrganizedSchema, ORGANIZE_SYSTEM, organizePrompt(v.data, fam.members.map((m) => `${m.name}（${m.role}）`)), {
      model: MODEL,
      effort: "medium",
      who,
      task: "visit-organize",
    });
    // 録音から聞こえた次の予約日。本人が確かめた日は上書きしない・聞こえなくなったら確かめていない予約は外す（lib/visit-next.ts の afterOrganize）
    const heardDate = result.nextAppointment ? resolveAppointmentDate(v.data.date, result.nextAppointment) : null;
    const heard = heardDate ? { date: heardDate, time: result.nextAppointment?.time ?? null, said: result.nextAppointment?.said } : null;
    // 整理の間に家族が確かめたかもしれないので、書く直前に読み直す
    const cur = requireVisit(id);
    const plan = getPlan(v.familyId);
    const out = afterOrganize({ id, date: cur.data.date, nextDate: cur.data.nextDate, nextCheck: cur.data.nextCheck }, heard, plan.next);
    patch<VisitData>(id, { result, nextDate: out.nextDate, nextCheck: out.nextCheck, status: "done", processingSince: undefined, failedAt: undefined });
    if (out.planNext !== (plan.next ?? null)) savePlan(v.familyId, { ...plan, next: out.planNext });
  } catch (e) {
    console.error("[visit]", e);
    const msg = friendlyError(e);
    patch<VisitData>(id, {
      status: "failed",
      failedAt: stage,
      processingSince: undefined,
      error: stage === "transcribe" ? `文字起こしができませんでした: ${msg}` : `整理ができませんでした: ${msg}`,
    });
  }
}

/** 機械の英語のエラーを、家族が読める日本語にする */
function friendlyError(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  if (/ECONNREFUSED|EHOSTUNREACH|ETIMEDOUT|ENOTFOUND|socket hang up|ECONNRESET/i.test(m)) return "家の文字起こしの機械につながりませんでした。少し待ってから「もう一度やってみる」を押してください";
  if (/overloaded|529|rate|429/i.test(m)) return "Claude が混み合っています。少し待ってから「もう一度やってみる」を押してください";
  if (/[ぁ-んァ-ン一-龥]/.test(m)) return m;
  return "うまくいきませんでした。少し待ってから「もう一度やってみる」を押してください";
}

const ORGANIZE_SYSTEM = `あなたの役目: 妊婦健診・乳幼児健診の録音の文字起こしを、家族があとで読み返せる形に整理する。
- 文字起こしは機械によるもので、話し手の名前は付いていない。言い方から、先生・家族・看護師を見分ける。聞き間違いらしい所は前後から元の言葉を推し量るが、推し量った時は引用をそのまま残す。
- said: 先生が言った事。point は短い要点、quote は文字起こしのままの引用（直さない）。
- todo: 先生が「次までに」「〜してきてください」と言った物だけ。自分で足さない。
- nextAppointment: 次の予約を言った時だけ。言われた形のまま、月日・「◯週間後」・曜日・時刻に分けて入れる（日付の計算はしない）。言っていなければ null。
- numbers: 話に出た数値を、言われたとおりの値と単位で。正常・異常・多い・少ない・順調などの評価は書かない。
- terms: 家族が分からなかったかもしれない専門用語（子宮頸管長・頭位・推定体重など）。plain は「それが何か／何を測るものか」だけを、中学生に話すような言葉で1〜2文。今回の値が良いか悪いか、心配かどうかは書かない。
- questions: 話の中で意味が残った所（説明が途中で終わった・理由が言われなかった・家族が聞き返しそびれた）を、次に家族が先生へ聞ける質問の形にする。体の判断を求める形ではなく「〜はどういう意味ですか」「〜の時はどうすればいいですか」のように。
- answered: 「今日聞く予定だった事」の一つずつに、録音の中の先生の答えを対応させる。答えが無ければ answer と quote を null に。
- summary: 家族への3行（3つまで）。1行目=何をした健診か、2行目=先生が伝えた一番大事な事、3行目=次までにやる事（無ければ2行でよい）。次の予約の日付は summary に書かない（nextAppointment に入れる。家族が確かめてから画面に出す）。1つは一文で40字まで（スマホで1行）。数値を並べない。専門の言葉（子宮頸管長・頭位・尿蛋白など）は使わず「赤ちゃんは頭が下」「子宮の出口の長さ」のように言い換える（元の言葉は terms に入れる）。安心させる言葉や評価（順調・問題なし など）は、先生がそう言った時だけ、引用として書く。`;

function organizePrompt(v: VisitData, members: string[]): string {
  const t = v.transcript!;
  const agenda = v.agenda?.length ? v.agenda.map((a) => `- ${a.text}`).join("\n") : "（なし）";
  return `健診の日: ${v.date}（${v.label}）
家族: ${members.join("、") || "（未設定）"}
今日聞く予定だった事:
${agenda}

文字起こし${t.source === "asr" ? "（[分:秒] は録音の時刻）" : ""}:
${transcriptForPrompt(t)}`;
}

// ───────── 院内の道案内 ─────────

const GUIDE_SYSTEM = `あなたの役目: 病院の案内図・受付票・番号札などの写真から、家族が今日回る順番を作る。
- 写真に書いてある事だけを使う。書いていない場所や階を作らない。読めない時は floor や note を null にし、unsure に「受付で確かめる事」として書く。
- 受付票に回る順（例: 受付→採尿→計測→診察→会計）が書いてあれば、その順を正とする。無ければ妊婦健診の一般的な流れ（受付・採尿・体重と血圧・診察・会計）を案内図に当てはめ、unsure にそう書く。
- what は短く（例「尿を取って、窓口に出す」）。note は番号札・持って行く物・待つ場所など。体の判断はしない。`;

export async function makeGuide(v: VisitDoc, images: string[], who: SendWho) {
  if (!images.length) throw new HttpError(400, "写真がありません");
  if (images.length > 6) throw new HttpError(400, "写真は6枚までにしてください");
  const blocks = images.map((d) => imageBlock(d));
  const out = await structured(GuideSchema, GUIDE_SYSTEM, [...blocks, { type: "text", text: `健診の日: ${v.data.date}（${v.data.label}）。今日回る順番を作ってください。` }], {
    model: MODEL,
    effort: "low",
    who,
    task: "visit-guide",
  });
  const guide = { steps: out.steps, done: [] as number[], at: new Date().toISOString(), unsure: out.unsure };
  patch<VisitData>(v.id, { guide });
  // 院内の順番はそう変わらないので「いつもの病院」として覚え、次の健診では撮らずに出す
  if (out.steps.length) {
    remember(v.familyId, {
      hospital: { name: out.hospital?.trim() || undefined, guide: { steps: out.steps, unsure: out.unsure, at: guide.at, fromVisit: v.id } },
    });
  }
  return guide;
}

/** 覚えている「いつもの順番」を、この健診の道案内にする（撮らずに使う） */
export function keptGuideFor(v: VisitDoc): VisitData["guide"] | null {
  const k = getKeep(v.familyId).hospital?.guide;
  if (!k?.steps?.length) return null;
  return { steps: k.steps, done: [], at: new Date().toISOString(), unsure: k.unsure ?? null };
}

/**
 * 健診を消す（録音のファイルも）。まだ整理していない健診なら、持ち越した聞く事を元へ戻す。
 * この健診から入った次の予約は、まだ確かめていなければ一緒に外し、本人が確かめた日は手で入れた予定として残す（lib/visit-next.ts）
 */
export function deleteVisit(v: VisitDoc) {
  if (running.has(v.id)) throw new HttpError(409, "いま整理している最中です。終わってから消してください");
  fs.rmSync(visitDir(v), { recursive: true, force: true });
  remove(v.id);
  const plan = getPlan(v.familyId);
  const next = planNextAfterDelete(plan.next ?? null, { id: v.id, date: v.data.date, nextCheck: v.data.nextCheck });
  const carried = v.data.carried && v.data.status !== "done" ? v.data.carried : null;
  if (!carried && next === (plan.next ?? null)) return;
  const known = new Set(plan.concerns.map((c) => c.id));
  savePlan(v.familyId, {
    ...plan,
    next,
    ...(carried ? { carriedFrom: carried.prevCarriedFrom, concerns: [...carried.concerns.filter((c) => !known.has(c.id)), ...plan.concerns] } : {}),
  });
}

/** 確かめのボタンを出してよいか（書ける人だけ。公開版は健診の書く口を middleware.ts が閉じているので出さない＝押しても保存しない形は 11/6） */
export function canWriteVisit(h: HouseholdAccess): boolean {
  return h.can("record:write") && process.env.BOSHI_PUBLIC !== "1";
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const HM = /^\d{2}:\d{2}$/;

/**
 * 結果の画面の1問の答え（大丈夫・直す・言われていない）。押した人と時刻を残し、次の予約日と次の予約（plan.next）を本人の日にそろえる。
 * 大丈夫は、画面に出ていた日（date）を一緒に受け、ほかの家族が先に別の日へ直していたら 409（古い画面のまま上書きしない）
 */
export function answerNext(v: VisitDoc, input: unknown, account: string | null): Partial<VisitData> {
  const b = (input && typeof input === "object" ? input : {}) as { state?: unknown; date?: unknown; time?: unknown; by?: unknown };
  const state = b.state;
  if (state !== "ok" && state !== "fixed" && state !== "none") throw new HttpError(400, "確かめの答えが読めません");
  const result = v.data.result;
  if (v.data.status !== "done" || !result) throw new HttpError(409, "まとめができてから確かめられます");
  const by = typeof b.by === "string" && b.by.trim() ? b.by.trim().slice(0, 40) : null;
  const at = new Date().toISOString();
  let check: NextCheck;
  if (state === "ok") {
    const cur = nextOfVisit(v.data);
    if (!cur) throw new HttpError(409, "確かめる日がありません。日付を入れてください");
    if (typeof b.date === "string" && b.date !== cur.date) throw new HttpError(409, "ほかの家族が、先に別の日で確かめました。開き直してください");
    check = { state, date: cur.date, time: cur.time, at, by };
  } else if (state === "fixed") {
    if (typeof b.date !== "string" || !DAY.test(b.date) || fromDay(toDay(b.date)) !== b.date) throw new HttpError(400, "日付が読めません");
    if (b.time != null && b.time !== "" && (typeof b.time !== "string" || !HM.test(b.time))) throw new HttpError(400, "時刻が読めません");
    if (b.date < v.data.date) throw new HttpError(400, "健診の日より前の日は入れられません");
    check = { state, date: b.date, time: typeof b.time === "string" && b.time ? b.time : null, at, by };
  } else {
    check = { state, at, by };
  }
  if (account) check.account = account;
  const plan = getPlan(v.familyId);
  // この健診より後の日の「できた」健診があれば、この答えでその健診の予約を上書きしない
  const newest = !visitsOf(v.familyId).some((d) => d.id !== v.id && d.data.status === "done" && d.data.date > v.data.date);
  const out = afterCheck({ id: v.id, date: v.data.date }, result.nextAppointment?.said, plan.next ?? null, check, newest);
  if (out.planNext !== (plan.next ?? null)) savePlan(v.familyId, { ...plan, next: out.planNext });
  return { nextCheck: check, nextDate: out.nextDate };
}

export const newId = () => randomUUID();
