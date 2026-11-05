"use client";

// 「家族から」（総点検 2-1・2026-11-04）: ほかの家族が7日の間に済ませた事に「ありがとう」を送り、自分に届いたありがとうを3日の間見る。
// 手帳が家族の仕事を引き受けるほど、家族の間の「ありがとう」が消えていく。その往復を手帳の中に戻す。
// 並べ方は lib/done-words.ts の familyNewsFor（誰が済ませたか分からない 11/5 より前の記録は並べない）。家族が1人の手帳では出さない。
import type { FamilyNews as News } from "@/lib/done-words";
import { doneWords } from "@/lib/done-words";
import { t as tr } from "@/lib/i18n";
import { nameIn } from "@/lib/i18n/names";
import { msWords } from "@/lib/i18n/milestone-words";
import { Btn } from "../ui";

/** 名前の置き場の印（訳した文を名前の所で分けて、名前だけ太字にする。言葉ごとに名前の位置が違う） */
const NAME = "\u0001";
function boldName(text: string, name: string) {
  const [head, tail = ""] = text.split(NAME);
  return (
    <>
      {head}
      <b>{name}</b>
      {tail}
    </>
  );
}

export function FamilyNews({ news, childName, titleOf, onThank }: { news: News; childName?: string; titleOf: (id: string) => string; onThank: (id: string) => void }) {
  const done = news.done.filter((d) => titleOf(d.id));
  const thanks = news.thanks.filter((t) => titleOf(t.id));
  if (!done.length && !thanks.length) return null;
  return (
    <section aria-label={tr("家族から")} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <h2 className="text-sm font-semibold text-muted">{tr("家族から")}</h2>
      {thanks.map((t) => (
        <p key={`t:${t.id}`} className="text-base">
          {boldName(tr("🌷 {name}から、ありがとう", { name: NAME }), nameIn(t.from.name))}
          <span className="text-muted">{tr("（{x}）", { x: msWords(titleOf(t.id)) })}</span>
        </p>
      ))}
      {done.map((d) => {
        const words = doneWords(d.id, nameIn(childName));
        return (
          <div key={`d:${d.id}`} className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 flex-1 text-base">
              {boldName(tr("{name}が「{title}」を済ませました", { name: NAME, title: msWords(titleOf(d.id)) }), nameIn(d.by.name))}
              {words && <span className="block text-sm text-muted">{words}</span>}
            </p>
            {d.thanked ? (
              <span className="shrink-0 text-sm font-semibold text-ok">{tr("ありがとうを送りました")}</span>
            ) : (
              <span className="shrink-0">
                <Btn kind="secondary" onClick={() => onThank(d.id)} ariaLabel={tr("{name}に、ありがとうを送る", { name: d.by.name })}>
                  {tr("ありがとう")}
                </Btn>
              </span>
            )}
          </div>
        );
      })}
    </section>
  );
}
