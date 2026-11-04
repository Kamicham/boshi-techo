"use client";

// お金の線（お金の1000日）: 妊娠〜2歳のお金の手続きを、届く見込みの順に1本で見る。
// 申請がまだ → 届くのを待っている → 届いた（日付だけ）／届く時期を過ぎた（確かめ先と、今日の画面の問い合わせの下書きへ）。
// 額は出さない・もらえるかの判断はしない（lib/money.ts）。
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { scheduleFor } from "@/lib/milestones";
import { MONEY, moneyWatch, paidId } from "@/lib/money";

type DoneRes = { done: string[]; fromTecho?: string[]; doneOn?: Record<string, string> };

const md = (s: string) => `${Number(s.slice(5, 7))}/${Number(s.slice(8, 10))}`;

export function MoneyLine() {
  const { family, today, isDemo } = useFamily();
  const [res, setRes] = useState<DoneRes | null>(null);
  useEffect(() => {
    let alive = true;
    api<DoneRes>(`/api/done?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => alive && setRes(j))
      .catch(() => alive && setRes({ done: [] }));
    return () => {
      alive = false;
    };
  }, [family.id, today]);

  const rows = useMemo(() => {
    if (!res) return [];
    const base = scheduleFor(family, today);
    const done = new Set([...(res.done ?? []), ...(res.fromTecho ?? [])]);
    if (isDemo) for (const m of base) if (m.deadlineDate && m.deadlineDate < today) done.add(m.id);
    const born = family.birthDate && family.birthDate <= today ? family.birthDate : undefined;
    const watch = new Map(moneyWatch(base, done, res.doneOn ?? {}, born).map((w) => [w.id, w]));
    return base
      .filter((m) => m.id in MONEY)
      .map((m) => {
        const w = watch.get(paidId(m.id));
        const def = MONEY[m.id];
        if (!w) return { id: m.id, name: def.name, sort: m.deadlineDate ?? m.startDate, state: "申請がまだ" as const, line: m.awaitingBirth || m.awaitingPregnancy ? "生まれてから申請" : `申請の目安 ${md(m.deadlineDate ?? m.startDate)}まで`, ask: def.ask };
        const paid = done.has(w.id) || (isDemo && w.deadlineDate! < today);
        if (paid) return { id: m.id, name: def.name, sort: w.startDate, state: "届いた" as const, line: res.doneOn?.[w.id] ? `届いた（${md(res.doneOn[w.id])}）` : "届いた", ask: def.ask };
        if (today > w.deadlineDate!) return { id: m.id, name: def.name, sort: w.startDate, state: "届く時期を過ぎた" as const, line: `${md(w.deadlineDate!)}までの見込みを過ぎました。確かめ先: ${def.ask}`, ask: def.ask, focus: w.id };
        return { id: m.id, name: def.name, sort: w.startDate, state: "待っている" as const, line: `届く見込み ${md(w.startDate)}〜${md(w.deadlineDate!)}`, ask: def.ask, focus: today >= w.startDate ? w.id : undefined };
      })
      .sort((a, b) => a.sort.localeCompare(b.sort));
  }, [res, family, today, isDemo]);

  if (!rows.length) return null;
  const late = rows.filter((r) => r.state === "届く時期を過ぎた").length;
  return (
    <details id="money" className="group scroll-mt-4 rounded-2xl border border-line bg-card">
      <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-0.5 p-4 [&::-webkit-details-marker]:hidden">
        <span className="font-display text-lg font-bold">お金の線</span>
        <span className="text-sm text-muted">{late ? `届く時期を過ぎた物が${late}つ` : "申請したお金が届くまでを見ます（額は残しません）"}</span>
        <span className="text-sm text-muted underline group-open:hidden">開く</span>
      </summary>
      <ol className="flex flex-col gap-3 px-4 pb-4">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5 border-t border-line pt-3">
            <span className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-base font-semibold">{r.name}</span>
              <span className={`text-sm ${r.state === "届く時期を過ぎた" ? "font-semibold text-rose" : "text-muted"}`}>{r.state}</span>
            </span>
            <span className="text-sm">{r.line}</span>
            {r.focus && (
              <a href={`/?focus=${r.focus}`} className="min-h-11 text-sm text-rose underline">
                {r.state === "届く時期を過ぎた" ? "問い合わせの下書きを作る" : "届いたら「済んだ」を押す"}
              </a>
            )}
          </li>
        ))}
      </ol>
      <p className="px-4 pb-4 text-xs text-muted">届く時期は近似です（町・健康保険・ハローワークで違います）。児童手当は偶数月の振込で、前の2か月分（児童手当法・2024年10月から）。</p>
    </details>
  );
}
