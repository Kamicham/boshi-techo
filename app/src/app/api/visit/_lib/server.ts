// ⑤ 健診の1日: サーバ側の処理（録音のつなぎ・文字起こし・Claude で整理・道案内）。
import "server-only";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { get, list, patch, put, remove, filesDir, type Doc } from "@/lib/db";
import { HttpError, requireFamily } from "@/lib/family";
import { structured, imageBlock } from "@/lib/claude";
import { transcribe } from "@/lib/asr";
import {
  ASR_HINT,
  GuideSchema,
  OrganizedSchema,
  chunkName,
  isSafeExt,
  mergeTranscripts,
  nextAgenda,
  orderChunks,
  orderTakeDirs,
  planId,
  resolveAppointmentDate,
  segmentsFromText,
  takeDirName,
  transcriptForPrompt,
  visitLabel,
  type Take,
  type VisitData,
  type VisitPlan,
} from "@/lib/visit";

export type VisitDoc = Doc<VisitData>;

/** 健診を1つ引く（無ければ 404） */
export function requireVisit(id: string): VisitDoc {
  const d = get<VisitData>(id);
  if (!d || d.type !== "visit" || d.data.kind !== "visit") throw new HttpError(404, "この健診の記録が見つかりません");
  return d;
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

/** 新しい健診を作る。前回の質問と気がかりを「今日聞く事」に移す */
export function createVisit(familyId: string, date: string, opts: { demo?: boolean; demoAgenda?: string[] } = {}): VisitDoc {
  const fam = requireFamily(familyId);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "健診の日付が読めません");
  const plan = getPlan(familyId);
  const visits = visitsOf(familyId).map((v) => ({ id: v.id, ...v.data, createdAt: v.createdAt }));
  // デモの健診は家族の持ち越しに触らず、渡された気がかりだけを入れる
  const { items, fromVisit } = opts.demo
    ? { items: (opts.demoAgenda ?? []).map((text, i) => ({ id: `demo:${i}`, text, from: "気がかり" as const })), fromVisit: null }
    : nextAgenda(visits, plan);
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
      carried: opts.demo ? undefined : { prevCarriedFrom: plan.carriedFrom, concerns: plan.concerns },
    },
    { date },
  );
  if (!opts.demo) savePlan(familyId, { ...plan, concerns: [], carriedFrom: fromVisit ?? plan.carriedFrom });
  return doc;
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

/** finish: すぐ返し、処理は裏で続ける */
export function startFinish(v: VisitDoc, transcriptText?: string): VisitData {
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
  void runPipeline(v.id, reuse).finally(() => running.delete(v.id));
  return requireVisit(v.id).data;
}

async function runPipeline(id: string, reuseTranscript: boolean) {
  let stage: "transcribe" | "organize" = "transcribe";
  try {
    let v = requireVisit(id);
    if (!reuseTranscript) {
      const joined = joinTakes(v);
      if (!joined.length) throw new Error("録音のファイルが見つかりません");
      const parts = [];
      for (const j of joined) parts.push(await transcribe(fs.readFileSync(j.file), ASR_HINT));
      const transcript = mergeTranscripts(parts);
      if (!transcript.text.trim()) throw new Error("録音から言葉を聞き取れませんでした（マイクが遠い・無音の可能性）");
      const missing = joined.reduce((n, j) => n + j.missing.length, 0);
      v = patch<VisitData>(id, {
        transcript,
        status: "organizing",
        warning: missing ? `途中の ${missing * 10} 秒ほどが届いていません（通信が切れた所）` : undefined,
      })!;
    }
    stage = "organize";
    const fam = requireFamily(v.familyId);
    const result = await structured(OrganizedSchema, ORGANIZE_SYSTEM, organizePrompt(v.data, fam.members.map((m) => `${m.name}（${m.role}）`)), {
      effort: "medium",
    });
    const nextDate = result.nextAppointment ? resolveAppointmentDate(v.data.date, result.nextAppointment) : null;
    patch<VisitData>(id, { result, nextDate, status: "done", processingSince: undefined, failedAt: undefined });
    if (nextDate) {
      const plan = getPlan(v.familyId);
      const n = plan.next;
      // 手で入れた先の予約は残す。前の健診で決まった予約（今日以前）なら、今日の話で置き換える
      if (!n || n.date <= v.data.date || n.visitId === id) {
        savePlan(v.familyId, {
          ...plan,
          next: { date: nextDate, time: result.nextAppointment?.time ?? null, source: "visit", visitId: id, said: result.nextAppointment?.said },
        });
      }
    }
  } catch (e) {
    console.error("[visit]", e);
    const msg = e instanceof Error ? e.message : "うまくいきませんでした";
    patch<VisitData>(id, {
      status: "failed",
      failedAt: stage,
      processingSince: undefined,
      error: stage === "transcribe" ? `文字起こしができませんでした: ${msg}` : `整理ができませんでした: ${msg}`,
    });
  }
}

