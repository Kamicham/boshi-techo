"use client";

// 生まれた届けを、まとめて（第1波②）。生まれた日から15日の間、出生届・児童手当・保険・医療証などを1枚に並べる。
// 行く順と理由、どこに出すか（役所・勤め先・保険が届いたら）、合わせた持ち物、行く日を1つにまとめる。
// 束が自分の番の画面では、この1枚が一番上（一番上の札を重ねない）。自分の番の最初の届けは、中で窓口と書く事を用意する（UX の見直し C08）。
// 誰が役所へ行くかは、見出しでまとめて決める。母の画面で、届けをパートナーの番に決めた時は、1行にたたむ（TripFolded）。
// 外へは何も送らない。「1回で全部」とは言い切らない（会社の保険の家族は、医療証が後になる）。
import { useEffect, useMemo, useState } from "react";
import type { Family, Member } from "@/lib/demo-family";
import type { Keep } from "@/lib/keep";
import type { LocalInfo } from "@/lib/local";
import { mergeBring, tripDue, type BirthTrip, type TripFold, type TripWhere } from "@/lib/birth-trip";
import { listOf, t } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { msWords } from "@/lib/i18n/milestone-words";
import { api } from "../FamilyProvider";
import { Btn, CopyButton, Pill } from "../ui";
import { PrepBox } from "./NowCard";
import { TaskBody, type ShownTask } from "./TaskCard";
import { turnLabel, whoLabel } from "./task";
import { dueName, nudgeText, untilWords } from "./trip";
import { usePrep } from "./usePrep";

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
  firstId,
  onAssign,
  onAssignMany,
  onDone,
  onKeep,
}: {
  trip: BirthTrip<ShownTask>;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  /** 束の中で開いて、窓口と書く事を用意する1件（今日の画面の一番上の事＝lib/birth-trip.ts の tripScreen の top。たたんだ束を開いた時は無し） */
  firstId?: string | null;
  onAssign?: (milestoneId: string, who: string) => void;
  /** 束の届けの担当をまとめて決める（家族の id か "together"。"" は決め直し） */
  onAssignMany?: (milestoneIds: string[], who: string) => void;
  onDone: (ids: string[]) => void;
  /** 行く日を覚える */
  onKeep: (date: string) => void;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [locals, setLocals] = useState<Record<string, LocalInfo>>({});
  const office = trip.items.filter((i) => i.where === "役所" && i.task.needsLocal);
  const officeKey = office.map((i) => i.task.id).join(",");

  // 調べ済みの町の窓口と持ち物だけ読む（ここでは調べに行かない。費用をかけない。自分の番の最初の届けの調べは FirstRow が受け持つ）
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
  const due = tripDue(
    trip.items.map((i) => i.task),
    today,
  );
  const picker = !!onAssignMany && family.members.length >= 2 && trip.items.some((i) => i.task.shared);
  const who = picker ? "" : whoLabel(trip.items[0].task, family, me);
  // 訳さない: 行き先の値（見出しは STAGE を描く所で訳す）
  const stages = (["役所", "勤め先", "保険が届いたら"] as TripWhere[]).filter((w) => trip.items.some((i) => i.where === w));

  return (
    <section aria-label={t("生まれた届けを、まとめて")} className="flex flex-col gap-4 rounded-2xl border-2 border-rose/40 bg-card p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-rose">{t("生まれた届けを、まとめて")}</p>
        <h2 className="font-display text-xl leading-snug font-bold">{t("役所へ行く日を1つにしましょう")}</h2>
        {(due || who) && (
          <p className="flex flex-wrap items-center gap-x-2 text-base">
            {due && (
              <span>
                {t("{name}は", { name: dueName(due.task) })} <b className="tabular">{untilWords(due.left, due.date, today)}</b>
              </span>
            )}
            {who && <Pill tone="sky">{turnLabel(trip.items[0].task, family, me)}</Pill>}
          </p>
        )}
      </div>

      {picker && <TripWho trip={trip} family={family} onAssignMany={onAssignMany!} />}

      <label className="flex flex-wrap items-center gap-2 text-base">
        <span className="text-sm font-semibold text-muted">{t("行く日")}</span>
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
          <p className="text-sm font-semibold text-muted">{t(STAGE[w])}</p>
          <ol className="flex flex-col">
            {trip.items
              .filter((i) => i.where === w)
              .map((i) => {
                // 自分の番の最初の届けは、窓口と書く事をこの中で用意して開いておく（一番上の札を重ねない）
                const first = !!firstId && i.task.id === firstId;
                // 束の1件目（出生届）と自分の番の最初の届けは開いたまま。2件目からは、題と「済んだ」の1行に畳み、題を押すと理由と窓口が出る
                // （家族の声①への直し A。早送りの決まり j の「1件目は出生届」は畳まない）
                const lead = first || i.task.id === trip.items[0]?.task.id;
                const isOpen = open === i.task.id;
                const name = (
                  <>
                    <span className="tabular mr-1 text-rose">{i.step}.</span>
                    {msWords(i.task.plain)}
                  </>
                );
                return (
                  <li key={i.task.id} className={`flex flex-col gap-1 border-b border-line last:border-b-0 ${lead || isOpen ? "py-2" : "py-1"}`}>
                    <div className="flex items-start justify-between gap-2">
                      {lead ? (
                        <span className="min-w-0 text-base leading-snug font-semibold">{name}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setOpen(isOpen ? null : i.task.id)}
                          aria-expanded={isOpen}
                          className="flex min-h-11 min-w-0 items-center gap-1 text-left text-base leading-snug font-semibold"
                        >
                          <span>{name}</span>
                          <span className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-90" : ""}`} aria-hidden>
                            ›
                          </span>
                        </button>
                      )}
                      <div className="flex shrink-0 gap-1">
                        <Btn kind="secondary" onClick={() => onDone([i.task.id])} ariaLabel={t("{plain}を済んだにする", { plain: msWords(i.task.plain) })}>
                          {t("済んだ")}
                        </Btn>
                      </div>
                    </div>
                    {/* 行く順の理由と一緒にする事は lib/birth-trip.ts の BIRTH_TRIP（辞書は today.ts） */}
                    {(lead || isOpen) && <p className="text-sm text-muted">{t(i.reason)}</p>}
                    {(lead || isOpen) && i.also && <p className="text-sm font-semibold">{t(i.also)}</p>}
                    {first ? (
                      <FirstRow task={i.task} today={today} family={family} me={me} keep={keep} onAssign={onAssign} onDone={() => onDone([i.task.id])} />
                    ) : (
                      <>
                        {lead && (
                          <button
                            type="button"
                            onClick={() => setOpen(isOpen ? null : i.task.id)}
                            className="min-h-11 self-start text-sm text-sky underline underline-offset-2"
                            aria-expanded={isOpen}
                          >
                            {isOpen ? t("閉じる") : t("窓口・書く事を見る")}
                          </button>
                        )}
                        {isOpen && (
                          <div className="flex flex-col gap-2 rounded-lg bg-sky-soft px-3 py-2">
                            <TaskBody task={i.task} today={today} family={family} me={me} keep={keep} onAssign={onAssign} onDone={() => onDone([i.task.id])} noDone />
                          </div>
                        )}
                      </>
                    )}
                  </li>
                );
              })}
          </ol>
        </div>
      ))}

      {/* 持って行く物は1行に畳む（家族の声①への直し A。押せば全部） */}
      <details className="group">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold text-muted">
          <span>
            {t("役所へ持って行く物（調べた分を合わせた物）")}
            {bring.length > 0 && <span className="ml-1 font-normal">{t("{n}件", { n: bring.length })}</span>}
          </span>
          <span className="shrink-0 transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-1 pb-1">
          {bring.length > 0 ? (
            <ul className="flex flex-col gap-1">
              {bring.map((b) => (
                <li key={b.item} className="flex flex-col text-base">
                  {/* 持ち物の名前は、町のページから取った日本語のまま（窓口で見る字） */}
                  <span>□ {b.item}</span>
                  <span className="text-sm text-muted">{t("{what}の分", { what: listOf(b.for.map(msWords)) })}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">{t("まだ町の窓口を調べていません。")}</p>
          )}
          {notYet.length > 0 && (
            <p className="text-sm text-muted">
              {t("まだ調べていない届け: {list}（行の「窓口・書く事を見る」から町で調べられます）", { list: listOf(notYet.map((i) => msWords(i.task.plain))) })}
            </p>
          )}
        </div>
      </details>

      {trip.items.length > 1 && (
        <div>
          <Btn kind="quiet" onClick={() => onDone(trip.items.map((i) => i.task.id))}>
            {t("全部済んだ（{n}件）", { n: trip.items.length })}
          </Btn>
        </div>
      )}
    </section>
  );
}

/**
 * 「役所へ行くのは？［翔太］［美咲］［2人で］」: 束の届け（家族みんなの事）の担当を、まとめて決める。
 * パートナーを先に並べる（産んだ人は休む事が先。どちらにするかは家族が決める）。もう一度押すと決め直せる
 */
function TripWho({ trip, family, onAssignMany }: { trip: BirthTrip<ShownTask>; family: Family; onAssignMany: (ids: string[], who: string) => void }) {
  const shared = trip.items.map((i) => i.task).filter((t) => t.shared);
  const pickOf = (t: ShownTask) => (t.together ? "together" : (family.members.find((m) => m.role === t.who)?.id ?? ""));
  const picks = new Set(shared.map(pickOf));
  const current = picks.size === 1 ? [...picks][0] : "";
  const people = [...family.members].sort((a, b) => Number(a.role !== "パートナー") - Number(b.role !== "パートナー"));
  const choices = [...people.map((m) => ({ id: m.id, label: nameIn(m.name) })), { id: "together", label: t("2人で") }];
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t("生まれた届けを、誰が出しに行くか")}>
      <span className="text-sm text-muted">{current ? t("役所へ行く人") : t("役所へ行くのは？")}</span>
      {choices.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={current === c.id}
          onClick={() =>
            onAssignMany(
              shared.map((t) => t.id),
              current === c.id ? "" : c.id,
            )
          }
          className={`min-h-11 rounded-full border px-4 text-base ${current === c.id ? "border-rose bg-rose text-white" : "border-line bg-card text-ink"}`}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

/** 束の中の、自分の番の最初の届け: 手帳が窓口を調べ、書く事のメモを作っておく。中身はふつうの行と同じ（済んだは行の右、担当は見出し） */
function FirstRow({
  task,
  today,
  family,
  me,
  keep,
  onAssign,
  onDone,
}: {
  task: ShownTask;
  today: string;
  family: Family;
  me: Member | null;
  keep: Keep | null;
  onAssign?: (milestoneId: string, who: string) => void;
  onDone: () => void;
}) {
  const [tries, setTries] = useState(0);
  const prep = usePrep(task, today, family, me, tries);
  const label = !prep.preps ? null : prep.busy ? t("手帳が用意しています") : prep.made ? t("手帳が用意しておきました") : null;
  return (
    <div className="flex flex-col gap-2 rounded-lg bg-sky-soft px-3 py-2">
      {label && <p className="text-sm font-semibold text-sky">{label}</p>}
      <PrepBox prep={prep} family={family} onRetry={() => setTries((n) => n + 1)} />
      <TaskBody key={prep.ver} task={task} today={today} family={family} me={me} keep={keep} onAssign={onAssign} onDone={onDone} top noDone noWho />
    </div>
  );
}

/**
 * 母の画面: パートナーの番に決めた届けを1行にたたむ（UX の見直し C08）。
 * 「生まれた届け5件は、翔太さんの番です（済んだ 0/5）›」。押すと束が開く。
 * 法の期限まで5日を切ったら「翔太さんに声をかける文を作る」（写して LINE などに貼る。外へは送らない）
 */
export function TripFolded({ fold, family, today, open, onToggle }: { fold: TripFold<ShownTask>; family: Family; today: string; open: boolean; onToggle: () => void }) {
  const person = family.members.find((m) => m.role === fold.who);
  const name = person ? t("{name}さん", { name: person.name }) : t("パートナー");
  const due = fold.due ? `${t("{name}は", { name: dueName(fold.due.task) })} ${untilWords(fold.due.left, fold.due.date, today)}` : null;
  const count = t("済んだ {done}/{total}", { done: fold.done, total: fold.total });
  const text = fold.due ? nudgeText(fold.items.length, fold.due, today) : "";
  return (
    <section aria-label={t("生まれた届け")} className="flex flex-col rounded-2xl border border-line bg-card px-4 py-1">
      {fold.nudge && (
        <details className="group border-b border-line">
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2">
            <span className="min-w-0">
              <span className="block text-base font-semibold">{t("{name}に声をかける文を作る", { name })}</span>
              {due && <span className="tabular block text-sm text-muted">{due}</span>}
            </span>
            <span className="shrink-0 text-muted transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="flex flex-col gap-2 pb-3">
            <p className="rounded-lg bg-sky-soft px-3 py-2 text-base">{text}</p>
            <div>
              <CopyButton label={t("文を写す")} text={text} />
            </div>
          </div>
        </details>
      )}
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-12 w-full items-center justify-between gap-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block text-base">
            {fold.nudge ? t("届けを見る") : t("生まれた届け{n}件は、{name}の番です", { n: fold.total, name })}
            <span className="tabular text-sm text-muted">{t("（{x}）", { x: count })}</span>
          </span>
          {!fold.nudge && due && <span className="tabular block text-sm text-muted">{due}</span>}
        </span>
        <span className={`shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} aria-hidden>
          ›
        </span>
      </button>
    </section>
  );
}
