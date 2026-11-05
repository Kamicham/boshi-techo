"use client";

// 「手帳に入れる候補」: 話した・撮った中から手帳のページに入りそうな物を出し、家族の「OK」で確定、「違う」で消す。
// 数字や色の良い悪いは言わない。手帳と同じ注意書きだけを添える。
import { useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { vaccineLabel } from "@/components/techo/labels";
import { Btn, Notice, Pill, plainError, Why } from "@/components/ui";
import { DEVELOPMENT_NOTE, GROWTH_NOTE, STOOL_ASIDE, STOOL_COLORS, STOOL_NOTE, TECHO_PAGES, type TechoEntry } from "@/lib/techo";
import type { TechoDoc } from "@/lib/techo-store";
import { TECHO_FORMS } from "@/lib/techo-fields";
import { t } from "@/lib/i18n";
import { isMadeId, labelIn } from "@/lib/i18n/names";
import { DateCheck, initialDate } from "./DateCheck";

/** 単位。日・番は描く所で「{n}日」「{n}番」と書く（訳す時に数と並べ替えられるように） */
type Unit = "kg" | "g" | "cm" | "day" | "no";

/** 欄の名前（辞書の鍵。描く所で t() で訳す）と単位 */
const LABELS: Record<string, [string, Unit?]> = {
  week: ["週数"],
  weightKg: ["体重", "kg"],
  weightG: ["体重", "g"],
  heightCm: ["身長", "cm"],
  headCm: ["頭囲", "cm"],
  chestCm: ["胸囲", "cm"],
  bpHigh: ["血圧（上）"],
  bpLow: ["血圧（下）"],
  fundusCm: ["子宮底長", "cm"],
  edema: ["むくみ"],
  urineProtein: ["尿たんぱく"],
  urineSugar: ["尿糖"],
  days: ["産後", "day"],
  dayAge: ["生まれて", "day"],
  colorNo: ["便色カード", "no"],
  ageText: ["時期"],
  item: ["できた事"],
  test: ["検査"],
  result: ["結果"],
  checkup: ["健診"],
  vaccine: ["ワクチン"],
  dose: ["回"],
  lot: ["ロット（シールの番号）"],
  facility: ["医療機関"],
  doctor: ["医師"],
  text: ["言葉"],
  occasion: ["いつ"],
  whom: ["相談した相手"],
  has: ["相談できる人"],
  method: ["お産の方法"],
  place: ["場所"],
  feeding: ["栄養"],
  vitaminK: ["ビタミンK2"],
  care: ["産後ケア"],
  memo: ["メモ"],
  history: ["かかった病気"],
  allergy: ["アレルギー"],
  medicine: ["薬"],
  pastBirths: ["前のお産"],
  smoking: ["たばこ"],
};

/** 直せる欄（読み取った値と、その欄の形にある短い欄）。色の番号とワクチンの種類は、それぞれのページの選び方で直す */
function editKeys(e: TechoEntry): string[] {
  const fixed = new Set(["colorNo", "vaccine"]);
  const form = (TECHO_FORMS[e.page]?.fields ?? []).filter((f) => !f.long).map((f) => f.key);
  return [...new Set([...Object.keys(e.values), ...form])].filter((k) => !fixed.has(k));
}

const isNumberKey = (k: string) => !!LABELS[k]?.[1] || k.startsWith("bp");

const pageTitle = (id: TechoEntry["page"]) => TECHO_PAGES.find((p) => p.id === id)?.title ?? id;

/** 直す欄の札に添える単位（「（kg）」「（日）」） */
function unitTag(unit?: Unit): string {
  if (!unit) return "";
  return unit === "day" ? t("（日）") : unit === "no" ? t("（番）") : t("（{x}）", { x: unit });
}

function valueText(key: string, v: TechoEntry["values"][string]): string {
  const [name, unit] = LABELS[key] ?? [key];
  const label = t(name);
  if (typeof v === "boolean") return t("{label}: {value}", { label, value: t(v ? "いる" : "いない") });
  if (key === "vaccine" && typeof v === "string") return t("{label}: {value}", { label, value: t(vaccineLabel(v)) });
  if (key === "colorNo" && typeof v === "number") return t("{label}: {n}番（{name}）", { label, n: v, name: t(STOOL_COLORS.find((c) => c.no === v)?.name ?? "") });
  if (unit === "day") return t("{label}: {n}日", { label, n: String(v) });
  if (unit === "no") return t("{label}: {n}番", { label, n: String(v) });
  return t("{label}: {value}", { label, value: `${v}${unit ?? ""}` });
}

function Candidate({
  d,
  date,
  onDate,
  today,
  onOk,
  onNo,
  busy,
  edit,
  onEdit,
  made,
}: {
  /** 作った家族か（中文で、ばあば・じいじを外婆・爷爷と書く） */
  made: boolean;
  edit?: Record<string, string>;
  onEdit: (v: Record<string, string> | undefined) => void;
  d: TechoDoc;
  date: string;
  onDate: (v: string) => void;
  today: string;
  onOk: () => void;
  onNo: () => void;
  busy: boolean;
}) {
  const e = d.data;
  const color = e.page === "stool" && typeof e.values.colorNo === "number" ? STOOL_COLORS.find((c) => c.no === e.values.colorNo) : undefined;
  // 便色は手帳の原文（府令様式 p.19）を「」で引き、手帳の文でない #8000 の一言は引用の外に書く
  const note =
    e.page === "stool"
      ? t("母子手帳の便色カード「{note}」{aside}", { note: t(STOOL_NOTE), aside: t(STOOL_ASIDE) })
      : e.page === "growth"
        ? t(GROWTH_NOTE)
        : e.page === "development"
          ? t(DEVELOPMENT_NOTE)
          : null;
  const shown = Object.entries(e.values).filter(([k]) => !(e.page === "development" && k === "item") && !(e.page === "feeling" && k === "text"));
  return (
    <li className="flex flex-col gap-2 rounded-xl bg-card p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pill tone="sky">{t(pageTitle(e.page))}</Pill>
        {e.who && <span className="text-sm text-muted">{labelIn(e.who, { made })}</span>}
      </div>
      <p className="flex items-center gap-2 text-base font-semibold">
        {color && <span className="inline-block h-5 w-5 shrink-0 rounded-full border border-line" style={{ background: color.sample }} aria-hidden />}
        {/* 見出し（e.title）は読み取った記録の本文なので、そのまま出す */}
        {e.page === "vaccine" && typeof e.values.vaccine === "string" ? t(vaccineLabel(e.values.vaccine)) : e.title}
      </p>
      {e.page === "feeling" && typeof e.values.text === "string" && <p className="text-base">{t("「{text}」", { text: e.values.text })}</p>}
      {edit ? (
        <div className="grid grid-cols-2 gap-2">
          {editKeys(e).map((k) => {
            const [label, unit] = LABELS[k] ?? [k];
            return (
              <label key={k} className="flex flex-col gap-1 text-sm text-muted">
                <span>
                  {t(label)}
                  {unitTag(unit)}
                </span>
                <input
                  value={edit[k] ?? ""}
                  onChange={(ev) => onEdit({ ...edit, [k]: ev.target.value })}
                  inputMode={isNumberKey(k) ? "decimal" : undefined}
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base text-ink"
                />
              </label>
            );
          })}
        </div>
      ) : shown.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-ink">
          {shown.map(([k, v]) => (
            <li key={k} className="tabular">
              {valueText(k, v)}
            </li>
          ))}
        </ul>
      )}
      {note && <p className="text-sm text-muted">{note}</p>}
      <DateCheck id={`date-${d.id}`} value={date} onChange={onDate} unsure={e.dateUnsure} max={today} disabled={busy} />
      <div className="flex gap-2">
        <Btn onClick={onOk} disabled={busy || !date}>
          {edit ? t("直してOK") : "OK"}
        </Btn>
        {editKeys(e).length > 0 && (
          <Btn
            kind="secondary"
            onClick={() => onEdit(edit ? undefined : Object.fromEntries(editKeys(e).map((k) => [k, e.values[k] == null ? "" : String(e.values[k])])))}
            disabled={busy}
          >
            {edit ? t("直さない") : t("直す")}
          </Btn>
        )}
        <Btn kind="secondary" onClick={onNo} disabled={busy}>
          {t("違う")}
        </Btn>
      </div>
    </li>
  );
}

