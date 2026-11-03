// 急ぎの時: のどに物が詰まった（窒息）・反応が無い（心肺蘇生）。紙の母子手帳の終わりの方にある「救急の手当」のページの考え方を、短く自分の言葉で。
// 通信が無くても開けるよう、public/sw.js がこのページと部品を取っておく。家族の読み込みを待たずに出す（emergency/Frame.tsx）。
// 体の判断はしない。手当の手順と、119・#8000 への橋だけ。迷ったら 119（通報すると、電話の向こうで手当を教えてもらえる）。
//
// 出典（原文は写さず、要点を自分の言葉でまとめた）:
// - こども家庭庁「母子健康手帳 任意様式」2026-01-16版 p.72-73「子どもの事故の手当」（監修: 日本小児呼吸器学会・日本小児救急医学会）
//   https://www.cfa.go.jp/policies/boshihoken/techou
// - 日本蘇生協議会「JRC蘇生ガイドライン2020」第3章 小児の蘇生（一次救命処置・気道異物の除去）https://www.jrc-cpr.org/jrc-guideline-2020/
// - こども家庭庁「こども医療電話相談事業（#8000）」https://www.cfa.go.jp/policies/boshihoken/8000/
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "急ぎの時 | 母子手帳" };
// 通信が無くても開けるよう、作る時に1回だけ組み立てる（家族の情報は何も入らない）
export const dynamic = "force-static";

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-alert/10 font-display text-base font-bold text-alert" aria-hidden>
        {n}
      </span>
      <span className="min-w-0 pt-1 text-base leading-relaxed">{children}</span>
    </li>
  );
}

