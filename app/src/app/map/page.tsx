"use client";

// ⑥ 家族が育てる地図: 町の「窓口の知恵」。ある家族が確かめた事が、次の家族へ。
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { MILESTONES } from "@/lib/milestones";
import type { WisdomDoc } from "@/lib/wisdom";

const titleOf = (id: string | null) => (id ? MILESTONES.find((m) => m.id === id)?.title ?? null : null);

export default function MapPage() {
  const { family, today, isDemo } = useFamily();
  const [items, setItems] = useState<WisdomDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [fresh, setFresh] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const r = await api<{ items: WisdomDoc[] }>(`/api/wisdom?familyId=${encodeURIComponent(family.id)}`);
    return r.items;
  }, [family.id]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError("");
    (async () => {
      try {
        let got = await load();
        // デモの町は、空なら作った例を入れておく（何度呼んでも重複しない）
        if (isDemo && got.length === 0) {
          await api("/api/wisdom/seed", { method: "POST" });
          got = await load();
        }
        if (alive) setItems(got);
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [load, isDemo]);

  const send = async () => {
    setSending(true);
    setMsg("");
    setError("");
    try {
      const r = await api<{ added: WisdomDoc[] }>("/api/wisdom", { body: { familyId: family.id, text, today } });
      if (r.added.length === 0) {
        setMsg("ありがとうございます。今回の話からは、次の家族に渡せる知恵は見つかりませんでした。");
      } else {
        setMsg(`${r.added.length}件の知恵を${family.city}の地図に足しました。名前など個人が分かる事は入れていません。`);
        setText("");
        setFresh(new Set(r.added.map((d) => d.id)));
        setItems(await load());
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  const confirm = async (id: string) => {
    setError("");
    try {
      const r = await api<{ item: WisdomDoc; already: boolean }>("/api/wisdom", { method: "PATCH", body: { familyId: family.id, id, today } });
      setItems((xs) => xs.map((x) => (x.id === id ? r.item : x)));
      if (r.already) setMsg("この手帳では、もう確かめた事になっています。");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const used = useMemo(() => [...new Set(items.map((i) => i.data.milestoneId).filter((x): x is string => !!x))], [items]);
  const shown = filter ? items.filter((i) => i.data.milestoneId === filter) : items;
  const anyDemo = items.some((i) => i.data.demo);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-semibold tracking-widest text-rose">家族が育てる地図</p>
        <h1 className="font-display text-2xl font-bold">{family.city}の窓口の知恵</h1>
        <p className="text-sm text-muted">先に行った家族が確かめた事です。制度の中身や期限は、窓口で確かめてください。</p>
      </header>

      {anyDemo && (
        <p className="rounded-lg bg-sky-soft px-3 py-2 text-xs font-semibold text-sky">
          デモ用の例（実在の窓口の情報ではありません）が入っています。
        </p>
      )}

      <section className="flex flex-col gap-2 rounded-xl border border-line bg-card p-4">
        <label htmlFor="wisdom-text" className="font-display font-bold">行ってみてどうだった？</label>
        <p className="text-xs text-muted">持ち物・待ち時間・順番など、次の家族に役立ちそうな事を一言でも。名前や住所は書かなくて大丈夫です。</p>
        <textarea
          id="wisdom-text"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例: 出生届と児童手当を同じ日に出したら一回で済んだ。口座の分かる物を忘れて出直した。"
          className="w-full rounded-lg border border-line bg-paper px-3 py-2 text-sm"
        />
        <button
          onClick={send}
          disabled={sending || text.trim().length < 5}
          className="self-start rounded-lg bg-rose px-5 py-2 font-semibold text-white disabled:opacity-50"
        >
          {sending ? "知恵を抜き出しています…" : "地図に足す"}
        </button>
        {sending && <p aria-live="polite" className="text-xs text-muted">話の中から、次の家族に渡せる事だけを選んでいます（10秒ほど）。</p>}
        {msg && <p className="text-sm text-ok">{msg}</p>}
      </section>

      {error && <p className="rounded-lg bg-alert/10 px-3 py-2 text-sm text-alert">{error}</p>}

      {used.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 text-xs" aria-label="手続きで絞る">
          <button onClick={() => setFilter("")} className={`shrink-0 rounded-full border px-3 py-1 ${!filter ? "border-rose text-rose" : "border-line text-muted"}`}>
            すべて
          </button>
          {used.map((id) => (
            <button key={id} onClick={() => setFilter(id)} className={`shrink-0 rounded-full border px-3 py-1 ${filter === id ? "border-rose text-rose" : "border-line text-muted"}`}>
              {titleOf(id)}
            </button>
          ))}
        </div>
      )}

      <section className="flex flex-col gap-3 pb-6">
        {loading && <p className="text-sm text-muted">{family.city}の知恵を読んでいます…</p>}
        {!loading && shown.length === 0 && <p className="text-sm text-muted">まだ知恵はありません。最初の一つを足してみませんか。</p>}
        {shown.map((d) => {
          const w = d.data;
          const mine = w.confirmedBy.includes(family.id);
          return (
            <article key={d.id} className={`flex flex-col gap-2 rounded-xl border bg-card p-4 ${fresh.has(d.id) ? "border-rose" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-full bg-rose-soft px-2 py-0.5 font-semibold text-rose">{w.place}</span>
                {titleOf(w.milestoneId) && <span className="text-muted">{titleOf(w.milestoneId)}</span>}
                {w.demo && <span className="rounded-full bg-sky-soft px-2 py-0.5 text-sky">デモ用の例</span>}
              </div>
              <p className="leading-relaxed">{w.tip}</p>
              <div className="flex items-center justify-between gap-2">
                <span className="tabular text-xs text-muted">
                  {w.confirmations}家族が確かめた・最後は{jpDate(w.lastConfirmed)}
                </span>
                <button
                  onClick={() => confirm(d.id)}
                  disabled={mine}
                  className="shrink-0 rounded-lg border border-line px-3 py-1 text-xs font-semibold disabled:text-ok"
                >
                  {mine ? "確かめました" : "私も確かめた"}
                </button>
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