/** いま入れた事から出た、手帳の候補 */
export function TechoCandidates({ familyId, items, onChange }: { familyId: string; items: TechoDoc[]; onChange?: () => void }) {
  const { today } = useFamily();
  const made = isMadeId(familyId);
  const [left, setLeft] = useState<TechoDoc[]>(() => items.filter((d) => d.data.pending));
  // 候補ごとの日付（OK の時にこの日で確定する）
  const [dates, setDates] = useState<Record<string, string>>(() => Object.fromEntries(items.map((d) => [d.id, initialDate(d.data.date, d.data.dateUnsure)])));
  // 値を直している候補（OK の前に、読み取った値をその場で直す）
  const [edits, setEdits] = useState<Record<string, Record<string, string> | undefined>>({});
  const [done, setDone] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const send = async (action: "confirm" | "remove", ids: string[]) => {
    setBusy(true);
    setError("");
    try {
      const pick = action === "confirm" ? Object.fromEntries(ids.map((id) => [id, dates[id]]).filter(([, v]) => v)) : undefined;
      const fixed = action === "confirm" ? Object.fromEntries(ids.flatMap((id) => (edits[id] ? [[id, edits[id]]] : []))) : {};
      await api("/api/techo", { body: { familyId, today, action, ids, ...(pick ? { dates: pick } : {}), ...(Object.keys(fixed).length ? { values: fixed } : {}) } });
      setLeft((cur) => cur.filter((d) => !ids.includes(d.id)));
      if (action === "confirm") setDone((n) => n + ids.length);
      onChange?.();
    } catch (e) {
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };

  if (!left.length && !done) return null;
  return (
    <section aria-label={t("手帳に入れる候補")} className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-lg font-bold">{t("手帳に入れる候補")}</h2>
        {left.length > 1 && (
          <Btn kind="secondary" onClick={() => void send("confirm", left.map((d) => d.id))} disabled={busy || left.some((d) => !dates[d.id])}>
            {t("{n}件ともOK", { n: left.length })}
          </Btn>
        )}
      </div>
      {left.length > 0 && (
        <p className="text-sm text-muted">{t("合っていれば OK。読み違いは「直す」でその場で直せます。OK は後で手帳の上からもできます。OK した後も手帳から消せます")}</p>
      )}
      {done > 0 && (
        <p role="status" className="text-sm font-semibold text-ok">
          {t("{n}件を手帳に入れました", { n: done })}
        </p>
      )}
      {error && <Notice title={t("手帳に届きませんでした")} safe={t("候補はそのまま残っています。もう一度押してください。")} detail={error} />}
      {left.length > 0 && (
        <ul className="flex flex-col gap-2">
          {left.map((d) => (
            <Candidate
              key={d.id}
              d={d}
              date={dates[d.id] ?? ""}
              onDate={(v) => setDates((cur) => ({ ...cur, [d.id]: v }))}
              today={today}
              busy={busy}
              onOk={() => void send("confirm", [d.id])}
              onNo={() => void send("remove", [d.id])}
              edit={edits[d.id]}
              onEdit={(v) => setEdits((cur) => ({ ...cur, [d.id]: v }))}
              made={made}
            />
          ))}
        </ul>
      )}
      {left.length > 0 && (
        <Why>
          <p>{t("撮った・話した事は、すぐには手帳に入れず候補にします。家族が OK した物だけが記録になります（紙の手帳が正本のまま）。")}</p>
          <p>{t("読めなかった・言っていない数字は空のままにしています。手帳のページで足してください。")}</p>
          <p>{t("OK した後も、手帳の記録の「消す」で消せます。")}</p>
          <p>{t("紙に日付が無い時は、今日の日付にせず、ページの題（1か月児健診など）と生まれた日から推した日を出します。違う時は直してから OK してください。")}</p>
        </Why>
      )}
    </section>
  );
}
