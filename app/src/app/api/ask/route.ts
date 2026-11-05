// 手帳に聞く: 家族の問いに、この家族の今を見てから答え、動きを添える（lib/ask/agent.ts）。
// GET ?familyId=                 … これまでの会話 { turns }
// POST { familyId, today, text, path?, meId? } … 答えを NDJSON で流す（status の行がいくつか → 最後に done か error）
// 返事の下の動き（記録・健診で聞く事・済み）を押した時は /api/ask/act（押した印をサーバが先に付ける）
// DELETE ?familyId=              … 会話を消して新しく始める
// 窓を閉じても答えは最後まで作って残す。作っている間の問いは pending として GET が返す（画面は開き直した時に待って拾う）
import { body, route } from "@/lib/api";
import { ask, clearChat, getChat, getPending, saveChat, setPending } from "@/lib/ask/agent";
import type { AskEvent, ChatTurn } from "@/lib/ask/types";
import { sendingAs } from "@/lib/claude";
import { HttpError } from "@/lib/http-error";
import { langOf } from "@/lib/i18n/dicts";
import { getKeep } from "@/lib/keep";
import { familyFor, WRITE_AND_SEND } from "../_lib/household";
import { todayOf } from "../capture/shared";

export const maxDuration = 300;

export const GET = route(async (req: Request) => {
  const { family } = await familyFor(req, new URL(req.url).searchParams.get("familyId"), "record:read");
  return { turns: getChat(family.id), pending: busy.has(family.id) ? getPending(family.id) : null };
});

export const DELETE = route(async (req: Request) => {
  const { family } = await familyFor(req, new URL(req.url).searchParams.get("familyId"), "record:write");
  clearChat(family.id);
  return { ok: true };
});

/** 同じ家族で同時に2つ答えない（二度押し） */
const busy = new Set<string>();

export const POST = route(async (req: Request) => {
  const b = await body<{ familyId?: string; today?: string; text?: string; path?: string; meId?: string; retry?: boolean }>(req);
  // 答えるために家族の今を Claude に送り、道具で予定などを書くので、書く権限と送る権限の両方が要る
  const h = await familyFor(req, b.familyId, WRITE_AND_SEND);
  const family = h.family;
  const today = todayOf(b.today);
  const text = (b.text ?? "").trim();
  if (!text) throw new HttpError(400, "聞きたい事が空です");
  if (text.length > 2000) throw new HttpError(400, "長すぎます（2000字まで）");
  if (busy.has(family.id)) throw new HttpError(409, "前の問いに答えています。少し待ってください");
  const member = family.members.find((m) => m.id === b.meId);
  const keep = getKeep(family.id);
  const who = member ? { name: keep.names?.[member.id] || member.name, role: member.role } : undefined;
  const path = typeof b.path === "string" ? b.path.slice(0, 120) : undefined;

  // 聞き直し（前の問いに答えが付かなかった時）: 答えの無い最後の問いを外してから聞く（同じ問いを2つ並べない）
  const saved = getChat(family.id);
  const history = b.retry && saved[saved.length - 1]?.role === "user" ? saved.slice(0, -1) : saved;
  const mine: ChatTurn = { role: "user", text, today, at: new Date().toISOString(), ...(who ? { who: who.name } : {}) };

  busy.add(family.id);
  setPending(family.id, mine);
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: AskEvent) => {
        try {
          controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`));
        } catch {
          // 画面が閉じられた後は流さない（答えは DB に残る）
        }
      };
      try {
        // 送る前の関所（本物の世帯は claude_us の同意）を効かせるため、この世帯の記録として送る
        const r = await sendingAs(h.who, () => ask({ family, today, text, who, path, history, lang: langOf(req), onStatus: (s) => send({ t: "status", text: s }) }));
        saveChat(family.id, [...history, mine, r.turn]);
        send({ t: "done", turn: r.turn });
      } catch (e) {
        console.error(e);
        // 問いは残す（もう一度押せば続きから聞ける）
        saveChat(family.id, [...history, mine]);
        const msg = e instanceof HttpError ? e.message : e instanceof Error && /budget|上限/.test(e.message) ? e.message : "答えを作れませんでした。少し待ってもう一度聞いてください";
        send({ t: "error", error: msg });
      } finally {
        busy.delete(family.id);
        try {
          controller.close();
        } catch {}
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
});
