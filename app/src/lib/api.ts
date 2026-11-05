// API ルートの共通の包み。エラーを JSON にして返す（言葉は頼みのクッキー boshi_lang で訳す。lib/i18n。訳の無い言葉は日本語のまま）。
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { HttpError } from "./family";
import { langOf, tFor } from "./i18n/dicts";

/**
 * 関所を先に通してから multipart の中身を読む（技術監査 (5)①・2026-11-05。写真と声の手紙の口）。
 * 画面は familyId を道（?familyId=）にも付けて送る。道に無い古い画面は、門の大きさの上限（lib/body-limit.ts）の内で
 * 中身を読んでから関所へ（開いたままの古い画面のため。11/8 の後に外す）。道と中身の familyId が食い違えば 400
 */
export async function formAfterGate<T>(req: Request, gate: (familyId: unknown) => Promise<T>, unreadable: string): Promise<{ ctx: T; form: FormData }> {
  const early = new URL(req.url).searchParams.get("familyId");
  const ctx = early ? await gate(early) : null;
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new HttpError(400, unreadable);
  }
  const inForm = form.get("familyId");
  if (early && typeof inForm === "string" && inForm && inForm !== early) throw new HttpError(400, "家族の指定が食い違っています");
  return { ctx: ctx ?? (await gate(inForm)), form };
}

export function route<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      const lang = langOf(args[0]);
      const say = (error: string, vars?: Record<string, string | number>) => ({ error: tFor(lang, error, vars) });
      if (e instanceof HttpError) return NextResponse.json(say(e.message), { status: e.status });
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json(say("Claude が混み合っています。少し待ってもう一度"), { status: 429 });
      if (e instanceof Anthropic.AuthenticationError) return NextResponse.json(say("いま Claude につながりません。手帳の予定と記録はそのまま使えます"), { status: 500 });
      if (e instanceof Anthropic.APIError) return NextResponse.json(say("Claude の呼び出しに失敗しました（{status}）", { status: String(e.status) }), { status: 502 });
      console.error(e);
      return NextResponse.json(say(e instanceof Error ? e.message : "うまくいきませんでした"), { status: 500 });
    }
  };
}

export async function body<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, "送られた内容が読めません");
  }
}
