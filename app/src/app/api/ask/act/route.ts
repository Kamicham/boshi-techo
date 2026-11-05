// 手帳に聞くの返事の下の動きを押した時（記録に残す・健診で聞く事に足す・済みにする）。
// POST { familyId, at, index } … 会話に残っている動きを、サーバが読み直して行う（画面から来た文は使わない）。
// 押した印は、動く前に付ける（記録の途中で窓を閉じて開き直しても、二度目は押せない＝第30回で同じ記録が2件入った）。失敗したら外す。
import { body, route } from "@/lib/api";
import { getChat, markActionUsed } from "@/lib/ask/agent";
import { addToAgenda, capture } from "@/lib/capture";
import { sendingAs } from "@/lib/claude";
import { HttpError } from "@/lib/http-error";
import { withLang, type Vars } from "@/lib/i18n";
import { dictFor, langOf, tFor } from "@/lib/i18n/dicts";
import { msWords } from "@/lib/i18n/milestone-words";
import { familyFor, WRITE_AND_SEND } from "../../_lib/household";
import { markDone } from "../../done/_lib/done";
import { newId } from "../../visit/_lib/server";

export const maxDuration = 120;

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; at?: string; index?: number }>(req);
  // 記録は Claude で手帳の候補に分けるので、書く権限と送る権限の両方が要る
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const family = h.family;
  // 押した後の一言は、頼みの言葉で返す（断りの HttpError は route() が訳す）
  const lang = langOf(req);
  const say = (key: string, vars?: Vars) => tFor(lang, key, vars);
  if (typeof b.at !== "string" || typeof b.index !== "number") throw new HttpError(400, "どの動きか読めません");
  const turn = getChat(family.id).find((t) => t.role === "assistant" && t.at === b.at);
  const a = turn?.actions?.[b.index];
  if (!turn || !a) throw new HttpError(404, "その動きが見つかりません。窓を開き直してください");
  if (turn.used?.includes(b.index)) return { ok: true, already: true, note: say("✓ もう済んでいます") };
  if (a.type !== "record" && a.type !== "concern" && a.type !== "done") throw new HttpError(400, "この動きはここでは行いません");

  markActionUsed(family.id, turn.at, b.index, true);
  try {
    if (a.type === "record") {
      const r = await sendingAs(h.who, () => capture({ family, today: turn.today, source: "text", text: a.text, lang: langOf(req) }));
      const techo = r.techo?.length ?? 0;
      // 記録した後の文は、Claude の言い換えを出さず決まった文にする（第30回で「今すぐ産院へ」が「今日のうちに」に弱まった）
      return {
        ok: true,
        note: techo
          ? say("✓ 記録に残しました（話す・撮るの「これまでの記録」）。手帳のページに入る物は、手帳のタブで OK を待っています")
          : say("✓ 記録に残しました（話す・撮るの「これまでの記録」）"),
      };
    }
    if (a.type === "concern") {
      // 話した・打った気がかりの記録と同じ決まりで足す（同じ文がもう並んでいれば足さない＝どちらの順でも1行）。
      // 今日の健診が始まっていれば、ママの事はその健診の「今日聞く事」へ
      const side = a.for === "child" ? "child" : "mother";
      const [added] = addToAgenda(family.id, [{ c: { id: newId(), text: a.text, date: turn.today, for: side }, side }], turn.today);
      const child = family.childName ?? say("赤ちゃん");
      if (side === "child")
        return {
          ok: true,
          note: added
            ? say("✓ {child}の次の健診で聞く事に足しました（健診のタブの「{child}の健診・予防接種」に並びます）", { child })
            : say("✓ もう{child}の次の健診で聞く事に並んでいます（同じ文は2回足しません）", { child }),
        };
      return {
        ok: true,
        note: added ? say("✓ ママの次の健診で聞く事に足しました（健診のタブの「聞く事」に並びます）") : say("✓ もうママの健診で聞く事に並んでいます（同じ文は2回足しません）"),
      };
    }
    markDone(family.id, a.milestoneId, turn.today);
    const label = withLang(lang, () => msWords(a.label), dictFor(lang));
    return { ok: true, done: true, note: say("✓ 「{label}」を済みにしました（今日の画面の「済んだ事」から戻せます）", { label }) };
  } catch (e) {
    markActionUsed(family.id, turn.at, b.index, false);
    throw e;
  }
});
