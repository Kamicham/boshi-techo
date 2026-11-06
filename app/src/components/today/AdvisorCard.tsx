"use client";

// 気づいた事: 今日の画面の一番上（NextStep の上）に出すカード。
// 期限表に無い事を、この家族の今から気づいて、数え直した期限とそのまま渡せる文面を出す。
// 今日の画面は、気づきがある時だけ（/api/advisor?peek=1 で先に数を聞いて）これを出す。
// 書き上がるまでの間も、同じ高さの場所（AdvisorSpace）を取っておく（後から入って下の行がずれ、押し間違えないように）。
// 表は高さをそろえ（題は2行・理由は1行まで）、次にする事と渡す文面は「次にする事と文面」の中に畳む。
// ようこその日（生まれた日からお七夜の前の日まで）は、題だけの1行に畳み、押すと開く（line。家族の声①への直し A「その時に1つ、聞かれたら全部」）。
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { Advice } from "@/lib/advisor";
import { currentLang, t as tr } from "@/lib/i18n";
import { Btn, CopyField, HandoffRow, Why } from "../ui";
import { whyParts } from "./why-parts";
import { Phrase } from "@/components/Phrase";

/** 「わかった」で閉じた時に出す合図（ClosedAdvice が読み直す） */
export const ADVICE_CLOSED = "boshi:advice-closed";

/** 気づきの箱の高さ（読み込み中の場所取りと、表の高さをそろえる） */
const BOX = "flex min-h-[15rem] flex-col gap-3 rounded-2xl border-2 border-sky bg-sky-soft p-5";

/** 1行に畳んだ気づき（ようこその日）の箱 */
const LINE = "rounded-2xl border-2 border-sky bg-sky-soft px-4";

