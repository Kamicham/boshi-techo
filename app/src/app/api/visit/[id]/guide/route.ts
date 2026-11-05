// 案内図・受付票の写真から「今日回る順番」を作る。
import { body, route } from "@/lib/api";
import { WRITE_AND_SEND } from "../../../_lib/household";
import { makeGuide, visitFor } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { v, h } = await visitFor(req, (await params).id, WRITE_AND_SEND);
  const b = await body<{ images?: string[] }>(req);
  const guide = await makeGuide(v, Array.isArray(b.images) ? b.images : [], h.who);
  return { guide };
});
