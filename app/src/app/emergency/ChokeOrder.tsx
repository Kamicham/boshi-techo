"use client";

// 窒息の手当の2つ（1歳になる前／1歳を過ぎた子）を、見ている家族の子の月齢に合う方から出す。
// このページは家族の読み込みを待たない（通信が無くても開く）ので、端末に覚えた家族と「今日」（デモ・シミュレーションは早送りの日）だけで決める。
// 妊娠中・生まれた日が分からない・読めない時は、今までどおり「1歳になる前」が先。
// ママの体の急ぎ（MamaUrgent）も同じ読み方で、妊娠中と産後8週までの家族では一番上に出す。
// #7119（Line7119）も同じ読み方で、家族の住む町で実施している時だけ出す（lib/emergency-lines.ts）。
// 「#」の入った番号（#8000・#7119）のボタンには、すぐ下に、つながらない時のふつうの番号（家族の県の窓口）を添える（Alt8000・AltCall）。
// 「#」の入ったリンク（tel:%238000）は、電話によってかからない事がある（IPHONE_NOTE）。家族の県が分からない時は添えない。
import { useEffect, useRef, useState } from "react";
import { clockAt } from "@/lib/clock";
import { DEMO_FAMILY, type Family } from "@/lib/demo-family";
import { line7119, line8000, normPref, telLink } from "@/lib/emergency-lines";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * FamilyProvider と同じ決まりで、端末が見ている家族と今日を読む（通信なしで読める物だけ）。
 * chosen は、端末が家族を選んでいるか（何も覚えていなくて見本の家族に落ちた時は false。町で出し分ける物は、その時は出さない）。
 */
function currentFamily(): { family: Family; today: string | null; chosen: boolean } | null {
  let cached: Family[] = [];
  try {
    // ログインした人の控えは、アカウントごとの名前（boshi.families:<アカウント>）に入っている
    const acct = read("boshi.account");
    const v = JSON.parse((acct ? read(`boshi.families:${acct}`) : null) ?? read("boshi.families") ?? "[]") as Family[];
    if (Array.isArray(v)) cached = v.filter((f) => f && typeof f.id === "string");
  } catch {}
  const saved = read("boshi.family");
  const id = saved ?? (cached.some((f) => f.id === "mine") ? "mine" : DEMO_FAMILY.id);
  const family = id === DEMO_FAMILY.id ? DEMO_FAMILY : cached.find((f) => f.id === id);
  if (!family) return null;
  const timeTravel = family.id === DEMO_FAMILY.id || family.id.startsWith("sim-") || family.id.startsWith("pop-");
  const real = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const demo = read("boshi.demoToday");
  const today = timeTravel ? (demo && /^\d{4}-\d{2}-\d{2}$/.test(demo) ? demo : null) : real;
  return { family, today, chosen: id !== DEMO_FAMILY.id || saved === DEMO_FAMILY.id };
}

function currentChild(): { name?: string; over1: boolean } | null {
  const cur = currentFamily();
  if (!cur?.family.birthDate || !cur.today) return null;
  const c = clockAt(cur.family, cur.today);
  if (c.phase !== "child" && c.phase !== "after") return null;
  return { name: cur.family.childName, over1: (c.ageMonths ?? 0) >= 12 };
}

export function ChokeOrder({ baby, child }: { baby: React.ReactNode; child: React.ReactNode }) {
  const [kid, setKid] = useState<{ name?: string; over1: boolean } | null>(null);
  useEffect(() => {
    setKid(currentChild());
  }, []);
  const childFirst = !!kid?.over1;
  return (
    <div className="flex flex-col gap-3">
      {childFirst && (
        <p className="text-sm text-muted">{kid?.name ? `${kid.name}は` : "お子さんは"}1歳を過ぎているので、「1歳を過ぎた子」を先に出しています。</p>
      )}
      <div className="flex flex-col gap-3" style={{ order: childFirst ? 2 : 1 }}>
        {baby}
      </div>
      <div className="flex flex-col gap-3" style={{ order: childFirst ? 1 : 2 }}>
        {child}
      </div>
    </div>
  );
}

