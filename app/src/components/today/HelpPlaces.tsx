"use client";

// 頼れる所（相談の橋）。今日の「相談できる人」の問い（ConsultAsk）・手帳の「相談した記録」・気持ちの記録から、同じ物を開く。
// 体の判断・心の相談はしない（大会の決まり・ビジョン⑤「橋」）。電話先と窓口を、責めずに短く並べるだけ。
// 並び: 町のこども家庭センター → 産後ケア → こころの健康相談統一ダイヤル → 子育てがつらい時に話せる電話 → DV相談＋ → 思いがけない妊娠 → #8000 → 日本語以外 → 119（末尾・控えめ）。
// いつも同じ並びで出す（言えない事を、アプリが当てにいかない）。押しても何も記録しない。
//
// 出典（番号は一次の出典で確かめた）:
// - DV相談＋ 0120-279-889（内閣府。電話は24時間・通話料はかからない。チャットは12〜22時・外国語はチャットで24時間）
//   内閣府 男女共同参画局 https://www.gender.go.jp/policy/sokushin/ouen/safe/dv/ ・ https://soudanplus.jp/ （2026-11-05 に確かめた）。
//   「今すぐ警察官に駆けつけてもらいたいような緊急の場合は、110番に通報してください」（DV相談＋のページ）
// - 思いがけない妊娠の相談窓口サイト（こども家庭庁の補助事業・相談は無料）https://ninshin-soudan.go.jp/
//   こども家庭庁「相談窓口」https://www.cfa.go.jp/children-inquiries が国の窓口として挙げる。妊娠の相談だけの全国1つの番号は無い（2026-11-05 に確かめた）
// - こころの健康相談統一ダイヤル 0570-064-556（ナビダイヤル・通話料あり・050 の IP 電話からは不可・時間は都道府県ごと）
//   厚生労働省「まもろうよ こころ」電話相談 https://www.mhlw.go.jp/mamorouyokokoro/soudan/tel （2026-11-03 に確かめた）
// - 児童相談所 相談専用ダイヤル 0120-189-783（無料・近くの児童相談所につながる。子育てや出産に悩んだ時の電話）
//   こども家庭庁 https://www.cfa.go.jp/policies/jidougyakutai/gyakutai-taiou-dial （受付時間は確かめられなかったので書かない）
// - 子ども医療電話相談 #8000（厚生労働省の事業・都道府県が行う）https://www.mhlw.go.jp/topics/2006/10/tp1010-3.html
// - こども家庭センター: 児童福祉法の改正（2024年4月〜）で市区町村に置く相談の窓口（努力義務。2025年5月1日で1,240/1,741＝71.2%。
//   こども家庭庁の調査。犯罪被害者白書 令和7年版・大阪府の資料の引用で確かめた）
// - 声で話せない時: 消防庁「NET119緊急通報システム」（事前の登録が要る）https://www.fdma.go.jp/mission/enrichment/kyukyumusen_kinkyutuhou/net119.html
//   電話リレーサービス（令和2年法律第53号・総務大臣指定の提供機関。24時間・110/119/118 に発信できる）https://www.nftrs.or.jp/
// - 産後ケア事業: 母子保健法 第17条の2（出産後1年を経過しない母と子。市区町村の事業）
// - 日本語以外の相談先: 出入国在留管理庁「外国人生活支援ポータルサイト」https://www.moj.go.jp/isa/support/portal/12_00227.html
//   外国人在留総合インフォメーションセンター 0570-013904 https://www.moj.go.jp/isa/consultation/center/index.html
import type { Family } from "@/lib/demo-family";
import { mapUrl } from "@/lib/handoff";
import { useDevice, Why } from "../ui";

interface Row {
  title: string;
  sub: string;
  href: string;
  label: string;
}

/** 頼れる所の行（町の窓口は、確かな番号が手元に無いので地図と調べる道だけ。番号は tel: で押せば電話がかかる） */
export function helpRows(family: Pick<Family, "prefecture" | "city">, apple: boolean, loss = false): Row[] {
  const town = `${family.prefecture}${family.city}`;
  // つらい別れのあと（静かにする loss）は、赤ちゃんがいる前提の行（産後ケア・子育ての電話・#8000）と、妊娠の相談の行を出さない
  const forBaby = new Set(["産後ケア", "子育てがつらい時に話せる電話 0120-189-783", "思いがけない妊娠の相談窓口", "子どもの急な病気 #8000"]);
  const rows: Row[] = [
    {
      title: `${family.city}のこども家庭センター・保健センター`,
      sub: "妊娠中から子育てまで、何でも聞ける町の窓口です（保健師さんがいます）",
      href: mapUrl(`${town} こども家庭センター`, apple),
      label: "地図で探す",
    },
    {
      title: "町の窓口の電話番号を調べる",
      sub: `「${family.city} こども家庭センター」で調べると、町の公式のページに電話番号があります`,
      href: `https://www.google.com/search?q=${encodeURIComponent(`${town} こども家庭センター 電話`)}`,
      label: "調べる",
    },
    {
      title: "産後ケア",
      sub: "出産後1年ごろまで、助産師さんに泊まりや通いで手伝ってもらえます（町の事業。申し込み方は町ごと）",
      href: mapUrl(`${town} 産後ケア`, apple),
      label: "地図で探す",
    },
    {
      title: "こころの健康相談統一ダイヤル 0570-064-556",
      sub: "住んでいる県や市の、心の電話相談につながります（通話料がかかります。時間は県ごと）",
      href: "tel:0570064556",
      label: "電話する",
    },
    {
      title: "子育てがつらい時に話せる電話 0120-189-783",
      sub: "無料。近くの相談の窓口につながります",
      href: "tel:0120189783",
      label: "電話する",
    },
    {
      title: "DV相談＋ 0120-279-889",
      sub: "夫やパートナーからの暴力の相談（内閣府）。電話は24時間・通話料はかかりません。今すぐ危ない時は110番",
      href: "tel:0120279889",
      label: "電話する",
    },
    {
      title: "思いがけない妊娠の相談窓口",
      sub: "全国の相談窓口を、夜間・土日・LINE などで探せます（こども家庭庁のサイト。相談は無料）",
      href: "https://ninshin-soudan.go.jp/",
      label: "探す",
    },
    {
      title: "子どもの急な病気 #8000",
      sub: "生まれた後、夜や休みの日に、小児科の先生や看護師さんに電話で聞けます",
      href: "tel:%238000",
      label: "電話する",
    },
    {
      title: "日本語以外で相談したい時（English・中文・Tiếng Việt など）",
      sub: "住んでいる県の、外国の人のための相談窓口を、言葉で探せます（出入国在留管理庁）",
      href: "https://www.moj.go.jp/isa/support/portal/12_00227.html",
      label: "探す",
    },
    {
      title: "声で話せない時（耳が聞こえにくい時）",
      sub: "手話や文字で電話できる電話リレーサービス（24時間・110や119にも）。文字で119に通報できる NET119 もあります（町の消防本部に登録が要ります）",
      href: "https://www.nftrs.or.jp/",
      label: "見る",
    },
  ];
  return loss ? rows.filter((r) => !forBaby.has(r.title)) : rows;
}

