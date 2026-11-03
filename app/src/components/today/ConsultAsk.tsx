"use client";

// 「困った時に相談できる人はいますか？」を、時期ごとに1回だけ聞く（母子健康手帳の保護者の記録で、毎回聞かれる問い）。
// 府令様式（母子保健法施行規則 様式第三号）の保護者の記録: 妊娠中・産後・1か月・3〜4か月・6〜7か月・1歳・1歳6か月 などの各ページに
// 「相談できる人はいますか」の問いがある。答えは page "consult" に残る（POST /api/techo action add）。
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
import { addDays, addMonths, clockAt, lmpFromDue } from "@/lib/clock";
import type { Family } from "@/lib/demo-family";
import { CONSULT_QUESTION, type TechoEntry } from "@/lib/techo";
import { api } from "../FamilyProvider";
import { Notice, plainError, Why } from "../ui";
import { consultAnswerFor, consultValues, needsBridge, type ConsultAnswer } from "./consult-answer";
import { HelpPlaces } from "./HelpPlaces";

/** 聞く区切り（手帳のページの時期）。from〜to の間に答えがあれば、その区切りは聞かない */
interface Period {
  key: string;
  label: string;
  from: string;
  to: string;
}

/** 今日がどの区切りにいるか（授かる前・2歳を過ぎた後は聞かない） */
export function consultPeriod(family: Family, today: string): Period | null {
  const c = clockAt(family, today);
  if (c.phase === "pregnant") {
    // 妊娠を届けて手帳をもらうころ（8週ごろ）から聞く
    if ((c.pregnancyWeek ?? 0) < 8) return null;
    const lmp = lmpFromDue(family.dueDate);
    return { key: "pregnancy", label: "妊娠中", from: lmp, to: addDays(family.birthDate ?? addDays(family.dueDate, 14), -1) };
  }
  if (c.phase !== "child" || !family.birthDate) return null;
  const b = family.birthDate;
  const cuts: [string, string, number, number][] = [
    ["2w", "産後2週ごろ", 0, 1],
    ["1m", "1か月", 1, 3],
    ["3m", "3〜4か月", 3, 6],
    ["6m", "6〜7か月", 6, 12],
    ["12m", "1歳", 12, 18],
    ["18m", "1歳6か月", 18, 24],
  ];
  const m = c.ageMonths ?? 0;
  const hit = cuts.find(([, , a, z]) => m >= a && m < z);
  if (!hit) return null;
  return { key: hit[0], label: hit[1], from: addMonths(b, hit[2]), to: addDays(addMonths(b, hit[3]), -1) };
}

/** GET /api/techo の返り（{ techo: Doc<TechoEntry>[] }）から記録を取り出す（中身が data に入っていなくても読める） */
function entriesOf(j: unknown): TechoEntry[] {
  const o = (j ?? {}) as Record<string, unknown>;
  const raw = (Array.isArray(o.techo) ? o.techo : Array.isArray(o.entries) ? o.entries : []) as Record<string, unknown>[];
  return raw.map((x) => ((x && typeof x === "object" && "data" in x ? x.data : x) as TechoEntry)).filter((e) => e && typeof e === "object" && e.page);
}

export function ConsultAsk({ family, today, meName }: { family: Family; today: string; meName?: string }) {
  const period = consultPeriod(family, today);
  // undefined = 読み込み中、null = この人はこの区切りでまだ答えていない
  const [answered, setAnswered] = useState<ConsultAnswer | null | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 今この画面で答えた結果（「いない」「頼みにくい」の時は橋を開いたまま出す）
  const [justSaid, setJustSaid] = useState<ConsultAnswer | null>(null);

  useEffect(() => {
    let alive = true;
    setAnswered(undefined);
    setJustSaid(null);
    setError("");
    if (!period) return;
    api<unknown>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => {
        if (!alive) return;
        setAnswered(consultAnswerFor(entriesOf(j), period, meName));
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
        手帳の「相談した記録」に残しました
      </p>
    );
  if (justSaid === "skip")
    return (
      <p role="status" className="rounded-lg bg-paper px-3 py-2 text-sm text-muted">
        わかりました。{period.label}のあいだは、もう聞きません
      </p>
    );
  if (answered === undefined) return null;
  // 「いない」「頼みにくい」と答えた後は、開き直しても小さく出し続ける
  if (needsBridge(answered)) return <HelpPlaces family={family} compact label="頼れる所（いつでも開けます）" />;
  if (answered !== null) return null;

  const answer = async (a: ConsultAnswer) => {
    setSaving(true);
    setError("");
    const entry: TechoEntry = {
      page: "consult",
      date: today,
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
  return (
    <section aria-label="相談できる人" className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-base">
        <span className="mr-2 text-xs font-semibold text-muted">{period.label}の手帳の問い</span>
        <br />
        {CONSULT_QUESTION}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={saving} onClick={() => void answer("yes")} className={btn}>
          いる
        </button>
        <button type="button" disabled={saving} onClick={() => void answer("no")} className={btn}>
          いない
        </button>
        <button type="button" disabled={saving} onClick={() => void answer("hard")} className={`${btn} col-span-2`}>
          いるけど頼みにくい
        </button>
      </div>
      <button
        type="button"
        disabled={saving}
        onClick={() => void answer("skip")}
        className="inline-flex min-h-11 items-center self-start text-sm text-muted underline underline-offset-2 disabled:opacity-50"
      >
        今は答えない
      </button>
      {error && <Notice title="まだ手帳に残せていません" safe="もう一度押してください" detail={error} />}
      <Why>
        <p>紙の母子手帳も、健診のたびに同じことを聞きます。一人で抱えないための問いです。答えは手帳の「相談した記録」に残り、ほかの人には送られません。家族の一人ひとりに聞きます。</p>
      </Why>
    </section>
  );
}

/** 「いない」「頼みにくい」と答えた時の橋（責めない。連絡先だけを短く。中身は HelpPlaces と共通） */
function Bridge({ family }: { family: Family }) {
  return (
    <section aria-label="相談できる所" className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-base">答えてくれてありがとう。一人で抱えずに頼れる所が、町にあります。</p>
      <HelpPlaces family={family} />
    </section>
  );
}
