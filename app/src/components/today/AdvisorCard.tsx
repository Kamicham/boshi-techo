"use client";

// ④ 参謀の気づき: 今日の画面の一番上（NextStep の上）に出すカード。
// 期限表に無い事を、この家族の今から気づいて、組み直し案とそのまま渡せる文面を出す。
// 読み込み中・何も無い時は何も出さない（一番上がちらつかない）。
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { Advice } from "@/lib/advisor";
import { Btn, CopyField, HandoffRow, Why } from "../ui";

interface Res {
  advice: Advice | null;
  mailTo?: string;
  waiting: number;
}

export function AdvisorCard({ familyId, today, meId }: { familyId: string; today: string; meId?: string }) {
  const [res, setRes] = useState<Res | null>(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    let alive = true;
    setRes(null);
    // 早送りの時計を動かしている間は呼ばない（止まってから読む）
    const t = setTimeout(() => {
      api<Res>(`/api/advisor?familyId=${encodeURIComponent(familyId)}&today=${today}`)
        .then((r) => alive && setRes(r))
        .catch(() => alive && setRes(null));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [familyId, today]);

  const a = res?.advice;
  if (!a) return null;
  void meId;

  const dismiss = async () => {
    setClosing(true);
    try {
      await api("/api/advisor", { body: { familyId, key: a.key } });
      // 次のきっかけがあれば読み直す
      const r = res && res.waiting > 0 ? await api<Res>(`/api/advisor?familyId=${encodeURIComponent(familyId)}&today=${today}`) : null;
      setRes(r);
    } catch {
      setRes(null);
    } finally {
      setClosing(false);
    }
  };

  const m = a.message;
  // 表には1文目だけ、残りは「なぜ？」の奥へ
  const [whyHead, ...whyRest] = a.why
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <section aria-label="気づいた事" className="flex flex-col gap-3 rounded-2xl border-2 border-sky bg-sky-soft p-5">
      <p className="text-sm font-semibold text-sky">気づいた事</p>
      <h2 className="font-display text-2xl leading-snug font-bold text-balance">{a.title}</h2>
      {whyHead && <p className="line-clamp-1 text-base">{whyHead}</p>}
      <Why>
        {whyRest.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
        <p className="font-semibold">機械で確かめた事</p>
        {a.facts.map((f, i) => (
          <p key={`f${i}`}>{f}</p>
        ))}
        {a.sources && a.sources.length > 0 && (
          <>
            <p className="font-semibold">調べたページ</p>
            {a.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="underline underline-offset-2">
                {s.title || s.url}
              </a>
            ))}
          </>
        )}
      </Why>

      {a.plan.length > 0 && (
        <ol className="flex flex-col gap-1">
          {a.plan.map((p, i) => (
            <li key={i} className="flex gap-2 text-base">
              <span className="tabular font-bold text-sky">{i + 1}</span>
              <span>{p}</span>
            </li>
          ))}
        </ol>
      )}

      {m && (
        <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
          <p className="text-sm font-semibold text-muted">{m.to}へ渡す文面</p>
          {m.subject && <CopyField label="件名" value={m.subject} />}
          <CopyField label="本文" value={m.body} long />
          <HandoffRow
            mail={m.via === "mail" ? { to: res?.mailTo, subject: m.subject, body: m.body } : undefined}
            line={m.via === "line" ? m.body : undefined}
          />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Btn kind="secondary" onClick={() => void dismiss()} disabled={closing}>
          わかった
        </Btn>
        {res && res.waiting > 0 && <span className="text-sm text-muted">ほかにも気づいた事が{res.waiting}つ</span>}
      </div>
    </section>
  );
}
