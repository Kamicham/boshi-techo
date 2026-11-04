// アカウントで作った世帯の「家族の設定」（予定日・町・家族・家族の形）を保存する。
// 中身の決まりは /api/family の POST（わが家）と同じ。権限は withHousehold の household:admin（持ち主・共同の管理）。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { cleanSituation, saveFamilyProfile, withBirthFacts } from "@/lib/family";
import { HttpError } from "@/lib/http-error";
import { scheduleFor } from "@/lib/milestones";
import { audit } from "@/lib/households";
import type { Family } from "@/lib/demo-family";
import { callNameField } from "@/lib/call-name";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const b = await body<Partial<Family> & { familyId?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:admin");
  if (ctx.household.kind !== "real") throw new HttpError(403, "作った家族（デモ）の設定は、ここでは見るだけです");
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new HttpError(400, "出産予定日を入れてください");
  if (!b.city) throw new HttpError(400, "住んでいる市区町村を入れてください");
  const hid = ctx.household.id;
  const prior = ctx.family;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10); // 日本時間の今日
  const restart = !prior?.startedOn || prior.dueDate !== b.dueDate;
  const movedNow = !!prior?.city && (prior.city !== b.city || (prior.prefecture ?? "") !== (b.prefecture ?? ""));
  const move = movedNow
    ? { previousCity: prior!.city, previousPrefecture: prior!.prefecture || undefined, movedOn: today }
    : { previousCity: prior?.previousCity, previousPrefecture: prior?.previousPrefecture, movedOn: prior?.movedOn };
  const members = (b.members ?? [])
    .filter((m) => m?.name?.trim() && (m.role === "母" || m.role === "パートナー"))
    .map((m) => ({ id: String(m.id), name: String(m.name).trim().slice(0, 30), role: m.role, ...callNameField(m.callName) }));
  const hasPartner = members.some((m) => m.role === "パートナー");
  const situation = "situation" in b ? cleanSituation(b.situation, hasPartner) : prior?.situation;
  const fam = saveFamilyProfile(hid, {
    ...move,
    startedOn: restart ? today : prior!.startedOn,
    city: String(b.city).slice(0, 40),
    prefecture: String(b.prefecture ?? "").slice(0, 10),
    dueDate: b.dueDate,
    birthDate: b.birthDate || undefined,
    childName: b.childName ? String(b.childName).slice(0, 30) : undefined,
    members,
    ...(situation ? { situation } : {}),
  });
  const full = withBirthFacts(fam);
  // 途中から使い始めた家族: 使い始める前に期限が過ぎた事は、済んでいるものとして扱う
  if (restart) {
    const done = new Set(ctx.db.list<{ milestoneId?: string }>("done", { limit: 10000 }).map((d) => d.data.milestoneId));
    for (const m of scheduleFor(full, today)) {
      if (m.deadlineDate && !m.awaitingBirth && m.deadlineDate < today && !done.has(m.id)) {
        ctx.db.put("done", { milestoneId: m.id, today, at: new Date().toISOString(), auto: "started-late" }, { id: `done:${hid}:${m.id}`, date: today });
      }
    }
  }
  audit(hid, ctx.account?.id ?? null, "profile.save");
  return { family: full };
});
