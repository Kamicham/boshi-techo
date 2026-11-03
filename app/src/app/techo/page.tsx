"use client";

// 手帳: 国の母子健康手帳（府令様式）と同じページの並びで、家族の記録を見る。
// 妊娠 → 出産 → 新生児 → 成長 → 接種 → つなぐ、最後に「一冊（子どもへ）」。
// 約束: 体の判断はしない。数字・色・発達に良し悪しを言わない。手帳と同じ注意書きと相談先への橋だけ。
import { useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { Btn, Why } from "@/components/ui";
import { DevelopmentList } from "@/components/techo/DevelopmentList";
import { EntryCard } from "@/components/techo/EntryCard";
import { FeelingList } from "@/components/techo/FeelingList";
import { GrowthChart } from "@/components/techo/GrowthChart";
import { PendingBox } from "@/components/techo/PendingBox";
import { StoolCard } from "@/components/techo/StoolCard";
import { useTecho, type TechoItem } from "@/components/techo/useTecho";
import { VaccineList } from "@/components/techo/VaccineList";
import { CONSULT_QUESTION, TECHO_PAGES, type TechoPageId } from "@/lib/techo";

const PARTS: string[] = [...new Set(TECHO_PAGES.map((p) => p.part as string))];
const partId = (part: string) => `part-${PARTS.indexOf(part)}`;

/** 家族がその場で押す・書くページ（撮る・話すが無くても足せる） */
const DIRECT: TechoPageId[] = ["stool", "development", "feeling", "growth", "vaccine"];

export default function TechoPage() {
  const { family, today } = useFamily();
  const { items, loading, error, reload, confirm, add } = useTecho();
  const child = family.childName ?? "子ども";
  const pending = items.filter((i) => i.pending);
  const byPage = (id: TechoPageId) => items.filter((i) => i.page === id && !i.pending);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">手帳</h1>
        <p className="text-base text-muted">紙の母子手帳と同じ並びです。紙が正本のまま、撮る・話すだけで控えが積み上がります。</p>
        <nav aria-label="手帳の部" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2 whitespace-nowrap">
            {PARTS.map((part) => (
              <li key={part}>
                <a href={`#${partId(part)}`} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
                  {part}
                </a>
              </li>
            ))}
            <li>
              <a href="#book" className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold">
                一冊
              </a>
            </li>
          </ul>
        </nav>
      </header>

      {error && (
        <div className="flex flex-col gap-2 rounded-xl bg-alert/10 p-3">
          <p className="text-base text-alert">{error}</p>
          <Btn kind="secondary" onClick={() => void reload()}>
            もう一度読む
          </Btn>
        </div>
      )}
      {loading && <p className="text-base text-muted">手帳を開いています…</p>}

      <PendingBox items={pending} onConfirm={confirm} />

      {PARTS.map((part) => (
        <section key={part} id={partId(part)} className="flex scroll-mt-4 flex-col gap-3">
          <h2 className="font-display text-xl font-bold text-rose">{part}</h2>
          {TECHO_PAGES.filter((p) => p.part === part).map((p) => {
            const list = byPage(p.id);
            return (
              <article key={p.id} id={`page-${p.id}`} className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
                <div className="flex flex-col gap-1">
                  <h3 className="font-display text-lg font-bold">
                    {p.title}
                    {list.length > 0 && <span className="ml-2 text-sm font-normal text-muted">{list.length}件</span>}
                  </h3>
                  <p className="text-sm text-muted">{p.note}</p>
                </div>
                <PageBody id={p.id} list={list} today={today} add={add} />
                {(!DIRECT.includes(p.id) || p.id === "growth" || p.id === "vaccine") && list.length === 0 && <CaptureLinks page={p.id} />}
              </article>
            );
          })}
        </section>
      ))}

      <section id="book" className="flex scroll-mt-4 flex-col gap-3 rounded-2xl bg-rose-soft p-5">
        <h2 className="font-display text-xl font-bold">一冊（{child}へ）</h2>
        <p className="text-base">1000日の記録が、最後に{child}への一冊になります。</p>
        <Btn href="/book">一冊を開く</Btn>
      </section>
    </main>
  );
}

/** 記録の多いページは、新しい3件だけ出して、前の物は押すと出す */
const SHOWN = 3;
function RecentList({ list }: { list: TechoItem[] }) {
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, list.length - SHOWN);
  return (
    <div className="flex flex-col gap-2">
      {hidden > 0 && (
        <button type="button" onClick={() => setAll(true)} className="min-h-11 self-start text-sm text-muted underline">
          前の{hidden}件も見る
        </button>
      )}
      {list.slice(hidden).map((it) => (
        <EntryCard key={it.id} item={it} />
      ))}
    </div>
  );
}

function CaptureLinks({ page }: { page: TechoPageId }) {
  const q = `?techo=${page}`;
  return (
    <div className="flex flex-wrap gap-2">
      <Btn href={`/capture${q}`} kind="secondary">
        撮って足す
      </Btn>
      <Btn href={`/capture${q}`} kind="secondary">
        話して足す
      </Btn>
    </div>
  );
}

type Add = ReturnType<typeof useTecho>["add"];

function PageBody({ id, list, today, add }: { id: TechoPageId; list: TechoItem[]; today: string; add: Add }) {
  switch (id) {
    case "stool":
      return <StoolCard items={list} today={today} onAdd={(colorNo, date) => add({ page: "stool", date, title: `便の色 ${colorNo}番`, values: { colorNo } })} />;
    case "growth":
      return <GrowthChart items={list} onAdd={(values, date) => add({ page: "growth", date, title: "身長・体重など（紙から写した）", values })} />;
    case "development":
      return <DevelopmentList items={list} today={today} onAdd={(item, date) => add({ page: "development", date, title: item, values: { item } })} />;
    case "vaccine":
      return (
        <VaccineList
          items={list}
          today={today}
          onAdd={(v, date) =>
            add({ page: "vaccine", date, title: [v.vaccine, v.dose].filter(Boolean).join(" "), values: { vaccine: v.vaccine, dose: v.dose ?? null, lot: v.lot ?? null, facility: v.facility ?? null } })
          }
        />
      );
    case "feeling":
      return <FeelingList items={list} today={today} onAdd={(v, date) => add({ page: "feeling", date, title: "気持ち", who: v.who, values: { text: v.text } })} />;
    default:
      return (
        <>
          {id === "consult" && (
            <>
              <p className="text-base font-semibold">{CONSULT_QUESTION}</p>
              <Why label="相談できる所">
                <p>子どもの急な病気で迷う時: #8000（こども医療でんわ相談）</p>
                <p>命に関わりそうな時: 119</p>
                <p>妊娠中・産後の体の事: かかっている産院</p>
                <p>子育ての困りごと: 住んでいる町の保健センター・こども家庭センター</p>
              </Why>
              <div className="flex flex-wrap gap-2">
                <Btn href="/emergency" kind="secondary">
                  急ぎの時
                </Btn>
              </div>
            </>
          )}
          {list.length > 0 && <RecentList list={list} />}
        </>
      );
  }
}
