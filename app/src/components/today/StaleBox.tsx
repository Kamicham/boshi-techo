"use client";

// 「済みましたか？」の箱: 法の期限を過ぎて一番上から外した事（まだ済みにしていない物）を、1つの畳んだ箱にまとめて聞く。
// 赤い「◯日過ぎ」を何か月も一番上に残さないため（なりきり6家族の気づき）。
// 聞くのは法の期限がある物だけ。目安の物と期限の無い物は、聞かずに畳む（task.ts の asksDone）。
// 「済んだ」は今日の画面の済みの印（/api/done）と同じ。
import { useState } from "react";
import { Btn } from "../ui";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import { t as tr } from "@/lib/i18n";
import { msWords } from "@/lib/i18n/milestone-words";
import { TaskBody, type ShownTask } from "./TaskCard";
import { turnLabel, whoLabel } from "./task";

export function StaleBox({
  tasks,
  onDone,
  today,
  family,
  me,
  keep,
  onAssign,
  defaultOpen,
}: {
  tasks: ShownTask[];
  /** まとめて済みにする */
  onDone: (ids: string[]) => void;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onAssign?: (milestoneId: string, who: string) => void;
  /** 一番上が目安の事か何も無い時は、開いて上に出す（法の期限を過ぎた出生届が、畳まれたまま目安の赤ちゃん訪問の下に隠れた＝第31回） */
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState<string | null>(null);
  if (tasks.length === 0) return null;
  return (
    <details className="group rounded-2xl border border-line bg-card" open={defaultOpen || undefined}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-2 px-4">
        <span className="font-display text-lg font-bold">
          {tr("ふり返り")}
          <span className="ml-2 text-sm font-normal text-muted">{tr("時期が過ぎた手続き（{n}つ）", { n: tasks.length })}</span>
        </span>
        <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
          ›
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4">
        <p className="text-base">{tr("忙しい時期でした。済んでいたら、印だけ付けてください。まだの事も、今からできる道があります。")}</p>
        {tasks.length > 1 && (
          <div>
            <Btn kind="secondary" onClick={() => onDone(tasks.map((t) => t.id))}>
              {tr("全部済んだ（{n}件）", { n: tasks.length })}
            </Btn>
          </div>
        )}
        <ul className="flex flex-col">
          {tasks.map((t) => (
            <li key={t.id} className="flex flex-col gap-2 border-b border-line py-2 last:border-b-0">
              <span className="text-base leading-snug font-semibold">
                {msWords(t.plain)}
                {whoLabel(t, family, me) && <span className="ml-2 text-sm font-normal text-muted">{turnLabel(t, family, me)}</span>}
              </span>
              <div className="flex flex-wrap gap-2">
                <Btn kind="secondary" onClick={() => onDone([t.id])} ariaLabel={tr("{plain}を済んだにする", { plain: msWords(t.plain) })}>
                  {tr("済んだ")}
                </Btn>
                <Btn kind="secondary" onClick={() => setOpen(open === t.id ? null : t.id)} ariaLabel={tr("{plain}の今からの道を見る", { plain: msWords(t.plain) })}>
                  {tr("まだ")}
                </Btn>
                <Btn kind="quiet" onClick={() => onDone([t.id])} ariaLabel={tr("{plain}はうちには関係なかった", { plain: msWords(t.plain) })}>
                  {tr("うちには関係なかった")}
                </Btn>
              </div>
              {/* 「まだ」は、ふつうの行と同じ中身（担当・窓口・どこへ行くか見る）で開く（1行の説明だけでは、誰がいつ行くか決められなかった＝第31回） */}
              {open === t.id && (
                <div className="flex flex-col gap-2 rounded-lg bg-sky-soft px-3 py-2">
                  <p className="text-base">{tr("{hint}（期限を過ぎていても、まず窓口に事情を伝えて聞いてみてください）", { hint: msWords(t.hint) })}</p>
                  <TaskBody task={t} today={today} family={family} me={me} keep={keep} onAssign={onAssign} onDone={() => onDone([t.id])} />
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}
