// 未来の手紙を1通読む。開く日より前は 403（書いた本人でも）。中身は世帯の鍵で復号して渡し、端末にも途中にも残さない。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { readLetter } from "@/lib/letters";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  return { letter: readLetter(ctx, id, q.get("today"), q.get("by")) };
});