const ORGANIZE_SYSTEM = `あなたの役目: 妊婦健診・乳幼児健診の録音の文字起こしを、家族があとで読み返せる形に整理する。
- 文字起こしは機械によるもので、話し手の名前は付いていない。言い方から、先生・家族・看護師を見分ける。聞き間違いらしい所は前後から元の言葉を推し量るが、推し量った時は引用をそのまま残す。
- said: 先生が言った事。point は短い要点、quote は文字起こしのままの引用（直さない）。
- todo: 先生が「次までに」「〜してきてください」と言った物だけ。自分で足さない。
- nextAppointment: 次の予約を言った時だけ。言われた形のまま、月日・「◯週間後」・曜日・時刻に分けて入れる（日付の計算はしない）。言っていなければ null。
- numbers: 話に出た数値を、言われたとおりの値と単位で。正常・異常・多い・少ない・順調などの評価は書かない。
- terms: 家族が分からなかったかもしれない専門用語。plain は「それが何か／何を測るものか」だけを一般的な言葉で。今回の値が良いか悪いか、心配かどうかは書かない。
- questions: 話の中で意味が残った所（説明が途中で終わった・理由が言われなかった・家族が聞き返しそびれた）を、次に家族が先生へ聞ける質問の形にする。体の判断を求める形ではなく「〜はどういう意味ですか」「〜の時はどうすればいいですか」のように。
- answered: 「今日聞く予定だった事」の一つずつに、録音の中の先生の答えを対応させる。答えが無ければ answer と quote を null に。
- summary: 家族への3行。何をした健診か・先生が伝えた事・次までにやる事。安心させる言葉や評価（順調・問題なし など）は、先生がそう言った時だけ、引用として書く。`;

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

export async function makeGuide(v: VisitDoc, images: string[]) {
  if (!images.length) throw new HttpError(400, "写真がありません");
  if (images.length > 6) throw new HttpError(400, "写真は6枚までにしてください");
  const blocks = images.map((d) => imageBlock(d));
  const out = await structured(GuideSchema, GUIDE_SYSTEM, [...blocks, { type: "text", text: `健診の日: ${v.data.date}（${v.data.label}）。今日回る順番を作ってください。` }], {
    effort: "low",
  });
  const guide = { steps: out.steps, done: [] as number[], at: new Date().toISOString(), unsure: out.unsure };
  patch<VisitData>(v.id, { guide });
  return guide;
}

/** 健診を消す（録音のファイルも）。まだ整理していない健診なら、持ち越した聞く事を元へ戻す */
export function deleteVisit(v: VisitDoc) {
  if (running.has(v.id)) throw new HttpError(409, "いま整理している最中です。終わってから消してください");
  fs.rmSync(visitDir(v), { recursive: true, force: true });
  remove(v.id);
  if (v.data.carried && v.data.status !== "done") {
    const plan = getPlan(v.familyId);
    const known = new Set(plan.concerns.map((c) => c.id));
    savePlan(v.familyId, {
      ...plan,
      carriedFrom: v.data.carried.prevCarriedFrom,
      concerns: [...v.data.carried.concerns.filter((c) => !known.has(c.id)), ...plan.concerns],
    });
  }
}

export const newId = () => randomUUID();
