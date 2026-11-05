"use client";

// 「子育てについて気軽に相談できる人はいますか。」（CONSULT_QUESTION）を、時期ごとに1回だけ聞く（母子健康手帳の保護者の記録で、毎回聞かれる問い）。
// 府令様式（母子保健法施行規則 様式第三号・2026年4月施行版）の保護者の記録: 2週間頃（p.18）・1か月頃・2か月頃・3～4か月頃・6～7か月頃・
// 9～10か月頃・1歳の頃 … 6歳の頃（p.42）の各ページに、この問いがそのままある。妊娠中の頁は問いではなく「※妊娠・出産について気軽に
// 相談できる人を見つけておくと安心です。」（p.5）で、このアプリは妊娠中も同じ問いで聞く。答えは page "consult" に残る（POST /api/techo action add）。
// 答えは4つ（いる／いるけど頼みにくい／いない／今は答えない）。答えた人ごとに聞く（母が答えても、パートナーには別に聞く）。
// 「いない」「頼みにくい」の時は、責めずに、町の相談先への橋だけを出す（体や心の判断はしない）。開き直しても、
// この位置に小さな「頼れる所（いつでも開けます）›」を出し続ける。「今は答えない」はその時期は二度と聞かない印。
// 判定は consult-answer.ts（純粋な関数・試験つき）、頼れる所の中身は HelpPlaces.tsx（手帳・気持ちの記録と共通）。
// 出典: こども家庭庁「母子健康手帳について」（府令様式 2026年）／こども家庭センター（児童福祉法 2024年4月〜）／
//       こども医療電話相談 #8000（こども家庭庁）／児童相談所 相談専用ダイヤル 0120-189-783（こども家庭庁）
// 日本語以外で相談できる所（2026-11-03 に出入国在留管理庁の一次の出典で実在を確かめた）:
//   - 外国人生活支援ポータルサイト「あなたの住んでいるところの相談窓口を探す」（都道府県・対応言語・相談方法で探せる）
//     https://www.moj.go.jp/isa/support/portal/12_00227.html
//   - 外国人在留総合インフォメーションセンター 0570-013904（IP電話・海外から 03-5796-7112）。平日 8:30〜17:15。
//     日本語・英語・中国語・韓国語・スペイン語・ポルトガル語・ベトナム語・ネパール語・タイ語・ミャンマー語・シンハラ語。
//     https://www.moj.go.jp/isa/consultation/center/index.html
//   （外国人在留支援センター FRESC は東京・四谷の、在留・労働・法律の国の窓口の集まり。子育ての相談先ではないので出さない
//     https://www.moj.go.jp/isa/support/fresc/fresc01.html ）
import { useEffect, useState } from "react";
import { addDays } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { CONSULT_AFTER_NOTE, consultWaitsFirstDay } from "@/lib/consult-first-day";
import { CONSULT_QUESTION, type TechoEntry } from "@/lib/techo";
import { api } from "../FamilyProvider";
import { Notice, plainError, Why } from "../ui";
import { consultAnswerFor, consultPeriod, consultValues, needsBridge, type ConsultAnswer } from "./consult-answer";
import { HelpPlaces } from "./HelpPlaces";


/** GET /api/techo の返り（{ techo: Doc<TechoEntry>[] }）から記録を取り出す（中身が data に入っていなくても読める） */
function entriesOf(j: unknown): TechoEntry[] {
  const o = (j ?? {}) as Record<string, unknown>;
  const raw = (Array.isArray(o.techo) ? o.techo : Array.isArray(o.entries) ? o.entries : []) as Record<string, unknown>[];
  return raw.map((x) => ((x && typeof x === "object" && "data" in x ? x.data : x) as TechoEntry)).filter((e) => e && typeof e === "object" && e.page);
}

/**
 * hold: 大きな札の日（お祝い・ようこそ・届けの束・手帳の気づき。now-fold.ts の bigCardDay）。問いを出さない
 * （前の時期に「いない」「頼みにくい」と答えた人の、小さな頼れる所の1行だけは残す）
 */
