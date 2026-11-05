"use client";

// どの家族の手帳を見ているか、と「今日」を全画面で共有する。
// デモの家族は時計を早送りでき、「わが家」は本当の今日で動く。
// 家族の一覧:
// - アカウントの仕組みが動く置き場（/api/account が enabled）: ログインした人の世帯＋公開の世帯（デモ・シミュレーションの作った家族）
// - 動かない置き場（今のわが家の本番）: 今までどおり /api/family
// 端末の控え（一覧・使う人）はアカウントごとの名前で持ち、ログアウトで消す。ログインしていない時は今までの名前（boshi.families・boshi.me）
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { DEMO_FAMILY, type Family, type Member } from "@/lib/demo-family";
import { t } from "@/lib/i18n";
import { Btn } from "./ui";
import { demoFirstDay } from "./today/stages";

export type AccountInfo = { id: string; email: string; name: string };
export type HouseholdInfo = {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
  kind: "real" | "demo" | "sim";
  /** 家族の設定（予定日・町）を入れたか。入れていない世帯は families に入らない */
  hasProfile: boolean;
  /** はじめの「記録を残す同意」がまだの本人がいる */
  needsRecordConsent: boolean;
  /** ログインした人に結んだ本人（母・パートナー）。設定で選んでいない時の「わたし」になる */
  me?: { kind: "mother" | "partner" | "child"; name: string } | null;
};
type AccountList = {
  enabled: boolean;
  account?: AccountInfo | null;
  households?: HouseholdInfo[];
  families?: Family[];
  kinds?: Record<string, "real" | "demo" | "sim">;
};