/** 産院の電話を覚えておく所（通信が無くても出せるように。設定の「通う病院」の電話を、読めた時に写しておく） */
const phoneKey = (familyId: string) => `boshi.hospitalPhone.${familyId}`;

/** 産後の体の急ぎを出す長さ（産後8週＝産後休業の長さ。労働基準法第65条） */
const POSTPARTUM_DAYS = 56;

/** 生まれてから POSTPARTUM_DAYS 日の間か（産後の体の急ぎの1枚を出す） */
function isPostpartumNow(): boolean {
  const cur = currentFamily();
  const b = cur?.family.birthDate;
  if (!cur?.today || !b || b > cur.today) return false;
  return (Date.parse(cur.today) - Date.parse(b)) / 86_400_000 <= POSTPARTUM_DAYS;
}

/** 端末が見ている家族が今、妊娠中か（分からない時は false） */
function isPregnantNow(): { familyId: string } | null {
  const cur = currentFamily();
  if (!cur?.today) return null;
  return clockAt(cur.family, cur.today).phase === "pregnant" ? { familyId: cur.family.id } : null;
}

type Info7119 = { hours: string | null; tel: string; alt: string | null; pref: string | null };

/** 家族の住む町の #7119（実施していなければ null）。家族を読めない時・見本の家族に落ちただけの時も null（ほかの町の人に、見本の町の番号を出さない） */
function use7119(): Info7119 | null {
  const [line, setLine] = useState<Info7119 | null>(null);
  useEffect(() => {
    const cur = currentFamily();
    const l = cur?.chosen ? line7119(cur.family.prefecture, cur.family.city) : null;
    setLine(l && cur ? { ...l, pref: normPref(cur.family.prefecture) } : null);
  }, []);
  return line;
}

/**
 * 「#」の番号につながらない時の、ふつうの番号。すぐ上の「#」のボタンと1つの枠に入れる（枠は呼ぶ側）。
 * 見える文は「つながらない時は 番号（県）」の1行（iPhone の幅 390px で折り返さない長さ）。読み上げには、どの番号の代わりかも入れる。
 *
 * IPHONE_NOTE（なぜ添えるか）: Apple の開発者向けの古い文書「Apple URL Scheme Reference」の Phone Links に、
 * 「if a URL contains the * or # characters, the Phone app does not attempt to dial the corresponding phone number.」とある
 * （https://developer.apple.com/library/archive/featuredarticles/iPhoneURLScheme_Reference/PhoneLinks/PhoneLinks.html ）。
 * 今の iOS でも同じかは、実機で確かめていない（本物の #8000 にかけて試すと、相談の窓口につながってしまうので試さない）。
 * どの電話でも届くよう、ふつうの番号を添える（2026-11-05 統括の決め）。
 */
function AltCall({ tel, instead, where }: { tel: string; instead: string; where: string }) {
  return (
    <a
      href={telLink(tel)}
      aria-label={`${instead} につながらない時は、${tel}（${where}の窓口）にかける`}
      className="flex min-h-11 items-center justify-center border-t border-sky/30 px-3 py-1 text-center text-sm text-muted"
    >
      <span>
        つながらない時は <span className="tabular font-semibold text-sky underline underline-offset-2">{tel}</span>（{where}）
      </span>
    </a>
  );
}

/**
 * #7119（救急安心センター事業）: 大人の体（ママ）の事で、救急車を呼ぶか迷う時の相談先。家族の町で実施している時だけ、電話の段に1行足す。
 * 実施していない町・家族を読めない時（組み立てたページ）は出さない。受付が24時間でない県は時間を、一覧に別の番号が書かれた町はその番号を添える。
 * 「#7119」にかける町は、すぐ下に一覧のふつうの番号（つながらない時）を添える。
 */
export function Line7119() {
  const line = use7119();
  if (!line) return null;
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-sky/50 bg-card">
      <a href={telLink(line.tel)} className="flex min-h-14 flex-col items-center justify-center gap-0.5 px-4 py-2 text-center">
        <span className="font-display text-xl font-bold text-sky">#7119 に聞く</span>
        <span className="text-sm text-muted">大人の体（ママ）の事で、救急車を呼ぶか迷う時</span>
        {line.tel !== "#7119" && <span className="tabular text-xs text-muted">この町からは {line.tel} にかけます</span>}
        {line.hours && <span className="text-xs text-muted">受付: {line.hours}</span>}
      </a>
      {line.alt && line.pref && <AltCall tel={line.alt} instead="#7119" where={line.pref} />}
    </div>
  );
}

