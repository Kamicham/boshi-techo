// 録音の一切れ（10秒ごと）を受け取る。本文は生のバイト列。「録音ファイルを取り込む」も、1本を丸ごと seq=0 で送る。
// POST /api/visit/[id]/chunk?seq=N&take=T&ext=webm
import { route } from "@/lib/api";
import { BIG_BODY } from "@/lib/body-limit";
import { readBytes } from "@/lib/read-body";
import { extFromMime } from "@/lib/visit";
import { saveChunk, visitFor } from "../../_lib/server";

/**
 * 1回に受ける大きさ: 写真と声の口と同じ 32MB（lib/body-limit.ts の BIG_BODY）。10秒の一切れは数十KB、
 * 取り込むボイスメモは圧縮した形でおよそ1時間まで。読み方は lib/read-body.ts の readBytes（名乗った長さで先に断り、
 * 読んだ後も途中で切れていないかを見る。Next.js 15.5.29 が門のために写す中身を 32MB で黙って切っても、半端な録音を残さない）
 */
const TOO_BIG = `録音が大きすぎます（1回 ${BIG_BODY / 1024 / 1024}MB まで。圧縮した録音で1時間ほど）`;

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { v } = await visitFor(req, (await params).id, "record:write");
  const q = new URL(req.url).searchParams;
  const mime = req.headers.get("content-type") ?? "";
  const ext = q.get("ext") || extFromMime(mime);
  const data = await readBytes(req, { tooBig: TOO_BIG });
  const takes = saveChunk(v, Number(q.get("take") ?? 0), Number(q.get("seq")), ext, mime, data);
  return { ok: true, takes };
});
