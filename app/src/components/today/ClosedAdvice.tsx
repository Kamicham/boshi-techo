"use client";

// 手帳が気づいた事（閉じた物）: 「わかった」で閉じた気づきを、今日の画面の「済んだ事」の下に並べる（見直し C10③）。
// 押すと、その気づきを文面ごともう一度開ける（その場で開くだけ。上の札には戻さない）。閉じた物が無い時は何も出さない。
// 一覧は GET /api/advisor?closed=1（Claude は呼ばない）。上の札で「わかった」を押した時（ADVICE_CLOSED）も読み直す。
import { useEffect, useState } from "react";
import { api } from "@/components/FamilyProvider";
import type { Advice } from "@/lib/advisor";
import { t } from "@/lib/i18n";
import { Fold } from "../ui";
import { ADVICE_CLOSED, AdviceDetails } from "./AdvisorCard";

interface Closed {
  advice: Advice;
  mailTo?: string;
  from?: string;
}

/** 理由の1文目（上の札と同じ切り方） */
const whyHead = (why: string) =>
  why
    .split(/(?<=。)|\n/)
    .map((x) => x.trim())
    .find(Boolean) ?? "";

export function ClosedAdvice({ familyId }: { familyId: string }) {
  const [items, setItems] = useState<Closed[]>([]);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<{ closed: Closed[] }>(`/api/advisor?familyId=${encodeURIComponent(familyId)}&closed=1`)
        .then((r) => alive && setItems(r.closed ?? []))
        .catch(() => alive && setItems([]));
    void load();
    window.addEventListener(ADVICE_CLOSED, load);
    return () => {
      alive = false;
      window.removeEventListener(ADVICE_CLOSED, load);
    };
  }, [familyId]);

  if (!items.length) return null;
  return (
    <Fold title={t("手帳が気づいた事（閉じた物）")} count={items.length}>
      <ul className="flex flex-col">
        {items.map(({ advice: a, mailTo, from }) => {
          const on = open === a.key;
          return (
            <li key={a.key} className="border-b border-line last:border-b-0">
              <button
                type="button"
                aria-expanded={on}
                onClick={() => setOpen(on ? null : a.key)}
                className="flex min-h-12 w-full items-center justify-between gap-3 text-left text-base"
              >
                <span className="min-w-0">{t(a.title)}</span>
                <span className="shrink-0 text-sm text-muted underline underline-offset-2">{on ? t("閉じる") : t("もう一度開く")}</span>
              </button>
              {on && (
                <div className="flex flex-col gap-3 pb-4">
                  {/* 札と同じく1文目だけ（残りは下の中身に出る） */}
                  {whyHead(a.why) && <p className="text-base">{t(whyHead(a.why))}</p>}
                  <AdviceDetails a={a} res={{ mailTo, from }} />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Fold>
  );
}
