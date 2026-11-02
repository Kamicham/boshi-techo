// ⑥ 家族が育てる地図: 町の「窓口の知恵」を読む・足す・確かめる。
import { z } from "zod";
import { body, route } from "@/lib/api";
import { LIGHT_MODEL, structured } from "@/lib/claude";
import { HttpError, requireFamily } from "@/lib/family";
import { MILESTONES } from "@/lib/milestones";
import { addWisdom, confirmWisdom, wisdomFor } from "@/lib/wisdom";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const jpToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

/** GET /api/wisdom?familyId=…&milestoneId=… */
export const GET = route(async (req: Request) => {
  const u = new URL(req.url);
  const family = requireFamily(u.searchParams.get("familyId"));
  const items = wisdomFor(family.city, u.searchParams.get("milestoneId") ?? undefined);
  return { city: family.city, items };
});

const Schema = z.object({
  tips: z.array(
    z.object({
      place: z.string().describe("どの窓口・場所か（一般的な呼び方。例: 区役所の戸籍の窓口）"),
      milestoneId: z.string().nullable().describe("結びつく手続きの id（一覧から選ぶ。無ければ null）"),
      tip: z.string().describe("次の家族に役立つ知恵。1〜2文"),
    }),
  ),
});

const SYSTEM = `あなたは、家族が窓口へ行った話から「次の家族に役立つ知恵」を抜き出す係です。
- 持ち物・待ち時間・順番・電話で確かめた事など、次の家族がそのまま使える事だけを抜き出す（0〜4件）。
- 個人を特定できる事（名前・住所・職員の名前・子どもの名前・日時の細部）は抜き出さない。職員や人への評価・悪口も入れない。
- 体や病気の事、制度の額や条件の言い切りは入れない（それは窓口で確かめる事）。
- 話に無い事を足さない。役立つ事が無ければ空の配列。
- milestoneId は次の一覧の id から選ぶ:
${MILESTONES.map((m) => `  ${m.id}: ${m.title}`).join("\n")}`;

/** POST {familyId, text, today?}: 話から知恵を抜き出して、町の地図に足す */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; text?: string; today?: string }>(req);
  const family = requireFamily(b.familyId);
  const text = (b.text ?? "").trim();
  if (text.length < 5) throw new HttpError(400, "行ってみた話を、もう少し書いてください");
  if (text.length > 4000) throw new HttpError(400, "長すぎます（4000字まで）");
  const today = b.today && DATE.test(b.today) ? b.today : jpToday();

  const out = await structured(Schema, SYSTEM, `町: ${family.city}\n\n家族の話:\n${text}`, { model: LIGHT_MODEL, effort: "low", maxTokens: 4000 });
  const valid = new Set(MILESTONES.map((m) => m.id));
  const added = out.tips
    .filter((t) => t.tip.trim() && t.place.trim())
    .slice(0, 4)
    .map((t) => addWisdom({ city: family.city, place: t.place.trim(), tip: t.tip.trim(), milestoneId: t.milestoneId && valid.has(t.milestoneId) ? t.milestoneId : null }, family.id, today));
  return { added };
});

/** PATCH {familyId, id, today?}: 私も確かめた */
export const PATCH = route(async (req: Request) => {
  const b = await body<{ familyId?: string; id?: string; today?: string }>(req);
  const family = requireFamily(b.familyId);
  if (!b.id) throw new HttpError(400, "どの知恵か分かりません");
  const today = b.today && DATE.test(b.today) ? b.today : jpToday();
  const r = confirmWisdom(b.id, family.id, today);
  if (!r || r.doc.data.city !== family.city) throw new HttpError(404, "その知恵が見つかりません");
  return { item: r.doc, already: r.already };
});
