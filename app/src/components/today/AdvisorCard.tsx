"use client";

// 気づいた事: 今日の画面の一番上（NextStep の上）に出すカード。
// 期限表に無い事を、この家族の今から気づいて、数え直した期限とそのまま渡せる文面を出す。
// 今日の画面は、気づきがある時だけ（/api/advisor?peek=1 で先に数を聞いて）これを出す。
// 書き上がるまでの間も、同じ高さの場所（AdvisorSpace）を取っておく（後から入って下の行がずれ、押し間違えないように）。
// 表は高さをそろえ（題は2行・理由は1行まで）、次にする事と渡す文面は「次にする事と文面」の中に畳む。
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { Advice } from "@/lib/advisor";
import { Btn, CopyField, HandoffRow, Why } from "../ui";

/** 気づきの箱の高さ（読み込み中の場所取りと、表の高さをそろえる） */
const BOX = "flex min-h-[15rem] flex-col gap-3 rounded-2xl border-2 border-sky bg-sky-soft p-5";

/** 読み込み中の場所取り（気づきの箱と同じ高さ） */
export function AdvisorSpace() {
  return (
    <section aria-label="手帳が気づいた事を見ています" aria-busy className={BOX}>
      <p className="text-sm font-semibold text-sky">手帳が気づいた事</p>
      <p className="text-base text-muted">この家族の今から、気づいた事をまとめています…</p>
    </section>
  );
}

interface Res {
  advice: Advice | null;
  mailTo?: string;
  /** 文面を送る人（家族の名前）。分かる時だけ */
  from?: string;
  waiting: number;
}

export function AdvisorCard({ familyId, today, meId }: { familyId: string; today: string; meId?: string }) {
  const [res, setRes] = useState<Res | null>(null);
  const [closing, setClosing] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setRes(null);
    setLoaded(false);
    // 早送りの時計を動かしている間は呼ばない（止まってから読む）
    const t = setTimeout(() => {
      api<Res>(`/api/advisor?familyId=${encodeURIComponent(familyId)}&today=${today}`)
        .then((r) => alive && setRes(r))
        .catch(() => alive && setRes(null))
        .finally(() => alive && setLoaded(true));
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [familyId, today]);

  const a = res?.advice;
  if (!loaded) return <AdvisorSpace />;
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
  const [whyHead] = a.why
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  return (
    <section aria-label="手帳が気づいた事" className={BOX}>
      {/* 主語は手帳（UX の見直し C07: 「気づいた事」だけでは、誰が気づいたのかが無かった） */}
      <p className="text-sm font-semibold text-sky">{a.kind === "look" ? "手帳を見渡して、気づいた事" : "手帳が気づいた事"}</p>
      <h2 className="line-clamp-2 font-display text-2xl leading-snug font-bold text-balance">{a.title}</h2>
      {whyHead && <p className="line-clamp-1 text-base">{whyHead}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Btn kind="secondary" onClick={() => void dismiss()} disabled={closing}>
          わかった
        </Btn>
        {res && res.waiting > 0 && <span className="text-sm text-muted">ほかにも気づいた事が{res.waiting}つ</span>}
      </div>
      <Why label={a.plan.length > 0 || m ? "次にする事と文面" : "なぜ？"}>
        <Details a={a} res={res} />
      </Why>
    </section>
  );
}

/** 畳んだ中身: 次にする事・渡す文面・なぜ（機械で確かめた事・調べたページ） */
function Details({ a, res }: { a: Advice; res: Res | null }) {
  const m = a.message;
  const [, ...whyRest] = a.why
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .filter(Boolean);
  // 宛先のメールアドレスが分からない時（町の窓口など）は、空の宛先の欄を出さず、町のページで調べる事を書く
  const mailTo = res?.mailTo && /@/.test(res.mailTo) ? res.mailTo : "";
  const isWork = !!m && /職場|上司|人事|会社/.test(m.to);
  return (
    <div className="flex flex-col gap-3 text-ink">
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
          <p className="text-sm font-semibold text-muted">
            {m.to}へ渡す文面{res?.from ? `（${res.from}から送る文）` : ""}
          </p>
          {m.via === "mail" &&
            (mailTo ? (
              <CopyField label="宛先" value={mailTo} />
            ) : (
              <p className="text-sm text-muted">{isWork ? "宛先は、メールアプリで上司のアドレスを選んでください" : "宛先は町のページで（問い合わせのフォームやメールアドレス）"}</p>
            ))}
          {m.subject && <CopyField label="件名" value={m.subject} />}
          <CopyField label="本文" value={m.body} long />
          <HandoffRow mail={m.via === "mail" ? { to: mailTo || undefined, subject: m.subject, body: m.body } : undefined} line={m.via === "line" ? m.body : undefined} />
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm text-muted">
        {whyRest.map((w, i) => (
          <p key={i}>{w}</p>
        ))}
        <p className="font-semibold">{a.kind === "look" ? "手帳の中で気づいた所" : "機械で確かめた事"}</p>
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
      </div>
    </div>
  );
}
