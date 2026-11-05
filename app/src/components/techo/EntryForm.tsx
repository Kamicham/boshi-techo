"use client";

// 手帳の欄に打って入れる（撮る・話すと同じ重さで。VISION ①「入力ゼロ、でも押し付けない」）。紙の母子手帳の欄の名前のまま。値の良し悪しは言わない。
// 開いた時に、週数・生後の日数・医療機関など手帳が知っている値を先に入れておく（lib/techo-prefill.ts）。
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
}: {
  page: TechoPageId;
  today: string;
  add: Add;
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
    return (
      <div className="grid grid-cols-2 gap-2">
        <Btn kind="secondary" full onClick={() => void start()}>
          {t("打って入れる")}
        </Btn>
        <Btn kind="secondary" full href="/capture">
          {t("話す・撮る")}
        </Btn>
      </div>
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
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line p-3">
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
}
