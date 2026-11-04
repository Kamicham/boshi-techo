// 頼れる所の行（並び・番号・つながらない時の番号）。画面は HelpPlaces.tsx、番号の出典はその頭の注。
// 試験（HelpPlaces.test.ts）から読めるよう、JSX の無いこのファイルに分けた（部品の .tsx は vitest で読めない）。
import type { Family } from "@/lib/demo-family";
import { line8000 } from "@/lib/emergency-lines";
import { mapUrl } from "@/lib/handoff";

export interface Row {
  title: string;
  sub: string;
  href: string;
  label: string;
  /** 「#」の番号につながらない時のふつうの番号（#8000 の行だけ。家族の県が分かる時） */
  alt?: { instead: string; tel: string; where: string };
}

/** 頼れる所の行（町の窓口は、確かな番号が手元に無いので地図と調べる道だけ。番号は tel: で押せば電話がかかる） */
export function helpRows(family: Pick<Family, "prefecture" | "city">, apple: boolean, loss = false): Row[] {
  const town = `${family.prefecture}${family.city}`;
  const n8000 = line8000(family.prefecture);
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
      ...(n8000 ? { alt: { instead: "#8000", tel: n8000.tel, where: n8000.prefecture } } : {}),
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