/**
 * #8000 につながらない時の、家族の都道府県のふつうの番号（厚生労働省の表）。#8000 のボタンと同じ枠の中、すぐ下に置く。
 * 家族を読めない時・見本の家族に落ちただけの時は出さない（#7119 と同じ。ほかの県の人に、見本の県の番号を出さない）。
 */
export function Alt8000() {
  const [line, setLine] = useState<{ tel: string; prefecture: string } | null>(null);
  useEffect(() => {
    const cur = currentFamily();
    setLine(cur?.chosen ? line8000(cur.family.prefecture) : null);
  }, []);
  if (!line) return null;
  return <AltCall tel={line.tel} instead="#8000" where={line.prefecture} />;
}

/** 母子手帳（国の様式）の言葉をそのまま引く。cite は最後の引用にだけ付ける */
function Quote({ children, small, cite }: { children: React.ReactNode; small?: boolean; cite?: boolean }) {
  return (
    <blockquote className={`border-l-4 border-alert/40 pl-3 leading-relaxed ${small ? "text-sm" : "text-base"}`}>
      {children}
      {cite && <span className="text-xs text-muted">（母子手帳・国の様式）</span>}
    </blockquote>
  );
}

/**
 * ママの体の急ぎ → かかっている産院に電話（夜間も）。症状の判断はせず、母子手帳（国の様式）の言葉と電話先だけ。
 * 妊娠中と産後8週までは一番上（slot="top"）、ほかは下（slot="bottom"）に出す。組み立てたページ（通信なしで出す物）では下に出し、
 * 端末の家族を読めたら上へ移す。id は "mama"（聞くの床と聞く窓が /emergency#mama を開く）。
 * 産院の番号は設定（/api/keep の hospital.phone）から読み、端末にも写しておく。無い時は、番号の探し方を書く（急ぎの時に設定へ送らない）。
 * 出典: こども家庭庁 母子健康手帳の様式（府令様式・令和8年4月1日施行）p.6「※出血や破水、…すぐに医療機関を受診しましょう。」、
 * p.5「妊娠中注意したい症状」の「また、つわりで…すぐに医師などに相談しましょう。」（その前の症状の一覧は「医師などに相談」なので、急ぎの札には引かない）、
 * p.17「退院時の記録」（施設名又は担当者名と電話の欄）。表紙には電話の欄が無いので、表紙とは書かない。
 */
