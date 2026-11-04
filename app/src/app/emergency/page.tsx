// 急ぎの時: のどに物が詰まった（窒息）・反応が無い（心肺蘇生）。紙の母子手帳の終わりの方にある「救急の手当」のページの考え方を、短く自分の言葉で。
// 通信が無くても開けるよう、public/sw.js がこのページと部品を取っておく。家族の読み込みを待たずに出す（emergency/Frame.tsx）。
// 体の判断はしない。手当の手順と、119・#8000・かかっている産院（妊娠中の体の急ぎ）への橋だけ。迷ったら 119（通報すると、電話の向こうで手当を教えてもらえる）。
//
// 出典（原文は写さず、要点を自分の言葉でまとめた）:
// - 消防庁 消防救第385号「『救急蘇生法の指針2025（市民用）』への対応について」2026-10-23（別紙＝主に市民が行う一次救命処置）
//   https://www.fdma.go.jp/laws/tutatsu/items/20261023_kyuuki_01.pdf （2026-11-04 に本文を確かめた。乳児の胸骨圧迫は2本指でなく片手の手のひらの付け根・
//   押す所は胸の真ん中＝左右の乳頭を結ぶ線の真ん中あたり・気道異物は背部叩打・腹部突き上げ・胸部突き上げをそれぞれ5回程度・1歳以上は背部叩打が先）
// - 日本蘇生協議会「JRC蘇生ガイドライン2025」https://www.jrc-cpr.org/jrc-guideline-2025/
// - こども家庭庁「母子健康手帳 任意様式」2026-01-15版 p.73-75「子どもの事故の手当」（2025年版より前の物。新しい方に合わせた）
//   https://www.cfa.go.jp/policies/boshihoken/techou
// - 厚生労働省「子ども医療電話相談事業（#8000）」（都道府県が行う）https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html
// - 消防庁「NET119緊急通報システム」（2026-04-01 で719本部のうち677本部が導入・事前の登録が要る）
//   https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/net119.html
// - 電話リレーサービス: 聴覚障害者等による電話の利用の円滑化に関する法律（令和2年法律第53号）。総務大臣指定の提供機関
//   一般財団法人日本財団電話リレーサービス https://www.nftrs.or.jp/ （24時間・110/119/118 に発信できる）
import type { Metadata } from "next";
import Link from "next/link";
import { ChokeOrder, PregnancyUrgent } from "./ChokeOrder";

export const metadata: Metadata = { title: "急ぎの時 | 母子手帳" };
// 通信が無くても開けるよう、作る時に1回だけ組み立てる（家族の情報は何も入らない）
export const dynamic = "force-static";

const SOURCES = [
  { label: "消防庁の通知（救急蘇生法の指針2025）", href: "https://www.fdma.go.jp/laws/tutatsu/items/20261023_kyuuki_01.pdf" },
  { label: "JRC蘇生ガイドライン2025", href: "https://www.jrc-cpr.org/jrc-guideline-2025/" },
  { label: "こども家庭庁 母子健康手帳について", href: "https://www.cfa.go.jp/policies/boshihoken/techou" },
  { label: "厚生労働省 #8000", href: "https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html" },
  { label: "消防庁 NET119", href: "https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/net119.html" },
  { label: "電話リレーサービス", href: "https://www.nftrs.or.jp/" },
];

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="tabular flex size-8 shrink-0 items-center justify-center rounded-full bg-alert/10 font-display text-base font-bold text-alert"
        aria-hidden
      >
        {n}
      </span>
      <span className="min-w-0 pt-1 text-base leading-relaxed">{children}</span>
    </li>
  );
}

