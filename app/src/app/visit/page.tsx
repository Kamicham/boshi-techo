"use client";

// ⑤ 健診: 一番上に「今やる1つ」（今日の健診／3日前〜前日は聞きたい事を書く／次の健診まであと◯日）。予約・聞く事・これまでは畳む。
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, Fold, HandoffRow, NextStep, Pill, daysUntil } from "@/components/ui";
import { Briefing } from "@/components/visit/Briefing";
import { StatusChip } from "@/components/visit/StatusChip";
import { DEMO_AGENDA, DEMO_TRANSCRIPT, DEMO_VISIT_WEEKS } from "@/components/visit/demoTranscript";
import { addDays, lmpFromDue } from "@/lib/clock";
import { deadlineKindOf, scheduleFor, statusOf, type Milestone, type Status } from "@/lib/milestones";
import type { PrenatalState } from "@/lib/prenatal";
import { briefingDay, concernSide, visitLabel, type AgendaItem, type VisitPlan, type VisitStatus } from "@/lib/visit";

interface Row {
  id: string;
  date: string;
  label: string;
  status: VisitStatus;
  demo?: boolean;
  summary: string | null;
}
interface ListRes {
  visits: Row[];
  plan: VisitPlan;
  agenda: AgendaItem[];
  agendaFor?: "today" | "next";
  /** 妊婦健診の次の目安と受診券の残り（妊娠中だけ） */
  prenatal?: PrenatalState | null;
}

