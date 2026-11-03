// 世帯を作る（POST）。ログインした人が owner になり、本人「母」と「子」（生まれる前は仮の名前）と、世帯の鍵（DEK）ができる。
//   POST { name?, me?: "mother" | "partner", motherName?, partnerName?, childName? }
//   → { household: { id, name, role: "owner" }, subjects: [{ id, kind, name }] }
// 世帯の行（households・kind = real）と世帯の鍵は、Better Auth の afterCreateOrganization（lib/auth.ts）が作る。
// ここでは念のためもう一度 ensureHousehold を呼ぶ（何度呼んでもよい・kind は書き換えない）。
// 家族の設定（町・予定日）は、作った後に /api/family の POST で入れる。
import { randomBytes } from "node:crypto";
import { body, route } from "@/lib/api";
import { requireAccount } from "@/lib/access";
import { authReady } from "@/lib/auth";
import { madeFamilyKind } from "@/lib/family";
import { addSubject, audit, ensureHousehold, listSubjects } from "@/lib/households";
import { HttpError } from "@/lib/http-error";
import { accountsOn } from "../_lib/household";

const text = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export const POST = route(async (req: Request) => {
  if (!accountsOn()) throw new HttpError(503, "アカウントの仕組みは、まだ動かしていません");
  const account = await requireAccount(req);
  const b = await body<{ name?: string; me?: string; motherName?: string; partnerName?: string; childName?: string }>(req);
  const me = b.me === "partner" ? "partner" : "mother";
  const name = text(b.name, 40) || "わが家";
  const auth = await authReady();
  // slug は人に見せない（Better Auth が一意を求めるので、ランダムに作る）
  const org = await auth.api.createOrganization({
    body: { name, slug: `h-${randomBytes(9).toString("hex")}` },
    headers: req.headers,
  });
  if (!org?.id) throw new HttpError(500, "家族を作れませんでした");
  // 作った家族（コードに固定の一覧）と同じ id にはならないはず。なれば公開の側に落ちないよう止める
  if (madeFamilyKind(org.id)) throw new HttpError(500, "世帯の id が作った家族と重なりました。もう一度作ってください");
  const household = ensureHousehold(org.id, "real");

  // 本人: 作った人は自分の本人に結びつける。子は生まれる前は仮の名前
  if (!listSubjects(household.id).length) {
    if (me === "mother") {
      addSubject(household.id, { kind: "mother", name: text(b.motherName, 30) || account.name || "母", accountId: account.id });
    } else {
      addSubject(household.id, { kind: "mother", name: text(b.motherName, 30) || "母" });
      addSubject(household.id, { kind: "partner", name: text(b.partnerName, 30) || account.name || "パートナー", accountId: account.id });
    }
    addSubject(household.id, { kind: "child", name: text(b.childName, 30) || "赤ちゃん（仮の名前）" });
  }
  audit(household.id, account.id, "household.create", { detail: { me } });
  return {
    household: { id: household.id, name: org.name, role: "owner" as const },
    subjects: listSubjects(household.id).map((s) => ({ id: s.id, kind: s.kind, name: s.name })),
  };
});
