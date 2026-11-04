"use client";

// 一冊・映画の終わりの「家族のありがとう」（総点検 2-1・2026-11-04）。手帳の中で家族が交わしたありがとう（誰から誰へ・何に・いつ）。
// 中身は /api/done の doneBy・thanks（lib/done-words.ts の thanksLog）。1つも無い時は出さない。Claude には送らない（一冊の文にも入れない）。
import { useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/today/dates";
import { thanksLog, type Thanks } from "@/lib/done-words";
import { childView } from "@/lib/call-name";
import { scheduleFor } from "@/lib/milestones";

export function useThanksLog() {
  const { family, today } = useFamily();
  const [r, setR] = useState<{ doneBy?: Record<string, string>; thanks?: Record<string, Thanks> }>({});
  useEffect(() => {
    let alive = true;
    api<{ doneBy?: Record<string, string>; thanks?: Record<string, Thanks> }>(`/api/done?familyId=${encodeURIComponent(family.id)}&today=${today}`)
      .then((j) => alive && setR({ doneBy: j.doneBy ?? {}, thanks: j.thanks ?? {} }))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [family.id, today]);
  const titles = useMemo(() => new Map(scheduleFor(family, today).map((m) => [m.id, m.plain])), [family, today]);
  return useMemo(() => thanksLog(family, today, r).map((x) => ({ ...x, title: titles.get(x.id) ?? "" })), [family, today, r, titles]);
}

export function ThanksChapter() {
  const { family, today } = useFamily();
  const log = useThanksLog();
  if (!log.length) return null;
  return (
    <section aria-label="家族のありがとう" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h2 className="font-display text-lg font-bold">
        家族のありがとう <span className="tabular text-base font-normal text-muted">{log.length}</span>
      </h2>
      <p className="text-sm text-muted">手帳の中で、家族が交わしたありがとうです。</p>
      <ul className="flex flex-col">
        {log.map((x) => (
          <li key={x.id} className="flex flex-col border-b border-line py-2 last:border-b-0">
            <span className="text-base">
              🌷 <b>{childView(family, x.from.name)}</b>から <b>{childView(family, x.to.name)}</b>へ
            </span>
            <span className="text-sm text-muted">
              {x.title ? `「${x.title}」に` : ""}（{jpDate(x.on, today)}）
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
