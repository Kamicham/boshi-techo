"use client";

// 手帳の記録を読む・足す・OK する（/api/techo）。
// GET は { techo: Doc<TechoEntry>[] }。念のため平らな形（id つきの TechoEntry）も読む。
import { useCallback, useEffect, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import type { TechoEntry } from "@/lib/techo";

export type TechoItem = TechoEntry & { id: string };

type Raw = Partial<TechoEntry> & { id?: string; data?: Partial<TechoEntry> };

function normalize(raw: Raw): TechoItem | null {
  const body = raw.data && typeof raw.data === "object" && "page" in raw.data ? raw.data : raw;
  if (!raw.id || !body.page || !body.date) return null;
  return {
    id: raw.id,
    page: body.page,
    date: body.date,
    title: body.title ?? "",
    values: body.values ?? {},
    who: body.who,
    source: body.source ?? "text",
    note: body.note,
    captureId: body.captureId,
    pending: body.pending,
  };
}

export function useTecho() {
  const { family, today } = useFamily();
  const [items, setItems] = useState<TechoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await api<{ techo?: Raw[] }>(`/api/techo?familyId=${encodeURIComponent(family.id)}&today=${today}`);
      const list = (r.techo ?? []).map(normalize).filter((x): x is TechoItem => x != null);
      // 日付の古い順（手帳と同じく、上から時の流れ）
      list.sort((a, b) => a.date.localeCompare(b.date));
      setItems(list);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [family.id, today]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  /** 候補を OK する（家族の OK で確定） */
  const confirm = useCallback(
    async (ids: string[]) => {
      await api(`/api/techo`, { body: { familyId: family.id, today, action: "confirm", ids } });
      await load();
    },
    [family.id, today, load],
  );

  /** 家族が押した・写した記録を足す（確定の記録。数字は家族が入れた物だけ） */
  const add = useCallback(
    async (entry: Omit<TechoEntry, "source"> & { source?: TechoEntry["source"] }) => {
      await api(`/api/techo`, { body: { familyId: family.id, today, action: "add", entries: [{ source: "text", ...entry }] } });
      await load();
    },
    [family.id, today, load],
  );

  return { items, loading, error, reload: load, confirm, add };
}
