// 健診で見せる記録（家族の声②の C・2026-11-05）: 1枚の中身（GET）。
// 出してよい欄だけを lib/share-view.ts の shareView で拾い直して返す（元の記録・id・名前・題・メモは渡さない）。
// ママの束（体の数字・妊婦の健康状態）は、ママ本人（recordViewerOf が mother）の時だけ。読むだけの人（member）には選ぶ所も出さない。
// 画面（/techo/share）は、返した中身を日本語の1枚に描き、印刷と共有の文を作る（lib/share-text.ts）。
import { route } from "@/lib/api";
import { get } from "@/lib/db";
import { SHARE_BUNDLES, shareChoices, shareView, shareViewerOf, type ShareBundle } from "@/lib/share-view";
import { listTecho } from "@/lib/techo-store";
import { planId, type VisitData, type VisitPlan } from "@/lib/visit";
import { withHeard } from "@/lib/visit-next";
import { familyFor } from "../../_lib/household";
import { todayOf } from "../../capture/shared";

const IDS = new Set<string>(SHARE_BUNDLES.map((b) => b.id));

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const h = await familyFor(req, q.get("familyId"), "record:read");
  const { family } = h;
  const today = todayOf(q.get("today"));
  const viewer = shareViewerOf(h);
  // 生まれた後は、母の体の束をはじめは外す（子の健診で開くと妊娠中の表が上に来るため。ママは入れられる）
  const choices = shareChoices(viewer, { born: !!family.birthDate && family.birthDate <= today });
  // 束の指定（bundles=body,growth）。無ければ、はじめの入り切りのまま。選べない束は shareView が外す
  const asked = q.get("bundles");
  const bundles = asked === null ? choices.filter((c) => c.on).map((c) => c.id) : asked.split(",").filter((x): x is ShareBundle => IDS.has(x));
  const entries = listTecho(family.id, { family, today }).map((d) => d.data);
  const plan = get<VisitPlan>(planId(family.id))?.data ?? null;
  // 次の予約が録音から聞こえた日なら、本人が確かめたか（ok・fixed）を、その家族の健診の記録で見る（健診のタブと同じ withHeard）。
  // 確かめる前の日は1枚・共有の文に出さない（lib/share-view.ts）
  const next = withHeard(plan?.next ?? null, (id) => {
    const d = get<VisitData>(id);
    return d && d.familyId === family.id ? d.data : undefined;
  });
  const nextChecked = next?.source === "visit" && !next.heard;
  return { viewer, choices, sheet: shareView({ entries, plan, family, today, nextChecked }, { viewer, bundles }) };
});
