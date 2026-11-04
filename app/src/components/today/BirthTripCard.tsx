"use client";

// 生まれた届けを、まとめて（第1波②）。生まれた日から15日の間、出生届・児童手当・保険・医療証などを1枚に並べる。
// 行く順と理由、どこに出すか（役所・勤め先・保険が届いたら）、合わせた持ち物、行く日を1つにまとめる。
// 1件目は、すぐ下の1枚（NowCard）が窓口と書く事のメモを先に用意する。ほかの行は開くと、ふつうの行と同じ中身（TaskBody）。
// 外へは何も送らない。「1回で全部」とは言い切らない（会社の保険の家族は、医療証が後になる）。
import { useEffect, useMemo, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import type { LocalInfo } from "@/lib/local";
import { mergeBring, type BirthTrip, type TripWhere } from "@/lib/birth-trip";
import { api } from "../FamilyProvider";
import { Btn, Pill, daysUntil } from "../ui";
import { jpDate } from "./dates";
import { TaskBody, type ShownTask } from "./TaskCard";
import { whoLabel } from "./task";

const STAGE: Record<TripWhere, string> = {
  役所: "役所で",
  勤め先: "勤め先へ",
  保険が届いたら: "赤ちゃんの保険の書類が届いたら（郵送・電子で出せるかは町で確かめる）",
};

export function BirthTripCard({
  trip,
  today,
  family,
  me,
  keep,
  onAssign,
  onDone,
  onKeep,
}: {
  trip: BirthTrip<ShownTask>;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onAssign?: (milestoneId: string, who: string) => void;
  onDone: (ids: string[]) => void;
  /** 行く日を覚える */
  onKeep: (date: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [locals, setLocals] = useState<Record<string, LocalInfo>>({});
  const office = trip.items.filter((i) => i.where === "役所" && i.task.needsLocal);
  const officeKey = office.map((i) => i.task.id).join(",");

  // 調べ済みの町の窓口と持ち物だけ読む（ここでは調べに行かない。費用をかけない）
  useEffect(() => {
    let alive = true;
    for (const id of officeKey.split(",").filter(Boolean)) {
      const q = new URLSearchParams({ familyId: family.id, milestoneId: id });
      void api<{ local: LocalInfo | null }>(`/api/local?${q}`)
        .then((r) => alive && r.local && setLocals((cur) => ({ ...cur, [id]: r.local! })))
        .catch(() => {});
    }
    return () => {
      alive = false;
    };
  }, [family.id, officeKey]);

  const bring = useMemo(
    () => mergeBring(office.filter((i) => locals[i.task.id]).map((i) => ({ title: i.task.plain, bring: locals[i.task.id].bring }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [locals, officeKey],
  );
  const notYet = office.filter((i) => !locals[i.task.id]);
  const left = daysUntil(today, trip.deadline);
  const who = whoLabel(trip.items[0].task, family, me);
  const stages = (["役所", "勤め先", "保険が届いたら"] as TripWhere[]).filter((w) => trip.items.some((i) => i.where === w));

  return (
    <section aria-label="生まれた届けを、まとめて" className="flex flex-col gap-4 rounded-2xl border-2 border-rose/40 bg-card p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-rose">生まれた届けを、まとめて</p>
        <h2 className="font-display text-xl leading-snug font-bold">役所へ行く日を1つにしましょう</h2>
        <p className="text-base">
          出生届は <b className="tabular">{jpDate(trip.deadline, today)}</b> まで
          {left >= 0 && <span className="tabular">（あと{left}日）</span>}
          {who && <Pill tone="sky">{who}の番</Pill>}
        </p>
      </div>

      <label className="flex flex-wrap items-center gap-2 text-base">
        <span className="text-sm font-semibold text-muted">行く日</span>
        <input
          type="date"
          min={today}
          max={trip.deadline}
          value={keep?.birthTrip?.date ?? ""}
          onChange={(e) => onKeep(e.target.value)}
          className="min-h-11 rounded-lg border border-line bg-card px-2 text-base"
        />
      </label>

      {stages.map((w) => (
        <div key={w} className="flex flex-col gap-1">
          <p className="text-sm font-semibold text-muted">{STAGE[w]}</p>
          <ol className="flex flex-col">
            {trip.items
              .filter((i) => i.where === w)
              .map((i) => (
                <li key={i.task.id} className="flex flex-col gap-1 border-b border-line py-2 last:border-b-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 text-base leading-snug font-semibold">
                      <span className="tabular mr-1 text-rose">{i.step}.</span>
                      {i.task.plain}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Btn kind="secondary" onClick={() => onDone([i.task.id])} ariaLabel={`${i.task.plain}を済んだにする`}>
                        済んだ
                      </Btn>
                    </div>
                  </div>
                  <p className="text-sm text-muted">{i.reason}</p>
                  {i.step === 1 ? (
                    <p className="text-sm text-sky">すぐ下で、窓口と書く事を用意しています</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setOpen(open === i.task.id ? null : i.task.id)}
                      className="min-h-11 self-start text-sm text-sky underline underline-offset-2"
                      aria-expanded={open === i.task.id}
                    >
                      {open === i.task.id ? "閉じる" : "窓口・書く事を見る"}
                    </button>
                  )}
                  {open === i.task.id && (
                    <div className="flex flex-col gap-2 rounded-lg bg-sky-soft px-3 py-2">
                      <TaskBody task={i.task} today={today} family={family} me={me} keep={keep} onAssign={onAssign} onDone={() => onDone([i.task.id])} />
                    </div>
                  )}
                </li>
              ))}
          </ol>
        </div>
      ))}

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">役所へ持って行く物（調べた分を合わせた物）</p>
        {bring.length > 0 ? (
          <ul className="flex flex-col gap-1">
            {bring.map((b) => (
              <li key={b.item} className="flex flex-col text-base">
                <span>□ {b.item}</span>
                <span className="text-sm text-muted">{b.for.join("・")}の分</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">まだ町の窓口を調べていません。</p>
        )}
        {notYet.length > 0 && (
          <p className="text-sm text-muted">まだ調べていない届け: {notYet.map((i) => i.task.plain).join("・")}（行の「窓口・書く事を見る」から町で調べられます）</p>
        )}
      </div>

      {trip.items.length > 1 && (
        <div>
          <Btn kind="quiet" onClick={() => onDone(trip.items.map((i) => i.task.id))}>
            全部済んだ（{trip.items.length}件）
          </Btn>
        </div>
      )}
    </section>
  );
}
