// 急ぎの時: のどに物が詰まった（窒息）・反応が無い（心肺蘇生）。紙の母子手帳の終わりの方にある「救急の手当」のページの考え方を、短く自分の言葉で。
// 通信が無くても開けるよう、public/sw.js がこのページと部品を取っておく。家族の読み込みを待たずに出す（emergency/Frame.tsx）。
// 体の判断はしない。手当の手順と、119・#8000・#7119・かかっている産院（ママの体の急ぎ）への橋だけ。
// 言い分け: 命が危ないと思ったら、迷わず 119（通報すると、電話の向こうで手当を教えてもらえる）。救急車を呼ぶか迷う時は、子どもの事は #8000、
// 大人の体（ママ）の事は #7119（家族の町で実施している時だけ。lib/emergency-lines.ts）。「迷ったら119」とは書かない（迷う時の相談先より先に119へ向かわせる）。
// 1画面目（iPhone 390×844）に、ママの体の札（妊娠中・産後8週まで）・119・#8000（・#7119）が収まるよう、119 の赤を画面いっぱいに伸ばさない。
// Safari のツールバーが出ている高さ（664px ほど）でも、妊娠中の札・119・#8000 が入るよう、高さ760px以下では余白と119を詰める。
// 「#」の入った番号（#8000・#7119）のボタンには、すぐ下に家族の県の窓口のふつうの番号を添える（電話によって「#」のリンクがかからない事がある。
// 番号の表と出典は lib/emergency-lines.ts。家族の県が分からない時は添えない）。
//
// 119 の例（息をしていない・反応が無い・けいれんが止まらない）は消防庁の言葉に合わせた:
// - 消防庁「緊急度判定プロトコル Ver.3 救急受診ガイド」（「呼吸をしていない。息がない。」「呼びかけても、反応がない。」）
//   https://www.fdma.go.jp/mission/enrichment/appropriate/items/kyuukyuuzyushinngaido.pdf
// - 消防庁「救急車を上手に使いましょう」令和7年12月 p.4（「けいれんが止まらない」）https://www.fdma.go.jp/publication/portal/items/portal002_japanese121.pdf
// #7119: 消防庁「救急安心センター事業（♯7119）ってナニ？」https://www.fdma.go.jp/mission/enrichment/appropriate/appropriate007.html （2026-11-04 に確かめた。
//   つながらない時のふつうの番号は 2026-11-05 に「♯7119 又は」の後の番号を写した）
// 泣きやまない時: こども家庭庁「赤ちゃんが泣きやまない」とガイドブック（制作 厚生労働省。p.2・3・7〜10）の文を、言い換えずに引く（2026-11-05 にページで確かめた）
//   https://www.cfa.go.jp/policies/jidougyakutai/nakiyamanai
//   0120-189-783: こども家庭庁「出産や子育てに悩んだ時は、こちらにお電話ください。」https://kodomoshien.cfa.go.jp/no-gyakutai/ （受付時間は確かめられなかったので書かない）
//
// 出典（原文は写さず、要点を自分の言葉でまとめた）:
// - 消防庁 消防救第385号「『救急蘇生法の指針2025（市民用）』への対応について」2026-10-23（別紙＝主に市民が行う一次救命処置）
//   https://www.fdma.go.jp/laws/tutatsu/items/20261023_kyuuki_01.pdf （2026-11-04 に本文を確かめた。乳児の胸骨圧迫は2本指でなく片手の手のひらの付け根・
//   押す所は胸の真ん中＝左右の乳頭を結ぶ線の真ん中あたり・気道異物は背部叩打・腹部突き上げ・胸部突き上げをそれぞれ5回程度・1歳以上は背部叩打が先）
// - 日本蘇生協議会「JRC蘇生ガイドライン2025」https://www.jrc-cpr.org/jrc-guideline-2025/
// - こども家庭庁「母子健康手帳 任意様式」2026-01-15版 p.73-75「子どもの事故の手当」（2025年版より前の物。新しい方に合わせた）
//   https://www.cfa.go.jp/policies/boshihoken/techou
// - 厚生労働省「子ども医療電話相談事業（#8000）」（都道府県が行う）https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html
//   （つながらない時のふつうの番号は、同じページの「子ども医療電話相談事業実施状況（令和８年５月22日現在）」の表。2026-11-05 に写した）
// - 消防庁「NET119緊急通報システム」（2026-04-01 で719本部のうち677本部が導入・事前の登録が要る）
//   https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/net119.html
// - 電話リレーサービス: 聴覚障害者等による電話の利用の円滑化に関する法律（令和2年法律第53号）。総務大臣指定の提供機関
//   一般財団法人日本財団電話リレーサービス https://www.nftrs.or.jp/ （24時間・110/119/118 に発信できる）
import type { Metadata } from "next";
import Link from "next/link";
import { CRY_LINES } from "@/lib/cautions";
import { Alt8000, ChokeOrder, Line7119, MamaUrgent } from "./ChokeOrder";

