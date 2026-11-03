// 母子手帳の記録: 一覧（GET）と、確定・消す・手で足す（POST）
// 撮った・話した記録は pending:true の候補で入り、家族の「OK」（confirm）で確定する。
import { body, route } from "@/lib/api";
import { HttpError, requireFamily } from "@/lib/family";
import { addTecho, confirmTecho, listTecho, removeTecho } from "@/lib/techo-store";
import { todayOf } from "../capture/shared";

export const GET = route(async (req: Request) => {
  const q = new URL(req.url).searchParams;
  const family = requireFamily(q.get("familyId"));
  return { techo: listTecho(family.id, { family, today: todayOf(q.get("today")) }) };
});

type Post =
  | { familyId?: string; today?: string; action: "confirm" | "remove"; id?: string; ids?: string[] }
  | { familyId?: string; today?: string; action: "add"; entries?: unknown[] };

export const POST = route(async (req: Request) => {
  const b = await body<Post>(req);
  const family = requireFamily(b.familyId);
  if (b.action === "confirm" || b.action === "remove") {
    const ids = [...(b.id ? [b.id] : []), ...(Array.isArray(b.ids) ? b.ids : [])].filter((x): x is string => typeof x === "string").slice(0, 200);
    if (!ids.length) throw new HttpError(400, "どの記録か分かりません");
    if (b.action === "confirm") {
      const done = ids.map((id) => confirmTecho(id, family.id)).filter((d) => d != null);
      if (!done.length) throw new HttpError(404, "記録が見つかりません");
      return { techo: done };
    }
    const removed = ids.filter((id) => removeTecho(id, family.id));
    if (!removed.length) throw new HttpError(404, "記録が見つかりません");
    return { removed };
  }
  if (b.action === "add") {
    if (!Array.isArray(b.entries) || !b.entries.length) throw new HttpError(400, "足す記録がありません");
    if (b.entries.length > 50) throw new HttpError(400, "一度に足せるのは50件までです");
    // 手で足した物は家族が自分で書いた物なので、確定として入れる（source は text）
    const added = addTecho(family.id, b.entries, { today: todayOf(b.today), source: "text", pending: false });
    if (!added.length) throw new HttpError(400, "記録の形が読めませんでした（ページ・日付・中身）");
    return { techo: added };
  }
  throw new HttpError(400, "やる事（action）が分かりません");
});
