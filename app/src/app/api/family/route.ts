import { body, route } from "@/lib/api";
import { allFamilies, HttpError, saveMine } from "@/lib/family";
import type { Family } from "@/lib/demo-family";

export const GET = route(async () => ({ families: allFamilies() }));

/** 「わが家」の設定を保存する */
export const POST = route(async (req: Request) => {
  const b = await body<Partial<Family>>(req);
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new HttpError(400, "出産予定日を入れてください");
  if (!b.city) throw new HttpError(400, "住んでいる市区町村を入れてください");
  const fam = saveMine({
    city: b.city,
    prefecture: b.prefecture ?? "",
    dueDate: b.dueDate,
    birthDate: b.birthDate || undefined,
    childName: b.childName || undefined,
    members: (b.members ?? []).filter((m) => m.name),
  });
  return { family: fam };
});
