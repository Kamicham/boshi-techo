// 録音を止めた: 文字起こし → 整理 をサーバの中で始め、すぐ返す。
// 本文に {transcriptText} があれば、音声を飛ばして整理だけ行う。
import { route } from "@/lib/api";
import { requireVisit, startFinish } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const v = requireVisit((await params).id);
  const b = (await req.json().catch(() => ({}))) as { transcriptText?: string };
  const data = startFinish(v, typeof b.transcriptText === "string" ? b.transcriptText : undefined);
  return { status: "processing", visit: { id: v.id, ...data } };
});