export const metadata: Metadata = { title: "急ぎの時 | 母子手帳" };
// 通信が無くても開けるよう、作る時に1回だけ組み立てる（家族の情報は何も入らない）
export const dynamic = "force-static";

const SOURCES = [
  { label: "消防庁の通知（救急蘇生法の指針2025）", href: "https://www.fdma.go.jp/laws/tutatsu/items/20261023_kyuuki_01.pdf" },
  { label: "JRC蘇生ガイドライン2025", href: "https://www.jrc-cpr.org/jrc-guideline-2025/" },
  { label: "こども家庭庁 母子健康手帳について", href: "https://www.cfa.go.jp/policies/boshihoken/techou" },
  { label: "厚生労働省 #8000", href: "https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html" },
  { label: "消防庁 #7119", href: "https://www.fdma.go.jp/mission/enrichment/appropriate/appropriate007.html" },
  { label: "消防庁 救急受診ガイド", href: "https://www.fdma.go.jp/mission/enrichment/appropriate/items/kyuukyuuzyushinngaido.pdf" },
  { label: "消防庁 救急車を上手に使いましょう", href: "https://www.fdma.go.jp/publication/portal/items/portal002_japanese121.pdf" },
  { label: "こども家庭庁 赤ちゃんが泣きやまない", href: "https://www.cfa.go.jp/policies/jidougyakutai/nakiyamanai" },
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
    // 高さの低い画面（Safari のツールバーが出ている iPhone は 664px ほど）では、上の余白・119・#8000 を詰める（妊娠中でも札・119・#8000 を1画面目に）
    <main className="flex flex-col gap-4 px-4 pt-4 pb-12 [@media(max-height:760px)]:gap-3 [@media(max-height:760px)]:pt-2">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-base text-muted underline-offset-2 hover:underline"
        >
          ‹ 今日へ
        </Link>
        <span className="text-xs text-muted">電波が無くても開けます</span>
      </div>

      {/* 妊娠中と産後8週までの家族では、ママの体の札（産院への電話）を一番上に（ほかの家族ではページの下） */}
      <MamaUrgent slot="top" />

      {/* 開いたら電話の画面（作り手の声「急ぎの時は読むより、まず電話」）。1画面目に、命が危ない時の119と、迷う時の #8000（・#7119）。
          119 の赤は画面いっぱいに伸ばさない（伸ばすと、産後の家族で #8000 が1画面目の外に落ちた）。
          開いただけで自動でかける事はしない（Web からはできず、手が当たって開いた時に誤った通報になる）。押せば発信の確かめへ進む */}
      <section aria-label="電話する" className="flex flex-col gap-3">
        <a
          href="tel:119"
          className="flex min-h-36 flex-col items-center justify-center gap-1 rounded-2xl bg-alert px-4 py-4 text-center text-white [@media(max-height:760px)]:min-h-0 [@media(max-height:760px)]:gap-0.5 [@media(max-height:760px)]:py-3"
        >
          <span className="font-display text-4xl font-bold [@media(max-height:760px)]:text-3xl">119 にかける</span>
          <span className="text-base font-semibold">命が危ないと思ったら、迷わずこちら</span>
          <span className="text-sm">
            息をしていない・反応が無い・けいれんが止まらない。手当のしかたも電話で教えてもらえます
          </span>
        </a>
        {/* #8000 のボタンと、つながらない時の家族の県のふつうの番号（Alt8000。県が分かる時だけ）を1つの枠に */}
        <div className="flex flex-col overflow-hidden rounded-2xl border-2 border-sky bg-card">
          <a
            href="tel:%238000"
            className="flex min-h-20 flex-col items-center justify-center gap-1 px-4 py-3 text-center [@media(max-height:760px)]:py-2"
          >
            <span className="font-display text-2xl font-bold text-sky">
              #8000 に聞く
            </span>
            <span className="text-sm text-muted">
              子どもの事で、救急車を呼ぶか迷う時はまずこちら。夜や休みの日に、小児科の先生や看護師さんに聞けます
            </span>
          </a>
          <Alt8000 />
        </div>
        {/* 大人の体（ママ）の事で迷う時。家族の町で実施している時だけ（消防庁の一覧） */}
        <Line7119 />
        {/* 耳が聞こえにくい・声で話せない時の道（消防庁 NET119・電話リレーサービス） */}
        <p className="rounded-lg bg-paper px-3 py-2 text-sm leading-relaxed">
          <b>声で話せない時</b>: 文字で119に通報できる「NET119」（前もって住む町の消防本部に登録が要ります）と、手話や文字で110・119にもつながる「電話リレーサービス」（24時間）があります。
        </p>
        <p className="text-center text-sm text-muted">
          手当の手順は、この下にあります ↓
        </p>
      </section>

      {/* ママの体の札は1つ（MamaUrgent・id="mama"）。妊娠中と産後8週までは一番上、ほかはページの下（第29回: 妊娠中の家族が開いても、赤ちゃんの手当しか無かった） */}
      <nav aria-label="このページの中" className="flex flex-wrap gap-2">
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
          href="#crying"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          泣きやまない
        </a>
        <a
          href="#mama"
          className="inline-flex min-h-11 items-center rounded-full border border-ink/20 bg-card px-4 text-base font-semibold"
        >
          妊娠中・産後のママの体
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

      {/* 泣きやまない時（言えない時の橋）: こども家庭庁のガイドブック（制作 厚生労働省）の文を言い換えずに引くだけ。手当や心の相談にはしない */}
      <Card id="crying" title="赤ちゃんが泣きやまない時" sub="こども家庭庁「赤ちゃんが泣きやまない」の言葉のまま">
        {/* 言葉は lib/cautions.ts の CRY_LINES（今日の画面の「気をつける事」の札と同じ物を読む。同じ言葉を2か所に書かない） */}
        <ul className="flex flex-col gap-2 text-base leading-relaxed">
          {CRY_LINES.map((l) => (
            <li key={l.page} className={l.alert ? "font-semibold text-alert" : undefined}>
              {l.says.map((s) => `「${s}」`).join("")}
              {l.after && `（${l.after}）`}
              <span className={`text-xs text-muted${l.alert ? " font-normal" : ""}`}>（{l.page}）</span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-2">
          <div className="flex flex-col overflow-hidden rounded-2xl border border-sky/50">
            <a href="tel:%238000" className="flex min-h-12 items-center justify-between gap-3 px-4 py-2">
              <span className="min-w-0">
                <span className="block text-base font-semibold text-sky">#8000</span>
                <span className="block text-sm text-muted">子どもの事で、受診するか迷う時（夜や休みの日）</span>
              </span>
              <span className="shrink-0 text-sm font-semibold">電話する</span>
            </a>
            <Alt8000 />
          </div>
          <a
            href="tel:0120189783"
            className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-ink/20 px-4 py-2"
          >
            <span className="min-w-0">
              <span className="tabular block text-base font-semibold">0120-189-783</span>
              <span className="block text-sm text-muted">「出産や子育てに悩んだ時は、こちらにお電話ください。」（こども家庭庁・無料）</span>
            </span>
            <span className="shrink-0 text-sm font-semibold">電話する</span>
          </a>
        </div>
        <p className="text-xs text-muted">
          ページの数字は、こども家庭庁のページにあるガイドブック「赤ちゃんが泣きやまない」（制作 厚生労働省）のページです。
        </p>
      </Card>

      <MamaUrgent slot="bottom" />

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
              「#8000」「#7119」のように「#」の入った番号は、電話によっては、画面のボタンからかからない事があります。そのため、すぐ下に、わが家の県の窓口のふつうの番号を添えています（#8000 は厚生労働省の実施状況の表〈2026年5月22日現在〉の「一般ダイヤル回線」の番号、#7119 は消防庁の一覧の「♯7119 又は」の後の番号）。
            </p>
            <p>
              #7119 は、消防庁の「救急安心センター事業」で、救急車を呼ぶか・今すぐ病院へ行くかを迷う時に相談できます。2026年10月の一覧では42の地域が行っていて、三重・島根・佐賀・宮崎・鹿児島はまだ無く、北海道・愛知・和歌山は一部の町だけです。このページは、わが家の住む町にある時だけ出します（町は、わが家の情報の都道府県と市区町村から）。
            </p>
            <p>
              119 の例（息をしていない・反応が無い・けいれんが止まらない）は、消防庁の「救急受診ガイド」と「救急車を上手に使いましょう」の言葉です。ほかにも命が危ないと思ったら、迷わず119です。ママの体の札の引用は、母子健康手帳の国の様式（こども家庭庁）の言葉です。泣きやまない時の札は、こども家庭庁のページ「赤ちゃんが泣きやまない」の言葉をそのまま引いています。
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
