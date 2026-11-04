"use client";

// 手帳: 国の母子健康手帳（府令様式）と同じページの並びで、家族の記録を見る。
// 妊娠 → 出産 → 新生児 → 成長 → 接種 → つなぐ、最後に「一冊（子どもへ）」。
// 約束: 体の判断はしない。数字・色・発達に良し悪しを言わない。手帳と同じ注意書きと相談先への橋だけ。
// 並びは国の様式のまま。開いた時は子の今の時期の部まで送り、過ぎた時期のページは畳む（開けば見られる。記録は消さない）。
// UX 2026-11-04: 妊娠中は、まだ先の部（出産・新生児・成長・接種）を1行の「これから」に畳む（11週の人に便色カードまで並んでいた）。
// 空の欄ごとの「撮って足す・話して足す」は、上の［撮る・話す］と、欄ごとの「いつ・何を撮ると入るか」1行と、
// 紙の欄の名前のまま手で入れる［入力する］にした（作り手の家族の声「撮ると話す、項目も欲しい」）。
import { useEffect, useRef, useState } from "react";
import { useFamily } from "@/components/FamilyProvider";
import { HelpPlaces } from "@/components/today/HelpPlaces";
import { Btn, Notice } from "@/components/ui";
import { DevelopmentList } from "@/components/techo/DevelopmentList";
import { EntryCard } from "@/components/techo/EntryCard";
import { EntryForm } from "@/components/techo/EntryForm";
import { FeelingList } from "@/components/techo/FeelingList";
import { GrowthChart } from "@/components/techo/GrowthChart";
import { PendingBox } from "@/components/techo/PendingBox";
import { StoolCard } from "@/components/techo/StoolCard";
import { useTecho, type TechoItem } from "@/components/techo/useTecho";
import { VaccineList } from "@/components/techo/VaccineList";
import { diffDays } from "@/lib/clock";
import { CONSULT_QUESTION, TECHO_PAGES, type TechoPageId } from "@/lib/techo";

const PARTS: string[] = [...new Set(TECHO_PAGES.map((p) => p.part as string))];
const partId = (part: string) => `part-${PARTS.indexOf(part)}`;
/** 部の見せる名前（様式の「つなぐ」は、中身が相談先なのでそう呼ぶ） */
const partLabel = (part: string) => (part === "つなぐ" ? "相談先" : part);

/** 空の欄に出す「いつ・何を撮ると入るか」（紙の手帳のどの欄を、どの日に撮るか） */
const WHEN: Partial<Record<TechoPageId, string>> = {
  "mother-health":
    "紙の手帳のこのページ（自分で書く欄）を撮るか、話すと入ります",
  "pregnancy-checkup": "健診の日に、先生が書いた欄を撮ると入ります",
  "pregnancy-test": "検査の結果が書かれたら、その欄を撮ると入ります",
  birth: "退院の前に、病院が書いた出産の欄を撮ると入ります",
  postpartum: "産後の健診の日に、その欄を撮るか、話すと入ります",
  newborn: "退院の前に、病院が書いた新生児の欄を撮ると入ります",
  growth: "健診で測った日に、身長・体重の欄を撮っても入ります",
  "child-checkup": "健診の日に、先生が書いた欄を撮ると入ります",
  vaccine: "接種の日に、シールが貼られた欄を撮っても入ります",
};

/** 生後何日を過ぎたら新生児の時期を「過ぎた」とするか（便色カードは生後1か月ごろまでの物＝手帳の説明。余裕を見て2か月） */
const NEWBORN_PAST_DAYS = 60;

/**
 * 子の今の時期（開いた時に送る部）と、過ぎた時期のページ。
 * - 生まれる前: 妊娠の部。過ぎたページは無い
 * - 生まれて1か月（28日）まで: 新生児の部。妊娠のページ（気持ちの記録を除く）は過ぎた時期
 * - それ以降: 成長の部。生後2か月を過ぎたら、新生児の記録・便色カードも過ぎた時期
 * 気持ちの記録は誕生日のメッセージなど生まれた後も書くので畳まない。
 */
function periodOf(
  birthDate: string | undefined,
  today: string,
): { part: string; past: Set<TechoPageId>; later: Set<string> } {
  const ageDays = birthDate ? diffDays(today, birthDate) : -1;
  // 妊娠中は、出産から接種までがまだ先（相談先はいつでも）
  if (ageDays < 0)
    return {
      part: "妊娠",
      past: new Set(),
      later: new Set(["出産", "新生児", "成長", "接種"]),
    };
  const past = new Set<TechoPageId>([
    "mother-health",
    "pregnancy-checkup",
    "pregnancy-test",
  ]);
  if (ageDays > NEWBORN_PAST_DAYS) {
    past.add("newborn");
    past.add("stool");
  }
  return { part: ageDays <= 28 ? "新生児" : "成長", past, later: new Set() };
}