export function ConsultAsk({ family, today, meName, hold }: { family: Family; today: string; meName?: string; hold?: boolean }) {
  // 使い始めた日は聞かない（初めての日は手帳に慣れるだけ。見本の家族は今までどおり。lib/consult-first-day.ts）
  const period = consultWaitsFirstDay(family, today) ? null : consultPeriod(family, today);
  // undefined = 読み込み中、null = この人はこの区切りでまだ答えていない
  const [answered, setAnswered] = useState<ConsultAnswer | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 今この画面で答えた結果（「いない」「頼みにくい」の時は橋を開いたまま出す）
  const [justSaid, setJustSaid] = useState<ConsultAnswer | null>(null);
  // 前の時期に「いない」「頼みにくい」と答えていたら、新しい時期の問いの下にも頼れる所を残す（なりきり sim-09）
  const [earlier, setEarlier] = useState<ConsultAnswer | null>(null);

  useEffect(() => {
    let alive = true;
    setAnswered(undefined);
    setJustSaid(null);
    setError("");
    if (!period) return;
    api<unknown>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => {
        if (!alive) return;
        const entries = entriesOf(j);
        setAnswered(consultAnswerFor(entries, period, meName));
        setEarlier(consultAnswerFor(entries, { from: "0000-01-01", to: addDays(period.from, -1) }, meName));
      })
      // 読めない時は聞かない（目立たせない問いなので、エラーで画面を埋めない）
      .catch(() => alive && setAnswered("skip"));
    return () => {
      alive = false;
    };
    // period は日付から決まるので、family と today と答える人だけ見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, today, period?.key, meName]);

  if (!period) return null;
  if (justSaid && needsBridge(justSaid)) return <Bridge family={family} />;
  if (justSaid === "yes")
    return (
      <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-base text-ok">
        {t("手帳の「相談した記録」に残しました")}
      </p>
    );
  if (justSaid === "skip")
    return (
      <p role="status" className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
        {t("わかりました。{label}のあいだは、もう聞きません", { label: t(period.label) })}
      </p>
    );
  if (answered === undefined) return null;
  // 「いない」「頼みにくい」と答えた後は、開き直しても小さく出し続ける
  if (needsBridge(answered)) return <HelpPlaces family={family} compact label={t("頼れる所（いつでも開けます）")} />;
  if (answered !== null) return null;
  if (hold) return needsBridge(earlier) ? <HelpPlaces family={family} compact label={t("頼れる所（いつでも開けます）")} /> : null;

  const answer = async (a: ConsultAnswer) => {
    setSaving(true);
    setError("");
    const entry: TechoEntry = {
      page: "consult",
      date: today,
      // 訳さない: 手帳に残す題（記録は日本語で残し、手帳の画面が出す時に訳す）
      title: `相談できる人（${period.label}）`,
      values: consultValues(a),
      who: meName,
      source: "text",
    };
    try {
      await api("/api/techo", { body: { familyId: family.id, action: "add", entries: [entry], today } });
      setJustSaid(a);
    } catch (e) {
      setError(plainError(e));
    } finally {
      setSaving(false);
    }
  };

  const btn = "min-h-11 rounded-full border border-ink/20 bg-card px-4 text-base font-semibold disabled:opacity-50";
  // 問いは1行に畳み、押すと4つの答えが出る（家族の声①への直し A。紙の手帳と同じ問いの全文は、開いた中に）
  const ask = (
    <details aria-label={t("相談できる人")} className="group rounded-2xl border border-line bg-card px-4">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 py-1">
        <span className="min-w-0 text-base">
          <span className="mr-2 text-xs font-semibold text-muted">{t("手帳から1つ聞きます")}</span>
          {t("相談できる人はいますか")}
        </span>
        <span className="shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-2 pb-3">
        <p className="text-base">{t(CONSULT_QUESTION)}</p>
        <p className="text-sm text-muted">{t(CONSULT_AFTER_NOTE)}</p>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" disabled={saving} onClick={() => void answer("yes")} className={btn}>
            {t("いる")}
          </button>
          <button type="button" disabled={saving} onClick={() => void answer("no")} className={btn}>
            {t("いない")}
          </button>
          <button type="button" disabled={saving} onClick={() => void answer("hard")} className={`${btn} col-span-2`}>
            {t("いるけど頼みにくい")}
          </button>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void answer("skip")}
          className="inline-flex min-h-11 items-center self-start text-sm text-muted underline underline-offset-2 disabled:opacity-50"
        >
          {t("今は答えない")}
        </button>
        {error && <Notice title={t("まだ手帳に残せていません")} safe={t("もう一度押してください")} detail={error} />}
        <Why>
          <p>{t("紙の母子手帳も、健診のたびに同じことを聞きます。一人で抱えないための問いです。答えは手帳の「相談した記録」に残ります。家族の一人ひとりに聞きます。")}</p>
        </Why>
      </div>
    </details>
  );
  // 前の時期に「いない」「頼みにくい」と答えた人には、畳んだ問いの下に頼れる所の1行を出したままにする
  if (!needsBridge(earlier)) return ask;
  return (
    <div className="flex flex-col gap-2">
      {ask}
      <HelpPlaces family={family} compact label={t("頼れる所（いつでも開けます）")} />
    </div>
  );
}

/**
 * 「いない」「頼みにくい」と答えた時の橋（責めない。連絡先だけを短く。中身は HelpPlaces と共通）。
 * 町のこども家庭センターの1行だけを出し、ほかは「ほかの頼れる所（9か所）›」に畳む（家族の声①への直し A）
 */
function Bridge({ family }: { family: Family }) {
  return (
    <section aria-label={t("相談できる所")} className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-base">{t("答えてくれてありがとう。一人で抱えずに頼れる所が、町にあります。")}</p>
      <HelpPlaces family={family} lead />
    </section>
  );
}
