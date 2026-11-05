"use client";

// 手帳の欄に打って入れる（撮る・話すと同じ重さで。VISION ①「入力ゼロ、でも押し付けない」）。紙の母子手帳の欄の名前のまま。値の良し悪しは言わない。
// 開いた時に、週数・生後の日数・医療機関など手帳が知っている値を先に入れておく（lib/techo-prefill.ts）。
// 閉じた形は［＋ 入れる］1つ（家族の声①への直し A。前はページごとに［打って入れる］［話す・撮る］が並んでいた）。押すと打つ欄が開き、
// 欄の頭に「話す・撮るで入れる ›」（手帳のタブの上の［話す・撮る・打つ］と同じ口）。head を渡すと、空のページの見出しの右にボタンを置く1行になる。
import Link from "next/link";
import { useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { techoPrefill } from "@/lib/techo-prefill";
import { Btn } from "@/components/ui";
import { t } from "@/lib/i18n";
import type { TechoPageId } from "@/lib/techo";
import { TECHO_FORMS, formValues } from "@/lib/techo-fields";
import type { TechoItem, useTecho } from "./useTecho";

type Add = ReturnType<typeof useTecho>["add"];

export function EntryForm({
  page,
  today,
  add,
  head,
}: {
  page: TechoPageId;
  today: string;
  add: Add;
  /** 空のページの見出し（題と「いつ・何を撮ると入るか」）。渡すと、その右に［＋ 入れる］を置いた1行にする */
  head?: React.ReactNode;
}) {
  const form = TECHO_FORMS[page];
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(today);
  const [raw, setRaw] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const { family } = useFamily();
  if (!form) return null;
  const start = async () => {
    setOpen(true);
    try {
      const r = await api<{ techo?: { id: string; data: TechoItem }[] }>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`);
      const items = (r.techo ?? []).map((d) => d.data).filter((x) => x && x.page);
      const pre = techoPrefill(page, family, today, items);
      setRaw((cur) => ({ ...pre, ...cur }));
    } catch {
      // 先入れが無くても打てる
    }
  };
  if (!open) {
    // 妊婦健診のページは、家で測った体重の［入れる］（components/techo/HomeEntry.tsx）と紛れないよう、何を入れるかを言う
    const button = (
      <Btn kind="secondary" onClick={() => void start()}>
        {page === "pregnancy-checkup" ? t("＋ 健診の記録を入れる") : t("＋ 入れる")}
      </Btn>
    );
    return head ? (
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">{head}</div>
        <span className="shrink-0">{button}</span>
      </div>
    ) : (
      <div>{button}</div>
    );
  }
  const field =
    "min-h-11 w-full rounded-lg border border-line bg-card px-3 text-base";
  const save = async () => {
    const values = formValues(form, raw);
    if (!values) {
      const req = form.fields.find((f) => f.key === form.required);
      setError(
        req ? t("「{label}」を入れてください", { label: t(req.label) }) : t("どれか1つ入れてください"),
      );
      return;
    }
    setBusy(true);
    setError("");
    try {
      await add({ page, date, title: form.title(values), values });
      setRaw({});
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const sheet = (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
      <Link href="/capture" className="inline-flex min-h-11 items-center gap-1 self-start text-sm font-semibold text-sky">
        <span className="underline underline-offset-2">{t("話す・撮るで入れる")}</span>
        <span aria-hidden>›</span>
      </Link>
      <p className="text-sm text-muted">
        {t("分かる欄だけで足ります。週数・医療機関など手帳が知っている所は入れてあります（違えば直してください）。")}
      </p>
      <label className="flex flex-col gap-1 text-sm text-muted">
        {t(form.dateLabel)}
        <input
          type="date"
          value={date}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className={field}
        />
      </label>
      {form.fields.map((f) => (
        <label key={f.key} className="flex flex-col gap-1 text-sm text-muted">
          <span>
            {t(f.label)}
            {f.unit && (f.unit === "日" ? t("（日）") : t("（{x}）", { x: f.unit }))}
            {f.key === form.required && t("（要る）")}
          </span>
          {f.long ? (
            <textarea
              value={raw[f.key] ?? ""}
              onChange={(e) => setRaw({ ...raw, [f.key]: e.target.value })}
              rows={3}
              placeholder={f.hint && t(f.hint)}
              className="w-full rounded-lg border border-line bg-card px-3 py-2 text-base"
            />
          ) : (
            <input
              value={raw[f.key] ?? ""}
              onChange={(e) => setRaw({ ...raw, [f.key]: e.target.value })}
              inputMode={
                f.unit || f.key.startsWith("bp") ? "decimal" : undefined
              }
              placeholder={f.hint && t(f.hint)}
              className={field}
            />
          )}
        </label>
      ))}
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
  return head ? (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">{head}</div>
      {sheet}
    </div>
  ) : (
    sheet
  );
}
