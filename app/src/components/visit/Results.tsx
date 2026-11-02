"use client";

// 帰り道に読む: 3行のまとめ → 次の予約（カレンダーへ） → 残りは3つの箱に畳む（先生の話／聞いた事と答え／次までに）。
// 体の判断はしない。言い換えは必ず元の言葉（引用）と並べる。
import { jpDate } from "@/components/Techo";
import { Btn, Fold, HandoffRow, NextStep, Why, daysUntil } from "@/components/ui";
import { SUMMARY_LINE, clip, formatClock, summaryTooLong, type VisitView } from "@/lib/visit";

function Quote({ children, at }: { children: React.ReactNode; at?: string | null }) {
  return (
    <blockquote className="border-l-2 border-line pl-2 text-sm leading-relaxed text-muted">
      {at && <span className="tabular mr-1 text-sky">{at}</span>}「{children}」
    </blockquote>
  );
}

export function Results({ visit, today, onSend }: { visit: VisitView; today: string; onSend: () => void }) {
  const r = visit.result;
  if (!r) return null;
  const t = visit.transcript;
  const na = r.nextAppointment;
  const summary = r.summary.slice(0, 3);
  const long = summaryTooLong(r.summary);
  const nextAsk = r.questions.length;
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-2xl bg-rose-soft p-5">
        <p className="text-sm font-semibold text-muted">{visit.date === today ? "今日のまとめ" : `${jpDate(visit.date)}のまとめ`}</p>
        {long ? (
          <>
            <p className="text-base leading-relaxed">{clip(summary[0] ?? "", SUMMARY_LINE * 2)}</p>
            <Why label="全部読む">
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
          <Btn onClick={onSend}>家族に送る</Btn>
        </div>
        {visit.warning && <Why label="録れていない所">{visit.warning}</Why>}
      </section>

      {na &&
        (visit.nextDate ? (
          <NextStep
            eyebrow="次の健診"
            title={`${jpDate(visit.nextDate)}${na.time ? ` ${na.time}` : ""}`}
            days={daysUntil(today, visit.nextDate)}
            tone="sky"
          >
            <HandoffRow calendar={{ title: "健診", date: visit.nextDate, time: na.time, minutes: 60, details: `先生の言葉:「${na.said}」` }} />
            <Why label="先生の言葉">
              <Quote>{na.said}</Quote>
            </Why>
          </NextStep>
        ) : (
          <NextStep eyebrow="次の健診" title="日付を入れる" tone="sky">
            <Btn href="/visit" kind="secondary">
              入れに行く
            </Btn>
            <Why label="先生の言葉">
              <Quote>{na.said}</Quote>
            </Why>
          </NextStep>
        ))}

      {/* 畳んだ箱は3つ: 先生の話 / 聞いた事と答え / 次までに（題が重ならないように） */}
      {(r.said.length > 0 || r.numbers.length > 0 || r.terms.length > 0 || t) && (
        <Fold title="先生の話" count={r.said.length || undefined}>
          {r.said.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base">{x.point}</p>
              <Quote at={x.at}>{x.quote}</Quote>
            </div>
          ))}
          {r.numbers.length > 0 && (
            <table className="w-full text-base">
              <caption className="pb-1 text-left text-sm font-semibold text-muted">話に出た数字</caption>
              <tbody>
                {r.numbers.map((n, i) => (
                  <tr key={i} className="border-b border-line align-top last:border-0">
                    <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">
                      {n.name}
                    </th>
                    <td className="tabular py-2 font-semibold">{n.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {r.terms.length > 0 && (
            <div className="flex flex-wrap gap-x-4">
              {r.terms.map((x, i) => (
                <Why key={i} label={`「${x.term}」って？`}>
                  <p className="text-base text-ink">{x.plain}</p>
                  <Quote>{x.quote}</Quote>
                </Why>
              ))}
            </div>
          )}
          <Why>
            <p>先生が言ったままの言葉と並べています。数字は言われたとおりに書き、良い・悪いは書きません。気になる時は先生に聞いてください。</p>
          </Why>
          {t && (
            <Why label={`録音の文字${t.duration ? `（${formatClock(t.duration)}）` : ""}`}>
              <p>{t.source === "asr" ? "機械が聞き取った文です。聞き間違いが含まれることがあります。" : "文字で渡された会話です。"}</p>
              <ol className="flex flex-col gap-2 text-base leading-relaxed text-ink">
                {t.segments.map((s, i) => (
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
        <Fold title="聞いた事と答え" count={r.answered.length}>
          {r.answered.map((a, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-sm text-muted">{a.ask}</p>
              {a.answer ? (
                <>
                  <p className="text-base">{a.answer}</p>
                  {a.quote && <Quote>{a.quote}</Quote>}
                </>
              ) : (
                <p className="text-base text-warn">答えは録れていません。次に聞けます</p>
              )}
            </div>
          ))}
        </Fold>
      )}

      {(r.todo.length > 0 || nextAsk > 0) && (
        <Fold title="次までに" count={r.todo.length + nextAsk}>
          {r.todo.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base font-semibold">
                {x.what}
                {x.when && <span className="ml-1 font-normal text-sky">（{x.when}）</span>}
              </p>
              <Quote>{x.quote}</Quote>
            </div>
          ))}
          {nextAsk > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-muted">次に聞く事</p>
              {r.questions.map((q, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <p className="text-base">{q.question}</p>
                  <p className="text-sm text-muted">{q.why}</p>
                </div>
              ))}
              <Why>
                <p>意味が残った所です。次の健診の「聞く事」に自動で入ります。</p>
              </Why>
            </div>
          )}
        </Fold>
      )}
    </div>
  );
}
