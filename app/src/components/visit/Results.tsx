"use client";

// 帰り道に読む: 3行のまとめ → 次の予約（カレンダーへ） → 残りは畳む。
// 体の判断はしない。言い換えは必ず元の言葉（引用）と並べる。
import { jpDate } from "@/components/Techo";
import { Btn, Fold, HandoffRow, NextStep, Why, daysUntil } from "@/components/ui";
import { formatClock, type VisitView } from "@/lib/visit";

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
  return (
    <div className="flex flex-col gap-3">
      <section className="flex flex-col gap-3 rounded-2xl bg-rose-soft p-5">
        <p className="text-sm font-semibold text-muted">今日のまとめ</p>
        <ul className="flex flex-col gap-2 text-base leading-relaxed">
          {r.summary.slice(0, 3).map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
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

      {r.todo.length > 0 && (
        <Fold title="次までにやる事" count={r.todo.length}>
          {r.todo.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base font-semibold">
                {x.what}
                {x.when && <span className="ml-1 font-normal text-sky">（{x.when}）</span>}
              </p>
              <Quote>{x.quote}</Quote>
            </div>
          ))}
        </Fold>
      )}

      {r.answered.length > 0 && (
        <Fold title="聞いた事の答え" count={r.answered.length}>
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

      {r.terms.length > 0 && (
        <Fold title="先生の言葉を、やさしく" count={r.terms.length}>
          {r.terms.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base">
                <span className="font-semibold">{x.term}</span>: {x.plain}
              </p>
              <Quote>{x.quote}</Quote>
            </div>
          ))}
          <Why>
            <p>先生が言ったままの言葉と並べています。良い・悪いは書きません。</p>
          </Why>
        </Fold>
      )}

      {r.numbers.length > 0 && (
        <Fold title="話に出た数字" count={r.numbers.length}>
          <table className="w-full text-base">
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
          <Why>
            <p>言われたとおりに書いています。良い・悪いはここでは書きません。気になる時は先生に聞いてください。</p>
          </Why>
        </Fold>
      )}

      {r.questions.length > 0 && (
        <Fold title="次に聞く事" count={r.questions.length}>
          {r.questions.map((q, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base font-semibold">{q.question}</p>
              <p className="text-sm text-muted">{q.why}</p>
            </div>
          ))}
          <Why>
            <p>意味が残った所です。次の健診の「聞く事」に自動で入ります。</p>
          </Why>
        </Fold>
      )}

      {r.said.length > 0 && (
        <Fold title="先生が話した事" count={r.said.length}>
          {r.said.map((x, i) => (
            <div key={i} className="flex flex-col gap-1">
              <p className="text-base">{x.point}</p>
              <Quote at={x.at}>{x.quote}</Quote>
            </div>
          ))}
        </Fold>
      )}

      {t && (
        <Fold title={`録音の文字${t.duration ? `（${formatClock(t.duration)}）` : ""}`}>
          <Why>
            <p>{t.source === "asr" ? "機械が聞き取った文です。聞き間違いが含まれることがあります。" : "文字で渡された会話です。"}</p>
          </Why>
          <ol className="flex flex-col gap-2 text-base leading-relaxed">
            {t.segments.map((s, i) => (
              <li key={i} className="flex gap-2">
                {s.start !== undefined && <span className="tabular w-12 shrink-0 text-sm text-sky">{formatClock(s.start)}</span>}
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </Fold>
      )}
    </div>
  );
}
