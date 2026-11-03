// 本人（母・子・パートナー）: 足す・名前を直す・本人の分を消す。
import { body, route } from "@/lib/api";
import { withHousehold } from "@/lib/access";
import { HttpError } from "@/lib/http-error";
import { addSubject, audit, purgeSubject, updateSubject, type SubjectKind } from "@/lib/households";
import { requireSubject } from "../_lib/server";

export const dynamic = "force-dynamic";

const KINDS: SubjectKind[] = ["mother", "child", "partner"];

function realOnly(kind: string) {
  if (kind !== "real") throw new HttpError(403, "作った家族（デモ）の本人は変えられません");
}

/** 本人を足す（例: 下の子が生まれた・双子） */
export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; kind?: SubjectKind; name?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:admin");
  realOnly(ctx.household.kind);
  if (!b.kind || !KINDS.includes(b.kind)) throw new HttpError(400, "本人の種類が違います");
  const s = addSubject(ctx.household.id, { kind: b.kind, name: (b.name ?? "").trim().slice(0, 30) || (b.kind === "child" ? "子" : b.kind === "mother" ? "母" : "パートナー") });
  audit(ctx.household.id, ctx.account?.id ?? null, "subject.add", { target: s.id });
  return { subject: s };
});

/** 呼び名を直す */
export const PATCH = route(async (req: Request) => {
  const b = await body<{ familyId?: string; subjectId?: string; name?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "household:admin");
  realOnly(ctx.household.kind);
  const s = requireSubject(ctx, ctx.subjects, b.subjectId);
  const name = (b.name ?? "").trim().slice(0, 30);
  if (!name) throw new HttpError(400, "呼び名を入れてください");
  return { subject: updateSubject(ctx.household.id, s.id, { name }) };
});

/**
 * 本人の分を消す（記録・写真・同意・代理・本人の行）。本人の付いていない世帯全体の記録は残る。
 * 押せるのは、その本人（自分の分）か、世帯の持ち主。
 */
export const DELETE = route(async (req: Request) => {
  const b = await body<{ familyId?: string; subjectId?: string; confirm?: string }>(req);
  const ctx = await withHousehold(req, b.familyId, "record:read");
  realOnly(ctx.household.kind);
  const s = requireSubject(ctx, ctx.subjects, b.subjectId);
  const self = !!ctx.account && s.accountId === ctx.account.id;
  if (!self && !ctx.can("household:delete")) throw new HttpError(403, "消せるのは、本人か世帯の持ち主だけです");
  if (b.confirm !== "消す") throw new HttpError(400, "確かめの「消す」を入れてください");
  await purgeSubject(ctx.household.id, s.id);
  audit(ctx.household.id, ctx.account?.id ?? null, "subject.purge", { target: s.id, detail: { kind: s.kind } });
  return { ok: true };
});
