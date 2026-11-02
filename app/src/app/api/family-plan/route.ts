// ④ 家族全体の参謀: 今週と14日以内の事を、家族の一人ずつに分ける。
// 考えた結果は「状況の鍵」（やる事・状態・担当・家族・家族の形）ごとに覚え、同じ状況では Claude を呼び直さない。
// 開き直した時（cacheOnly）は、今の状況の結果が無くても、最後に考えた結果を「前に考えた分」として返す（消えない）。
import { createHash } from "node:crypto";
import { z } from "zod";
import { getAssignments } from "@/app/api/assign/_lib/store";
import { situationFacts } from "@/lib/advisor";
import { applyAssignments } from "@/lib/assign";
import { body, route } from "@/lib/api";
import { structured } from "@/lib/claude";
import { clockAt } from "@/lib/clock";
import { get, list, put } from "@/lib/db";
import { DEMO_FAMILY } from "@/lib/demo-family";
import { HttpError, requireFamily } from "@/lib/family";
import { collectWeek, LOOKAHEAD_DAYS, mondayOf, type Plan } from "@/lib/roles";

const Schema = z.object({
  perMember: z.array(
    z.object({
      memberId: z.string(),
      items: z.array(
        z.object({
          milestoneId: z.string().nullable().describe("やる事の一覧の id。一覧に無い事（電話・送り物など）は null"),
          title: z.string().describe("その人がする事。短く具体的に"),
          why: z.string().describe("なぜこの人がするのか（一言）"),
          by: z.string().describe("いつまでに（例: 5月21日まで）"),
        }),
      ),
      message: z.string().describe("その人に宛てた短い言葉"),
    }),
  ),
  load: z.array(z.object({ memberId: z.string(), value: z.number().describe("今週の負担 0〜100"), note: z.string() })),
  rebalance: z.array(
    z.object({
      milestoneId: z.string().nullable(),
      title: z.string(),
      fromMemberId: z.string(),
      toMemberId: z.string(),
      why: z.string(),
    }),
  ),
});

