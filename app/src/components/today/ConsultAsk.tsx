"use client";

// 「困った時に相談できる人はいますか？」を、時期ごとに1回だけ聞く（母子健康手帳の保護者の記録で、毎回聞かれる問い）。
// 府令様式（母子保健法施行規則 様式第三号）の保護者の記録: 妊娠中・産後・1か月・3〜4か月・6〜7か月・1歳・1歳6か月 などの各ページに
// 「相談できる人はいますか」の問いがある。答えは page "consult" に残る（POST /api/techo action add）。
// 「いない」と答えた時は、責めずに、町の相談先への橋だけを出す（体や心の判断はしない）。
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
import { mapUrl } from "@/lib/handoff";
import { CONSULT_QUESTION, type TechoEntry } from "@/lib/techo";
import { api } from "../FamilyProvider";
import { useDevice, Why } from "../ui";

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
  // null = 読み込み中、true = この区切りでは答えた
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // 今この画面で答えた結果（「いない」の時は橋を出したままにする）
  const [justSaid, setJustSaid] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    setAnswered(null);
    setJustSaid(null);
    setError("");
    if (!period) return;
    api<unknown>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => {
        if (!alive) return;
        const hit = entriesOf(j).some((e) => e.page === "consult" && !e.pending && e.date >= period.from && e.date <= period.to);
        setAnswered(hit);
      })
      // 読めない時は聞かない（目立たせない問いなので、エラーで画面を埋めない）
      .catch(() => alive && setAnswered(true));
    return () => {
      alive = false;
    };
    // period は日付から決まるので、family と today だけ見る
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.id, today, period?.key]);

  if (!period) return null;
  if (justSaid === false) return <Bridge family={family} period={period} />;
  if (justSaid === true)
    return (
      <p role="status" className="rounded-lg bg-ok/10 px-3 py-2 text-base text-ok">
        手帳の「相談した記録」に残しました
      </p>
    );
  if (answered !== false) return null;

  const answer = async (has: boolean) => {
    setSaving(true);
    setError("");
    const entry: TechoEntry = {
      page: "consult",
      date: today,
      title: `相談できる人（${period.label}）`,
      values: { has },
      who: meName,
      source: "text",
    };
    try {
      await api("/api/techo", { body: { familyId: family.id, action: "add", entries: [entry], today } });
      setJustSaid(has);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-label="相談できる人" className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-base">
        <span className="mr-2 text-xs font-semibold text-muted">{period.label}の手帳の問い</span>
        <br />
        {CONSULT_QUESTION}
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => void answer(true)}
          className="min-h-11 flex-1 rounded-full border border-ink/20 bg-card px-4 text-base font-semibold disabled:opacity-50"
        >
          いる
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void answer(false)}
          className="min-h-11 flex-1 rounded-full border border-ink/20 bg-card px-4 text-base font-semibold disabled:opacity-50"
        >
          いない
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-alert">
          保存できませんでした: {error}
        </p>
      )}
      <Why>
        <p>紙の母子手帳も、健診のたびに同じことを聞きます。一人で抱えないための問いです。答えは手帳の「相談した記録」に残り、ほかの人には送られません。</p>
      </Why>
    </section>
  );
}

/** 「いない」と答えた時の橋（責めない。連絡先だけを短く） */
function Bridge({ family, period }: { family: Family; period: Period }) {
  const { apple } = useDevice();
  const born = period.key !== "pregnancy";
  const town = `${family.prefecture}${family.city}`;
  // 町の窓口の電話番号は、確かな物が手元に無いので出さない（地図と調べる道だけ）
  const rows: { title: string; sub: string; href: string; label: string }[] = [
    {
      title: `${family.city}のこども家庭センター・保健センター`,
      sub: "妊娠中から子育てまで、何でも聞ける町の窓口です（保健師さんがいます）",
      href: mapUrl(`${town} こども家庭センター`, apple),
      label: "地図で探す",
    },
    {
      title: "町の窓口の電話番号を調べる",
      sub: `「${family.city} こども家庭センター」で調べると、町の公式のページに電話番号があります`,
      href: `https://www.google.com/search?q=${encodeURIComponent(`${town} こども家庭センター 電話`)}`,
      label: "調べる",
    },
    ...(born && ["2w", "1m", "3m", "6m"].includes(period.key)
      ? [{ title: "産後ケア", sub: "助産師さんに泊まりや通いで手伝ってもらえます（町の事業）", href: mapUrl(`${town} 産後ケア`, apple), label: "地図で探す" }]
      : []),
    ...(born ? [{ title: "子どもの急な病気 #8000", sub: "夜や休みの日に、小児科の先生や看護師さんに電話で聞けます", href: "tel:%238000", label: "電話する" }] : []),
    { title: "子育ての相談 0120-189-783", sub: "児童相談所の相談の電話です（無料）。つらい時も", href: "tel:0120189783", label: "電話する" },
    {
      title: "日本語以外で相談したい時（English・中文・Tiếng Việt など）",
      sub: "住んでいる県の、外国の人のための相談窓口を、言葉で探せます（出入国在留管理庁）",
      href: "https://www.moj.go.jp/isa/support/portal/12_00227.html",
      label: "探す",
    },
  ];
  return (
    <section aria-label="相談できる所" className="flex flex-col gap-2 rounded-2xl border border-line bg-card px-4 py-3">
      <p className="text-base">答えてくれてありがとう。一人で抱えずに頼れる所が、町にあります。</p>
      <ul className="flex flex-col">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="min-w-0">
              <span className="block text-base font-semibold">{r.title}</span>
              <span className="block text-sm text-muted">{r.sub}</span>
            </span>
            <a
              href={r.href}
              target={r.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/20 px-3 text-sm font-semibold"
            >
              {r.label}
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted">{born ? "命に関わる時は 119。" : "おなかの痛み・出血など体の急ぎは、かかりつけの産院（夜間も）・119。"}</p>
      <Why>
        <p>こども家庭センターは、2024年4月から全国の市区町村に置かれている相談の窓口です（児童福祉法）。産後ケアは市区町村の事業で、使える人や料金は町ごとに違います。</p>
        <p>#8000 はこども医療電話相談（こども家庭庁）、0120-189-783 は児童相談所の相談専用ダイヤル（こども家庭庁）です。</p>
        <p>
          日本語以外の相談先は、出入国在留管理庁の「外国人生活支援ポータルサイト」で、都道府県・言葉・相談のしかた（窓口・電話・メール・LINE）から探せます。在留の手続きの質問は、外国人在留総合インフォメーションセンター（0570-013904・平日。英語・中国語・ベトナム語など11の言葉）でも聞けます（2026年に確かめました）。
        </p>
      </Why>
    </section>
  );
}
