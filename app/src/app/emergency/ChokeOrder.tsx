"use client";

// 窒息の手当の2つ（1歳になる前／1歳を過ぎた子）を、見ている家族の子の月齢に合う方から出す。
// このページは家族の読み込みを待たない（通信が無くても開く）ので、端末に覚えた家族と「今日」（デモ・シミュレーションは早送りの日）だけで決める。
// 妊娠中・生まれた日が分からない・読めない時は、今までどおり「1歳になる前」が先。
// 妊娠中の体の急ぎ（PregnancyUrgent）も同じ読み方で、妊娠中の家族では一番上に出す。
import { useEffect, useState } from "react";
import { clockAt } from "@/lib/clock";
import { DEMO_FAMILY, type Family } from "@/lib/demo-family";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** FamilyProvider と同じ決まりで、端末が見ている家族と今日を読む（通信なしで読める物だけ） */
function currentFamily(): { family: Family; today: string | null } | null {
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
  return { family, today };
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

/** 端末が見ている家族が今、妊娠中か（分からない時は false） */
function isPregnantNow(): { familyId: string } | null {
  const cur = currentFamily();
  if (!cur?.today) return null;
  return clockAt(cur.family, cur.today).phase === "pregnant" ? { familyId: cur.family.id } : null;
}

/**
 * 妊娠中の体の急ぎ → かかっている産院に電話（夜間も）。症状の判断はせず、電話先だけ。
 * 妊娠中の家族では一番上（slot="top"）、ほかは下（slot="bottom"）に出す。組み立てたページ（通信なしで出す物）では下に出し、
 * 端末の家族を読めたら上へ移す。産院の番号は設定（/api/keep の hospital.phone）から読み、端末にも写しておく。
 */
export function PregnancyUrgent({ slot }: { slot: "top" | "bottom" }) {
  const [state, setState] = useState<{ pregnant: boolean; phone: string | null; name: string | null } | null>(null);
  useEffect(() => {
    const p = isPregnantNow();
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
    setState({ pregnant: !!p, phone, name });
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
        setState((s) => ({ pregnant: s?.pregnant ?? !!p, phone: ph, name: nm }));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const pregnant = !!state?.pregnant;
  if ((slot === "top") !== pregnant) return null;
  const digits = state?.phone?.replace(/[^\d+]/g, "") ?? "";
  return (
    <section id="pregnancy" aria-labelledby="pregnancy-h" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 id="pregnancy-h" className="font-display text-xl font-bold">
          妊娠中の体の急ぎ
        </h2>
        <p className="text-sm text-muted">出血・破水・強いおなかの痛み・胎動が気になる</p>
      </div>
      <p className="text-base">かかっている産院に電話します（夜間も）。どうするかは、電話で産院が教えてくれます。</p>
      {digits ? (
        <a href={`tel:${digits}`} className="flex min-h-14 items-center justify-between gap-3 rounded-2xl bg-alert px-4 py-3 text-white">
          <span className="min-w-0">
            <span className="block text-lg font-bold">{state?.name || "かかっている産院"}に電話</span>
            <span className="tabular block text-sm">{state?.phone}</span>
          </span>
          <span className="shrink-0 text-base font-semibold">電話する</span>
        </a>
      ) : (
        <a href="/settings" className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-ink/20 px-4 py-2">
          <span className="text-base font-semibold">設定で産院の電話を入れる</span>
          <span className="shrink-0 text-muted" aria-hidden>
            ›
          </span>
        </a>
      )}
      <p className="text-sm text-muted">
        産院につながらない時・迷う時は <a href="tel:119" className="font-semibold text-alert underline underline-offset-2">119</a>。
      </p>
    </section>
  );
}