const SYSTEM = `あなたは家族全体の参謀です。今週と、この先${LOOKAHEAD_DAYS}日以内のやる事を、家族の一人ずつに分けます。
- 家族の状況（出産の前後・産後の体）を考え、産後の母に手続きや外出が偏らないようにする。役所の手続きはパートナーへ寄せる、など。
- 遠くに住む祖父母には、遠くからできる事（電話・送り物・上の子や家事の手配・話を聞く）を渡す。役所や病院の手続きは渡さない。
- message はその人に宛てる。各メンバーの「伝え方のヒント」に合わせる。パートナーには短く具体的に。祖父母には大きな字で読める、短いやさしい言葉で（3文以内）。押し付けず、家族の側から見た言葉で。
- load は、あなたが分けたこの割り当てでの今週の負担（0〜100）。note で一言の理由。
- rebalance は偏りを減らす組み替えの提案（0〜3件）。from と to は memberId。
- 体の状態の良し悪しは書かない。健診は「付き添う」「送り迎え」「上の子を見る」など家族ができる事として扱う。
- milestoneId は渡した一覧の id だけを使う。
- 「家族が決めた担当」と書いた事は、その人に渡す（組み替えの案に出すのはよい）。
- 「家族の形」に書かれた事を使う。同居・近くの祖父母、里帰り先の実家の人は、手帳の家族に入っていなくても頼める人として why や message で触れてよい（memberId は家族の中の人だけ）。仕事のない人に職場の事を渡さない。夜勤の人は平日の日中に窓口へ行ける日がある。書かれていない事は決めつけない。`;

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; refresh?: boolean; cacheOnly?: boolean }>(req);
  const family = requireFamily(b.familyId);
  if (!b.today || !/^\d{4}-\d{2}-\d{2}$/.test(b.today)) throw new HttpError(400, "今日の日付が読めません");
  if (family.members.length === 0) throw new HttpError(400, "わが家の設定で家族を入れてください");
  const today = b.today;
  const week = mondayOf(today);

  const done = new Set(
    list<{ milestoneId?: string; id?: string }>(family.id, "done")
      .map((d) => d.data.milestoneId ?? d.data.id)
      .filter((x): x is string => typeof x === "string"),
  );
  // 家族が決め直した担当を当てる（今日の画面と同じ）
  const assign = getAssignments(family.id);
  const items = applyAssignments(collectWeek(family, today, done, family.id === DEMO_FAMILY.id), assign, family.members);
  const clock = clockAt(family, today);

  // 状況の鍵: やる事（id・状態・担当）・家族・家族の形。同じなら前の結果をそのまま使う
  const fp = createHash("sha1")
    .update(
      JSON.stringify({
        items: items.map((m) => [m.id, m.status, m.who, m.assignedTo ?? ""]),
        members: family.members.map((m) => [m.id, m.name, m.role, m.visit?.from ?? ""]),
        situation: family.situation ?? null,
        phase: clock.phase,
      }),
    )
    .digest("hex")
    .slice(0, 16);
  const id = `plan:${family.id}:${fp}`;
  const latestId = `plan:${family.id}:latest`;

  const cached = get<Plan>(id);
  if (cached && !b.refresh) {
    put(family.id, "plan", { planId: id }, { id: latestId, date: week });
    return { plan: cached.data, cached: true, outdated: false };
  }
  if (b.cacheOnly) {
    // 今の状況の結果は無い: 最後に考えた結果を「前に考えた分」として返す（開き直しても消えない）
    const last = get<{ planId?: string }>(latestId)?.data.planId;
    const prev = last ? get<Plan>(last) : null;
    return { plan: prev?.data ?? null, cached: !!prev, outdated: !!prev };
  }

  const content = [
    `今日: ${today}（${clock.label}）。この週の月曜: ${week}`,
    `住む町: ${family.prefecture}${family.city}`,
    family.childName ? `子どもの呼び名: ${family.childName}` : "",
    "",
    "家族:",
    ...family.members.map((m) => `- memberId=${m.id} ${m.name}（${m.role}）。伝え方のヒント: ${m.voice || "なし"}`),
    ...(situationFacts(family).length ? ["", "家族の形:", ...situationFacts(family).map((x) => `- ${x}`)] : []),
    "",
    `今と${LOOKAHEAD_DAYS}日以内のやる事（いまの担当の目安つき）:`,
    ...(items.length
      ? items.map(
          (m) =>
            `- id=${m.id}「${m.title}」状態=${m.status} ${assign[m.id] ? `家族が決めた担当=${m.assignedTo ? family.members.find((x) => x.id === m.assignedTo)?.name : m.who}` : `担当の目安=${m.who}`} 始まり=${m.startDate}${m.deadlineDate ? ` 期限=${m.deadlineDate}` : ""}（根拠: ${m.basis}）`,
        )
      : ["（手続きの期限は無い週。暮らしと支え合いの事を考える）"]),
  ].join("\n");

  const out = await structured(Schema, SYSTEM, content, { effort: "medium" });

  const ids = new Set(family.members.map((m) => m.id));
  const validMs = new Set(items.map((m) => m.id));
  const plan: Plan = {
    week,
    today,
    considered: items.length,
    perMember: family.members.map((m) => {
      const p = out.perMember.find((x) => x.memberId === m.id);
      return {
        memberId: m.id,
        message: p?.message ?? "",
        items: (p?.items ?? []).map((it) => ({ ...it, milestoneId: it.milestoneId && validMs.has(it.milestoneId) ? it.milestoneId : null })),
      };
    }),
    load: family.members.map((m) => {
      const l = out.load.find((x) => x.memberId === m.id);
      return { memberId: m.id, value: Math.max(0, Math.min(100, Math.round(l?.value ?? 0))), note: l?.note ?? "" };
    }),
    rebalance: out.rebalance
      .filter((r) => ids.has(r.fromMemberId) && ids.has(r.toMemberId) && r.fromMemberId !== r.toMemberId)
      .map((r) => ({ ...r, milestoneId: r.milestoneId && validMs.has(r.milestoneId) ? r.milestoneId : null })),
  };
  put(family.id, "plan", plan, { id, date: week });
  put(family.id, "plan", { planId: id }, { id: latestId, date: week });
  return { plan, cached: false, outdated: false };
});
