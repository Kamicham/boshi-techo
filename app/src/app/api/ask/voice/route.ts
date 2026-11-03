// 手帳に聞く（声）: 録音を文字にして返すだけ（答えは画面が /api/ask に聞き直す）。記録にはしない。
import { route } from "@/lib/api";
import { transcribe } from "@/lib/asr";
import { HttpError, requireFamily } from "@/lib/family";

export const POST = route(async (req: Request) => {
  const family = requireFamily(new URL(req.url).searchParams.get("familyId"));
  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length < 1000) throw new HttpError(400, "録音が短すぎました。もう少し長く押してください");
  if (audio.length > 20 * 1024 * 1024) throw new HttpError(400, "録音が長すぎます");
  const names = [family.childName, ...family.members.map((m) => m.name)].filter(Boolean).join("、");
  const t = await transcribe(audio, `母子手帳への質問。${names}。出生届、児童手当、育休、保育園、健診、予防接種。`);
  // 文字起こしの機械が無い時（審査員の手元など）は、記録用のデモの文を問いにしない
  if (t.demo) throw new HttpError(503, "この環境では声を文字にできません。下の欄に書いてください");
  const text = t.text.trim();
  if (!text) throw new HttpError(422, "声が聞き取れませんでした。もう一度話すか、書いてください");
  return { text };
});
