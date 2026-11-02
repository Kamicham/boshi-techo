"use client";

// 「済みましたか？」の箱: 時期を過ぎて一番上から外した事（まだ済みにしていない物）を、1つの畳んだ箱にまとめて聞く。
// 赤い「◯日過ぎ」を何か月も一番上に残さないため（なりきり6家族の気づき）。
// 「済んだ」は今日の画面の済みの印（/api/done）と同じ。「やっていない」は、なぜ？・どこへを開いて、今からできる事を見せる。
import { useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { Btn } from "../ui";
import { TaskRow, type ShownTask } from "./TaskCard";

export function StaleBox({
  tasks,
  today,
  family,
  me,
  keep,
  onDone,
}: {
  tasks: ShownTask[];
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  /** まとめて済みにする */
  onDone: (ids: string[]) => void;
}) {
  // 「やっていない」と答えた事（この画面を開いている間だけ。開くと中身が見える）
  const [notYet, setNotYet] = useState<Set<string>>(new Set());
  if (tasks.length === 0) return null;
  const asking = tasks.filter((t) => !notYet.has(t.id));
  const open = tasks.filter((t) => notYet.has(t.id));
  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4">
        <span className="font-display text-lg font-bold">
          済みましたか？<span className="ml-2 text-sm font-normal text-muted">時期を過ぎた事 {tasks.length}件</span>
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-muted">もう済ませた事は「済んだ」に。やっていない事も、多くは今から窓口に聞けばできます。</p>
        {asking.length > 1 && (
          <div>
            <Btn kind="secondary" onClick={() => onDone(asking.map((t) => t.id))}>
              全部済んだ（{asking.length}件）
            </Btn>
          </div>
        )}
        <ul className="flex flex-col">
          {asking.map((t) => (
            <li key={t.id} className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
              <span className="text-base leading-snug font-semibold">{t.plain}</span>
              <span className="flex flex-wrap gap-2">
                <Btn kind="secondary" onClick={() => onDone([t.id])} ariaLabel={`${t.plain}を済んだにする`}>
                  済んだ
                </Btn>
                <Btn kind="quiet" onClick={() => setNotYet((s) => new Set(s).add(t.id))} ariaLabel={`${t.plain}はやっていない`}>
                  やっていない
                </Btn>
              </span>
            </li>
          ))}
        </ul>
        {open.length > 0 && (
          <div className="flex flex-col">
            <p className="text-sm font-semibold text-muted">やっていない事（開くと、なぜ？・どこへが見られます）</p>
            {open.map((t) => (
              <TaskRow key={t.id} task={t} today={today} family={family} me={me} keep={keep} onDone={() => onDone([t.id])} />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}
