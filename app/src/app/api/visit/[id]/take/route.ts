// 新しい録音の番号（take）をサーバで確保する。画面の情報が古くても、前の録音を上書きしない。
// POST /api/visit/[id]/take → { take }
import { route } from "@/lib/api";
import { requireVisit, reserveTake } from "../../_lib/server";

export const POST = route(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const v = requireVisit((await params).id);
  return { take: reserveTake(v) };
});