function List({ family, loss }: { family: Family; loss?: boolean }) {
  const { apple } = useDevice();
  return (
    <>
      <ul className="flex flex-col">
        {helpRows(family, apple, loss).map((r) => (
          <li key={r.title} className="flex items-center justify-between gap-3 border-b border-line py-2 last:border-b-0">
            <span className="min-w-0">
              <span className="block text-base font-semibold">{r.title}</span>
              <span className="block text-sm text-muted">{r.sub}</span>
            </span>
            <a
              href={r.href}
              target={r.href.startsWith("http") ? "_blank" : undefined}
              rel="noreferrer"
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-ink/20 px-3 text-sm font-semibold"
            >
              {r.label}
            </a>
          </li>
        ))}
      </ul>
      {/* 命の橋は末尾に控えめに（相談の場で赤い119を大きく出して、怖がらせない） */}
      <p className="text-sm text-muted">
        命に関わる時は <a href="tel:119" className="underline underline-offset-2">119</a>。妊娠中・産後の体の急ぎは、かかっている産院へ（夜間も）。
      </p>
      <Why>
        <p>こども家庭センターは、2024年4月から市区町村に置かれ始めた相談の窓口です（児童福祉法。2025年5月で約7割の市区町村。まだの町は保健センターが窓口です）。産後ケアは出産後1年までの母と子のための市区町村の事業で、使える人や料金は町ごとに違います（母子保健法）。</p>
        <p>
          0570-064-556 は厚生労働省の「こころの健康相談統一ダイヤル」で、かけた場所の都道府県・政令市の公的な相談窓口につながります（ナビダイヤルなので通話料がかかり、050 の IP 電話からはつながりません）。
        </p>
        <p>0120-189-783 は、こども家庭庁の「児童相談所 相談専用ダイヤル」です。叱られる所ではなく、出産や子育てに悩んだ時に話せる電話です。#8000 は、厚生労働省の「子ども医療電話相談事業」で、都道府県が行っています（つながる時間は都道府県ごと）。</p>
        <p>
          DV相談＋は、内閣府の配偶者やパートナーからの暴力の相談窓口です（電話は24時間・通話料なし。チャットは12時〜22時、外国語はチャットで24時間）。今すぐ危ない時は110番です。思いがけない妊娠の相談窓口サイトは、こども家庭庁の補助事業で、全国の窓口を時間や相談のしかたで探せます。妊娠の相談だけの全国で1つの番号はありません（2026年11月に確かめました）。
        </p>
        <p>
          NET119 は、声での119番が難しい人がスマホの画面から文字で通報できる仕組みです（消防庁。2026年4月で全国719の消防本部のうち677本部。使う前に住む町の消防本部への登録が要ります）。電話リレーサービスは法律にもとづく公共の仕組みで、通訳の人が手話や文字と声をつなぎます（2026年に確かめました）。
        </p>
        <p>
          日本語以外の相談先は、出入国在留管理庁の「外国人生活支援ポータルサイト」で、都道府県・言葉・相談のしかた（窓口・電話・メール・LINE）から探せます。在留の手続きの質問は、外国人在留総合インフォメーションセンター（0570-013904・平日。英語・中国語・ベトナム語など11の言葉）でも聞けます（2026年に確かめました）。
        </p>
      </Why>
    </>
  );
}

/**
 * 頼れる所。compact は1行の「頼れる所 ›」で開く畳み（label で言い方を変えられる）。
 * 例: <HelpPlaces family={family} compact />（手帳の「相談した記録」・気持ちの記録から）
 */
export function HelpPlaces({ family, compact, label = "頼れる所", loss }: { family: Family; compact?: boolean; label?: string; loss?: boolean }) {
  if (compact) {
    return (
      <details className="group rounded-2xl border border-line bg-card px-4">
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-base font-semibold">
          <span>{label}</span>
          <span className="text-muted transition-transform group-open:rotate-90" aria-hidden>
            ›
          </span>
        </summary>
        <div className="flex flex-col gap-2 pb-3">
          <List family={family} loss={loss} />
        </div>
      </details>
    );
  }
  return (
    <section aria-label="頼れる所" className="flex flex-col gap-2">
      <List family={family} loss={loss} />
    </section>
  );
}