/** 読み込み中の場所取り（気づきの箱と同じ高さ。line は1行に畳んだ形と同じ高さ） */
export function AdvisorSpace({ line }: { line?: boolean } = {}) {
  return (
    <section aria-label={tr("手帳が気づいた事を見ています")} aria-busy className={line ? `${LINE} flex min-h-14 flex-col justify-center py-2` : BOX}>
      <p className="text-sm font-semibold text-sky">{tr("手帳が気づいた事")}</p>
      <p className={`text-base text-muted ${line ? "line-clamp-2" : ""}`}>{tr("この家族の今から、気づいた事をまとめています…")}</p>
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

export function AdvisorCard({
  familyId,
  today,
  meId,
  line,
  defaultOpen,
}: {
  familyId: string;
  today: string;
  meId?: string;
  /** 題だけの1行に畳む（押すと開く）。ようこその日 */
  line?: boolean;
  /** 1行に畳んだ時も、開いて始める（見本の「生まれた翌日」の札から、気づきを見に来た時） */
  defaultOpen?: boolean;
}) {
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
  if (!loaded) return <AdvisorSpace line={line} />;
  if (!a) return null;
  void meId;

  const dismiss = async () => {
    setClosing(true);
    try {
      await api("/api/advisor", { body: { familyId, key: a.key } });
      // 閉じた気づきの一覧（今日の画面の「済んだ事」の下）に知らせる
      window.dispatchEvent(new Event(ADVICE_CLOSED));
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
  const [whyHead] = whyParts(a.why);
  // 主語は手帳（UX の見直し C07: 「気づいた事」だけでは、誰が気づいたのかが無かった）
  const eyebrow = a.kind === "look" ? tr("手帳を見渡して、気づいた事") : tr("手帳が気づいた事");
  const rest = (
    <>
      {whyHead && <p className={`text-base ${line ? "" : "line-clamp-1"}`}>{tr(whyHead)}</p>}
      <div className="mt-auto flex flex-wrap items-center gap-2">
        <Btn kind="secondary" onClick={() => void dismiss()} disabled={closing}>
          {tr("わかった")}
        </Btn>
        {res && res.waiting > 0 && <span className="text-sm text-muted">{tr("ほかにも気づいた事が{n}つ", { n: res.waiting })}</span>}
      </div>
      <Why label={a.plan.length > 0 || m ? tr("次にする事と文面") : tr("なぜ？")}>
        <AdviceDetails a={a} res={res} />
      </Why>
    </>
  );
  // ようこその日: 題だけの1行（押すと、理由・わかった・次にする事と文面）
  if (line)
    return (
      <section aria-label={eyebrow}>
        <details className={`group ${LINE}`} open={defaultOpen}>
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-sky">{eyebrow}</span>
              <span className="phrase line-clamp-2 text-base leading-snug font-semibold">
                <Phrase text={tr(a.title)} />
              </span>
            </span>
            <span className="shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="flex flex-col gap-3 pb-4">{rest}</div>
        </details>
      </section>
    );
  return (
    <section aria-label={tr("手帳が気づいた事")} className={BOX}>
      <p className="text-sm font-semibold text-sky">{eyebrow}</p>
      {/* 気づきの中身はサーバ（Claude か決まり）が日本語で書いて残した物。辞書にある文（決まりの文）だけ、画面の言葉にする */}
      <h2 className="phrase line-clamp-2 font-display text-2xl leading-snug font-bold text-balance">
        <Phrase text={tr(a.title)} />
      </h2>
      {rest}
    </section>
  );
}

/** 文面の相手の役（「職場の上司」・「{町}の子育ての窓口」）を今の言葉で。町の名前は日本語のまま */
const toIn = (to: string): string => {
  const city = /^(.+)の子育ての窓口$/.exec(to)?.[1];
  return city ? tr("{city}の子育ての窓口", { city }) : tr(to);
};

/** 畳んだ中身: 次にする事・渡す文面・なぜ（手帳が記録と日付から確かめた事・調べたページ）。閉じた気づきを開き直す所（ClosedAdvice）でも使う */
export function AdviceDetails({ a, res }: { a: Advice; res: Pick<Res, "mailTo" | "from"> | null }) {
  const m = a.message;
  const [, ...whyRest] = whyParts(a.why);
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
              <span>{tr(p)}</span>
            </li>
          ))}
        </ol>
      )}

      {m && (
        <div className="flex flex-col gap-2 rounded-xl bg-card p-3">
          <p className="text-sm font-semibold text-muted">
            {tr("{to}へ渡す文面", { to: toIn(m.to) })}
            {res?.from ? tr("（{from}から送る文）", { from: res.from }) : ""}
          </p>
          {m.via === "mail" &&
            (mailTo ? (
              <CopyField label={tr("宛先")} value={mailTo} />
            ) : (
              <p className="text-sm text-muted">{isWork ? tr("宛先は、メールアプリで上司のアドレスを選んでください") : tr("宛先は町のページで（問い合わせのフォームやメールアドレス）")}</p>
            ))}
          {/* 件名と本文は、職場・役所あての日本語の文書のまま（中文・English の画面では、そう一言） */}
          {currentLang() !== "ja" && <p className="text-sm text-muted">{tr("文面は、相手が読む日本語のままです")}</p>}
          {m.subject && <CopyField label={tr("件名")} value={m.subject} />}
          <CopyField label={tr("本文")} value={m.body} long />
          <HandoffRow mail={m.via === "mail" ? { to: mailTo || undefined, subject: m.subject, body: m.body } : undefined} line={m.via === "line" ? m.body : undefined} />
        </div>
      )}

      <div className="flex flex-col gap-1 text-sm text-muted">
        {whyRest.map((w, i) => (
          <p key={i}>{tr(w)}</p>
        ))}
        <p className="font-semibold">{a.kind === "look" ? tr("手帳の中で気づいた所") : tr("手帳が記録と日付から確かめた事")}</p>
        {a.facts.map((f, i) => (
          <p key={`f${i}`}>{tr(f)}</p>
        ))}
        {a.sources && a.sources.length > 0 && (
          <>
            <p className="font-semibold">{tr("調べたページ")}</p>
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
