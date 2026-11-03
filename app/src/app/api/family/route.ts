// 家族の一覧（GET）と、家族の設定の保存（POST）。
// - GET: ログインした人の世帯と、公開の世帯（見本の家族・シミュレーションのサーバの作った家族）だけを返す。ほかの家族は返さない
// - POST: 世帯を指定して保存する（owner か admin だけ）。画面が世帯を送らない時は、その人が管理できる世帯が1つならそれ
// アカウントの仕組みを動かす前（わが家の置き場・BOSHI_ACCOUNTS なし）は、今までどおり「わが家」（mine）と見本の家族。
import { body, route } from "@/lib/api";
import { currentAccount, myHouseholds, publicHouseholdKind } from "@/lib/access";
import { allFamilies, cleanSituation, getFamily, HttpError, saveFamilyProfile, saveMine, withBirthFacts } from "@/lib/family";
import { list, put } from "@/lib/db";
import { scheduleFor } from "@/lib/milestones";
import { DEMO_FAMILY, type Family } from "@/lib/demo-family";
import { accountsOn, householdFor, LEGACY_MINE_ID } from "../_lib/household";

/** シミュレーションのサーバだけ: 1000組の家族（pop-）は一覧に入れず、開いている家族だけを足す */
function withOpened(families: Family[], id: string): Family[] {
  if (!id.startsWith("pop-") || families.some((f) => f.id === id)) return families;
  if (accountsOn() && !publicHouseholdKind(id)) return families;
  const f = getFamily(id);
  return f ? [f, ...families] : families;
}

/** 家族の一覧。どの家族にも、手帳の出産の記録から birthWeightG・birthWeek（生まれた時の体重 g・週数）を埋めて返す */
export const GET = route(async (req: Request) => {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (!accountsOn()) return { families: withOpened(allFamilies(), id) };

  const account = await currentAccount(req);
  const mine = account ? myHouseholds(account.id) : [];
  // その人の世帯（家族の設定がまだの世帯は、households にだけ出す。画面は設定を勧める）
  const own = mine.flatMap((h) => {
    const f = getFamily(h.id);
    return f ? [f] : [];
  });
  // 公開の世帯: 見本の家族はいつでも。作った30家族はシミュレーションのサーバ（BOSHI_SIM=1）で、ログインを求めない時だけ
  const pub = allFamilies().filter((f) => f.id !== LEGACY_MINE_ID && publicHouseholdKind(f.id) && !own.some((o) => o.id === f.id));
  const families = withOpened([...own, ...pub], id);
  return {
    families,
    households: mine.map((h) => ({ id: h.id, name: h.name, role: h.role, hasProfile: own.some((f) => f.id === h.id) })),
    signedIn: !!account,
  };
});

/** POST で世帯を指定しない時: 移る前はわが家。アカウントでは、その人が管理できる世帯が1つだけならそれ */
async function targetOf(req: Request, familyId: unknown): Promise<string> {
  if (typeof familyId === "string" && familyId) return familyId;
  if (!accountsOn()) return LEGACY_MINE_ID;
  const account = await currentAccount(req);
  if (!account) throw new HttpError(401, "ログインしてください");
  const admin = myHouseholds(account.id).filter((h) => h.role === "owner" || h.role === "admin");
  if (admin.length === 1) return admin[0].id;
  if (!admin.length) throw new HttpError(404, "設定できる家族がありません。先に家族を作ってください");
  throw new HttpError(400, "どの家族の設定か分かりません（familyId を送る）");
}

/** 家族の設定を保存する（世帯の owner か admin） */
export const POST = route(async (req: Request) => {
  const b = await body<Partial<Family> & { familyId?: string }>(req);
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new HttpError(400, "出産予定日を入れてください");
  if (!b.city) throw new HttpError(400, "住んでいる市区町村を入れてください");
  const h = await householdFor(req, await targetOf(req, b.familyId), "household:admin");
  // 作った家族の設定は、移る前も変えられない（前は「わが家」しか書かなかった）
  if (h.kind !== "real" || h.id === DEMO_FAMILY.id) throw new HttpError(403, "作った家族の設定は変えられません");
  const fid = h.id;
  const prior = getFamily(fid);
  // 日本時間の今日
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const restart = !prior?.startedOn || prior.dueDate !== b.dueDate;
  // 町を変えた時は前の町と引っ越した日を覚える（参謀の気づき「町が変わった」が、引き継がれない制度の差を調べる）
  const movedNow = !!prior?.city && (prior.city !== b.city || (prior.prefecture ?? "") !== (b.prefecture ?? ""));
  const move = movedNow
    ? { previousCity: prior!.city, previousPrefecture: prior!.prefecture || undefined, movedOn: today }
    : { previousCity: prior?.previousCity, previousPrefecture: prior?.previousPrefecture, movedOn: prior?.movedOn };
  // 家族の人は母とパートナーだけ（ほかの役・前の形の欄は捨てる）
  const members = (b.members ?? [])
    .filter((m) => m?.name?.trim() && (m.role === "母" || m.role === "パートナー"))
    .map((m) => ({ id: String(m.id), name: String(m.name).trim().slice(0, 30), role: m.role }));
  // 家族の形: 送られて来なければ前のままにする。パートナーの欄は、パートナーを入れた時だけ持つ
  const hasPartner = members.some((m) => m.role === "パートナー");
  const situation = "situation" in b ? cleanSituation(b.situation, hasPartner) : prior?.situation;
  // 生まれた時の体重・週数は保存せず、手帳の出産の記録から毎回埋める（withBirthFacts）
  const profile: Omit<Family, "id"> = {
    ...move,
    startedOn: restart ? today : prior!.startedOn,
    city: b.city,
    prefecture: b.prefecture ?? "",
    dueDate: b.dueDate,
    birthDate: b.birthDate || undefined,
    childName: b.childName || undefined,
    members,
    ...(situation ? { situation } : {}),
  };
  const fam = fid === LEGACY_MINE_ID ? saveMine(profile) : saveFamilyProfile(fid, profile);
  const full = withBirthFacts(fam);
  // 途中から使い始めた家族: 使い始める前に期限が過ぎた事（妊娠の届出など）は、もう済んでいるものとして扱う
  if (restart) {
    const done = new Set(list<{ milestoneId?: string }>(fid, "done").map((d) => d.data.milestoneId));
    for (const m of scheduleFor(full, today)) {
      if (m.deadlineDate && !m.awaitingBirth && m.deadlineDate < today && !done.has(m.id)) {
        put(fid, "done", { milestoneId: m.id, today, at: new Date().toISOString(), auto: "started-late" }, { id: `done:${fid}:${m.id}`, date: today });
      }
    }
  }
  return { family: full };
});
