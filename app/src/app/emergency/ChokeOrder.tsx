"use client";

// 窒息の手当の2つ（1歳になる前／1歳を過ぎた子）を、見ている家族の子の月齢に合う方から出す。
// このページは家族の読み込みを待たない（通信が無くても開く）ので、端末に覚えた家族と「今日」（デモ・シミュレーションは早送りの日）だけで決める。
// 妊娠中・生まれた日が分からない・読めない時は、今までどおり「1歳になる前」が先。
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

/** FamilyProvider と同じ決まりで、端末が見ている家族と今日を読む */
function currentChild(): { name?: string; over1: boolean } | null {
  let cached: Family[] = [];
  try {
    const v = JSON.parse(read("boshi.families") ?? "[]") as Family[];
    if (Array.isArray(v)) cached = v.filter((f) => f && typeof f.id === "string");
  } catch {}
  const saved = read("boshi.family");
  const id = saved ?? (cached.some((f) => f.id === "mine") ? "mine" : DEMO_FAMILY.id);
  const family = id === DEMO_FAMILY.id ? DEMO_FAMILY : cached.find((f) => f.id === id);
  if (!family?.birthDate) return null;
  const timeTravel = family.id === DEMO_FAMILY.id || family.id.startsWith("sim-") || family.id.startsWith("pop-");
  const real = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const demo = read("boshi.demoToday");
  const today = timeTravel ? (demo && /^\d{4}-\d{2}-\d{2}$/.test(demo) ? demo : null) : real;
  if (!today) return null;
  const c = clockAt(family, today);
  if (c.phase !== "child" && c.phase !== "after") return null;
  return { name: family.childName, over1: (c.ageMonths ?? 0) >= 12 };
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
