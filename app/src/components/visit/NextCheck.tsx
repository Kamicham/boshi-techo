"use client";

// 結果の画面の1問（2026-11-05 作り手の方針「聞き違いはシステムで0にできない。最後の確かめと OK は本人に残す」・プラン第4版）:
// 「録音からは『…』と聞こえました。この日で大丈夫ですか？」。［大丈夫］1回でそのまま進む・［直す］はその場で日付と時刻を打ち直す・静かな［言われていない］。
// まとめ押しは置かない（形だけの押しになるため）。日付には年（今日と違う時）・曜日・あと◯日と、聞こえた言葉を並べる。
// カレンダーへ入れるボタンは確かめた後だけ（手帳の外へ出る物は「大丈夫」の後）。機械の印（lib/visit-next.ts の heardFlags）は1行の注意で聞き方を強めるだけ。
// 書けない人（体験版など。canWrite が false）にはボタンを出さず、「録音から聞こえた日・まだ確かめていません」と添える。
import { useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/today/dates";
import { Btn, HandoffRow, NextStep, Notice, Why, daysUntil, plainError } from "@/components/ui";
import { t } from "@/lib/i18n";
import { isChecked, nextOfVisit, type NextCheck as Check, type VisitView } from "@/lib/visit";
import { heardFlags, type HeardFlag } from "@/lib/visit-next";

function flagWord(f: HeardFlag): string {
  switch (f) {
    case "rollover":
      return t("年をまたいだ日に聞こえました。");
    case "sameDay":
      return t("健診と同じ日に聞こえました。");
    case "weekday":
      return t("言われた曜日と、日付の曜日が違います。");
    case "far":
      return t("いつもの間隔より、だいぶ先の日に聞こえました。");
    case "afterDue":
      return t("予定日より後の日に聞こえました。");
  }
}

/** 押した日（日本の暦日） */
const jstDay = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 10);

function checkedLine(c: Check, today: string, visitDate: string): string {
  const day = jstDay(c.at);
  const fixed = c.state === "fixed";
  // 見本の家族は日を動かして見せるので、押した日（今の暦）が健診の日より前に見える。その時は日を出さない
  if (day < visitDate) {
    if (fixed) return c.by ? t("{by}が直しました", { by: c.by }) : t("直しました");
    return c.by ? t("{by}が確かめました", { by: c.by }) : t("確かめました");
  }
  const date = jpDate(day, today);
  if (fixed) return c.by ? t("{by}が直しました（{date}）", { by: c.by, date }) : t("直しました（{date}）", { date });
  return c.by ? t("{by}が確かめました（{date}）", { by: c.by, date }) : t("確かめました（{date}）", { date });
}

function Quote({ children }: { children: React.ReactNode }) {
  return <blockquote className="border-l-2 border-line pl-2 text-sm leading-relaxed text-muted">「{children}」</blockquote>;
}

const FIELD = "min-h-11 rounded-lg border border-line bg-card px-3 text-base";

