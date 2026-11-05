"use client";

// 気持ちの記録: 誰の気持ちかを名前で残す。母だけでなく、父親や周りの人の記録も同じページに。
// 根拠: 2023年4月施行の様式改正で、府令様式に「父親や周囲の方の記録」欄が新しく作られた（「両親」も「保護者」に）。
//   厚生労働省「母子健康手帳、母子保健情報等に関する検討会 中間報告書」2022-09-20 https://www.mhlw.go.jp/content/11908000/000991931.pdf
// 気持ちの中身に AI は口を出さない（相談の受け皿にしない。橋は「相談した記録」のページと、下の相談の入口）。
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { HelpPlaces } from "@/components/today/HelpPlaces";
import { Btn, Notice, plainError } from "@/components/ui";
import { t } from "@/lib/i18n";
import { isMadeId, nameIn } from "@/lib/i18n/names";
import { jpDay, techoWords, whoIn } from "./labels";
import { PhotoSlot } from "./TechoPhotos";
import type { TechoItem } from "./useTecho";

export function FeelingList({ items, today, onAdd }: { items: TechoItem[]; today: string; onAdd: (v: { text: string; who: string }, date: string) => Promise<void> }) {
  const { family, me } = useFamily();
  const done = items.filter((i) => !i.pending);
  const names = family.members.map((m) => m.name);
  // 作った家族か（名前の書き方・中文のばあば・じいじ。lib/i18n/names.ts）
  const made = isMadeId(family.id);
  const [open, setOpen] = useState(false);
  const [who, setWho] = useState<string>(me?.name ?? names[0] ?? "");
  const [otherName, setOtherName] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);

  const save = async () => {
    const name = who === "__other" ? otherName.trim() : who;
    setFailed(false);
    if (!name) {
      setError(t("誰の気持ちか、名前を入れてください"));
      return;
    }
    if (!text.trim()) {
      setError(t("言葉を入れてください"));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onAdd({ text: text.trim(), who: name }, today);
      setText("");
      setOpen(false);
    } catch (e) {
      setFailed(true);
      setError(plainError(e));
    } finally {
      setBusy(false);
    }
  };
  const field = "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base";

  return (
    <div className="flex flex-col gap-3">
      {done.length > 0 && (
        <ul className="flex flex-col gap-2">
          {done.map((it) => (
            <li key={it.id} className="flex gap-2 rounded-xl bg-paper px-3 py-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="text-sm text-muted">
                  <span className="font-semibold text-ink">{it.who != null ? whoIn(it.who, made) : t("（名前なし）")}</span>　{jpDay(it.date)}
                  {it.values.occasion ? `　${techoWords(String(it.values.occasion))}` : ""}
                </p>
                {/* 本文: 作った家族の言葉だけ訳す（家族が書いた気持ちは、書いたまま） */}
                <p className="whitespace-pre-wrap text-base">{feelingText(it)}</p>
              </div>
              <PhotoSlot techoIds={[it.id]} />
            </li>
          ))}
        </ul>
      )}
      {!open ? (
        <Btn kind="secondary" onClick={() => setOpen(true)}>
          {t("気持ちを書く")}
        </Btn>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            {t("誰の気持ち？")}
            <select value={who} onChange={(e) => setWho(e.target.value)} className={field}>
              {names.map((n) => (
                <option key={n} value={n}>
                  {nameIn(n, { made })}
                </option>
              ))}
              <option value="__other">{t("ほかの人（祖父母・きょうだい・友だちなど）")}</option>
            </select>
          </label>
          {who === "__other" && <input value={otherName} onChange={(e) => setOtherName(e.target.value)} className={field} placeholder={t("呼び名（例: 静岡のばあば）")} aria-label={t("呼び名")} />}
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="w-full rounded-lg border border-line bg-card px-3 py-2 text-base" aria-label={t("気持ち")} placeholder={t("いま思っている事を、そのまま")} />
          {error &&
            (failed ? (
              <Notice title={t("手帳に届きませんでした")} safe={t("書いた言葉は消えていません。もう一度「残す」を押してください。")} detail={error} />
            ) : (
              <p className="text-sm font-semibold">{error}</p>
            ))}
          <div className="flex gap-2">
            <Btn onClick={() => void save()} disabled={busy}>
              {busy ? t("入れています…") : t("残す")}
            </Btn>
            <Btn kind="quiet" onClick={() => setOpen(false)}>
              {t("やめる")}
            </Btn>
          </div>
        </div>
      )}
      <HelpPlaces family={family} compact />
    </div>
  );
}

/** 気持ちの本文（作った家族の記録は作った言葉なので訳す。家族が書いた・話した言葉は書いたまま） */
function feelingText(it: TechoItem): string {
  const text = String(it.values.text ?? it.title ?? "");
  return it.source === "seed" ? t(text) : text;
}
