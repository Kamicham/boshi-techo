"use client";

// ⑥ 家族が育てる地図: 一番上は「わが町の窓口」1つ。知恵は短く並べ、確かめた家族の数は札に、注意は「なぜ？」へ。
import { officeSearch } from "@/lib/local-place";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, useFamily } from "@/components/FamilyProvider";
import { jpDate } from "@/components/Techo";
import { Btn, CopyButton, Fold, HandoffRow, NextStep, Pill, Why } from "@/components/ui";
import type { Keep } from "@/lib/keep";
import { MILESTONES } from "@/lib/milestones";
import type { WisdomDoc } from "@/lib/wisdom";

/** 札にはやさしい言い方（正式な名前は下書き・調べ物の中で使う） */
const titleOf = (id: string | null) => (id ? (MILESTONES.find((m) => m.id === id)?.plain ?? null) : null);

/** 政令市は、手続きの窓口が区役所になる */
const WARD_CITIES = new Set(["札幌市", "仙台市", "さいたま市", "千葉市", "横浜市", "川崎市", "相模原市", "新潟市", "静岡市", "浜松市", "名古屋市", "京都市", "大阪市", "堺市", "神戸市", "岡山市", "広島市", "北九州市", "福岡市", "熊本市"]);

/** 町・村は「役場」、政令市は「区役所」、ほかの市・区は「役所」 */
const officeWord = (city: string) => (/[町村]$/.test(city) ? "役場" : WARD_CITIES.has(city) ? "区役所" : "役所");

/** 地図で探す言葉: 空白を入れず「県＋市＋役所」。覚えた窓口の名前に町の名前が無ければ、前に足す */
export default function MapPage() {
  const { family, today, isDemo } = useFamily();
  const [items, setItems] = useState<WisdomDoc[]>([]);
  const [keep, setKeep] = useState<Keep>({});
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
    setKeep({});
    api<{ keep: Keep }>(`/api/keep?familyId=${encodeURIComponent(family.id)}`)
      .then((r) => alive && setKeep(r.keep))
      .catch(() => {});
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
  }, [load, isDemo, family.id]);

  const send = async () => {
    setSending(true);
    setMsg("");
    setError("");
    try {
      const r = await api<{ added: WisdomDoc[] }>("/api/wisdom", { body: { familyId: family.id, text, today } });
      if (r.added.length === 0) {
        setMsg("ありがとうございます。今回は地図に足す事が見つかりませんでした");
      } else {
        setMsg(`${r.added.length}件を地図に足しました`);
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
      if (r.already) setMsg("もう確かめた事になっています");
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const used = useMemo(() => [...new Set(items.map((i) => i.data.milestoneId).filter((x): x is string => !!x))], [items]);
  const shown = filter ? items.filter((i) => i.data.milestoneId === filter) : items;
  const anyDemo = items.some((i) => i.data.demo);

  const ward = !keep.office?.name && WARD_CITIES.has(family.city);
  const office = keep.office?.name || (ward ? `${family.city}の住んでいる区の区役所` : `${family.city}${officeWord(family.city)}`);
  const place = officeSearch({ prefecture: family.prefecture, city: family.city, office: keep.office?.name, address: keep.office?.address });

  return (
    <main className="flex flex-col gap-4 px-4 pt-4">
      <h1 className="sr-only">{family.city}の窓口の知恵</h1>

      <NextStep eyebrow="わが町の窓口" title={office} sub={items.length ? `先に行った家族の知恵 ${items.length}件` : undefined} tone="sky">
        <HandoffRow place={place} />
        {!keep.office?.name && (
          <Btn kind="quiet" href="/settings">
            いつもの窓口を入れる
          </Btn>
        )}
        <div className="w-full">
          <Why>
            <p>ここの知恵は、先に行った家族が確かめた事です。</p>
            <p>制度の中身や期限は、窓口で確かめてください。</p>
            <p>名前や住所など、個人が分かる事は地図に入れません。</p>
          </Why>
        </div>
      </NextStep>

      {error && <p className="rounded-xl bg-alert/10 px-4 py-3 text-base text-alert">{error}</p>}
      {msg && (
        <p role="status" className="rounded-xl bg-ok/10 px-4 py-3 text-base text-ok">
          {msg}
        </p>
      )}

      {used.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1" aria-label="手続きで絞る">
          <button onClick={() => setFilter("")} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${!filter ? "border-rose text-rose" : "border-line text-muted"}`}>
            すべて
          </button>
          {used.map((id) => (
            <button key={id} onClick={() => setFilter(id)} className={`min-h-11 shrink-0 rounded-full border px-4 text-sm font-semibold ${filter === id ? "border-rose text-rose" : "border-line text-muted"}`}>
              {titleOf(id)}
            </button>
          ))}
        </div>
      )}

      <section aria-label="窓口の知恵" className="flex flex-col gap-3">
        {loading && <p className="text-base text-muted">読んでいます…</p>}
        {!loading && shown.length === 0 && <p className="text-base text-muted">まだありません。下から最初の一つを足せます</p>}
        {anyDemo && (
          <p>
            <Pill tone="sky">デモ用の例（実在の窓口ではありません）</Pill>
          </p>
        )}
        {shown.map((d) => {
          const w = d.data;
          const mine = w.confirmedBy.includes(family.id);
          return (
            <article key={d.id} className={`flex flex-col gap-2 rounded-2xl border bg-card p-4 ${fresh.has(d.id) ? "border-rose" : "border-line"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="rose">{w.place}</Pill>
                {titleOf(w.milestoneId) && <Pill>{titleOf(w.milestoneId)}</Pill>}
                {w.demo && <Pill tone="sky">デモ</Pill>}
              </div>
              <p className="text-base leading-relaxed">{w.tip}</p>
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="ok">
                  {w.confirmations}家族が確かめた・{jpDate(w.lastConfirmed)}
                </Pill>
                <span className="flex-1" />
                <CopyButton text={w.tip} />
                <button
                  onClick={() => void confirm(d.id)}
                  disabled={mine}
                  className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/20 bg-card px-4 text-sm font-semibold disabled:border-ok/40 disabled:text-ok"
                >
                  {mine ? "確かめました" : "私も確かめた"}
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <div className="pb-6">
        <Fold title="行ってみた話を足す">
          <label htmlFor="wisdom-text" className="text-base">
            持ち物・待ち時間・順番など、一言でも
          </label>
          <textarea
            id="wisdom-text"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="例: 出生届と児童手当を同じ日に出したら一回で済んだ"
            className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-base"
          />
          <Btn onClick={() => void send()} disabled={sending || text.trim().length < 5}>
            {sending ? "選んでいます…（10秒ほど）" : "地図に足す"}
          </Btn>
        </Fold>
      </div>
    </main>
  );
}
