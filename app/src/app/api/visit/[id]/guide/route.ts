// 案内図・受付票の写真から「今日回る順番」を作る。
import { body, route } from "@/lib/api";
import { makeGuide, requireVisit } from "../../_lib/server";

export const POST = route(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const v = requireVisit((await params).id);
  const b = await body<{ images?: string[] }>(req);
  const guide = await makeGuide(v, Array.isArray(b.images) ? b.images : []);
  return { guide };
});
