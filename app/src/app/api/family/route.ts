import { body, route } from "@/lib/api";
import { allFamilies, cleanSituation, getFamily, HttpError, MINE_ID, saveMine, withBirthFacts } from "@/lib/family";
import { list, put } from "@/lib/db";
import { scheduleFor } from "@/lib/milestones";
import type { Family } from "@/lib/demo-family";

/** 家族の一覧。どの家族にも、手帳の出産の記録から birthWeightG・birthWeek（生まれた時の体重 g・週数）を埋めて返す */
export const GET = route(async (req: Request) => {
  const families = allFamilies();
  // シミュレーションのサーバだけ: 1000組の家族（pop-）は一覧に入れず、開いている家族だけを足す
  const id = new URL(req.url).searchParams.get("id") ?? "";
  if (id.startsWith("pop-")) {
    const f = getFamily(id);
    if (f) families.unshift(f);
  }
  return { families };
});

/** 「わが家」の設定を保存する */
export const POST = route(async (req: Request) => {
  const b = await body<Partial<Family>>(req);
  if (!b.dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(b.dueDate)) throw new HttpError(400, "出産予定日を入れてください");
  if (!b.city) throw new HttpError(400, "住んでいる市区町村を入れてください");
  const prior = getFamily(MINE_ID);
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
  const fam = saveMine({
    ...move,
    startedOn: restart ? today : prior!.startedOn,
    city: b.city,
    prefecture: b.prefecture ?? "",
    dueDate: b.dueDate,
    birthDate: b.birthDate || undefined,
    childName: b.childName || undefined,
    members,
    ...(situation ? { situation } : {}),
  });
  const full = withBirthFacts(fam);
  // 途中から使い始めた家族: 使い始める前に期限が過ぎた事（妊娠の届出など）は、もう済んでいるものとして扱う
  if (restart) {
    const done = new Set(list<{ milestoneId?: string }>(MINE_ID, "done").map((d) => d.data.milestoneId));
    for (const m of scheduleFor(full, today)) {
      if (m.deadlineDate && !m.awaitingBirth && m.deadlineDate < today && !done.has(m.id)) {
        put(MINE_ID, "done", { milestoneId: m.id, today, at: new Date().toISOString(), auto: "started-late" }, { id: `done:${MINE_ID}:${m.id}`, date: today });
      }
    }
  }
  return { family: full };
});
