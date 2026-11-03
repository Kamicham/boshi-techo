"use client";

// アカウントの画面（ログイン・世帯・同意・招待）で共通の小さな部品。
import { useCallback, useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { Consent, Subject } from "@/lib/households";

/** Better Auth の失敗を日本語に（英語の文を画面に出さない） */
export function authMessage(err: { code?: string; message?: string; status?: number } | null | undefined, fallback: string): string {
  const code = err?.code ?? "";
  const map: Record<string, string> = {
    INVALID_OTP: "コードが違います。メールのコードをもう一度確かめてください",
    OTP_EXPIRED: "コードの期限（5分）が切れました。もう一度コードを送ってください",
    TOO_MANY_ATTEMPTS: "3回まちがえたので、このコードは使えなくなりました。もう一度コードを送ってください",
    INVALID_EMAIL: "メールの形が違います",
  };
  if (map[code]) return map[code];
  if (err?.status === 429) return "続けて押されたので、少し待ってからもう一度押してください";
  if (err?.status === 503) return "このサーバでは、アカウントの仕組みをまだ動かしていません";
  return fallback;
}

/** 箱1つ分 */
export function Box({ title, children, tone }: { title?: string; children: React.ReactNode; tone?: "alert" }) {
  return (
    <section className={`flex flex-col gap-3 rounded-2xl border p-4 ${tone === "alert" ? "border-alert/40 bg-alert/5" : "border-line bg-card"}`}>
      {title && <h2 className="font-display text-xl font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function Msg({ msg }: { msg: { ok: boolean; text: string } | null }) {
  if (!msg) return null;
  return (
    <p role={msg.ok ? "status" : "alert"} className={`rounded-xl px-4 py-3 text-base ${msg.ok ? "bg-ok/10 text-ok" : "bg-alert/10 font-semibold text-alert"}`}>
      {msg.text}
    </p>
  );
}

export const field = "min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base";

export const SUBJECT_WORD: Record<Subject["kind"], string> = { mother: "母", child: "子", partner: "パートナー" };
export const ROLE_WORD: Record<string, string> = { owner: "持ち主", admin: "共同の管理", member: "読むだけ", guest: "作った家族（ログインなし）" };

export type SubjectView = Subject & { mine: boolean; canConsent: boolean; record: Consent | null; claude: Consent | null };
export type HouseholdDetail = {
  household: { id: string; kind: "real" | "demo" | "sim"; name: string };
  role: "owner" | "admin" | "member" | "guest";
  perms: string[];
  account: { id: string; email: string; name: string } | null;
  subjects: SubjectView[];
  history: Consent[];
  members: { id: string; accountId: string; email: string; name: string; role: string; createdAt: string }[];
  invitations: { id: string; email: string; role: string; expiresAt: string; relation: string | null }[];
  proxies: { accountId: string; subjectId: string; basis: string; scope: string[] }[];
};

/** 世帯の中身（GET /api/account/household）を読む */
export function useHouseholdDetail(familyId: string | null) {
  const [data, setData] = useState<HouseholdDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!familyId) return;
    try {
      setData(await api<HouseholdDetail>(`/api/account/household?familyId=${encodeURIComponent(familyId)}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [familyId]);
  useEffect(() => {
    void load();
  }, [load]);
  return { data, error, load };
}

/** 日時を「2026年11月3日 14:05」に */
export function jpDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const p = new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });
  return p.format(d);
}

/** ログイン後の行き先: 招待のリンクなど、このアプリの中の道だけ（外の住所へは飛ばさない） */
export function safeNext(v: string | null | undefined): string | null {
  if (!v || !v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\")) return null;
  return v;
}
