// 招待を受ける。受けた後、招待の範囲どおりに本人と代理の印を作る:
// - パートナーとして招かれた人は、本人「パートナー」に結びつける（無ければ作る）
// - 母が見せると選んだ項目があれば、母の任意代理人（voluntary）として、その範囲の印を付ける
// - 子の記録は、世帯の仲間ならだれでも見える（lib/access.ts の visibleSubjects）
import { body, route } from "@/lib/api";
import { authReady } from "@/lib/auth";
import { requireAccount } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { addSubject, audit, listSubjects, setProxy, updateSubject } from "@/lib/households";
import { getFamily, saveFamilyProfile } from "@/lib/family";
import { authError, inviteScope } from "../../_lib/server";

export const dynamic = "force-dynamic";

export const POST = route(async (req: Request) => {
  const account = await requireAccount(req);
  const b = await body<{ invitationId?: string }>(req);
  if (!b.invitationId) throw new HttpError(404, "招待が見つかりません");
  const auth = await authReady();
  let hid: string;
  try {
    const r = (await auth.api.acceptInvitation({ body: { invitationId: b.invitationId }, headers: req.headers })) as {
      invitation?: { organizationId: string };
      member?: { organizationId: string };
    } | null;
    const id = r?.member?.organizationId ?? r?.invitation?.organizationId;
    if (!id) throw new HttpError(500, "招待を受けられませんでした");
    hid = id;
  } catch (e) {
    authError(e, "招待を受けられませんでした");
  }
  const scope = inviteScope(b.invitationId);
  const subjects = listSubjects(hid);
  if (scope?.relation === "パートナー" && !subjects.some((s) => s.accountId === account.id)) {
    const free = subjects.find((s) => s.kind === "partner" && !s.accountId);
    if (free) updateSubject(hid, free.id, { accountId: account.id });
    else addSubject(hid, { kind: "partner", name: account.name || "パートナー", accountId: account.id });
  }
  // 手帳の家族にもパートナーの人を足す（3つの問いで作った手帳には、母しかいない時がある。いないままだと、
  // 入ったパートナーが「ママ」として扱われ、母の手続きが一番先の事に出ていた。UX 2026-11-04）
  if (scope?.relation === "パートナー") {
    const f = getFamily(hid);
    if (f && !f.members.some((m) => m.role === "パートナー")) {
      // 生まれた時の体重・週数は読む時に足す値なので、保存しない
      const { id: _id, birthWeightG: _w, birthWeek: _k, ...rest } = f;
      saveFamilyProfile(hid, { ...rest, members: [...f.members, { id: `partner-${account.id.slice(0, 8)}`, name: account.name || "パートナー", role: "パートナー" }] });
    }
  }
  if (scope?.showMother.length) {
    for (const m of subjects.filter((s) => s.kind === "mother")) setProxy(hid, { accountId: account.id, subjectId: m.id, basis: "voluntary", scope: scope.showMother });
  }
  audit(hid, account.id, "invite.accept", { target: b.invitationId, detail: scope ?? undefined });
  return { householdId: hid };
});