export function MamaUrgent({ slot }: { slot: "top" | "bottom" }) {
  const [state, setState] = useState<{ pregnant: boolean; postpartum?: boolean; phone: string | null; name: string | null } | null>(null);
  const line = use7119();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const p = isPregnantNow();
    const after = !p && isPostpartumNow();
    const cur = currentFamily();
    const fid = cur?.family.id;
    let phone: string | null = null;
    let name: string | null = null;
    if (fid) {
      try {
        const v = JSON.parse(read(phoneKey(fid)) ?? "null") as { phone?: string; name?: string } | null;
        phone = v?.phone ?? null;
        name = v?.name ?? null;
      } catch {}
    }
    setState({ pregnant: !!p, postpartum: after, phone, name });
    if (!fid) return;
    let alive = true;
    // 通信できる時だけ、設定の番号を読み直して写す（読めなくても、写しで出す）
    fetch(`/api/keep?familyId=${encodeURIComponent(fid)}`, { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { keep?: { hospital?: { phone?: string; name?: string } } } | null) => {
        if (!alive || !j) return;
        const h = j.keep?.hospital;
        const ph = h?.phone?.trim() || null;
        const nm = h?.name?.trim() || null;
        try {
          if (ph) localStorage.setItem(phoneKey(fid), JSON.stringify({ phone: ph, name: nm }));
          else localStorage.removeItem(phoneKey(fid));
        } catch {}
        setState((s) => ({ pregnant: s?.pregnant ?? !!p, postpartum: s?.postpartum ?? after, phone: ph, name: nm }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  // 聞くの床から /emergency#mama で開いた時: 組み立てたページでは札が下にあり、家族を読んでから上へ移るので、移った先へ送り直す
  useEffect(() => {
    if (state && window.location.hash === "#mama") ref.current?.scrollIntoView({ block: "start" });
  }, [state]);
  // 妊娠中と産後8週までは、ママの体の急ぎを一番上に（なりきり sim-15: 産後の急ぎが一番下で見つからなかった）
  const kind: "pregnant" | "postpartum" | "other" = state?.pregnant ? "pregnant" : state?.postpartum ? "postpartum" : "other";
  if ((slot === "top") !== (kind !== "other")) return null;
  const digits = state?.phone?.replace(/[^\d+]/g, "") ?? "";
  const title = kind === "pregnant" ? "妊娠中の体の急ぎ" : kind === "postpartum" ? "産後の体の急ぎ" : "妊娠中・産後のママの体";
  const call =
    kind === "pregnant"
      ? "かかっている産院に電話します（夜間も）。"
      : kind === "postpartum"
        ? "お産をした産院に電話します（夜間も）。どうするかは、電話で産院が教えてくれます。"
        : "体の事で心配な時は、かかっている産院（お産をした産院）に電話します（夜間も）。どうするかは、電話で産院が教えてくれます。";
  const find =
    kind === "pregnant"
      ? "番号は、診察券や産院の書類で探せます。"
      : kind === "postpartum"
        ? "番号は、母子手帳の「退院時の記録」の欄や、診察券で探せます。"
        : "番号は、診察券や産院からもらった書類、母子手帳の「退院時の記録」の欄で探せます。";
  return (
    // 高さの低い画面（Safari のツールバーが出ている iPhone は 664px ほど）では余白を詰め、妊娠中でも札・119・#8000 を1画面目に
    <section
      ref={ref}
      id="mama"
      aria-labelledby="mama-h"
      className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border border-line bg-card p-4 [@media(max-height:760px)]:p-3"
    >
      <div>
        <h2 id="mama-h" className="font-display text-xl font-bold">
          {title}
        </h2>
        {kind === "postpartum" && <p className="text-sm text-muted">出血・熱・強い痛み・息苦しさなど、ママの体の事で心配な時</p>}
      </div>
      {kind !== "postpartum" && (
        <div className="flex flex-col gap-2">
          {kind === "other" && <p className="text-sm font-semibold text-muted">妊娠中</p>}
          <Quote cite={kind === "other"}>出血や破水、おなかの強い張りや痛み、胎動の減少を感じたら、すぐに医療機関を受診しましょう。</Quote>
          {kind === "pregnant" && (
            <Quote small cite>
              また、つわりで衰弱がひどいとき、イライラや動悸がはげしく、不安感が強いとき、今まであった胎動を感じなくなったときは、すぐに医師などに相談しましょう。
            </Quote>
          )}
        </div>
      )}
      <p className="text-base">{call}</p>
      {digits ? (
        <a href={`tel:${digits}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-alert px-4 py-3 text-white">
          <span className="min-w-0">
            <span className="block text-lg font-bold">{state?.name || "かかっている産院"}に電話</span>
            <span className="tabular block text-sm">{state?.phone}</span>
          </span>
          <span className="shrink-0 text-base font-semibold">電話する</span>
        </a>
      ) : (
        <p className="text-sm text-muted">{find}</p>
      )}
      {/* 一番上に出す時は、すぐ下に119と #7119 のボタンがあるので繰り返さない（1画面目に #8000 まで収める）。ページの下に出す時だけ書く */}
      {slot === "bottom" && (
        <p className="text-sm text-muted">
          命が危ないと思ったら、迷わず <a href="tel:119" className="font-semibold text-alert underline underline-offset-2">119</a>。
          {line && (
            <>
              救急車を呼ぶか迷う時は{" "}
              <a href={telLink(line.tel)} className="font-semibold text-sky underline underline-offset-2">
                #7119
              </a>
              。
            </>
          )}
        </p>
      )}
    </section>
  );
}