function Card({
  id,
  title,
  sub,
  children,
}: {
  id: string;
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-h`}
      className="flex scroll-mt-4 flex-col gap-3 rounded-2xl border border-line bg-card p-4"
    >
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
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-base text-muted underline-offset-2 hover:underline"
        >
          ‹ 今日へ
        </Link>
        <span className="text-xs text-muted">電波が無くても開けます</span>
      </div>

      {/* 妊娠中の家族では、産院への電話を一番上に（ほかの家族ではページの下） */}
      <PregnancyUrgent slot="top" />

      {/* 開いたら電話の画面（作り手の声「急ぎの時は読むより、まず電話」）。最初の1画面は電話の2つだけ。
          開いただけで自動でかける事はしない（Web からはできず、手が当たって開いた時に誤った通報になる）。押せば発信の確かめへ進む */}
      <section
        aria-label="電話する"
        className="flex min-h-[calc(100svh-7rem)] flex-col gap-3"
      >
        <a
          href="tel:119"
          className="flex min-h-48 flex-1 flex-col items-center justify-center gap-2 rounded-2xl bg-alert px-4 py-6 text-center text-white"
        >
          <span className="font-display text-4xl font-bold">119 にかける</span>
          <span className="text-base">
            迷ったらこちら。手当のしかたも、電話の向こうで教えてもらえます
          </span>
        </a>
        <a
          href="tel:%238000"
          className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-2xl border-2 border-sky bg-card px-4 py-4 text-center"
        >
          <span className="font-display text-2xl font-bold text-sky">
            #8000 に聞く
          </span>
          <span className="text-sm text-muted">
            子どもの急な病気で、急ぐか迷う時。夜や休みの日も、小児科の先生や看護師さんに聞けます
          </span>
        </a>
        {/* 耳が聞こえにくい・声で話せない時の道（消防庁 NET119・電話リレーサービス） */}
        <p className="rounded-lg bg-paper px-3 py-2 text-sm leading-relaxed">
          <b>声で話せない時</b>: 文字で119に通報できる「NET119」（前もって住む町の消防本部に登録が要ります）と、手話や文字で110・119にもつながる「電話リレーサービス」（24時間）があります。
        </p>
        <p className="text-center text-sm text-muted">
          手当の手順は、この下にあります ↓
        </p>
      </section>

      {/* 妊娠中・産後のママの体（第29回: 妊娠中の家族が開いても、赤ちゃんの手当しか無かった）。判断はせず、電話の先だけ */}
      <section
        id="mama"
        aria-labelledby="mama-h"
        className="flex scroll-mt-4 flex-col gap-2 rounded-2xl border border-line bg-card p-4"
      >
        <h2 id="mama-h" className="font-display text-xl font-bold">
          妊娠中・産後のママの体
        </h2>
        <p className="text-base leading-relaxed">
          出血・破水（水っぽいものが出た）・強いお腹の痛みや張り・胎動が少ない・ひどい頭痛や目のちかちか・産後の大量の出血や高い熱の時は、
          <b>かかっている産院へ電話</b>します（夜間も休みの日も）。
        </p>
        <p className="text-sm text-muted">
          産院の番号は、診察券や母子手帳の表紙に書いてあることが多いです。わが家の設定で病院を入れておくと、「聞く」の答えに電話のボタンが出ます。迷ったら
          119。
        </p>
      </section>

      <nav aria-label="このページの中" className="flex flex-wrap gap-2">
        <a
          href="#mama"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          妊娠中・産後のママ
        </a>
        <a
          href="#choke"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          のどに詰まった
        </a>
        <a
          href="#cpr"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          反応が無い・息をしていない
        </a>
        <a
          href="#pregnancy"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          妊娠中・産後の体の急ぎ
        </a>
      </nav>

      {/* 出典を頭に（折りたたみの奥だけだと、アプリが独自に手当を教えているように見える） */}
      <p className="text-sm text-muted">
        下の手当は、「救急蘇生法の指針2025（市民用）」（消防庁が2026年10月に全国の消防へ通知）と、日本蘇生協議会の「JRC蘇生ガイドライン2025」の要点です。アプリが判断した物ではありません。
      </p>

      <Card id="choke" title="のどに物が詰まった" sub="窒息（ちっそく）">
        <p className="rounded-lg bg-paper px-3 py-2 text-base">
          <b>せきができる・泣ける時</b>
          は、せきを続けさせます。口の中に見える物だけを取ります。指で奥を探ると、もっと奥へ押し込むことがあります。
        </p>
        <p className="text-base font-semibold text-alert">
          声が出ない・息ができない・顔色が悪くなってきた時は、大声で人を呼び、119を頼みます。一人で頼める人がいない時は、119より先に、下の取り出す手当を始めます。
        </p>

        {/* 子の月齢に合う方を先に出す（ChokeOrder。妊娠中・分からない時は「1歳になる前」が先） */}
        <ChokeOrder
          baby={
            <>
              <h3 className="font-display text-lg font-bold">
                1歳になる前の赤ちゃん
              </h3>
              <ol className="flex flex-col gap-2">
                <Step n={1}>
                  <b>背中をたたく</b>:
                  赤ちゃんをうつぶせにして片腕に乗せ、手であごを支えて、頭を体より低くします。手のひらの付け根で、背中の真ん中（肩甲骨〈けんこうこつ〉の間＝かたの
                  ほねの あいだ）を強く5回ほどたたきます。
                </Step>
                <Step n={2}>
                  <b>胸を押す</b>:
                  あお向けにして頭を低くし、胸の真ん中（左右の乳首を結ぶ線の真ん中あたり）を、片手の手のひらの付け根で強く5回ほど押します。
                </Step>
                <Step n={3}>
                  出てくるか、ぐったりするまで、1と2をくり返します。お腹を突き上げる方法は、赤ちゃんにはしません。
                </Step>
              </ol>
            </>
          }
          child={
            <>
              <h3 className="font-display text-lg font-bold">1歳を過ぎた子</h3>
              <ol className="flex flex-col gap-2">
                <Step n={1}>
                  <b>背中をたたく</b>:
                  背中の真ん中（かたの ほねの
                  あいだ）を、手のひらの付け根で強く5回ほどたたきます。
                </Step>
                <Step n={2}>
                  <b>お腹を突き上げる</b>: 出てこなければ、後ろから抱えるように腕を回し、片手でにぎりこぶしを作って、おへその少し上に当てます。もう片方の手でこぶしを包み、手前の上の方へ、すばやく5回ほど突き上げます。
                </Step>
                <Step n={3}>
                  出てくるか、ぐったりするまで、1と2をくり返します。
                </Step>
              </ol>
            </>
          }
        />
        <p className="text-base">
          <b>ぐったりして反応が無くなったら</b>
          、すぐに下の「心肺蘇生」へ。お腹を突き上げた時は、出てきても病院で診てもらいます。
        </p>
      </Card>

      <Card
        id="cpr"
        title="反応が無い・息をしていない"
        sub="心肺蘇生（しんぱいそせい）"
      >
        <ol className="flex flex-col gap-2">
          <Step n={1}>
            <b>反応を見る</b>:
            肩をたたいて大きな声で呼びます（赤ちゃんは足の裏をたたく）。
          </Step>
          <Step n={2}>
            <b>人を呼ぶ</b>: 反応が無ければ、大声で人を呼び、119 と AED
            を頼みます。一人なら、スマホをスピーカーにして119。話しながら手当を始めます。
          </Step>
          <Step n={3}>
            <b>息を見る</b>:
            胸とお腹が動いているかを10秒以内で見ます。ふだんどおりの息が無い・分からない時は、すぐに次へ。
          </Step>
          <Step n={4}>
            <b>胸を押す</b>:
            胸の真ん中を、胸の厚みの3分の1が沈むくらい強く、1分に100〜120回の速さで、休まず押します。赤ちゃんは片手の手のひらの付け根で（左右の乳首を結ぶ線の真ん中あたり）。子どもは両手で（体が小さければ片手でも）。
          </Step>
          <Step n={5}>
            <b>息を吹き込む</b>:
            やり方を習った人は、押す30回ごとに息を2回。できなければ、押すことだけを続けます。
          </Step>
          <Step n={6}>
            <b>AED が来たら</b>:
            ふたを開けて電源を入れ、声の案内のとおりに。小学校に上がる前の子は、未就学児用のパッドかモード（前の呼び名は小児用）があれば使います。無ければ大人用で代わりにします（赤ちゃんは体が小さいので、胸と背中に貼ります）。
          </Step>
          <Step n={7}>救急隊に代わるまで、押すのを続けます。</Step>
        </ol>
      </Card>

      <PregnancyUrgent slot="bottom" />

      <section className="flex flex-col gap-2 text-sm text-muted">
        <p>
          このページは、手当の要点を短くまとめた物です。手当は、消防署などの救命講習で一度体で覚えておくのがいちばんです。
        </p>
        <details className="group">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1">
            <span className="underline underline-offset-2">なぜ？（出典）</span>
            <span
              className="transition-transform group-open:rotate-90"
              aria-hidden
            >
              ›
            </span>
          </summary>
          <div className="mt-1 flex flex-col gap-1 rounded-lg bg-paper px-3 py-2">
            <p>
              日本救急医療財団「救急蘇生法の指針2025（市民用）」と日本蘇生協議会「JRC蘇生ガイドライン2025」を元に、消防庁が全国の消防へ出した通知（消防救第385号・2026年10月23日）の「主に市民が行う一次救命処置」から、言葉を短くしました。2025年版で、赤ちゃんの胸を押すのは指2本から片手の手のひらの付け根に変わり、1歳を過ぎた子の窒息は背中をたたくのが先になりました。
            </p>
            <p>
              紙の母子健康手帳の「子どもの事故の手当」のページ（こども家庭庁 任意様式 2026年1月15日版 73〜75ページ）は、2025年版より前の書き方です。原文はそれぞれのページで読めます。
            </p>
            <p>
              {SOURCES.map((s, i) => (
                <span key={s.href}>
                  {i > 0 && " ・ "}
                  <a
                    href={s.href}
                    className="underline underline-offset-2"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {s.label}
                  </a>
                </span>
              ))}
            </p>
            <p>
              #8000
              は、厚生労働省の「子ども医療電話相談事業」で、都道府県が行っています（つながる時間は都道府県ごとに違います）。
            </p>
            <p>
              NET119 は、声での119番が難しい人が、スマホの画面から文字で通報できる仕組みです（消防庁。2026年4月で全国719の消防本部のうち677本部。使う前に住む町の消防本部への登録が要ります）。電話リレーサービスは、法律にもとづく公共の仕組みで、通訳の人が手話や文字と声をつないでくれます（24時間。110・119・118にもかけられます）。
            </p>
          </div>
        </details>
      </section>
    </main>
  );
}
