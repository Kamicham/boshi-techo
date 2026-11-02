// 「いつもの場所と人」を読む・覚える。
import { body, route } from "@/lib/api";
import { requireFamily } from "@/lib/family";
import { getKeep, remember, type Keep } from "@/lib/keep";

export const GET = route(async (req: Request) => {
  const fam = requireFamily(new URL(req.url).searchParams.get("familyId"));
  return { keep: getKeep(fam.id) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; keep?: Partial<Keep> }>(req);
  const fam = requireFamily(b.familyId);
  const k = b.keep ?? {};
  const str = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
  const patch: Partial<Keep> = {};
  if (k.hospital) patch.hospital = { name: str(k.hospital.name), phone: str(k.hospital.phone, 30), ...(k.hospital.guide ? { guide: k.hospital.guide } : {}) };
  if (k.work) patch.work = { company: str(k.work.company), boss: str(k.work.boss), email: str(k.work.email) };
  if (k.office) patch.office = { name: str(k.office.name), address: str(k.office.address) };
  if (k.shareVia === "line" || k.shareVia === "mail" || k.shareVia === "share") patch.shareVia = k.shareVia;
  return { keep: remember(fam.id, patch) };
});