function Card({ id, title, sub, children }: { id: string; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 id={`${id}-h`} className="font-display text-xl font-bold">
          {title}
        </h2>
        {sub && <p className="text-sm text-muted">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

export default function EmergencyPage() {
  return (
    <main className="flex flex-col gap-4 px-4 pt-4 pb-12">
      <div className="flex items-center justify-between gap-2">
        <Link href="/" className="inline-flex min-h-11 items-center text-base text-muted underline-offset-2 hover:underline">
          ‹ 今日へ
        </Link>
        <span className="text-xs text-muted">電波が無くても開けます</span>
      </div>

      {/* 一番上は、迷ったら 119 */}
      <a href="tel:119" className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl bg-alert px-4 py-4 text-center text-white">
        <span className="font-display text-3xl font-bold">迷ったら 119</span>
        <span className="text-base">押すと電話がかかります。手当のしかたも電話で教えてもらえます</span>
      </a>
      <a href="tel:%238000" className="flex min-h-14 items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3">
        <span className="min-w-0">
          <span className="block text-lg font-bold">#8000 こども医療電話相談</span>
          <span className="block text-sm text-muted">急ぐか迷う時。夜や休みの日も、小児科の先生や看護師さんに聞けます</span>
        </span>
        <span className="shrink-0 text-base font-semibold text-sky">電話する</span>
      </a>

      <nav aria-label="このページの中" className="flex flex-wrap gap-2">
        <a href="#choke" className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold">
          のどに詰まった
        </a>
        <a href="#cpr" className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold">
          反応が無い・息をしていない
        </a>
      </nav>

      <Card id="choke" title="のどに物が詰まった" sub="窒息（ちっそく）">
        <p className="rounded-lg bg-paper px-3 py-2 text-base">
          <b>せきができる・泣ける時</b>は、せきを続けさせます。口の中に見える物だけを取ります。指で奥を探ると、もっと奥へ押し込むことがあります。
        </p>
        <p className="text-base font-semibold text-alert">声が出ない・息ができない・顔色が悪くなってきた時は、すぐに119（そばの人に頼む）。そして手当を始めます。</p>

        <h3 className="font-display text-lg font-bold">1歳になる前の赤ちゃん</h3>
        <ol className="flex flex-col gap-2">
          <Step n={1}>
            <b>背中をたたく</b>: 赤ちゃんをうつぶせにして片腕に乗せ、手であごを支えて、頭を体より低くします。手のひらの付け根で、背中の真ん中（肩甲骨の間）を強く5回ほどたたきます。
          </Step>
          <Step n={2}>
            <b>胸を押す</b>: あお向けにして頭を低くし、胸の真ん中を指2本で、強く5回ほど押します。
          </Step>
          <Step n={3}>出てくるまで、1と2をくり返します。お腹を突き上げる方法は、赤ちゃんにはしません。</Step>
        </ol>

        <h3 className="font-display text-lg font-bold">1歳を過ぎた子</h3>
        <ol className="flex flex-col gap-2">
          <Step n={1}>
            <b>お腹を突き上げる</b>: 後ろから抱えるように腕を回し、片手でにぎりこぶしを作って、おへその少し上に当てます。もう片方の手でこぶしを包み、手前の上の方へ、すばやく突き上げます。
          </Step>
          <Step n={2}>背中の真ん中を、手のひらの付け根で強くたたく方法もあります。出てくるまでくり返します。</Step>
        </ol>
        <p className="text-base">
          <b>ぐったりして反応が無くなったら</b>、すぐに下の「心肺蘇生」へ。お腹を突き上げた時は、出てきても病院で診てもらいます。
        </p>
      </Card>

      <Card id="cpr" title="反応が無い・息をしていない" sub="心肺蘇生（しんぱいそせい）">
        <ol className="flex flex-col gap-2">
          <Step n={1}>
            <b>反応を見る</b>: 肩をたたいて大きな声で呼びます（赤ちゃんは足の裏をたたく）。
          </Step>
          <Step n={2}>
            <b>人を呼ぶ</b>: 反応が無ければ、大声で人を呼び、119 と AED を頼みます。一人なら、スマホをスピーカーにして119へ。
          </Step>
          <Step n={3}>
            <b>息を見る</b>: 胸とお腹が動いているかを10秒以内で見ます。ふだんどおりの息が無い・分からない時は、すぐに次へ。
          </Step>
          <Step n={4}>
            <b>胸を押す</b>: 胸の真ん中を、胸の厚みの3分の1が沈むくらい強く、1分に100〜120回の速さで、休まず押します。赤ちゃんは指2本、子どもは片手か両手で。
          </Step>
          <Step n={5}>
            <b>息を吹き込む</b>: やり方を習った人は、押す30回ごとに息を2回。できなければ、押すことだけを続けます。
          </Step>
          <Step n={6}>
            <b>AED が来たら</b>: ふたを開けて電源を入れ、声の案内のとおりに。小学校に上がる前の子は、子ども用のパッドかモードがあれば使います（無ければ大人用でかまいません）。
          </Step>
          <Step n={7}>救急隊に代わるまで、押すのを続けます。</Step>
        </ol>
      </Card>

      <section className="flex flex-col gap-2 text-sm text-muted">
        <p>このページは、手当の要点を短くまとめた物です。手当は、消防署などの救命講習で一度体で覚えておくのがいちばんです。</p>
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1">
            <span className="underline underline-offset-2">なぜ？（出典）</span>
            <span className="transition-transform group-open:rotate-90" aria-hidden>
              ›
            </span>
          </summary>
          <div className="mt-1 flex flex-col gap-1 rounded-lg bg-paper px-3 py-2">
            <p>
              紙の母子健康手帳の「子どもの事故の手当」のページ（こども家庭庁 任意様式 2026年1月16日版 72〜73ページ。監修: 日本小児呼吸器学会・日本小児救急医学会）と、日本蘇生協議会「JRC蘇生ガイドライン2020」の小児の一次救命処置を元に、言葉を短くしました。原文はそれぞれのページで読めます。
            </p>
            <p>
              <a href="https://www.cfa.go.jp/policies/boshihoken/techou" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                こども家庭庁 母子健康手帳について
              </a>
              {" ・ "}
              <a href="https://www.jrc-cpr.org/jrc-guideline-2020/" className="underline underline-offset-2" target="_blank" rel="noreferrer">
                JRC蘇生ガイドライン2020
              </a>
            </p>
            <p>#8000 は、こども家庭庁の「こども医療電話相談事業」です（つながる時間は都道府県ごとに違います）。</p>
          </div>
        </details>
      </section>
    </main>
  );
}
