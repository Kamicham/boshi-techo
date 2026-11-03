"use client";

// 「済みましたか？」の箱: 法の期限を過ぎて一番上から外した事（まだ済みにしていない物）を、1つの畳んだ箱にまとめて聞く。
// 赤い「◯日過ぎ」を何か月も一番上に残さないため（なりきり6家族の気づき）。
// 聞くのは法の期限がある物だけ。目安の物と期限の無い物は、聞かずに畳む（task.ts の asksDone）。
// 「済んだ」は今日の画面の済みの印（/api/done）と同じ。
import { useState } from "react";
import { Btn } from "../ui";
import type { ShownTask } from "./TaskCard";

export function StaleBox({
  tasks,
  onDone,
}: {
  tasks: ShownTask[];
  /** まとめて済みにする */
  onDone: (ids: string[]) => void;
  // 前の形の呼び出し（today・family・me・keep）も受け取れるように残す。中では使わない
  [rest: string]: unknown;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (tasks.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4">
        <span className="font-display text-lg font-bold">
          ふり返り<span className="ml-2 text-sm font-normal text-muted">時期が過ぎた手続き（{tasks.length}つ）</span>
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-base">忙しい時期でした。済んでいたら、印だけ付けてください。まだの事も、今からできる道があります。</p>
        {tasks.length > 1 && (
          <div>
            <Btn kind="secondary" onClick={() => onDone(tasks.map((t) => t.id))}>
              全部済んだ（{tasks.length}件）
            </Btn>
          </div>
        )}
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 border-b border-line py-2 last:border-b-0">
              <span className="text-base leading-snug font-semibold">{t.plain}</span>
              <div className="flex flex-wrap gap-2">
                <Btn kind="secondary" onClick={() => onDone([t.id])} ariaLabel={`${t.plain}を済んだにする`}>
                  済んだ
                </Btn>
                <Btn kind="secondary" onClick={() => setOpen(open === t.id ? null : t.id)} ariaLabel={`${t.plain}の今からの道を見る`}>
                  まだ
                </Btn>
                <Btn kind="quiet" onClick={() => onDone([t.id])} ariaLabel={`${t.plain}はうちには関係なかった`}>
                  うちには関係なかった
                </Btn>
              </div>
              {open === t.id && (
                <p className="rounded-lg bg-sky-soft px-3 py-2 text-base">
                  {t.hint}（期限を過ぎていても、まず窓口に事情を伝えて聞いてみてください）
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
