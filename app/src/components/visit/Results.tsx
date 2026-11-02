"use client";

// 健診の結果: 要約・やる事・次の予約・言葉の言い換え（元の言葉と並べる）・次の質問・数値・原文。
import { jpDate } from "@/components/Techo";
import { formatClock, type VisitView } from "@/lib/visit";

function Quote({ children, at }: { children: React.ReactNode; at?: string | null }) {
  return (
    <blockquote className="border-l-2 border-line pl-2 text-xs leading-relaxed text-muted">
      {at && <span className="tabular mr-1 text-sky">{at}</span>}「{children}」
    </blockquote>
  );
}

function Card({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-line bg-card p-4">
      <div>
        <h2 className="font-display text-lg font-bold">{title}</h2>
        {note && <p className="text-xs text-muted">{note}</p>}
      </div>
      {children}
    </section>
  );
}

export function Results({ visit }: { visit: VisitView }) {
  const r = visit.result;
  if (!r) return null;
  const t = visit.transcript;
  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-2 rounded-xl bg-rose-soft p-4">
        <p className="text-xs font-semibold tracking-widest text-rose">今日の健診のまとめ</p>
        <ul className="flex flex-col gap-2 text-sm leading-relaxed">
          {r.summary.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ul>
        {visit.warning && <p className="text-xs text-warn">{visit.warning}</p>}
      </section>

      {r.nextAppointment && (
        <section className="flex flex-col gap-1 rounded-xl border border-sky bg-sky-soft p-4">
          <p className="text-xs font-semibold text-sky">次の予約</p>
          {visit.nextDate ? (
            <p className="tabular font-display text-2xl font-bold text-sky">
              {jpDate(visit.nextDate)}
              {r.nextAppointment.time && <span className="ml-2">{r.nextAppointment.time}</span>}
            </p>
          ) : (
            <p className="text-sm">日付までは分かりませんでした。健診の一覧で入れてください。</p>
          )}
          <Quote>{r.nextAppointment.said}</Quote>
        </section>
      )}

      {r.todo.length > 0 && (
        <Card title="次までにやる事">
          <ul className="flex flex-col gap-3">
            {r.todo.map((x, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="text-sm font-semibold">
                  {x.what}
                  {x.when && <span className="ml-1 font-normal text-sky">（{x.when}）</span>}
                </p>
                <Quote>{x.quote}</Quote>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.answered.length > 0 && (
        <Card title="聞きたかった事への答え">
          <ul className="flex flex-col gap-3">
            {r.answered.map((a, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="text-xs text-muted">Q. {a.ask}</p>
                {a.answer ? (
                  <>
                    <p className="text-sm">{a.answer}</p>
                    {a.quote && <Quote>{a.quote}</Quote>}
                  </>
                ) : (
                  <p className="text-sm text-warn">録音の中に答えが見つかりませんでした。次の健診で聞けます。</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {r.terms.length > 0 && (
        <Card title="出てきた言葉" note="先生の言葉と、そのやさしい説明を並べています。">
          <dl className="flex flex-col gap-3">
            {r.terms.map((x, i) => (
              <div key={i} className="flex flex-col gap-1">
                <dt className="font-semibold">{x.term}</dt>
                <dd className="text-sm leading-relaxed">{x.plain}</dd>
                <dd>
                  <Quote>{x.quote}</Quote>
                </dd>
              </div>
            ))}
          </dl>
        </Card>
      )}

      {r.questions.length > 0 && (
        <Card title="次に先生へ聞く事" note="意味が残った所です。次の健診の「聞く事」に入ります。">
          <ol className="flex list-decimal flex-col gap-2 pl-5">
            {r.questions.map((q, i) => (
              <li key={i} className="text-sm">
                <p className="font-semibold">{q.question}</p>
                <p className="text-xs text-muted">{q.why}</p>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {r.numbers.length > 0 && (
        <Card title="話に出た数字" note="言われたとおりに書いています。良い・悪いはここでは書きません。">
          <table className="w-full text-sm">
            <tbody>
              {r.numbers.map((n, i) => (
                <tr key={i} className="border-b border-line align-top last:border-0">
                  <th scope="row" className="py-2 pr-3 text-left font-normal text-muted">{n.name}</th>
                  <td className="tabular py-2 font-semibold">{n.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {r.said.length > 0 && (
        <Card title="先生が話した事">
          <ul className="flex flex-col gap-3">
            {r.said.map((x, i) => (
              <li key={i} className="flex flex-col gap-1">
                <p className="text-sm">{x.point}</p>
                <Quote at={x.at}>{x.quote}</Quote>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {t && (
        <details className="rounded-xl border border-line bg-card p-4">
          <summary className="cursor-pointer font-display font-bold">
            原文（文字起こし）
            {t.duration ? <span className="tabular ml-2 text-xs font-normal text-muted">{formatClock(t.duration)}</span> : null}
          </summary>
          <p className="mt-2 text-xs text-muted">
            {t.source === "asr" ? "機械が聞き取った文です。聞き間違いが含まれることがあります。" : "文字で渡された会話です。"}
          </p>
          <ol className="mt-3 flex flex-col gap-2 text-sm leading-relaxed">
            {t.segments.map((s, i) => (
              <li key={i} className="flex gap-2">
                {s.start !== undefined && <span className="tabular w-12 shrink-0 text-xs text-sky">{formatClock(s.start)}</span>}
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