export default function VisitList() {
  const { family, families, today, isDemo, ready, setFamilyId, me } = useFamily();
  const mine = families.find((f) => f.id === "mine");
  const router = useRouter();
  const [data, setData] = useState<ListRes | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<ListRes>(`/api/visit?familyId=${encodeURIComponent(family.id)}&today=${today}`));
      setErr("");
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [family.id, today]);

  useEffect(() => {
    void load();
  }, [load]);

  const start = async () => {
    setBusy("start");
    try {
      const r = await api<{ visit: { id: string } }>("/api/visit", { body: { familyId: family.id, date: today } });
      router.push(`/visit/${r.visit.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  };

  const demo = async () => {
    setBusy("demo");
    try {
      const date = addDays(lmpFromDue(family.dueDate), DEMO_VISIT_WEEKS * 7);
      const r = await api<{ visit: { id: string } }>("/api/visit", { body: { familyId: family.id, date, demo: true, agenda: DEMO_AGENDA } });
      await api(`/api/visit/${r.visit.id}/finish`, { body: { transcriptText: DEMO_TRANSCRIPT } });
      router.push(`/visit/${r.visit.id}`);
    } catch (e) {
      setErr((e as Error).message);
      setBusy("");
    }
  };

  const savePlan = async (b: Record<string, unknown>) => {
    try {
      // 保存した予定（plan）には、健診の結果から取った次の予約が入っていない。一覧を読み直して使う
      // （途中で next が消えると一番上の箱が入れ替わり、書いている途中の欄が閉じるため）
      await api<{ plan: VisitPlan }>("/api/visit/plan", { body: { familyId: family.id, today, ...b } });
      await load();
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const ongoing = data?.visits.find((v) => v.date === today && (v.status === "ready" || v.status === "recording"));
  // 過ぎた予約は「次」として扱わない
  const next = data?.plan.next && data.plan.next.date >= today ? data.plan.next : null;
  const when = briefingDay(today, next?.date);
  // 母以外（パートナー・祖父母）が開いた時は、終わったばかりの健診のまとめを先に
  const notMom = !!me && me.role !== "母";
  const born = !!family.birthDate && family.birthDate <= today;
  // 「ママの健診」は1回だけ: 生まれた後は下の見出しが言うので、箱の上には繰り返さない
  const whose = notMom && !born ? "ママの健診" : undefined;
  // 今日録った健診（整理中・できた）は、まとめを読むのが次の一手。母以外は3日以内の健診も
  const recent = data?.visits.find(
    (v) => !v.demo && v.status !== "ready" && v.status !== "recording" && (v.date === today || (notMom && v.status === "done" && daysUntil(v.date, today) <= 3)),
  );
  // 前回の健診（家族が録った物。デモは除く）。次の予約が無い時は、これを先に見せる
  const last = data?.visits.find((v) => !v.demo && v.status === "done");
  const startLabel = busy === "start" ? "準備しています…" : "今日の健診を始める";
  const agendaCount = data?.agenda.length ?? 0;
  const daysToNext = next ? daysUntil(today, next.date) : null;
  // 3日前〜前日は「聞きたい事を書く」が今やる1つ（前日は持ち物も一緒に）
  const soon = daysToNext != null && daysToNext >= 1 && daysToNext <= 3;
  const calendar = next ? { title: `健診（${visitLabel(family, next.date)}）`, date: next.date, time: next.time ?? null, minutes: 60 } : null;
  const askAndCalendar = (
    <>
      <AskQuick count={agendaCount} onAdd={(t) => void savePlan({ concern: t })} />
      {calendar && <HandoffRow calendar={calendar} />}
    </>
  );
  const startQuiet = (
    <Btn kind="quiet" onClick={() => void start()} disabled={!!busy || !ready}>
      {busy === "start" ? "準備しています…" : "今日が健診の日なら、先生の話を録る"}
    </Btn>
  );

  let top: React.ReactNode;
  if (!data) {
    top = err ? null : <p className="text-base text-muted">読み込んでいます…</p>;
  } else if (ongoing) {
    top = (
      <NextStep eyebrow={`今日・${ongoing.label}`} title="今日の健診を続ける">
        <Btn href={`/visit/${ongoing.id}`}>続ける</Btn>
      </NextStep>
    );
  } else if (recent) {
    top = (
      <NextStep eyebrow={`${recent.date === today ? "今日" : jpDate(recent.date)}・${recent.label}`} title="健診のまとめを読む" sub={recent.summary ?? undefined}>
        <Btn href={`/visit/${recent.id}`}>{recent.status === "done" ? "読む" : "見る"}</Btn>
      </NextStep>
    );
  } else if (when && next) {
    // デモの家族でも、前日・当日の流れはそのまま出す（審査とデモ動画はデモの家族で見る）
    top = (
      <Briefing family={family} today={today} next={next} agenda={data.agenda} whose={whose}>
        {when === "day" ? (
          <Btn onClick={() => void start()} disabled={!!busy || !ready}>
            {startLabel}
          </Btn>
        ) : (
          askAndCalendar
        )}
      </Briefing>
    );
  } else if (next && soon) {
    top = (
      <NextStep
        eyebrow={whose ?? "次の健診"}
        title={`${visitLabel(family, next.date)}の健診`}
        days={daysToNext}
        dateLabel={`${jpDate(next.date)}${next.time ? ` ${next.time}` : ""}`}
      >
        {askAndCalendar}
      </NextStep>
    );
  } else if (next) {
    top = (
      <NextStep
        eyebrow={whose ?? "次の健診"}
        title={`${visitLabel(family, next.date)}の健診`}
        days={daysToNext}
        dateLabel={`${jpDate(next.date)}${next.time ? ` ${next.time}` : ""}`}
      >
        {startQuiet}
      </NextStep>
    );
  } else if (last) {
    // 記録がある時は、空の「次の健診の日を入れる」より前回の健診を先に（次の日は下の折りたたみで入れる）
    top = (
      <NextStep eyebrow={`前回の健診・${jpDate(last.date)}・${last.label}`} title="前回の健診のまとめ" sub={last.summary ?? undefined} tone="sky">
        <Btn href={`/visit/${last.id}`} kind="secondary">
          読む
        </Btn>
      </NextStep>
    );
  } else if (notMom) {
    // パートナー・祖父母には、入力を求めない（ママが入れた日がここに出る）
    top = (
      <p className="rounded-2xl bg-card px-4 py-3 text-base text-muted">
        {whose ? `${whose}の` : ""}次の日は、まだ入っていません。入ると、ここに出ます
      </p>
    );
  } else {
    top = (
      <NextStep eyebrow={whose ?? "次の健診"} title="次の健診の日を入れる">
        <NextAppointment next={null} onSave={(n) => void savePlan({ next: n })} />
        {startQuiet}
      </NextStep>
    );
  }

  const agenda = data?.agenda ?? [];
  const pastAsks = born ? (data?.plan.concerns ?? []).filter((c) => concernSide(c, family.birthDate) === "past") : [];
  // 次の予約が無く、上の箱が入力欄でない時（前回のまとめ・パートナー）は、次の日を入れる欄を畳んで出す
  const nextFold = data && !next && !ongoing && !recent && (!!last || notMom);
  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-6">
      <h1 className="font-display text-xl font-bold">健診</h1>

      {err && (
        <p role="alert" className="rounded-lg bg-alert/10 px-3 py-2 text-base text-alert">
          {err}
        </p>
      )}

      {/* デモの家族を見ている時は、小さな札1行だけ（健診の流れはそのまま見せる） */}
      {isDemo && (
        <p className="flex min-h-11 flex-wrap items-center justify-between gap-x-2 rounded-lg bg-sky-soft px-3 text-sm text-muted">
          <span>デモの家族を見ています</span>
          {mine ? (
            <button type="button" onClick={() => setFamilyId(mine.id)} className="min-h-11 font-semibold text-sky underline underline-offset-2">
              わが家に切り替える
            </button>
          ) : (
            <Link href="/settings" className="inline-flex min-h-11 items-center font-semibold text-sky underline underline-offset-2">
              わが家を作る
            </Link>
          )}
        </p>
      )}

      {/* 生まれた後は、ママの健診の上に「赤ちゃんの健診・予防接種」 */}
      {born && (
        <BabyCheckups
          familyId={family.id}
          today={today}
          asks={(data?.plan.concerns ?? []).filter((c) => concernSide(c, family.birthDate) === "child")}
          onRemove={(id) => void savePlan({ removeConcern: id })}
        />
      )}

      {born && <h2 className="pt-2 text-sm font-semibold text-muted">ママの健診</h2>}
      {top}

      {!born && data?.prenatal && <PrenatalBox s={data.prenatal} today={today} paid={data.plan.paid ?? []} hasNext={!!next} onSave={(b) => void savePlan(b)} />}

      {isDemo && data && (
        <Btn kind="quiet" onClick={() => void demo()} disabled={!!busy}>
          {busy === "demo" ? "作っています…（30秒ほど）" : `デモの健診のまとめを見る（${DEMO_VISIT_WEEKS}週）`}
        </Btn>
      )}

      {data && next && (
        <Fold title="次の健診の日">
          <NextAppointment next={next} onSave={(n) => void savePlan({ next: n })} />
        </Fold>
      )}

      {nextFold && (
        <Fold title="次の健診の日を入れる">
          <NextAppointment next={null} onSave={(n) => void savePlan({ next: n })} />
          {startQuiet}
        </Fold>
      )}

      {data && (
        <Fold title={data.agendaFor === "today" ? "今日、先生に聞く事" : "先生に聞く事"} count={agenda.length}>
          <AskList agenda={agenda} onAdd={(t) => void savePlan({ concern: t })} onRemove={(id) => void savePlan({ removeConcern: id })} />
        </Fold>
      )}

      {/* 妊娠中に足した聞く事は、生まれた後はママの「聞く事」に出さず、ふり返りに畳む（第31回: 産後の健診に妊娠中の気がかりが残った） */}
      {born && pastAsks.length > 0 && (
        <Fold title="妊娠中に気になっていた事" count={pastAsks.length}>
          <p className="text-sm text-muted">生まれる前に足した物です。今も聞きたい事は、上の「聞く事」に書き直してください。</p>
          <ul className="flex flex-col">
            {pastAsks.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 border-b border-line py-1 last:border-b-0">
                <span className="min-w-0 text-base">{c.text}</span>
                <button type="button" onClick={() => void savePlan({ removeConcern: c.id })} className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-2">
                  消す
                </button>
              </li>
            ))}
          </ul>
        </Fold>
      )}

      {data && data.visits.length > 0 && (
        <Fold title="これまでの健診" count={data.visits.length}>
          {data.visits.map((v) => (
            <Link key={v.id} href={`/visit/${v.id}`} className="flex min-h-11 flex-col gap-1 rounded-xl border border-line bg-card p-3 hover:border-rose">
              <span className="flex flex-wrap items-center gap-2">
                <span className="tabular text-base font-semibold">{jpDate(v.date)}</span>
                <span className="text-sm text-sky">{v.label}</span>
                <StatusChip status={v.status} />
                {v.demo && <Pill tone="sky">デモ</Pill>}
              </span>
              {v.summary && <span className="line-clamp-2 text-base">{v.summary}</span>}
            </Link>
          ))}
        </Fold>
      )}
    </main>
  );
}

function NextAppointment({ next, onSave }: { next: VisitPlan["next"]; onSave: (n: { date: string; time: string | null } | null) => void }) {
  const [date, setDate] = useState(next?.date ?? "");
  const [time, setTime] = useState(next?.time ?? "");
  const [editing, setEditing] = useState(!next);
  useEffect(() => {
    setDate(next?.date ?? "");
    setTime(next?.time ?? "");
  }, [next?.date, next?.time]);

  const field = "min-h-11 rounded-lg border border-line bg-card px-3 text-base";
  if (next && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="tabular text-lg font-semibold">
          {jpDate(next.date)}
          {next.time && <span className="ml-2">{next.time}</span>}
        </span>
        {next.source === "visit" && next.said && <Pill tone="sky">先生「{next.said}」</Pill>}
        <Btn kind="quiet" onClick={() => setEditing(true)}>
          直す
        </Btn>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-end gap-2">
      <label className="flex flex-col gap-1 text-sm text-muted">
        日付
        <input id="next-date" type="date" className={field} value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        時刻
        <input id="next-time" type="time" className={field} value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
      <Btn
        disabled={!date}
        onClick={() => {
          onSave({ date, time: time || null });
          if (next) setEditing(false);
        }}
      >
        入れる
      </Btn>
      {next && (
        <Btn kind="quiet" onClick={() => setEditing(false)}>
          やめる
        </Btn>
      )}
    </div>
  );
}

function AskList({ agenda, onAdd, onRemove }: { agenda: AgendaItem[]; onAdd: (t: string) => void; onRemove: (id: string) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      {agenda.length > 0 && (
        <ul className="flex flex-col gap-2">
          {agenda.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg border border-line bg-card px-3 py-2 text-base">
              <Pill tone={a.from === "前回の質問" ? "sky" : "rose"}>{a.from === "前回の質問" ? "前回" : "気がかり"}</Pill>
              <span className="min-w-0 flex-1">{a.text}</span>
              {a.from === "気がかり" && (
                <button type="button" onClick={() => onRemove(a.id)} className="min-h-11 shrink-0 px-2 text-sm text-muted" aria-label={`「${a.text}」を消す`}>
                  消す
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text.trim());
          setText("");
        }}
      >
        <input
          id="concern"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例: 夜に足がつって目が覚める"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-base"
        />
        <button className="min-h-11 shrink-0 rounded-full bg-ink px-5 text-base font-semibold text-paper">足す</button>
      </form>
    </>
  );
}

/** 3日前〜前日の主ボタン: 押すとその場で書ける。足したあとも続けて書ける */
function AskQuick({ count, onAdd }: { count: number; onAdd: (t: string) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [added, setAdded] = useState(false);
  if (!open) return <Btn onClick={() => setOpen(true)}>聞きたい事を書く</Btn>;
  return (
    <div className="flex w-full flex-col gap-1">
      <form
        className="flex w-full gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          onAdd(text.trim());
          setText("");
          setAdded(true);
        }}
      >
        <input
          id="ask-quick"
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="先生に聞きたい事"
          placeholder="例: 夜に足がつって目が覚める"
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-line bg-card px-3 text-base"
        />
        <button className="min-h-11 shrink-0 rounded-full bg-rose px-5 text-base font-semibold text-white">足す</button>
      </form>
      {added && <p className="text-sm text-muted">足しました（先生に聞く事 {count}件）。続けて書けます</p>}
    </div>
  );
}

/**
 * 赤ちゃんの健診・予防接種（予定表の「健診」で、生まれた日から数える物）。
 * 今の物と次の物を表に、済んだ物・過ぎた物・その先は畳む。押すと今日の画面で開く（どこへ・なぜ？・済んだ）。
 */
function BabyCheckups({
  familyId,
  today,
  asks,
  onRemove,
}: {
  familyId: string;
  today: string;
  /** 子の次の健診で聞く事（「聞く」の「健診で聞く事に足す」から） */
  asks: VisitPlan["concerns"];
  onRemove: (id: string) => void;
}) {
  const { family } = useFamily();
  const [done, setDone] = useState<Set<string> | null>(null);
  useEffect(() => {
    let alive = true;
    setDone(null);
    // 今日の画面と同じ「済み」（手帳の記録からの済みは、画面の今日までの記録で決まる。today を渡さないと時計を進めた家族で外れる）
    api<{ done: string[] }>(`/api/done?familyId=${encodeURIComponent(familyId)}&today=${today}`)
      .then((j) => alive && setDone(new Set(j.done)))
      .catch(() => alive && setDone(new Set()));
    return () => {
      alive = false;
    };
  }, [familyId, today]);
  if (!done) return <div className="h-32 rounded-2xl bg-sky-soft/60" aria-hidden />;
  const items = scheduleFor(family)
    .filter((m) => m.kind === "健診" && m.anchor === "birth")
    .map((m) => ({ m, st: statusOf(m, today, done) }))
    // 目安の日を30日より過ぎた物（1歳を過ぎた赤ちゃん訪問など）は「今」に並べず、時期を過ぎた物として畳む
    .map(({ m, st }) => ({ m, st: st === "期限切れ" && deadlineKindOf(m) === "目安" && m.deadlineDate && daysUntil(today, m.deadlineDate) < -30 ? ("過ぎた" as Status) : st }));
  const now = items.filter((x) => x.st === "今やる" || x.st === "期限が近い" || x.st === "期限切れ");
  const next = items.filter((x) => x.st === "まだ先");
  const shown = [...now, ...next.slice(0, Math.max(1, 3 - now.length))];
  const shownIds = new Set(shown.map((x) => x.m.id));
  const rest = items.filter((x) => !shownIds.has(x.m.id));
  return (
    <section aria-label="赤ちゃんの健診・予防接種" className="flex flex-col gap-2 rounded-2xl bg-sky-soft p-4">
      <h2 className="font-display text-lg font-bold">{family.childName ? `${family.childName}の` : "赤ちゃんの"}健診・予防接種</h2>
      {shown.length === 0 && <p className="text-base text-muted">1000日の間の健診と予防接種は、ひととおり過ぎました</p>}
      <ul className="flex flex-col">
        {shown.map(({ m, st }) => (
          <BabyRow key={m.id} m={m} st={st} today={today} />
        ))}
      </ul>
      {rest.length > 0 && (
        <Fold title="ほかの健診・予防接種" count={rest.length}>
          <ul className="flex flex-col">
            {rest.map(({ m, st }) => (
              <BabyRow key={m.id} m={m} st={st} today={today} />
            ))}
          </ul>
        </Fold>
      )}
      {asks.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-card p-3">
          <p className="text-sm font-semibold">次の健診で聞く事（{asks.length}）</p>
          <ul className="flex flex-col">
            {asks.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 border-b border-line py-1 last:border-b-0">
                <span className="min-w-0 text-base">{c.text}</span>
                <button type="button" onClick={() => onRemove(c.id)} className="min-h-11 shrink-0 px-2 text-sm text-muted underline underline-offset-2">
                  消す
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-sm text-muted">受ける所は、町が決めた小児科など。日と場所は町の案内で確かめてください</p>
    </section>
  );
}

function BabyRow({ m, st, today }: { m: Milestone; st: Status; today: string }) {
  const tone = st === "済み" ? "ok" : st === "まだ先" ? "muted" : st === "過ぎた" ? "muted" : "rose";
  // まだ先の札は、始まりまでの日数（近い物は「あと◯日」。遠い物だけ「まだ先」）
  const toStart = daysUntil(today, m.startDate);
  const word = st === "まだ先" ? (toStart <= 60 ? `あと${toStart}日` : "まだ先") : st === "済み" ? "済み" : st === "過ぎた" ? "時期を過ぎた" : st === "期限切れ" ? "まだなら" : "受ける時期";
  // 日の言い方: まだ先は「◯から」、今の物は「◯まで」（法の期限でない物は「◯ごろまでに」）。
  // 11/04 に「目安 12/20 今」と「11/20から まだ先」が並び、遅い日が今・早い日がまだ先に見えた（目安の日を受ける日と読まれた）ため、
  // 今の物は終わりの日だと分かる言い方にする。今日と年が違う日は年も書く（去年か来年か迷わせない）
  const day = (s: string) => jpDate(s, today);
  const when =
    st === "まだ先"
      ? `${day(m.startDate)}から受けられます`
      : m.deadlineDate && st !== "済み"
        ? st === "期限切れ"
          ? `${day(m.deadlineDate)}${deadlineKindOf(m) === "目安" ? "ごろ" : "まで"}の時期を過ぎています`
          : `今受けられます・${day(m.deadlineDate)}${deadlineKindOf(m) === "目安" ? "ごろまでに" : "まで"}`
        : "";
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={`/?focus=${encodeURIComponent(m.id)}`} className="flex min-h-12 items-center justify-between gap-3 py-2">
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className={`text-base leading-snug ${st === "済み" || st === "過ぎた" ? "text-muted" : "font-semibold"}`}>{m.plain}</span>
          {when && <span className="tabular text-sm text-muted">{when}</span>}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          <Pill tone={tone}>{word}</Pill>
          <span className="text-muted" aria-hidden>
            ›
          </span>
        </span>
      </Link>
    </li>
  );
}

/**
 * 妊婦健診の受診券と次の目安（第1波⑧）。予約がまだの時の目安は国の標準の間隔から出す（病院が言った日が正）。
 * 券の数は既定14回（国の標準）で、町の数に直せる。払った額は家族が入れた分の合計だけ（平均とは比べない）。
 */
function PrenatalBox({
  s,
  today,
  paid,
  hasNext,
  onSave,
}: {
  s: PrenatalState;
  today: string;
  paid: { id: string; date: string; yen: number }[];
  hasNext: boolean;
  onSave: (b: Record<string, unknown>) => void;
}) {
  const [yen, setYen] = useState("");
  const [tickets, setTickets] = useState("");
  return (
    <section aria-label="受診券と次の健診の目安" className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold">受診券と次の健診</h2>
      {!hasNext && s.next && (
        <p className="text-base">
          次の健診の目安 <b className="tabular">{jpDate(s.next, today)}</b>ごろ
          <span className="block text-sm text-muted">今は国の標準で{s.interval}。病院が言った日が正です（予約が決まったら上で入れてください）</span>
        </p>
      )}
      <p className="text-base">
        受診券 <b className="tabular">{s.total}</b> 回中 <b className="tabular">{s.used}</b> 回・あと <b className="tabular">{s.remaining}</b> 回
        <span className="block text-sm text-muted">
          {s.totalSource === "国の標準" ? "回数は国の標準（14回）。町で違う時は直せます" : "家族が直した回数"}
          {s.over && "。券の数を超えた分は自分で払う事が多いので、町で確かめてください"}
        </span>
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col text-sm text-muted">
          券の数を直す
          <input inputMode="numeric" value={tickets} onChange={(e) => setTickets(e.target.value.replace(/\D/g, ""))} className="min-h-11 w-24 rounded-lg border border-line bg-card px-2 text-base" placeholder="14" />
        </label>
        <Btn
          kind="secondary"
          disabled={!tickets}
          onClick={() => {
            onSave({ tickets: Number(tickets) });
            setTickets("");
          }}
        >
          直す
        </Btn>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-muted">今日払った額（領収書から。医療費控除や、里帰りの払い戻しに使えます）</p>
        <div className="flex flex-wrap items-end gap-2">
          <input inputMode="numeric" value={yen} onChange={(e) => setYen(e.target.value.replace(/\D/g, ""))} className="min-h-11 w-32 rounded-lg border border-line bg-card px-2 text-base" placeholder="例: 3000" aria-label="払った額（円）" />
          <Btn
            kind="secondary"
            disabled={!yen}
            onClick={() => {
              onSave({ paid: { date: today, yen: Number(yen) } });
              setYen("");
            }}
          >
            残す
          </Btn>
        </div>
        {paid.length > 0 && (
          <>
            <p className="text-base">
              これまでに払った額 <b className="tabular">{s.paidYen.toLocaleString("ja-JP")}</b> 円（{paid.length}回分）
            </p>
            <ul className="flex flex-col text-sm text-muted">
              {paid.slice(-5).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2">
                  <span className="tabular">
                    {jpDate(p.date, today)} {p.yen.toLocaleString("ja-JP")} 円
                  </span>
                  <button type="button" onClick={() => onSave({ removePaid: p.id })} className="min-h-11 px-2 underline underline-offset-2">
                    消す
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
