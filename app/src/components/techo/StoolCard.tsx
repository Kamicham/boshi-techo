"use client";

// 便色カード: 国の7色を番号つきで並べ、親が押して選んだ番号を記録する。AI は色を判定しない。
// 出典: 母子健康手帳 府令様式の便色カード（こども家庭庁「母子健康手帳について」2026年版）。
// 手帳の頁の言葉（府令様式 p.19 の枠2つ・本文・注記）は、lib/techo.ts の原文をそのまま出す（下の StoolRule）。
//   「迷う時は #8000」は手帳の文ではないので、引用の外に書く（STOOL_ASIDE）。
// 色: ふだんは空色の情報箱。最新の記録が1〜3番の時と、1〜3番を選んだ・入れた直後だけ赤くし、
//   #8000 と かかりつけへの電話を主ボタンにする（赤は命の橋だけ。判断の言葉は足さず、手帳の言葉をそのまま言う）。
// 画面の見本の色は印刷の色の近似。画面では色が変わるので、実物は紙の手帳のカードで（手帳の言葉どおり明るいところで）見比べる。
import { useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { Btn, Notice, plainError, Why } from "@/components/ui";
import { t } from "@/lib/i18n";
import { STOOL_ASIDE, STOOL_CHECKS, STOOL_COLORS, STOOL_NOTE_MORE, STOOL_RULE } from "@/lib/techo";
import { RemoveRow } from "./EntryCard";
import { jpDay } from "./labels";
import type { TechoItem } from "./useTecho";

export function StoolCard({
  items,
  today,
  onAdd,
  onRemove,
}: {
  items: TechoItem[];
  today: string;
  onAdd: (colorNo: number, date: string) => Promise<void>;
  /** 押し間違いを消す（消す前に1段確かめる） */
  onRemove?: (ids: string[]) => Promise<void>;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  // いま入れた番号（入れた直後の案内を、その場で赤くするため）
  const [savedNo, setSavedNo] = useState<number | null>(null);
  const done = items.filter((i) => !i.pending && typeof i.values.colorNo === "number");
  const latest = done.length ? (done[done.length - 1].values.colorNo as number) : null;
  const near = (n: number | null) => n != null && n >= 1 && n <= 3;
  const urgent = near(picked) || near(savedNo) || near(latest);
  const clinic = useClinic();

  const save = async () => {
    if (picked == null) return;
    setBusy(true);
    setError("");
    try {
      await onAdd(picked, date);
      setSaved(t("{date}に {n}番 を入れました", { date: jpDay(date), n: picked }));
      setSavedNo(picked);
      setPicked(null);
    } catch (e) {
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base">{t("明るいところで、紙の手帳の便色カードと見比べて、近い番号を押してください。")}</p>
      <ul className="grid grid-cols-4 gap-2" aria-label={t("便の色の番号")}>
        {STOOL_COLORS.map((c) => (
          <li key={c.no}>
            <button
              type="button"
              onClick={() => setPicked(c.no)}
              aria-pressed={picked === c.no}
              aria-label={t("{n}番 {name}", { n: c.no, name: t(c.name) })}
              className={`flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-xl border-2 p-1 ${picked === c.no ? "border-rose" : "border-line"}`}
            >
              <span className="h-8 w-full rounded-md border border-ink/10" style={{ background: c.sample }} aria-hidden />
              <span className="text-sm font-semibold">{c.no}</span>
            </button>
          </li>
        ))}
      </ul>
      {picked != null && (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <p className="text-base">
            {t("{n}番（{name}）", { n: picked, name: t(STOOL_COLORS[picked - 1].name) })}
          </p>
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t("見た日")}
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="min-h-11 rounded-lg border border-line bg-card px-3 text-base" />
          </label>
          <div className="flex gap-2">
            <Btn onClick={() => void save()} disabled={busy}>
              {busy ? t("入れています…") : t("記録する")}
            </Btn>
            <Btn kind="quiet" onClick={() => setPicked(null)}>
              {t("やめる")}
            </Btn>
          </div>
        </div>
      )}
      {saved && <p className="text-sm text-muted" aria-live="polite">{saved}</p>}
      {error && <Notice title={t("記録に届きませんでした")} safe={t("選んだ番号はまだ入っていません。もう一度「記録する」を押してください。")} detail={error} />}
      {/* 手帳の言葉（便色カードの頁）は消さない。ふだんは情報、1〜3番の時だけ赤い橋。#8000 の一言は引用の外 */}
      {urgent ? (
        <div role="alert" className="flex flex-col gap-3 rounded-xl border-l-4 border-alert bg-alert/10 px-3 py-3">
          <StoolRule alert />
          <div className="flex flex-col gap-2">
            <p className="text-base">{t(STOOL_ASIDE)}</p>
            <a href="tel:%238000" className="inline-flex min-h-12 items-center justify-center rounded-full bg-alert px-5 text-base font-semibold text-white">
              {t("#8000 に電話（こども医療でんわ相談）")}
            </a>
            {clinic?.tel ? (
              <a href={`tel:${clinic.tel}`} className="inline-flex min-h-12 items-center justify-center rounded-full bg-alert px-5 text-base font-semibold text-white">
                {/* 病院の名前は家族が設定に書いたまま */}
                {clinic.name ? t("かかりつけ（{name}）に電話", { name: clinic.name }) : t("かかりつけに電話")}
              </a>
            ) : (
              <p className="text-base">{t("かかりつけの小児科へ電話してください（電話番号は設定の「通う病院」に入れておくと、ここから押せます）。")}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-xl bg-sky-soft px-3 py-3">
          <StoolRule alert={false} />
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base">{t(STOOL_ASIDE)}</p>
            <Btn href="tel:%238000" kind="secondary">
              {t("#8000 に電話")}
            </Btn>
          </div>
        </div>
      )}
      {done.length > 0 && (
        <ul className="flex flex-col gap-0.5 text-base">
          {done.map((i) => (
            <li key={i.id} className="flex flex-col">
              <span>
                {jpDay(i.date)}　{t("{n}番", { n: String(i.values.colorNo) })}
              </span>
              {onRemove && (
                <RemoveRow
                  id={i.id}
                  onRemove={async (ids) => {
                    await onRemove(ids);
                    if (savedNo != null) setSavedNo(null);
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      <Why>
        <p>{t("画面の色は見本で、紙に印刷された色の近似です。スマホの明るさで色が変わるので、必ず紙の手帳のカードで見比べてください。")}</p>
        <p>{t("このアプリは色を見て判断しません。選んだ番号を、家族の記録として残すだけです。")}</p>
        <p>{t("紙の手帳には、生後2週・1か月・1〜4か月ごろに見た番号を書く欄があります（母子健康手帳の便色カード）。")}</p>
      </Why>
    </div>
  );
}

/**
 * 手帳の便色カードの頁の言葉（府令様式 p.19 の原文そのまま。言い換えない）。
 * 手帳と同じ並び: 枠の2つ → 本文（どちらかが当てはまるときは…）、その下に注記（生後4か月くらいまでは…）。
 */
function StoolRule({ alert }: { alert: boolean }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm text-muted">{t("母子手帳の言葉（便色カードの頁）")}</figcaption>
      <blockquote className="flex flex-col gap-2">
        <ul className="grid grid-cols-2 gap-2">
          {STOOL_CHECKS.map((c) => (
            <li key={c} className={`rounded-lg border bg-card px-2 py-1.5 text-base ${alert ? "border-alert/40" : "border-line"}`}>
              {t(c)}
            </li>
          ))}
        </ul>
        <p className={`text-base font-semibold ${alert ? "text-alert" : ""}`}>{t(STOOL_RULE)}</p>
        <p className="text-base">{t(STOOL_NOTE_MORE)}</p>
      </blockquote>
    </figure>
  );
}

/** 設定の「通う病院」の名前と電話（入っていれば、1〜3番の時にここから押せる） */
function useClinic(): { name: string; tel: string } | null {
  const { family } = useFamily();
  const [clinic, setClinic] = useState<{ name: string; tel: string } | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ keep?: { hospital?: { name?: string; phone?: string } } }>(`/api/keep?familyId=${encodeURIComponent(family.id)}`)
      .then((r) => {
        if (!alive) return;
        const tel = (r.keep?.hospital?.phone ?? "").replace(/[^\d+]/g, "");
        setClinic(tel ? { name: r.keep?.hospital?.name ?? "", tel } : null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id]);
  return clinic;
}
