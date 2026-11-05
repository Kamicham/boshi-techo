"use client";

// 健診で見せる記録の1枚（家族の声②の C・2026-11-05）。病院あてなので、画面の言葉に関わらず日本語で描く
// （使う側が LocaleScope lang="ja" で囲む。表と線は手帳と同じ部品 CheckupTable・WeightLine・GrowthLines で、数字がずれない）。
// 名前は出さない（手で書く欄を置く）。数字の良し悪し・評価の言葉は書かない。足元にいつも SHARE_FOOT。出典と年を書く。
// 中身は lib/share-view.ts の shareView の結果（出してよい欄だけ）だけを読む。共有の文は lib/share-text.ts。
import { GAIN_GUIDE_SOURCE, gainGuide } from "@/lib/body-series";
import { monthsFromDays } from "@/lib/growth";
import { ageText, madeOn, SHARE_FOOT, weekText } from "@/lib/share-text";
import type { ShareSheet } from "@/lib/share-view";
import { GrowthLines, type GrowthLine } from "./GrowthLines";
import { CheckupTable, WeightLine } from "./PregnancyBody";

const n1 = (v: number | undefined) => (v === undefined ? "" : String(Math.round(v * 10) / 10));
// 訳さない: 病院あての1枚の曜日（日本語）
const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];
/** 4/24（土） */
const mdw = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}（${WEEKDAY[new Date(`${d}T00:00:00Z`).getUTCDay()]}）`;
const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;
const bp = (hi?: number, lo?: number) => (hi === undefined && lo === undefined ? "" : `${n1(hi)}/${n1(lo)}`);

const TH = "border-b border-line px-2 py-1 text-left text-sm font-semibold text-muted";
const TD = "border-b border-line px-2 py-1.5 tabular-nums";

// 訳さない: 病院あての1枚は日本語で作る（家族の画面の言葉は /techo/share の上の段で、t() で訳す）
export function ShareSheetView({ sheet, today }: { sheet: ShareSheet; today: string }) {
  const growth = (sheet.growth ?? []).filter((g) => g.points.length > 0);
  const many = growth.length > 1;
  const weightLines: GrowthLine[] = growth
    .map((g) => ({
      label: many ? `${g.child}人目` : "",
      points: g.points.flatMap((p) => (p.weightKg !== undefined ? [{ month: monthsFromDays(p.ageDays), value: p.weightKg, date: p.date }] : [])),
    }))
    .filter((l) => l.points.length > 0);
  const body = sheet.body ?? null;
  // 妊婦健診の日は、からだの記録の表に同じ日が並ぶので、表がある時は省く（子の健診の日だけ）
  const checkups = (sheet.checkups ?? []).filter((c) => c.kind !== "pregnancy" || !body?.checkups.length);
  const vaccines = sheet.vaccines ?? [];
  const questions = sheet.questions ?? [];
  const health = sheet.motherHealth ?? null;
  const guide = body ? gainGuide(body.bmi, body.multiple) : null;
  const pre = body ? [body.heightCm !== undefined ? `身長 ${n1(body.heightCm)}cm` : "", body.preWeightKg !== undefined ? `妊娠前の体重 ${n1(body.preWeightKg)}kg` : "", body.bmi !== undefined ? `BMI ${n1(body.bmi)}` : ""].filter(Boolean) : [];
  const healthRows = health
    ? ([
        !body && health.heightCm !== undefined ? ["身長", `${n1(health.heightCm)}cm`] : null,
        !body && health.preWeightKg !== undefined ? ["妊娠前の体重", `${n1(health.preWeightKg)}kg`] : null,
        health.history ? ["これまでの病気", health.history] : null,
        health.allergy ? ["アレルギー", health.allergy] : null,
        health.medicine ? ["薬", health.medicine] : null,
        health.pastBirths ? ["前のお産", health.pastBirths] : null,
        health.smoking ? ["たばこ", health.smoking] : null,
      ].filter(Boolean) as [string, string][])
    : [];
  const hasBody = !!body && (body.checkups.length > 0 || body.home.length > 0 || pre.length > 0);
  const empty = !hasBody && !growth.length && !checkups.length && !vaccines.length && !sheet.next && !questions.length && !healthRows.length;
  const bothQ = questions.some((q) => q.forChild) && questions.some((q) => !q.forChild);

  return (
    <article lang="ja" className="share-sheet flex flex-col gap-5 rounded-2xl border border-line bg-card p-4 text-ink">
      <header className="flex flex-col gap-3 border-b border-line pb-3">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h2 className="font-display text-xl font-bold">健診で見せる記録</h2>
          <span className="text-sm text-muted">作った日 {madeOn(today)}</span>
        </div>
        <p className="flex items-end gap-2 text-base">
          <span className="shrink-0">お名前</span>
          <span className="h-8 min-w-0 flex-1 border-b border-ink/40" aria-label="手で書く欄" />
        </p>
      </header>

      {empty && <p className="text-base text-muted">まだ入れた記録がありません。</p>}

      {hasBody && body && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold">からだの記録（妊娠中）</h3>
          {pre.length > 0 && <p className="text-base tabular-nums">妊娠前: {pre.join("・")}</p>}
          <CheckupTable mother={body} />
          <WeightLine mother={body} plain />
          {body.home.length > 0 && (
            <div className="keep -mx-4 overflow-x-auto px-4">
              <table className="min-w-max border-collapse text-base">
                <caption className="pb-1 text-left text-sm text-muted">家で測った物</caption>
                <thead>
                  <tr>
                    {["月日", "週数", "体重 kg", "血圧 mmHg", "体温 ℃"].map((h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {body.home.map((r, i) => (
                    <tr key={`${r.date}-${i}`}>
                      <th scope="row" className={`${TD} text-left font-normal`}>
                        {md(r.date)}
                      </th>
                      <td className={TD}>{weekText(sheet, r.week, r.day)}</td>
                      <td className={TD}>{n1(r.weightKg)}</td>
                      <td className={TD}>{bp(r.bpHigh, r.bpLow)}</td>
                      <td className={TD}>{n1(r.tempC)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {growth.length > 0 && (
        <section className="flex flex-col gap-3">
          <h3 className="text-base font-bold">身長・体重・頭囲</h3>
          {growth.map((g) => (
            <div key={g.child} className="-mx-4 overflow-x-auto px-4">
              <table className="min-w-max border-collapse text-base">
                {many && <caption className="pb-1 text-left text-sm text-muted">{g.child}人目</caption>}
                <thead>
                  <tr>
                    {["月日", "生後", "体重 kg", "身長 cm", "頭囲 cm"].map((h) => (
                      <th key={h} scope="col" className={TH}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {g.points.map((p, i) => (
                    <tr key={`${p.date}-${i}`}>
                      <th scope="row" className={`${TD} text-left font-normal`}>
                        {md(p.date)}
                      </th>
                      <td className={TD}>{ageText(p.ageDays).replace("生後", "")}</td>
                      <td className={TD}>{n1(p.weightKg)}</td>
                      <td className={TD}>{n1(p.heightCm)}</td>
                      <td className={TD}>{n1(p.headCm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          {weightLines.length > 0 && <GrowthLines measure="weight" sex={null} lines={weightLines} corrected={false} showMid={false} />}
        </section>
      )}

      {checkups.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-bold">健診の日</h3>
          <ul className="flex flex-col text-base tabular-nums">
            {checkups.map((c, i) => {
              const w = weekText(sheet, c.week, c.day);
              return (
                <li key={`${c.date}-${i}`}>
                  {md(c.date)} {c.kind === "pregnancy" ? `妊婦健診${w ? `（${w}）` : ""}` : `${many && c.child ? `${c.child}人目 ` : ""}${c.name ?? "乳幼児健診"}`}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {vaccines.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-bold">予防接種</h3>
          <ul className="flex flex-col text-base tabular-nums">
            {vaccines.map((v, i) => (
              <li key={`${v.date}-${i}`}>
                {md(v.date)} {v.mother ? "（ママ）" : many && v.child ? `${v.child}人目 ` : ""}
                {v.vaccine}
                {v.dose ? ` ${v.dose}` : ""}
              </li>
            ))}
          </ul>
        </section>
      )}

      {sheet.next && (
        <section className="keep flex flex-col gap-1">
          <h3 className="text-base font-bold">次の予約</h3>
          <p className="text-base tabular-nums">
            {mdw(sheet.next.date)}
            {sheet.next.time ? ` ${sheet.next.time}` : ""}
          </p>
        </section>
      )}

      {questions.length > 0 && (
        <section className="flex flex-col gap-1">
          <h3 className="text-base font-bold">健診で聞きたい事</h3>
          {(bothQ ? ([["ママの健診で", false], ["子の健診で", true]] as const) : ([["", null]] as const)).map(([label, forChild]) => (
            <div key={label || "all"} className="flex flex-col">
              {label && <p className="text-sm text-muted">{label}</p>}
              <ul className="flex flex-col text-base">
                {questions
                  .filter((q) => forChild === null || q.forChild === forChild)
                  .map((q, i) => (
                    <li key={i}>・{q.text}</li>
                  ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {healthRows.length > 0 && (
        <section className="keep flex flex-col gap-1">
          <h3 className="text-base font-bold">妊婦の健康状態</h3>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
            {healthRows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="min-w-0 break-words">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="keep flex flex-col gap-1 border-t border-line pt-3 text-sm text-muted">
        <h3 className="font-semibold">出典と数え方</h3>
        {hasBody && <p>週数: 出産予定日から数えた妊娠週（最終月経の初日を0週0日とする数え方）。</p>}
        {hasBody && guide && <p>体重の線の40週の括弧: {GAIN_GUIDE_SOURCE.title}（{madeOn(GAIN_GUIDE_SOURCE.date)}）。</p>}
        {growth.length > 0 && <p>生後: 生まれた日を0日として数えた日数と月数。線は入れた数字をつないだだけです。</p>}
        <p>数字は家族が入れた物を、そのまま並べています（評価はしていません）。</p>
      </section>

      <footer className="rounded-xl border border-ink/30 px-3 py-2 text-base font-semibold">{SHARE_FOOT}</footer>
    </article>
  );
}
