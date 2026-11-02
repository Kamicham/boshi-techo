"use client";

// どの家族の手帳を見ているか、と「今日」を全画面で共有する。
// デモの家族は時計を早送りでき、「わが家」は本当の今日で動く。
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEMO_FAMILY, type Family, type Member } from "@/lib/demo-family";
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
  /** この端末を使っている家族の一人（「わたしはママ／パパ」）。まだ選んでいなければ null */
  me: Member | null;
  setMeId: (id: string | null) => void;
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
  const [chosen, setChosen] = useState(false);
  const [meIds, setMeIds] = useState<Record<string, string>>({});
  const [demoToday, setDemoToday] = useState<string>(addDays(conceptionDate(DEMO_FAMILY), 41));

  const reload = useCallback(async () => {
    try {
      const r = await fetch("/api/family");
      if (r.ok) {
        const list = ((await r.json()) as { families: Family[] }).families;
        setFamilies(list);
        // まだ自分で選んでいない端末は、わが家があればわが家から開く（デモは選んだ人だけ）
        if (list.some((f) => f.id === "mine")) setFamilyIdState((cur) => (read("boshi.family") ? cur : "mine"));
      }
    } catch {
      // 電波が無い時はデモの家族のまま
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    const id = read("boshi.family");
    const d = read("boshi.demoToday");
    const me = read("boshi.me");
    if (id) {
      setFamilyIdState(id);
      setChosen(true);
    }
    if (me) {
      try {
        setMeIds(JSON.parse(me) as Record<string, string>);
      } catch {}
    }
    if (d) setDemoToday(d);
    void reload();
  }, [reload]);

  const family = families.find((f) => f.id === familyId) ?? DEMO_FAMILY;
  const isDemo = family.id === DEMO_FAMILY.id;
  // デモとシミュレーションの家族だけ、時計を進められる
  const timeTravel = isDemo || family.id.startsWith("sim-");
  const today = timeTravel ? demoToday : realToday();
  const me = family.members.find((m) => m.id === meIds[family.id]) ?? null;
  void chosen;

  const value: Ctx = {
    family,
    families,
    isDemo,
    ready,
    today,
    setToday: (d) => {
      if (!timeTravel) return;
      setDemoToday(d);
      write("boshi.demoToday", d);
    },
    setFamilyId: (id) => {
      setFamilyIdState(id);
      setChosen(true);
      write("boshi.family", id);
    },
    reload,
    me,
    setMeId: (id) => {
      const next = { ...meIds };
      if (id) next[family.id] = id;
      else delete next[family.id];
      setMeIds(next);
      write("boshi.me", JSON.stringify(next));
    },
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
