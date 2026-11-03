"use client";

// 写真の一覧を読む（/api/media）。手帳の各ページの写真の枠が同じ一覧を何度も読まないよう、家族ごとに1回だけ読んで分け合う。
// 写真を足した・直した時は invalidateMedia で読み直す。
// アカウントの仕組みをまだ動かしていない置き場（503）・ログインしていない（401）時は unavailable（写真の枠は出さない）。
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFamily } from "@/components/FamilyProvider";
import type { ClientMedia } from "@/lib/media-shared";

export interface MediaList {
  media: ClientMedia[];
  usage: { count: number; bytes: number };
  canWrite: boolean;
}

type Entry = { promise: Promise<MediaList>; result?: MediaList; error?: { status: number; message: string } };

const cache = new Map<string, Entry>();
let version = 0;
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const getVersion = () => version;

/** 写真を足した・直した後に呼ぶ（読んだ一覧を捨てて、見ている画面が読み直す） */
export function invalidateMedia() {
  cache.clear();
  version++;
  for (const fn of listeners) fn();
}

class MediaError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

function load(key: string, url: string): Entry {
  const hit = cache.get(key);
  if (hit) return hit;
  const e: Entry = {
    promise: fetch(url)
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as MediaList & { error?: string };
        if (!r.ok) throw new MediaError(r.status, j.error ?? `写真を読めませんでした（${r.status}）`);
        e.result = j;
        return j;
      })
      .catch((err: unknown) => {
        e.error = err instanceof MediaError ? { status: err.status, message: err.message } : { status: 0, message: "通信できませんでした" };
        throw err;
      }),
  };
  e.promise.catch(() => {});
  cache.set(key, e);
  return e;
}

export function useMedia(opts: { trash?: boolean } = {}) {
  const { family, today, me } = useFamily();
  const v = useSyncExternalStore(subscribe, getVersion, getVersion);
  const key = `${family.id}|${opts.trash ? 1 : 0}|${me?.name ?? ""}|${today}`;
  const url = `/api/media?familyId=${encodeURIComponent(family.id)}&today=${today}${opts.trash ? "&trash=1" : ""}${me?.name ? `&by=${encodeURIComponent(me.name)}` : ""}`;
  const [state, setState] = useState<{ key: string; list: MediaList | null; error: { status: number; message: string } | null }>({ key: "", list: null, error: null });

  useEffect(() => {
    let alive = true;
    const e = load(key, url);
    if (e.result) setState({ key, list: e.result, error: null });
    else if (e.error) setState({ key, list: null, error: e.error });
    e.promise.then(
      (list) => alive && setState({ key, list, error: null }),
      () => alive && setState({ key, list: null, error: e.error ?? { status: 0, message: "写真を読めませんでした" } }),
    );
    return () => {
      alive = false;
    };
  }, [key, url, v]);

  const reload = useCallback(() => invalidateMedia(), []);
  const fresh = state.key === key;
  const error = fresh ? state.error : null;
  return {
    media: fresh ? (state.list?.media ?? []) : [],
    usage: fresh ? (state.list?.usage ?? null) : null,
    canWrite: fresh ? !!state.list?.canWrite : false,
    loading: !fresh || (!state.list && !state.error),
    /** 写真の仕組みが使えない（ログインの前・アカウントの表がまだ無い置き場） */
    unavailable: !!error && (error.status === 401 || error.status === 403 || error.status === 404 || error.status === 503),
    error: error?.message ?? "",
    reload,
  };
}

/** 写真1枚を直す（PATCH）。直したら一覧を読み直す */
export async function patchMedia(familyId: string, id: string, p: Record<string, unknown>): Promise<ClientMedia> {
  const r = await fetch(`/api/media/${encodeURIComponent(id)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ familyId, ...p }) });
  const j = (await r.json().catch(() => ({}))) as { media?: ClientMedia; error?: string };
  if (!r.ok || !j.media) throw new Error(j.error ?? `直せませんでした（${r.status}）`);
  invalidateMedia();
  return j.media;
}

/** ゴミ箱へ（purge でゴミ箱から今すぐ消す） */
export async function trashMedia(familyId: string, id: string, purge = false): Promise<void> {
  const r = await fetch(`/api/media/${encodeURIComponent(id)}?familyId=${encodeURIComponent(familyId)}${purge ? "&purge=1" : ""}`, { method: "DELETE" });
  const j = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(j.error ?? `消せませんでした（${r.status}）`);
  invalidateMedia();
}
