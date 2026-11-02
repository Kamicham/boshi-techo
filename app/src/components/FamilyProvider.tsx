"use client";

// どの家族の手帳を見ているか、と「今日」を全画面で共有する。
// デモの家族は時計を早送りでき、「わが家」は本当の今日で動く。
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEMO_FAMILY, type Family } from "@/lib/demo-family";
import { addDays, conceptionDate } from "@/lib/clock";

interface Ctx {
  family: Family;
  families: Family[];
  isDemo: boolean;
  /** 家族の一覧が届いたか（届くまでは一瞬デモの家族に見えるので、録音などは押せなくする） */
  ready: boolean;
  today: string;
  setToday: (d: string) => void;
  setFamilyId: (id: string) => void;
  reload: () => Promise<void>;
}

const FamilyCtx = createContext<Ctx | null>(null);

function realToday(): string {
  // 日本時間の暦日
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v);
  } catch {}
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [families, setFamilies] = useState<Family[]>([DEMO_FAMILY]);
  const [familyId, setFamilyIdState] = useState<string>(DEMO_FAMILY.id);
  const [ready, setReady] = useState(false);
  const [demoToday, setDemoToday] = useState<string>(addDays(conceptionDate(DEMO_FAMILY), 41));

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/family");
      if (r.ok) setFamilies(((await r.json()) as { families: Family[] }).families);
    } catch {
      // 電波が無い時はデモの家族のまま
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const id = read("boshi.family");
    const d = read("boshi.demoToday");
    if (id) setFamilyIdState(id);
    if (d) setDemoToday(d);
    void reload();
  }, [reload]);

  const family = families.find((f) => f.id === familyId) ?? DEMO_FAMILY;
  const isDemo = family.id === DEMO_FAMILY.id;
  const today = isDemo ? demoToday : realToday();

  const value: Ctx = {
    family,
    families,
    isDemo,
    ready,
    today,
    setToday: (d) => {
      if (!isDemo) return;
      setDemoToday(d);
      write("boshi.demoToday", d);
    },
    setFamilyId: (id) => {
      setFamilyIdState(id);
      write("boshi.family", id);
    },
    reload,
  };
  return <FamilyCtx.Provider value={value}>{children}</FamilyCtx.Provider>;
}

export function useFamily(): Ctx {
  const c = useContext(FamilyCtx);
  if (!c) throw new Error("FamilyProvider の外で useFamily が呼ばれました");
  return c;
}

/** API を JSON で呼ぶ小さな道具（エラーは日本語の文で投げる） */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url, {
      method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
      headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
      body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    // Safari は「Load failed」、Chrome は「Failed to fetch」と英語で出るので言い換える
    throw new Error("通信できませんでした。電波を確かめて、もう一度押してください");
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  if (!r.ok) throw new Error(j.error ?? `うまくいきませんでした（${r.status}）`);
  return j;
}
