"use client";

// 「生まれました」の儀式（総点検 1-1・2026-11-04）。手帳のいちばん大きな日を、事務の札だけで迎えない。
// - BornPrompt: 正期産（37週0日）から生まれた日を入れるまで、上の帯の下に「生まれたら、ここから」。押すと生まれた日（と名前・任意）だけを聞き、
//   設定と同じ口（/api/account/profile・わが家は /api/family）へ保存する。作った家族（見本・シミュレーション）は保存せず、時計を生まれた日へ進める。
//   保存できない役（読むだけの祖父母など）には出さない。
// - WelcomeBaby: 生まれた日からお七夜の前の日まで（生後0〜5日）、一番上に「ようこそ、{名前}」の1枚。はじめましての写真・声、家族へ知らせる文、
//   届けの一言（出生届は誰の番か。産んだ人には、休む事を先に）。届けの束（BirthTripCard）はその下。
// - どちらも静かにする（つらい別れ・入院）間は出さない（lib/media-shared.ts の bornPromptFor・welcomeFor）。体の事（体重・時刻・様子）は聞かない・書かない。
// 出生届の根拠: 戸籍法第49条（生まれた日を含めて14日以内）。署名した届書を窓口へ持っていくのは、ほかの家族でもよい（使者。lib/milestones.ts）。
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, plainError } from "@/components/ui";
import type { Family, Member } from "@/lib/demo-family";
import type { ClientLetter } from "@/lib/letters-shared";
import { birthNewsText } from "@/lib/media-shared";
import { jpDate } from "./dates";
import type { Task } from "./task";
import { registrationLine } from "./welcome";

const field = "min-h-12 w-full rounded-xl border border-line bg-card px-3 text-base";

export function BornPrompt({ family, today }: { family: Family; today: string }) {
  const { accountsEnabled, households, reload, setToday, timeTravel } = useFamily();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [name, setName] = useState(family.childName ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const canSave = !timeTravel && (accountsEnabled ? households.some((h) => h.id === family.id && h.role !== "member") : family.id === "mine");
  // 作った家族は生まれた日が決めてある（無い家族は、生まれる場面を持たない）
  const made = timeTravel && !!family.birthDate && family.birthDate > today;
  if (!canSave && !made) return null;

  const save = async () => {
    if (!date || date > today) return setErr("生まれた日は、今日かそれより前の日を入れてください");
    setSaving(true);
    setErr("");
    try {
      // 設定の画面と同じ中身で送る（ほかの欄は今のまま）
      const payload = {
        familyId: family.id,
        prefecture: family.prefecture,
        city: family.city,
        dueDate: family.dueDate,
        birthDate: date,
        childName: name.trim() || undefined,
        members: family.members,
        ...(family.situation ? { situation: family.situation } : {}),
      };
      await api(accountsEnabled ? "/api/account/profile" : "/api/family", { body: payload });
      await reload();
    } catch (e) {
      setErr(`まだ残せていません。入れた事は画面に残っています（${plainError(e)}）`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="生まれたら" className="flex flex-col gap-3 rounded-2xl border border-rose/40 bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 text-base">
          <span className="font-display text-lg font-bold">👶 生まれたら、ここから</span>
          {!open && <span className="block text-sm text-muted">生まれた日を入れると、出生届から先の14日を手帳が組み直します</span>}
        </p>
        {!open && (
          <span className="shrink-0">
            <Btn onClick={() => (made ? setToday(family.birthDate!) : setOpen(true))}>生まれました</Btn>
          </span>
        )}
      </div>
      {made && <p className="text-sm text-muted">見本の家族は、押すと{jpDate(family.birthDate!, today)}（生まれた日）へ進みます</p>}
      {open && (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-base">
            生まれた日
            <input type="date" className={field} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 text-base">
            名前（決まっていれば。あとからでも大丈夫です）
            <input className={field} value={name} maxLength={30} onChange={(e) => setName(e.target.value)} placeholder="例: ひなた" />
          </label>
          {err && (
            <p role="alert" className="text-sm text-alert">
              {err}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => void save()} disabled={saving}>
              {saving ? "残しています…" : "手帳に残す"}
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(false)}>
              やめる
            </Btn>
          </div>
        </div>
      )}
    </section>
  );
}

export function WelcomeBaby({
  family,
  today,
  me,
  reg,
  by,
  tripBelow,
}: {
  family: Family;
  today: string;
  me: Member | null;
  reg?: Task & { together?: boolean };
  by?: string;
  /** 届けの束（BirthTripCard）がすぐ下に出ているか */
  tripBelow?: boolean;
}) {
  const [sealed, setSealed] = useState(0);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ familyId: family.id, today, ...(by ? { by } : {}) });
    fetch(`/api/letters?${qs}`)
      .then((r) => (r.ok ? r.json() : { letters: [] }))
      .then((j: { letters?: ClientLetter[] }) => alive && setSealed((j.letters ?? []).filter((l) => !l.opened && l.open === "1y").length))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id, today, by]);
  const birth = family.birthDate!;
  const name = family.childName ?? "赤ちゃん";
  const news = birthNewsText({ birthDate: birth, childName: family.childName });
  const share = async () => {
    try {
      if (navigator.share) return void (await navigator.share({ text: news }));
    } catch {
      return; // 閉じた時
    }
    try {
      await navigator.clipboard.writeText(news);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  const line = registrationLine(family, me, reg);
  const link = "flex min-h-12 items-center justify-between gap-3 rounded-xl bg-card px-4 text-base font-semibold";
  return (
    <section aria-label="ようこそ" className="flex flex-col gap-3 rounded-2xl border border-rose/40 bg-rose-soft p-4">
      <p className="text-sm font-semibold text-rose">{jpDate(birth, today)}に生まれました</p>
      <h2 className="font-display text-2xl font-bold [text-wrap:balance]">ようこそ、{name}</h2>
      {sealed > 0 && <p className="text-base">おなかにいた頃に書いた手紙が{sealed}通、1歳の誕生日を待っています。</p>}
      <div className="flex flex-col gap-2">
        <Link href="/capture?keep=1" className={link}>
          <span>📷 はじめましての写真・🎙 声を残す</span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </Link>
        <button type="button" onClick={() => void share()} className={`${link} text-left`}>
          <span className="min-w-0">
            💌 家族に知らせる
            <span className="block text-sm font-normal text-muted">{copied ? "文を写しました。LINE などに貼れます" : `「${news}」`}</span>
          </span>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </button>
      </div>
      {line && (
        <p className="text-base">
          {tripBelow && reg?.status !== "済み" ? "届けの準備は、手帳が下の1枚にまとめました。" : ""}
          {line}
        </p>
      )}
    </section>
  );
}
