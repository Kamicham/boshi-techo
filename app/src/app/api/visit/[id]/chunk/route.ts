// 録音の一切れ（10秒ごと）を受け取る。本文は生のバイト列。
// POST /api/visit/[id]/chunk?seq=N&take=T&ext=webm
import { route } from "@/lib/api";
import { extFromMime } from "@/lib/visit";
import { requireVisit, saveChunk } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const v = requireVisit((await params).id);
  const q = new URL(req.url).searchParams;
  const mime = req.headers.get("content-type") ?? "";
  const ext = q.get("ext") || extFromMime(mime);
  const data = Buffer.from(await req.arrayBuffer());
  const takes = saveChunk(v, Number(q.get("take") ?? 0), Number(q.get("seq")), ext, mime, data);
  return { ok: true, takes };
});
