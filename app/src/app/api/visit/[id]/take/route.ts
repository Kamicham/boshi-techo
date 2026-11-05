// 新しい録音の番号（take）をサーバで確保する。画面の情報が古くても、前の録音を上書きしない。
// POST /api/visit/[id]/take → { take }
import { route } from "@/lib/api";
import { reserveTake, visitFor } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { v } = await visitFor(req, (await params).id, "record:write");
  return { take: reserveTake(v) };
});
