// 「いつもの場所と人」を読む・覚える。
// 送らなかった欄は今のまま。空の文字を送った欄は消す（設定で空にした時）。
import { body, route } from "@/lib/api";
import { familyFor } from "../_lib/household";
import { getKeep, remember, type Keep } from "@/lib/keep";

export const GET = route(async (req: Request) => {
  const { family: fam } = await familyFor(req, new URL(req.url).searchParams.get("familyId"), "record:read");
  return { keep: getKeep(fam.id) };
});

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; keep?: Partial<Keep> }>(req);
  const { family: fam } = await familyFor(req, b.familyId, "record:write");
  const k = b.keep ?? {};
  const str = (v: unknown, n = 200) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
  const patch: Partial<Keep> = {};
  if (k.hospital) patch.hospital = { name: str(k.hospital.name), phone: str(k.hospital.phone, 30), ...(k.hospital.guide ? { guide: k.hospital.guide } : {}) };
  if (k.work)
    patch.work = {
      company: str(k.work.company),
      dept: str(k.work.dept),
      boss: str(k.work.boss),
      email: str(k.work.email),
      hr: str(k.work.hr),
      hrEmail: str(k.work.hrEmail),
    };
  // 手紙に書く名前（家族の id ごと）。その家族にいる人の分だけ
  if (k.names && typeof k.names === "object") {
    const ids = new Set(fam.members.map((m) => m.id));
    const names = Object.fromEntries(Object.entries(k.names).filter(([id]) => ids.has(id)).map(([id, v]) => [id, str(v, 60)]));
    if (Object.keys(names).length) patch.names = names as Record<string, string>;
  }
  if (k.office) patch.office = { name: str(k.office.name), address: str(k.office.address) };
  // 家族みんなの事の担当（その家族にいる人か "together"。空の文字は決め直し＝消す）
  if (k.assign && typeof k.assign === "object") {
    const ids = new Set([...fam.members.map((m) => m.id), "together"]);
    const assign = Object.fromEntries(
      Object.entries(k.assign)
        .filter(([mid, v]) => /^[a-zA-Z0-9_-]{1,80}$/.test(mid) && typeof v === "string" && (v === "" || ids.has(v)))
        .slice(0, 50),
    ) as Record<string, string>;
    if (Object.keys(assign).length) patch.assign = assign;
  }
  // 発育曲線の帯の男女（手帳の画面で選んだ物）
  if (k.childSex === "boy" || k.childSex === "girl") patch.childSex = k.childSex;
  return { keep: remember(fam.id, patch) };
});