export default function TechoPage() {
  const { family, today } = useFamily();
  const { items, loading, error, reload, confirm, add, remove } = useTecho();
  const child = family.childName ?? "子ども";
  const pending = items.filter((i) => i.pending);
  const byPage = (id: TechoPageId) =>
    items.filter((i) => i.page === id && !i.pending);
  const confirmed = items.filter((i) => !i.pending);
  const period = periodOf(family.birthDate, today);
  // まだ先の部でも、記録がもうある部は畳まない
  const later = PARTS.filter(
    (part) =>
      period.later.has(part) &&
      !TECHO_PAGES.some((p) => p.part === part && byPage(p.id).length > 0),
  );
  const shown = PARTS.filter((part) => !later.includes(part));

  // 開いた時（ハッシュが無い時）は、今の時期の部まで送る。OK を待つ候補がある時は、それを先に見せるため上のまま。
  // ハッシュがある時は、畳んだページの中でも開いてそこへ送る。
  const sent = useRef(false);
  useEffect(() => {
    if (loading || sent.current) return;
    sent.current = true;
    const hash = decodeURIComponent(window.location.hash.slice(1));
    requestAnimationFrame(() => {
      if (hash) {
        const el = document.getElementById(hash);
        const fold = el?.closest("details");
        if (fold && !fold.open) fold.open = true;
        el?.scrollIntoView({ block: "start" });
        return;
      }
      if (pending.length > 0 || period.part === PARTS[0]) return;
      document
        .getElementById(partId(period.part))
        ?.scrollIntoView({ block: "start" });
    });
  }, [loading, pending.length, period.part]);

  return (
    <main className="flex flex-col gap-5 px-4 pt-4">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-2xl font-bold">手帳</h1>
        <p className="text-base">
          紙の母子手帳の中身を、スマホにも写しておく所。健診の紙を撮るか、話すと、ここに入ります。
        </p>
        <Btn href="/capture">撮る・話す</Btn>
        <nav aria-label="手帳の部" className="-mx-4 overflow-x-auto px-4">
          <ul className="flex gap-2 whitespace-nowrap">
            {shown.map((part) => (
              <li key={part}>
                <a
                  href={`#${partId(part)}`}
                  aria-current={part === period.part ? "true" : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold ${part === period.part ? "border-rose bg-rose-soft text-rose" : "border-line bg-card"}`}
                >
                  {partLabel(part)}
                  {part === period.part && "（今）"}
                </a>
              </li>
            ))}
            {later.length > 0 && (
              <li>
                <a
                  href="#later"
                  className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
                >
                  これから
                </a>
              </li>
            )}
            <li>
              <a
                href="#book"
                className="inline-flex min-h-11 items-center rounded-full border border-line bg-card px-4 text-sm font-semibold"
              >
                一冊
              </a>
            </li>
          </ul>
        </nav>
      </header>

      {error && (
        <Notice
          title="手帳を開けませんでした"
          safe="記録は消えていません。電波のよい所で、もう一度読んでください。"
          detail={error}
        >
          <Btn kind="secondary" onClick={() => void reload()}>
            もう一度読む
          </Btn>
        </Notice>
      )}
      {loading && <p className="text-base text-muted">手帳を開いています…</p>}

      <PendingBox items={pending} onConfirm={confirm} onRemove={remove} />

      {shown.map((part) => renderPart(part))}

      {later.length > 0 && (
        <details
          id="later"
          className="group scroll-mt-4 rounded-2xl border border-line bg-card"
        >
          <summary className="flex min-h-11 cursor-pointer list-none flex-col gap-0.5 p-4 [&::-webkit-details-marker]:hidden">
            <span className="font-display text-lg font-bold">
              これから: {later.map(partLabel).join("・")}
            </span>
            <span className="text-sm text-muted">
              その時期が来たら、ここに開きます。
            </span>
            <span className="text-sm text-muted underline group-open:hidden">
              先に見ておく
            </span>
          </summary>
          <div className="flex flex-col gap-5 px-4 pb-4">
            {later.map((part) => renderPart(part))}
          </div>
        </details>
      )}

      <section
        id="book"
        className="flex scroll-mt-4 flex-col gap-3 rounded-2xl bg-rose-soft p-5"
      >
        <h2 className="font-display text-xl font-bold">一冊（{child}へ）</h2>
        <p className="text-base">
          1000日の記録が、最後に{child}への一冊になります。
        </p>
        <Btn href="/book">一冊を開く</Btn>
      </section>
    </main>
  );

  function renderPart(part: string) {
    return (
      <section
        key={part}
        id={partId(part)}
        className="flex scroll-mt-4 flex-col gap-3"
      >
        <h2 className="font-display text-xl font-bold text-rose">
          {partLabel(part)}
        </h2>
        {TECHO_PAGES.filter((p) => p.part === part).map((p) => {
          const list = byPage(p.id);
          // 空の欄は、説明の代わりに「いつ・何を撮ると入るか」を1行
          const when = list.length === 0 ? WHEN[p.id] : undefined;
          const body = (
            <PageBody
              id={p.id}
              list={list}
              all={confirmed}
              today={today}
              add={add}
              remove={remove}
            />
          );
          if (period.past.has(p.id)) {
            return (
              <details
                key={p.id}
                id={`page-${p.id}`}
                className="group scroll-mt-4 rounded-2xl border border-line bg-card"
              >
                <summary className="flex min-h-11 cursor-pointer list-none flex-col [&::-webkit-details-marker]:hidden gap-0.5 p-4">
                  <span className="text-sm text-muted">過ぎた時期</span>
                  <span className="font-display text-lg font-bold">
                    {p.title}
                    {list.length > 0 && (
                      <span className="ml-2 text-sm font-normal text-muted">
                        {list.length}件
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-muted underline group-open:hidden">
                    開いて見る
                  </span>
                </summary>
                <div className="flex flex-col gap-3 px-4 pb-4">
                  <p className="text-sm text-muted">{when ?? p.note}</p>
                  {body}
                </div>
              </details>
            );
          }
          return (
            <article
              key={p.id}
              id={`page-${p.id}`}
              className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card p-4"
            >
              <div className="flex flex-col gap-1">
                <h3 className="font-display text-lg font-bold">
                  {p.title}
                  {list.length > 0 && (
                    <span className="ml-2 text-sm font-normal text-muted">
                      {list.length}件
                    </span>
                  )}
                </h3>
                <p className="text-sm text-muted">{when ?? p.note}</p>
              </div>
              {body}
            </article>
          );
        })}
      </section>
    );
  }
}

/** 記録の多いページは、新しい3件だけ出して、前の物は押すと出す */
const SHOWN = 3;
function RecentList({
  list,
  onRemove,
}: {
  list: TechoItem[];
  onRemove: Remove;
}) {
  const [all, setAll] = useState(false);
  const hidden = all ? 0 : Math.max(0, list.length - SHOWN);
  return (
    <div className="flex flex-col gap-2">
      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-11 self-start text-sm text-muted underline"
        >
          前の{hidden}件も見る
        </button>
      )}
      {list.slice(hidden).map((it) => (
        <EntryCard key={it.id} item={it} onRemove={onRemove} />
      ))}
    </div>
  );
}

type Add = ReturnType<typeof useTecho>["add"];
type Remove = ReturnType<typeof useTecho>["remove"];

function PageBody({
  id,
  list,
  all,
  today,
  add,
  remove,
}: {
  id: TechoPageId;
  list: TechoItem[];
  all: TechoItem[];
  today: string;
  add: Add;
  remove: Remove;
}) {
  const { family } = useFamily();
  switch (id) {
    case "stool":
      return (
        <StoolCard
          items={list}
          today={today}
          onRemove={remove}
          onAdd={(colorNo, date) =>
            add({
              page: "stool",
              date,
              title: `便の色 ${colorNo}番`,
              values: { colorNo },
            })
          }
        />
      );
    case "growth":
      return (
        <GrowthChart
          items={all}
          onAdd={(values, date) =>
            add({
              page: "growth",
              date,
              title: "身長・体重など（紙から写した）",
              values,
            })
          }
        />
      );
    case "development":
      return (
        <DevelopmentList
          items={list}
          today={today}
          onAdd={(item, date) =>
            add({ page: "development", date, title: item, values: { item } })
          }
        />
      );
    case "vaccine":
      return (
        <VaccineList
          items={list}
          today={today}
          onAdd={(v, date) =>
            add({
              page: "vaccine",
              date,
              title: [v.vaccine, v.dose].filter(Boolean).join(" "),
              values: {
                vaccine: v.vaccine,
                dose: v.dose ?? null,
                lot: v.lot ?? null,
                facility: v.facility ?? null,
              },
            })
          }
        />
      );
    case "feeling":
      return (
        <FeelingList
          items={list}
          today={today}
          onAdd={(v, date) =>
            add({
              page: "feeling",
              date,
              title: "気持ち",
              who: v.who,
              values: { text: v.text },
            })
          }
        />
      );
    default:
      return (
        <>
          {id === "consult" && (
            <>
              <p className="text-base font-semibold">{CONSULT_QUESTION}</p>
              <HelpPlaces family={family} />
              <div className="flex flex-wrap gap-2">
                <Btn href="/emergency" kind="secondary">
                  急ぎの時
                </Btn>
              </div>
            </>
          )}
          {list.length > 0 && <RecentList list={list} onRemove={remove} />}
          <EntryForm page={id} today={today} add={add} />
        </>
      );
  }
}
