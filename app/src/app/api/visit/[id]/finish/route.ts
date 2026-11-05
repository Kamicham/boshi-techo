// 録音を止めた: 文字起こし → 整理 をサーバの中で始め、すぐ返す。
// 本文に {transcriptText} があれば、音声を飛ばして整理だけ行う。
import { route } from "@/lib/api";
import { assertConsent } from "@/lib/claude";
import { WRITE_AND_SEND } from "../../../_lib/household";
import { startFinish, visitFor } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { v, h } = await visitFor(req, (await params).id, WRITE_AND_SEND);
  const b = (await req.json().catch(() => ({}))) as { transcriptText?: string };
  // 書き起こしは裏で Claude に送るので、文字起こし（時間がかかる）を始める前に同意を確かめる（本物の世帯だけ）
  assertConsent(h.who);
  const data = startFinish(v, h.who, typeof b.transcriptText === "string" ? b.transcriptText : undefined);
  return { status: "processing", visit: { id: v.id, ...data } };
});
