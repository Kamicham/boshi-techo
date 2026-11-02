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

/** 最後に読めた家族の一覧（この端末だけ）。電波が無い時・サーバが一瞬つまずいた時に、デモへ落とさずこれで開く */
const CACHE_KEY = "boshi.families";
function readCache(): Family[] {
  try {
    const v = JSON.parse(read(CACHE_KEY) ?? "[]") as Family[];
    return Array.isArray(v) ? v.filter((f) => f && typeof f.id === "string" && f.id !== DEMO_FAMILY.id) : [];
  } catch {
    return [];
  }
}
/** デモの家族は固定なので、いつもコードの物を使う（古い形が残らないように） */
const withDemo = (list: Family[]) => [...list.filter((f) => f.id !== DEMO_FAMILY.id), DEMO_FAMILY];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [families, setFamilies] = useState<Family[]>([DEMO_FAMILY]);
  const [familyId, setFamilyIdState] = useState<string>(DEMO_FAMILY.id);
  const [ready, setReady] = useState(false);
  // 何度か読み直しても家族の一覧が届かなかった（覚えた一覧も無い）
  const [lost, setLost] = useState(false);
  const [meIds, setMeIds] = useState<Record<string, string>>({});
  const [demoToday, setDemoToday] = useState<string>(addDays(conceptionDate(DEMO_FAMILY), 41));

  const reload = useCallback(async () => {
    const saved = read("boshi.family") ?? "";
    // サーバが一瞬つまずいても（開発中の作り直し・電波の切れ目）、すぐデモに落とさず3回まで読み直す
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(`/api/family?id=${encodeURIComponent(saved)}`);
        // 合言葉の前（401）は読み直しても同じ
        if (r.status === 401) break;
        if (r.ok) {
          const list = ((await r.json()) as { families: Family[] }).families;
          setFamilies(withDemo(list));
          write(CACHE_KEY, JSON.stringify(list.filter((f) => f.id !== DEMO_FAMILY.id)));
          setLost(false);
          // まだ自分で選んでいない端末は、わが家があればわが家から開く（デモは選んだ人だけ）
          if (list.some((f) => f.id === "mine")) setFamilyIdState((cur) => (read("boshi.family") ? cur : "mine"));
          setReady(true);
          return;
        }
      } catch {
        // 電波が無い・サーバが作り直し中
      }
      await sleep(600 * (i + 1));
    }
    // 届かなかった: 覚えた一覧にその家族があれば、それで開く。無ければデモのまま知らせる
    const cached = readCache();
    if (!cached.some((f) => f.id === saved) && saved && saved !== DEMO_FAMILY.id) setLost(true);
    setReady(true);
  }, []);

  useEffect(() => {
    const id = read("boshi.family");
    const d = read("boshi.demoToday");
    const me = read("boshi.me");
    const cached = readCache();
    if (cached.length) setFamilies(withDemo(cached));
    if (id) setFamilyIdState(id);
    // 覚えた一覧にその家族があれば、読み直しを待たずに開く（わが家の人にデモが見えない）
    if (id && cached.some((f) => f.id === id)) setReady(true);
    if (me) {
      try {
        setMeIds(JSON.parse(me) as Record<string, string>);
      } catch {}
    }
    if (d) setDemoToday(d);
    void reload();
  }, [reload]);

  // 選んだ家族が一覧に無い時だけデモ（読み込み中は ready を待つので、ここには来ない）
  const family = families.find((f) => f.id === familyId) ?? DEMO_FAMILY;
  const isDemo = family.id === DEMO_FAMILY.id;
  // デモとシミュレーションの家族だけ、時計を進められる
  const timeTravel = isDemo || family.id.startsWith("sim-") || family.id.startsWith("pop-");
  const today = timeTravel ? demoToday : realToday();
  const me = family.members.find((m) => m.id === meIds[family.id]) ?? null;

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
  return (
    <FamilyCtx.Provider value={value}>
      {/* 端末の記憶と家族の一覧を読むまでは、枠も描かない（上の切り替えに、デモの家族の名前が一瞬出ないように） */}
      {ready ? (
        <>
          {lost && (
            <p role="alert" className="mx-auto flex max-w-md flex-wrap items-center justify-between gap-2 bg-alert/10 px-4 py-2 text-base text-alert">
              <span>手帳を読めませんでした。いまはデモの家族を出しています</span>
              <button type="button" onClick={() => void reload()} className="min-h-11 font-semibold underline underline-offset-2">
                もう一度読む
              </button>
            </p>
          )}
          {children}
        </>
      ) : (
        <div className="mx-auto min-h-dvh max-w-md px-4 pt-16" aria-hidden>
          <div className="h-40 rounded-2xl bg-rose-soft/60" />
        </div>
      )}
    </FamilyCtx.Provider>
  );
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
