"use client";

// 帰り道に読む: 3行のまとめ → 次の健診の日の1問（録音から聞こえた日を本人が確かめる。NextCheck.tsx） → 残りは3つの箱に畳む（先生の話／聞いた事と答え／次までに）。
// 体の判断はしない。言い換えは必ず元の言葉（引用）と並べる。機械が聞き取った言葉を「先生の言葉」と書かない（録音から聞こえた言葉）。
// 字は画面の言葉で出す（t()。辞書は lib/i18n/dict/visit-results.ts）。Claude がまとめた中身と引用は、訳さずにそのまま出す
import { jpDate } from "@/components/Techo";
import { Btn, Fold, Why } from "@/components/ui";
import { NextCheck } from "@/components/visit/NextCheck";
import { t } from "@/lib/i18n";
import { SUMMARY_LINE, clip, formatClock, summaryTooLong, type VisitView } from "@/lib/visit";

/** 録音から聞こえた言葉の引用（中身は訳さない。括弧だけ画面の言葉で） */
function Quote({ text, at }: { text: string; at?: string | null }) {
  return (
    <blockquote className="border-l-2 border-line pl-2 text-sm leading-relaxed text-muted">
      {at && <span className="tabular mr-1 text-sky">{at}</span>}
      {t("「{text}」", { text })}
    </blockquote>
  );
}

export function Results({
  visit,
  today,
  family,
  onSend,
  onChange,
}: {
  visit: VisitView;
  today: string;
  /** 機械の印に使う（予定日・生まれた日） */
  family: { dueDate?: string | null; birthDate?: string | null };
  onSend: () => void;
  onChange: (v: VisitView) => void;
}) {
  const r = visit.result;
  if (!r) return null;
  const tr = visit.transcript;
  const summary = r.summary.slice(0, 3);
  const long = summaryTooLong(r.summary);
  const nextAsk = r.questions.length;
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-2xl bg-rose-soft p-5">
        <p className="text-sm font-semibold text-muted">{visit.date === today ? t("今日のまとめ") : t("{date}のまとめ", { date: jpDate(visit.date) })}</p>
        {long ? (
          <>
            <p className="text-base leading-relaxed">{clip(summary[0] ?? "", SUMMARY_LINE * 2)}</p>
            <Why label={t("全部読む")}>
              <ul className="flex flex-col gap-2 text-base leading-relaxed text-ink">
                {r.summary.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </Why>
          </>
        ) : (
          <ul className="flex flex-col gap-1 text-base leading-relaxed">
            {summary.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap gap-2 pt-1">
          <Btn onClick={onSend}>{t("家族に送る")}</Btn>
        </div>
        {visit.warning && <Why label={t("録れていない所")}>{visit.warning}</Why>}
      </section>

      <NextCheck visit={visit} today={today} family={family} onChange={onChange} />

      {/* 畳んだ箱は3つ: 先生の話 / 聞いた事と答え / 次までに（題が重ならないように） */}
      {(r.said.length > 0 || r.numbers.length > 0 || r.terms.length > 0 || tr) && (
        <Fold title={t("先生の話")} count={r.said.length || undefined}>
          {r.said.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base">{x.point}</p>
              <Quote at={x.at} text={x.quote} />
            </div>
          ))}
          {r.numbers.length > 0 && (
            <table className="w-full text-base">
              <caption className="pb-1 text-left text-sm font-semibold text-muted">{t("聞こえた数字")}</caption>
              <tbody>
                {r.numbers.map((n, i) => (
                  <tr key={i} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">
                      {n.name}
                    </th>
                    <td className="py-2">
                      <span className="tabular font-semibold">{n.value}</span>
                      {n.quote && <span className="block text-sm text-muted">{t("「{text}」", { text: n.quote })}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {r.terms.length > 0 && (
            <div className="flex flex-wrap gap-x-4">
              {r.terms.map((x, i) => (
                <Why key={i} label={t("「{term}」って？", { term: x.term })}>
                  <p className="text-base text-ink">{x.plain}</p>
                  <Quote text={x.quote} />
                </Why>
              ))}
            </div>
          )}
          <Why>
            <p>{t("録音から聞こえた言葉と並べています。数字は機械が聞き取った物で、紙の手帳（先生が書いた欄）が正です。良い・悪いは書きません。気になる時は先生に聞いてください。")}</p>
          </Why>
          {tr && (
            <Why label={tr.duration ? t("録音の文字（{time}）", { time: formatClock(tr.duration) }) : t("録音の文字")}>
              <p>{tr.source === "asr" ? t("機械が聞き取った文です。聞き間違いが含まれることがあります。") : t("文字で渡された会話です。")}</p>
              <ol className="flex flex-col gap-2 text-base leading-relaxed text-ink">
                {tr.segments.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    {s.start !== undefined && <span className="tabular w-12 shrink-0 text-sm text-sky">{formatClock(s.start)}</span>}
                    <span>{s.text}</span>
                  </li>
                ))}
              </ol>
            </Why>
          )}
        </Fold>
      )}

      {r.answered.length > 0 && (
        <Fold title={t("聞いた事と答え")} count={r.answered.length}>
          {r.answered.map((a, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm text-muted">{a.ask}</p>
              {a.answer ? (
                <>
                  <p className="text-base">{a.answer}</p>
                  {a.quote && <Quote text={a.quote} />}
                </>
              ) : (
                <p className="text-base text-warn">{t("答えは録れていません。次に聞けます")}</p>
              )}
            </div>
          ))}
        </Fold>
      )}

      {(r.todo.length > 0 || nextAsk > 0) && (
        <Fold title={t("次までに")} count={r.todo.length + nextAsk}>
          {r.todo.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base font-semibold">
                {x.what}
                {x.when && <span className="ml-1 font-normal text-sky">{t("（{x}）", { x: x.when })}</span>}
              </p>
              <Quote text={x.quote} />
            </div>
          ))}
          {nextAsk > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted">{t("次に聞く事")}</p>
              {r.questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="text-base">{q.question}</p>
                  <p className="text-sm text-muted">{q.why}</p>
                </div>
              ))}
              <Why>
                <p>{t("意味が残った所です。次の健診の「聞く事」に自動で入ります。")}</p>
              </Why>
            </div>
          )}
        </Fold>
      )}
    </div>
  );
}