export function NextCheck({
  visit,
  today,
  family,
  onChange,
}: {
  visit: VisitView;
  today: string;
  /** 機械の印に使う（予定日・生まれた日） */
  family: { dueDate?: string | null; birthDate?: string | null };
  onChange: (v: VisitView) => void;
}) {
  const { me } = useFamily();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const na = visit.result?.nextAppointment ?? null;
  const c = visit.nextCheck;
  if (!na && !c) return null;
  const said = na?.said ?? "";
  const n = nextOfVisit(visit);
  const canWrite = visit.canWrite !== false;
  const by = me?.name ?? null;

  const edit = (d: string, tm: string) => {
    setDate(d);
    setTime(tm);
    setEditing(true);
  };

  /** 先に画面を変え、届かなければ手帳の今の形を読み直す（読めなければ元へ戻す） */
  const send = async (answer: { state: Check["state"]; date?: string; time?: string | null }) => {
    const before = visit;
    const at = new Date().toISOString();
    const local: Check = answer.state === "none" ? { state: "none", at, by } : { state: answer.state, date: answer.date ?? null, time: answer.time ?? null, at, by };
    onChange({ ...visit, nextCheck: local, nextDate: answer.state === "none" ? null : (answer.date ?? null) });
    setEditing(false);
    setBusy(true);
    setErr("");
    try {
      const r = await api<{ visit: VisitView }>(`/api/visit/${visit.id}`, { method: "PATCH", body: { nextCheck: { ...answer, by } } });
      onChange(r.visit);
    } catch (e) {
      setErr(plainError(e));
      try {
        onChange((await api<{ visit: VisitView }>(`/api/visit/${visit.id}`)).visit);
      } catch {
        onChange(before);
      }
    } finally {
      setBusy(false);
    }
  };

  const notice = err ? <Notice title={t("手帳に届きませんでした")} safe={t("確かめは、まだ手帳に入っていません。もう一度押してください。")} detail={err} /> : null;
  const heardQuote = said ? (
    <Why label={t("録音から聞こえた言葉")}>
      <Quote>{said}</Quote>
    </Why>
  ) : null;

  // 日付と時刻を打ち直す（直す・日付を入れる・日付にできなかった時）
  const form = (onCancel: (() => void) | null) => (
    <>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1 text-sm text-muted">
          {t("日付")}
          <input id="next-check-date" type="date" min={visit.date} className={FIELD} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-muted">
          {t("時刻")}
          <input id="next-check-time" type="time" className={FIELD} value={time} onChange={(e) => setTime(e.target.value)} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={() => void send({ state: "fixed", date, time: time || null })} disabled={busy || !date || date < visit.date}>
          {t("この日で大丈夫")}
        </Btn>
        {onCancel && (
          <Btn kind="secondary" onClick={onCancel} disabled={busy}>
            {t("やめる")}
          </Btn>
        )}
      </div>
    </>
  );

  // 直している間（確かめた後の「直す」・言われていないの後の「日付を入れる」・聞こえた日の「直す」）
  if (editing && canWrite) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-sky-soft p-5">
        <p className="text-sm font-semibold text-muted">{t("次の健診")}</p>
        {form(() => setEditing(false))}
        {isChecked(c) && <p className="text-sm text-muted">{t("前にカレンダーへ入れていたら、前の予定はカレンダーで消してください")}</p>}
        {heardQuote}
        {notice}
      </section>
    );
  }

  // 確かめた後: 決まった日として出し、ここで初めてカレンダーへ入れられる
  if (isChecked(c)) {
    const days = daysUntil(today, c.date);
    return (
      <>
        <NextStep eyebrow={t("次の健診")} title={`${jpDate(c.date, today)}${c.time ? ` ${c.time}` : ""}`} days={days >= 0 ? days : null} tone="sky">
          <HandoffRow
            calendar={{ title: t("健診の予約"), date: c.date, time: c.time, minutes: 60, details: said ? t("録音から聞こえた言葉:「{said}」", { said }) : undefined }}
          />
          <p className="flex w-full flex-wrap items-center gap-x-2 text-sm text-muted">
            <span>{checkedLine(c, today, visit.date)}</span>
            {canWrite && (
              <button type="button" onClick={() => edit(c.date, c.time ?? "")} className="min-h-11 underline underline-offset-2">
                {t("直す")}
              </button>
            )}
          </p>
          {heardQuote}
        </NextStep>
        {notice}
      </>
    );
  }

  // 「言われていない」と答えた後
  if (c?.state === "none") {
    return (
      <section className="flex flex-col gap-1 rounded-2xl border border-line bg-card p-4">
        <p className="text-base">{t("次の健診の日は、言われていない事にしました")}</p>
        {heardQuote}
        {canWrite && (
          <Btn kind="quiet" onClick={() => edit("", "")}>
            {t("日付を入れる")}
          </Btn>
        )}
        {notice}
      </section>
    );
  }

  // 聞こえた言葉はあるが、日付にできなかった: その場で日付を入れる（健診のタブへ飛ばさない＝当日は入れる欄が無い）
  if (!n) {
    return (
      <section className="flex flex-col gap-3 rounded-2xl bg-sky-soft p-5">
        <p className="text-sm font-semibold text-muted">{t("次の健診・聞こえた日")}</p>
        <p className="text-base">{t("録音からは「{said}」と聞こえましたが、日付にできませんでした。", { said })}</p>
        {canWrite && (
          <>
            {form(null)}
            <button type="button" onClick={() => void send({ state: "none" })} disabled={busy} className="min-h-11 self-center text-sm text-muted underline underline-offset-2">
              {t("言われていない")}
            </button>
          </>
        )}
        {notice}
      </section>
    );
  }

  // 1問: 録音からはこう聞こえました。この日で大丈夫ですか？
  const days = daysUntil(today, n.date);
  const flags = heardFlags(visit.date, na, n.date, family);
  return (
    <section className="flex flex-col gap-3 rounded-2xl bg-sky-soft p-5">
      <p className="text-sm font-semibold text-muted">{t("次の健診・聞こえた日")}</p>
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span className="tabular font-display text-2xl font-bold">
          {jpDate(n.date, today)}
          {n.time ? ` ${n.time}` : ""}
        </span>
        {days >= 0 && <span className="text-base text-muted">{t("あと{n}日", { n: days })}</span>}
      </p>
      <p className="text-base">
        {canWrite ? t("録音からは「{said}」と聞こえました。この日で大丈夫ですか？", { said }) : t("録音からは「{said}」と聞こえました。", { said })}
      </p>
      {flags.length > 0 && (
        <p className="flex flex-wrap gap-x-1 rounded-lg border border-warn/40 bg-card px-3 py-2 text-base">
          {flags.map((f) => (
            <b key={f} className="text-warn">
              {flagWord(f)}
            </b>
          ))}
          <span>{t("予約票と見比べてください。")}</span>
        </p>
      )}
      {canWrite ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Btn onClick={() => void send({ state: "ok", date: n.date, time: n.time })} disabled={busy}>
              {t("大丈夫")}
            </Btn>
            <Btn kind="secondary" onClick={() => edit(n.date, n.time ?? "")} disabled={busy}>
              {t("直す")}
            </Btn>
          </div>
          <button type="button" onClick={() => void send({ state: "none" })} disabled={busy} className="min-h-11 self-center text-sm text-muted underline underline-offset-2">
            {t("言われていない")}
          </button>
        </>
      ) : (
        <p className="text-sm text-muted">{t("録音から聞こえた日・まだ確かめていません")}</p>
      )}
      {notice}
    </section>
  );
}
