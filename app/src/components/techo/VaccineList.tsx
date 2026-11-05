"use client";

// 予防接種の記録: 接種日・ワクチン・回・ロット・医療機関を、証明の控えとして並べる。
// 名前は「今日」の画面の予定（lib/milestones.ts の vaccines-*）と同じ呼び方に合わせる。
// 出典: 予防接種法・同施行令の定期接種（五種混合は2024年4月から）。厚生労働省「予防接種情報」https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/kenkou/kekkaku-kansenshou/yobou-sesshu/index.html
// 正本は紙の手帳の「予防接種の記録」欄（医療機関が書く・シールを貼る）。ここは家族の控え。
// 妊娠中の RS ウイルスの母子免疫ワクチン（2026年度から妊婦の定期接種）は、手帳の予防接種の記録の頭に「妊娠週数-日」の欄がある
// （こども家庭庁 府令様式 2026年4月施行版 p.52・厚生労働省「RSウイルスワクチン」）。ここでは回の代わりに妊娠週数を dose に残す（「妊娠30週2日」）。
import { useState } from "react";
import { Btn, Why } from "@/components/ui";
import { t } from "@/lib/i18n";
import { doseWords, head, jpDay, vaccineLabel } from "./labels";
import type { TechoItem } from "./useTecho";

/** 2歳までの定期接種（今日の画面の予定と同じ名前） */
// 訳さない: 保存する値（見出しは vaccineLabel でそろえ、描く所で t() で訳す）
export const VACCINE_NAMES = ["B型肝炎", "ロタ", "小児用肺炎球菌", "五種混合", "BCG", "麻しん風しん", "水痘"] as const;

/** 妊娠中に母が受ける RS ウイルスのワクチン（記録の見出しは一番上。保存する値。描く所で t()） */
export const RSV_NAME = "RSウイルス（妊娠中）";

/** 見出しの呼び方（RS ウイルスは撮った紙の書き方がまちまちなので、ここで1つにまとめる） */
function groupLabel(name: string): string {
  return /^(RS|アブリスボ)/i.test(name.normalize("NFKC").trim()) ? RSV_NAME : vaccineLabel(name);
}

