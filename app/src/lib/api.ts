// API ルートの共通の包み。エラーを日本語の JSON にして返す。
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { HttpError } from "./family";

export function route<A extends unknown[]>(fn: (...args: A) => Promise<unknown>) {
  return async (...args: A) => {
    try {
      const out = await fn(...args);
      return out instanceof Response ? out : NextResponse.json(out);
    } catch (e) {
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      if (e instanceof Anthropic.RateLimitError) return NextResponse.json({ error: "Claude が混み合っています。少し待ってもう一度" }, { status: 429 });
      if (e instanceof Anthropic.AuthenticationError) return NextResponse.json({ error: "いま Claude につながりません。手帳の予定と記録はそのまま使えます" }, { status: 500 });
      if (e instanceof Anthropic.APIError) return NextResponse.json({ error: `Claude の呼び出しに失敗しました（${e.status}）` }, { status: 502 });
      console.error(e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "うまくいきませんでした" }, { status: 500 });
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
