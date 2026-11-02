// ④ 家族全体の参謀: 今週と14日以内の事を、家族の一人ずつに分ける。
import { z } from "zod";
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
- milestoneId は渡した一覧の id だけを使う。`;

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; refresh?: boolean; cacheOnly?: boolean }>(req);
  const family = requireFamily(b.familyId);
  if (!b.today || !/^\d{4}-\d{2}-\d{2}$/.test(b.today)) throw new HttpError(400, "今日の日付が読めません");
  if (family.members.length === 0) throw new HttpError(400, "わが家の設定で家族を入れてください");
  const today = b.today;
  const week = mondayOf(today);
  const id = `plan:${family.id}:${week}`;

  const cached = get<Plan>(id);
  if (cached && !b.refresh) return { plan: cached.data, cached: true };
  if (b.cacheOnly) return { plan: null, cached: false };

  const done = new Set(
    list<{ milestoneId?: string; id?: string }>(family.id, "done")
      .map((d) => d.data.milestoneId ?? d.data.id)
      .filter((x): x is string => typeof x === "string"),
  );
  const items = collectWeek(family, today, done, family.id === DEMO_FAMILY.id);
  const clock = clockAt(family, today);

  const content = [
    `今日: ${today}（${clock.label}）。この週の月曜: ${week}`,
    `住む町: ${family.prefecture}${family.city}`,
    family.childName ? `子どもの呼び名: ${family.childName}` : "",
    "",
    "家族:",
    ...family.members.map((m) => `- memberId=${m.id} ${m.name}（${m.role}）。伝え方のヒント: ${m.voice || "なし"}`),
    "",
    `今と${LOOKAHEAD_DAYS}日以内のやる事（いまの担当の目安つき）:`,
    ...(items.length
      ? items.map(
          (m) =>
            `- id=${m.id}「${m.title}」状態=${m.status} 担当の目安=${m.who} 始まり=${m.startDate}${m.deadlineDate ? ` 期限=${m.deadlineDate}` : ""}（根拠: ${m.basis}）`,
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
  return { plan, cached: false };
});