export function VaccineList({ items, today, onAdd }: { items: TechoItem[]; today: string; onAdd: (v: { vaccine: string; dose?: string; lot?: string; facility?: string }, date: string) => Promise<void> }) {
  const done = items.filter((i) => !i.pending);
  // ワクチンごとに束ねる（回の順＝日付の順）。見出しは呼び方の表でそろえる（「水痘」と「水ぼうそう」を1つに）
  const groups = new Map<string, TechoItem[]>();
  for (const it of done) {
    const name = groupLabel(String(it.values.vaccine ?? it.title ?? ""));
    groups.set(name, [...(groups.get(name) ?? []), it]);
  }
  const known = [RSV_NAME, ...VACCINE_NAMES.map(vaccineLabel)];
  const order = [...known.filter((n) => groups.has(n)), ...[...groups.keys()].filter((n) => !known.includes(n))];

  return (
    <div className="flex flex-col gap-3">
      {order.length > 0 ? (
        <div className="flex flex-col gap-3">
          {order.map((name) => (
            <section key={name} className="flex flex-col gap-1">
              <h4 className="text-base font-bold">{head(t(name))}</h4>
              <ul className="flex flex-col gap-1">
                {groups.get(name)!.map((it) => (
                  <li key={it.id} className="rounded-lg bg-paper px-3 py-2 text-base">
                    <span className="font-semibold">{jpDay(it.date)}</span>
                    {it.values.dose ? `　${doseWords(String(it.values.dose))}` : ""}
                    <span className="block text-sm text-muted">
                      {/* ロットと医療機関の名前は、紙に書いてあるまま */}
                      {[it.values.lot ? t("{label} {value}", { label: t("ロット（シールの番号）"), value: String(it.values.lot) }) : "", it.values.facility ? String(it.values.facility) : ""].filter(Boolean).join("　") ||
                        t("ロット（シールの番号）・医療機関は未記入")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
      <AddVaccine today={today} onAdd={onAdd} />
      <Why>
        <p>{t("正式な記録は、紙の手帳の「予防接種の記録」欄です（医療機関が書き、シールを貼ります）。ここはその控えです。")}</p>
        <p>{t("保育園・学校・海外へ行く時に、受けた日とロット（シールの番号）を聞かれる事があります。手元に控えがあると、すぐ答えられます。")}</p>
      </Why>
    </div>
  );
}

function AddVaccine({ today, onAdd }: { today: string; onAdd: (v: { vaccine: string; dose?: string; lot?: string; facility?: string }, date: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [vaccine, setVaccine] = useState<string>(VACCINE_NAMES[0]);
  const [other, setOther] = useState("");
  // 訳さない: 保存する値（出す時は doseWords）
  const [dose, setDose] = useState("1回目");
  const [week, setWeek] = useState("");
  const [weekDay, setWeekDay] = useState("");
  const rsv = vaccine === RSV_NAME;
  const [lot, setLot] = useState("");
  const [facility, setFacility] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!open) {
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="secondary" full onClick={() => setOpen(true)}>
          {t("打って入れる")}
        </Btn>
        <Btn kind="secondary" full href="/capture">
          {t("話す・撮る")}
        </Btn>
      </div>
    );
  }
  const field = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base";
  const save = async () => {
    const name = vaccine === "その他" ? other.trim() : vaccine;
    if (!name) {
      setError(t("ワクチンの名前を入れてください"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      // RS ウイルス（妊娠中）は、回の代わりに妊娠週数（手帳の欄と同じ「週-日」）を残す
      const w = week.trim();
      // 訳さない: 保存する値（手帳の欄と同じ日本語。出す時は doseWords）
      const pregWeek = w ? `妊娠${w}週${weekDay ? `${weekDay}日` : ""}` : undefined;
      await onAdd({ vaccine: name, dose: rsv ? pregWeek : dose || undefined, lot: lot.trim() || undefined, facility: facility.trim() || undefined }, date);
      setLot("");
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("受けた日")}
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("ワクチン")}
        <select value={vaccine} onChange={(e) => setVaccine(e.target.value)} className={field}>
          {[...VACCINE_NAMES, RSV_NAME, "その他"].map((n) => (
            <option key={n} value={n}>
              {head(t(n === "その他" || n === RSV_NAME ? n : vaccineLabel(n)))}
            </option>
          ))}
        </select>
      </label>
      {vaccine === "その他" && <input value={other} onChange={(e) => setOther(e.target.value)} className={field} placeholder={t("ワクチンの名前")} aria-label={t("ワクチンの名前")} />}
      {rsv ? (
        <fieldset className="flex flex-col gap-1 text-sm text-muted">
          <legend>{t("受けた時の妊娠週数（手帳の欄と同じ）")}</legend>
          <div className="flex items-center gap-2">
            <input inputMode="numeric" value={week} onChange={(e) => setWeek(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} className={`${field.replace("w-full", "")} w-20`} aria-label={t("妊娠週数（週）")} />
            <span className="text-base text-ink">{t("週")}</span>
            <input inputMode="numeric" value={weekDay} onChange={(e) => setWeekDay(e.target.value.replace(/[^0-6]/g, "").slice(0, 1))} className={`${field.replace("w-full", "")} w-16`} aria-label={t("妊娠週数（日）")} />
            <span className="text-base text-ink">{t("日")}</span>
          </div>
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 text-sm text-muted">
          {t("回")}
          <select value={dose} onChange={(e) => setDose(e.target.value)} className={field}>
            {["1回目", "2回目", "3回目", "4回目（追加）", ""].map((d) => (
              <option key={d} value={d}>
                {d ? doseWords(d) : head(t("分からない"))}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("ロット（シールの番号）")}
        <input value={lot} onChange={(e) => setLot(e.target.value)} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t("医療機関")}
        <input value={facility} onChange={(e) => setFacility(e.target.value)} className={field} />
      </label>
      {error && <p className="text-sm text-alert">{error}</p>}
      <div className="flex gap-2">
        <Btn onClick={() => void save()} disabled={busy}>
          {busy ? t("入れています…") : t("入れる")}
        </Btn>
        <Btn kind="quiet" onClick={() => setOpen(false)}>
          {t("やめる")}
        </Btn>
      </div>
    </div>
  );
}