interface Ctx {
  family: Family;
  families: Family[];
  isDemo: boolean;
  /** 家族の一覧が届いたか（届くまでは一瞬デモの家族に見えるので、録音などは押せなくする） */
  ready: boolean;
  today: string;
  /** 作った家族（見本・シミュレーション・体験の写し）か。時計を進められ、家族の設定は保存しない */
  timeTravel: boolean;
  setToday: (d: string) => void;
  setFamilyId: (id: string) => void;
  reload: () => Promise<void>;
  /** この端末を使っている家族の一人。設定で選んだ人、選んでいなければ母（家族に人がいなければ null） */
  me: Member | null;
  setMeId: (id: string | null) => void;
  /** アカウントの仕組みが、このサーバで動くか（動かない時はログインの入口を出さない） */
  accountsEnabled: boolean;
  /** ログインした人（していなければ null） */
  account: AccountInfo | null;
  /** ログインした人が入っている世帯（家族の設定がまだの世帯も含む） */
  households: HouseholdInfo[];
  /** その家族が、ログインした人の世帯か（公開の作った家族・わが家の古い形は false） */
  isHousehold: (id: string) => boolean;
  /** ログアウト（この端末の控えも消す） */
  signOut: () => Promise<void>;
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

function drop(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {}
}

/** 最後に読めた家族の一覧（この端末だけ）。電波が無い時・サーバが一瞬つまずいた時に、デモへ落とさずこれで開く */
const CACHE_KEY = "boshi.families";
/** 最後にこの端末でログインしていた人（控えの名前を選ぶ） */
const ACCOUNT_KEY = "boshi.account";
const cacheKey = (acct: string) => (acct ? `${CACHE_KEY}:${acct}` : CACHE_KEY);
const meKey = (acct: string) => (acct ? `boshi.me:${acct}` : "boshi.me");
function readCache(acct: string): Family[] {
  try {
    const v = JSON.parse(read(cacheKey(acct)) ?? "[]") as Family[];
    return Array.isArray(v) ? v.filter((f) => f && typeof f.id === "string" && f.id !== DEMO_FAMILY.id) : [];
  } catch {
    return [];
  }
}
/** デモの家族は固定なので、いつもコードの物を使う（古い形が残らないように） */
const withDemo = (list: Family[]) => [...list.filter((f) => f.id !== DEMO_FAMILY.id), DEMO_FAMILY];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** わが家の手帳が読めなかった時の画面: 空のまま、読み直す事と急ぎの時だけ（合言葉・ログインが切れた時は、ページを読み直して入り口へ） */
function LostNotebook({ retry }: { retry: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const again = async () => {
    setBusy(true);
    try {
      await retry();
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 px-4 pb-16">
      <div role="alert" className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-snug font-bold">手帳を読めませんでした</h1>
        <p className="text-base">記録は消えていません。電波のある所で、もう一度読んでください。</p>
      </div>
      <Btn onClick={() => void again()} disabled={busy} full>
        {busy ? "読んでいます…" : "もう一度読む"}
      </Btn>
      <a href="/emergency" className="inline-flex min-h-11 items-center self-start text-base font-semibold text-alert underline-offset-2 hover:underline">
        急ぎの時 ›
      </a>
    </main>
  );
}

export function FamilyProvider({ children }: { children: React.ReactNode }) {
  const [families, setFamilies] = useState<Family[]>([DEMO_FAMILY]);
  const [familyId, setFamilyIdState] = useState<string>(DEMO_FAMILY.id);
  const [ready, setReady] = useState(false);
  // 何度か読み直しても家族の一覧が届かなかった（覚えた一覧も無い）。auth = 合言葉・ログインが切れていた（401）
  const [lost, setLost] = useState<false | "net" | "auth">(false);
  const [meIds, setMeIds] = useState<Record<string, string>>({});
  // 札を選ぶ前に見本を開いた時の日は、入口の時期の一覧の最初の札（妊娠8週0日）と同じ日（UX の見直し C36。前は7週6日で一覧とずれた）
  const [demoToday, setDemoToday] = useState<string>(demoFirstDay(DEMO_FAMILY));
  const [accountsEnabled, setAccountsEnabled] = useState(false);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [households, setHouseholds] = useState<HouseholdInfo[]>([]);
  const [kinds, setKinds] = useState<Record<string, "real" | "demo" | "sim">>({});

  /** 端末の控えを、いまログインしている人の物に切り替える（人が変わったら前の人の控えを消す） */
  const switchAccount = useCallback((acct: string) => {
    const prev = read(ACCOUNT_KEY) ?? "";
    if (prev === acct) return;
    if (prev) {
      drop(cacheKey(prev));
      drop(meKey(prev));
    }
    // 前の人が選んでいた世帯を、次の人の画面で開かない
    drop("boshi.family");
    setFamilyIdState(DEMO_FAMILY.id);
    write(ACCOUNT_KEY, acct);
    try {
      setMeIds(JSON.parse(read(meKey(acct)) ?? "{}") as Record<string, string>);
    } catch {
      setMeIds({});
    }
  }, []);

  /** 一覧を受け取った後: 控えに書き、まだ自分で選んでいない端末は自分の世帯（無ければわが家）から開く */
  const accept = useCallback((list: Family[], acct: string, own: string[]) => {
    setFamilies(withDemo(list));
    write(cacheKey(acct), JSON.stringify(list.filter((f) => f.id !== DEMO_FAMILY.id)));
    setLost(false);
    const first = own.find((id) => list.some((f) => f.id === id)) ?? (list.some((f) => f.id === "mine") ? "mine" : null);
    if (first) setFamilyIdState((cur) => (read("boshi.family") ? cur : first));
    setReady(true);
  }, []);

  const reload = useCallback(async () => {
    const saved = read("boshi.family") ?? "";
    let denied = false;
    // サーバが一瞬つまずいても（開発中の作り直し・電波の切れ目）、すぐデモに落とさず3回まで読み直す
    for (let i = 0; i < 3; i++) {
      try {
        const ra = await fetch(`/api/account?id=${encodeURIComponent(saved)}`);
        // 合言葉の前（401）は読み直しても同じ
        if (ra.status === 401) {
          denied = true;
          break;
        }
        // /api/account が無い古いサーバ（404）は、アカウントの仕組みが動かない置き場と同じに扱う
        const ja = ra.ok ? ((await ra.json()) as AccountList) : ra.status === 404 ? { enabled: false } : null;
        if (ja?.enabled) {
          const acct = ja.account?.id ?? "";
          switchAccount(acct);
          setAccountsEnabled(true);
          setAccount(ja.account ?? null);
          setHouseholds(ja.households ?? []);
          setKinds(ja.kinds ?? {});
          accept(ja.families ?? [], acct, (ja.households ?? []).map((h) => h.id));
          return;
        }
        if (ja && !ja.enabled) {
          // アカウントの仕組みが動かない置き場: 今までどおり
          setAccountsEnabled(false);
          setAccount(null);
          setHouseholds([]);
          setKinds({});
          switchAccount("");
          const r = await fetch(`/api/family?id=${encodeURIComponent(saved)}`);
          if (r.status === 401) {
            denied = true;
            break;
          }
          if (r.ok) {
            accept(((await r.json()) as { families: Family[] }).families, "", []);
            return;
          }
        }
      } catch {
        // 電波が無い・サーバが作り直し中
      }
      await sleep(600 * (i + 1));
    }
    // 届かなかった: 覚えた一覧にその家族があれば、それで開く。無ければデモの家族に切り替えず、読めなかった事だけを出す
    const cached = readCache(read(ACCOUNT_KEY) ?? "");
    if (!cached.some((f) => f.id === saved) && saved && saved !== DEMO_FAMILY.id) setLost(denied ? "auth" : "net");
    setReady(true);
  }, [accept, switchAccount]);

  useEffect(() => {
    const acct = read(ACCOUNT_KEY) ?? "";
    const id = read("boshi.family");
    const d = read("boshi.demoToday");
    const me = read(meKey(acct));
    const cached = readCache(acct);
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

  const signOut = useCallback(async () => {
    const acct = read(ACCOUNT_KEY) ?? "";
    try {
      await fetch("/api/auth/sign-out", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
    } catch {}
    // この端末の控えを消す（次に使う人に、前の人の世帯の名前や一覧が見えないように）
    drop(cacheKey(acct));
    drop(meKey(acct));
    drop("boshi.family");
    write(ACCOUNT_KEY, "");
    setAccount(null);
    setHouseholds([]);
    setFamilyIdState(DEMO_FAMILY.id);
    setFamilies([DEMO_FAMILY]);
    await reload();
  }, [reload]);

  // 選んだ家族が一覧に無い時だけデモ（読み込み中は ready を待つので、ここには来ない）
  const family = families.find((f) => f.id === familyId) ?? DEMO_FAMILY;
  const isDemo = family.id === DEMO_FAMILY.id;
  // デモとシミュレーションの家族だけ、時計を進められる（世帯の種類が分かればそれで、古い置き場では id で）
  const kind = kinds[family.id];
  const timeTravel = kind ? kind !== "real" : isDemo || family.id.startsWith("sim-") || family.id.startsWith("pop-");
  const today = timeTravel ? demoToday : realToday();
  // 設定で選んだ人。
  // 選んでいなければ、ログインした人に結んだ本人（母・パートナー）、それも無ければ母（いなければ最初の人）
  const linked = households.find((h) => h.id === family.id)?.me;
  const linkedRole = linked?.kind === "mother" ? "母" : linked?.kind === "partner" ? "パートナー" : null;
  const linkedMember = linkedRole
    ? (family.members.find((m) => m.role === linkedRole && m.name === linked?.name) ?? family.members.find((m) => m.role === linkedRole))
    : undefined;
  const me =
    family.members.find((m) => m.id === meIds[family.id]) ?? linkedMember ?? family.members.find((m) => m.role === "母") ?? family.members[0] ?? null;

  const value: Ctx = {
    family,
    families,
    isDemo,
    ready,
    today,
    timeTravel,
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
      write(meKey(account?.id ?? ""), JSON.stringify(next));
    },
    accountsEnabled,
    account,
    households,
    isHousehold: (id) => households.some((h) => h.id === id),
    signOut,
  };
  return (
    <FamilyCtx.Provider value={value}>
      {/* 端末の記憶と家族の一覧を読むまでは、枠も描かない（上の切り替えに、デモの家族の名前が一瞬出ないように） */}
      {ready ? (
        lost ? (
          // わが家の手帳が読めない時に、デモの家族を出さない（わが家の記録が消えたように見え、デモの家族に書き込んでしまう）
          <LostNotebook retry={lost === "auth" ? async () => location.reload() : reload} />
        ) : (
          children
        )
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

/** API の失敗。status は HTTP の番号（通信できない時は 0） */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/** 押し直しても変わらない失敗か（503＝見本や上限で調べない・401/403＝入れない）。「もう一度」を出さない */
export function settledError(e: unknown): boolean {
  return e instanceof ApiError && [401, 403, 503].includes(e.status);
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
    throw new ApiError(t("通信できませんでした。電波を確かめて、もう一度押してください"), 0);
  }
  const j = (await r.json().catch(() => ({}))) as T & { error?: string };
  // サーバの断り（j.error）は、route() が頼みの言葉で訳して返す
  if (!r.ok) throw new ApiError(j.error ?? t("うまくいきませんでした（{status}）", { status: r.status }), r.status);
  return j;
}
