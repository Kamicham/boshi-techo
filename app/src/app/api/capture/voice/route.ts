// 話した音声（生のバイト列）→ 文字起こし → 記録と予定
// 家族と今日は URL の ?familyId=&today= で受け取る
import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { transcribe } from "@/lib/asr";
import { capture } from "@/lib/capture";
import { HttpError, requireFamily } from "@/lib/family";
import { todayOf } from "../shared";

export const POST = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  const today = todayOf(q.get("today"));
  const audio = Buffer.from(await req.arrayBuffer());
  if (audio.length < 1000) throw new HttpError(400, "録音が短すぎました。もう少し長く押してください");
  if (audio.length > 30 * 1024 * 1024) throw new HttpError(400, "録音が長すぎます");
  const names = [family.childName, ...family.members.map((m) => m.name)].filter(Boolean).join("、");
  const t = await transcribe(audio, `母子手帳の記録。${names}。妊婦健診、つわり、胎動、母子健康手帳、出生届、保育園。`);
  const text = t.text.trim();
  if (!text) throw new HttpError(422, "声が聞き取れませんでした。もう一度話してみてください");
  try {
    const result = await capture({ family, today, source: "voice", text });
    return { ...result, transcript: text, ...(t.demo ? { demo: true, note: "文字起こしの機械が無いので、デモの文を使いました" } : {}) };
  } catch (e) {
    // 文字起こしは済んでいるので捨てない。画面は書く欄に入れて送り直せる
    console.error(e);
    const error = e instanceof HttpError ? e.message : "聞き取った言葉を手帳に書けませんでした。下の欄に入れたので、もう一度「手帳に書く」を押してください";
    return NextResponse.json({ error, transcript: text }, { status: 502 });
  }
});
