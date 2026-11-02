"use client";

// 「済みましたか？」の箱: 法の期限を過ぎて一番上から外した事（まだ済みにしていない物）を、1つの畳んだ箱にまとめて聞く。
// 赤い「◯日過ぎ」を何か月も一番上に残さないため（なりきり6家族の気づき）。
// 聞くのは法の期限がある物だけ。目安の物と期限の無い物は、聞かずに畳む（task.ts の asksDone）。
// 「済んだ」は今日の画面の済みの印（/api/done）と同じ。
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
  if (tasks.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-line bg-card">
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4">
        <span className="font-display text-lg font-bold">
          済みましたか？<span className="ml-2 text-sm font-normal text-muted">期限を過ぎた事 {tasks.length}件</span>
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-sm text-muted">もう済ませた事は「済んだ」に。</p>
        {tasks.length > 1 && (
          <div>
            <Btn kind="secondary" onClick={() => onDone(tasks.map((t) => t.id))}>
              全部済んだ（{tasks.length}件）
            </Btn>
          </div>
        )}
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-2 border-b border-line py-2 last:border-b-0">
              <span className="text-base leading-snug font-semibold">{t.plain}</span>
              <Btn kind="secondary" onClick={() => onDone([t.id])} ariaLabel={`${t.plain}を済んだにする`}>
                済んだ
              </Btn>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
