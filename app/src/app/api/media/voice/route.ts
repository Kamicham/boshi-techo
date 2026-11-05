// 声を残す（思い出の録り方: おなかに話しかける・寝る前のひとこと・名前を呼ぶ）。
// 声は世帯の鍵で暗号にして置く。文字にするのは自宅の機械（lib/asr.ts）だけで、Claude には何も送らない（記録の振り分けにもかけない）。
// 関所は土台の withHousehold（ログイン → 世帯 → 権限）。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { transcribe } from "@/lib/asr";
import { HttpError } from "@/lib/http-error";
import { readBytes } from "@/lib/read-body";
import { contributorFrom, saveAudio, toClient, VOICE_MOMENTS, type VoiceMoment } from "@/lib/media";

export const maxDuration = 120;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MOMENTS = [...VOICE_MOMENTS.map((m) => m.id), "message"] as string[];

export const POST = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  // 家族の記録を書ける人と、みんなの章に足せる人（祖父母など）が通る
  const ctx = await withHousehold(req, q.get("familyId"), "media:contribute");
  const from = contributorFrom(ctx, q.get("relation"));
  // 生の中身は readBytes で読む（32MB を超える・途中で切れた中身は 413。lib/read-body.ts）
  const audio = await readBytes(req);
  if (audio.length < 1000) throw new HttpError(400, "録音が短すぎました。もう少し長く押してください");
  const m = q.get("moment") ?? "";
  if (!MOMENTS.includes(m)) throw new HttpError(400, "録り方が分かりません");
  const today = DAY.test(q.get("today") ?? "") ? q.get("today")! : undefined;
  const who = from ? from.name : q.get("who");
  // 文字は、声を聞き返す時の手がかりと一冊の候補に使う。機械が無い所（デモの文が返る）では残さない
  let transcript: string | null = null;
  try {
    const names = [ctx.family?.childName, ...(ctx.family?.members ?? []).map((x) => x.name)].filter(Boolean).join("、");
    const t = await transcribe(audio, `家族の声。${names}。`);
    if (!t.demo) transcript = t.text.trim() || null;
  } catch (e) {
    // 文字にできなくても声は残す
    console.error(e);
  }
  const dur = Number(q.get("sec"));
  const r = await saveAudio(ctx, {
    audio,
    moment: m as VoiceMoment,
    who,
    spokenTo: m === "belly" || m === "name" ? (ctx.family?.childName ?? null) : null,
    transcript,
    durationSec: Number.isFinite(dur) ? dur : null,
    today,
    from,
  });
  return { media: toClient(ctx.household.id, r.media, ctx.account?.id), duplicate: r.duplicate };
});
