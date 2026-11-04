// 未来の手紙に添えた声を出す。文字と同じ関所（開く日より前は 403・書いた本人でも。ほかの世帯は 404）。
// 声は世帯の鍵で復号して出し、端末にも途中にも残さない。アルバムの声の口（/api/media）からは届かない置き場にある。
import { route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { audit } from "@/lib/households";
import { readLetterVoice } from "@/lib/letters";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = route(async (req: Request, { params }: Params) => {
  const { id } = await params;
  const q = new URL(req.url).searchParams;
  const ctx = await withHousehold(req, q.get("familyId"), "media:read");
  const got = await readLetterVoice(ctx, id, q.get("today"));
  audit(ctx.household.id, ctx.account?.id ?? null, "letter.voice", { target: id });
  return new Response(new Uint8Array(got.buf), {
    headers: { "content-type": got.mime, "content-length": String(got.buf.length), "cache-control": "private, no-store", "x-content-type-options": "nosniff" },
  });
});
