// 急ぎの時の電話のうち、町で違う物: #7119（救急安心センター事業）を、家族の住む町で実施しているか。
// 急ぎの時の画面は通信なしで開くので、表はここに持つ（家族の都道府県と市区町村だけで決める。Claude も通信も使わない）。
// 体の判断はしない。#7119 は「大人の体（ママ）の事で、救急車を呼ぶか迷う時」の相談先として出すだけ（子どもの事は #8000）。
//
// 出典（2026-11-04 に開いて確かめた）:
// - 総務省消防庁「救急安心センター事業（♯7119）ってナニ？」の実施地域の一覧（42のセンター・利用地域・番号・利用時間）
//   https://www.fdma.go.jp/mission/enrichment/appropriate/appropriate007.html
// - 総務省消防庁「救急安心センター事業（♯７１１９）の全国展開」（PDF の作成日 2026-10-23。「全国42地域で実施（R８年度末予定）」
//   「都道府県内全域：39地域」「都道府県内一部：３地域」。未実施は三重・島根・佐賀・宮崎・鹿児島。島しょ部などの除く町は※１〜４）
//   https://www.fdma.go.jp/mission/enrichment/appropriate/items/appropriate006_01_kyukyu_anshin_02.pdf
//   R8年度に始まる2つ（岡山県の全域 2026年7月・秋田県 2026年10月1日 開始＝秋田県の案内）は、もう始まっている。
// 受付の時間は一覧の原文を短くした物（「全日24時間」の地域は書かない）。人口の割合などの数字は画面に書かない。
// 一覧に「携帯電話からは」「◯◯町等は」と別の番号が書かれた町（山口県の岩国市・和木町、京都府の笠置町・南山城村）は、その番号にかける。

export const N7119_SOURCE = {
  label: "消防庁「救急安心センター事業（♯7119）ってナニ？」",
  href: "https://www.fdma.go.jp/mission/enrichment/appropriate/appropriate007.html",
  checked: "2026-11-04",
} as const;

/** 47都道府県（並びは全国地方公共団体コードの順） */
export const PREFECTURES = [
  "北海道", "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "富山県", "石川県", "福井県", "山梨県", "長野県", "岐阜県", "静岡県", "愛知県",
  "三重県", "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県", "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

/**
 * 実施している地域。all＝県の全域（except の町を除く）・only＝この市区町村だけ。
 * hours は24時間でない時の受付の時間。dial は #7119 ではなく別の番号にかける町（町の名 → 番号）。
 */
type Area =
  | { all: true; except?: readonly string[]; hours?: string; dial?: Readonly<Record<string, string>> }
  | { only: readonly string[]; hours?: string; dial?: Readonly<Record<string, string>> };

const ALL: Area = { all: true };

export const N7119: Readonly<Partial<Record<Prefecture, Area>>> = {
  // 一部（※５）: 救急安心センターさっぽろ
  北海道: { only: ["札幌市", "石狩市", "当別町", "新篠津村", "島牧村", "南幌町", "栗山町", "長沼町", "北広島市", "恵庭市", "江別市"] },
  青森県: ALL,
  岩手県: ALL,
  宮城県: ALL,
  秋田県: { all: true, hours: "月〜金は午後6時〜翌午前8時・土日祝は24時間" },
  山形県: { all: true, hours: "毎日 午後6時〜翌午前8時" },
  福島県: ALL,
  茨城県: ALL,
  栃木県: { all: true, hours: "月〜金は午後4時〜翌午前10時・土日祝は午前10時〜翌午前10時" },
  群馬県: ALL,
  埼玉県: ALL,
  千葉県: ALL,
  // ※１ 島しょ部を除く（東京都の島しょの2町7村）
  東京都: { all: true, except: ["大島町", "利島村", "新島村", "神津島村", "三宅村", "御蔵島村", "八丈町", "青ヶ島村", "小笠原村"] },
  神奈川県: ALL,
  新潟県: { all: true, hours: "毎日 午後6時〜翌午前8時（春の大型連休・年末年始は24時間）" },
  富山県: { all: true, hours: "平日は午後7時〜翌午前9時・土曜は午後1時〜翌午前9時・日祝は午前9時〜翌午前9時" },
  石川県: ALL,
  福井県: ALL,
  山梨県: ALL,
  長野県: { all: true, hours: "平日は午後7時〜翌午前8時・土日祝と年末年始は午前8時〜翌午前8時" },
  岐阜県: ALL,
  静岡県: ALL,
  // 一部: 救急安心センターなごや（名古屋市内）
  愛知県: { only: ["名古屋市"] },
  滋賀県: ALL,
  // 一覧「（※笠置町・南山城村等は、0570-00-7119）」
  京都府: { all: true, dial: { 笠置町: "0570-00-7119", 南山城村: "0570-00-7119" } },
  大阪府: ALL,
  兵庫県: ALL,
  奈良県: ALL,
  // 一部（※６）: 田辺市救急安心センター
  和歌山県: { only: ["田辺市", "美浜町", "日高町", "由良町", "印南町", "みなべ町", "日高川町", "白浜町", "上富田町", "すさみ町"] },
  鳥取県: ALL,
  岡山県: ALL,
  // ※２ 大崎上島町を除く
  広島県: { all: true, except: ["大崎上島町"] },
  // ※３ 萩市・阿武町を除く。岩国市・和木町は広島の救急相談センターが受け、一覧に「山口県のエリアから携帯電話でかける場合は 082-246-2000へ」
  山口県: { all: true, except: ["萩市", "阿武町"], dial: { 岩国市: "082-246-2000", 和木町: "082-246-2000" } },
  徳島県: { all: true, hours: "月〜土は午後6時〜翌午前8時・日祝と年末年始は24時間" },
  香川県: { all: true, hours: "毎日 午後7時〜翌午前8時" },
  愛媛県: ALL,
  高知県: ALL,
  福岡県: ALL,
  長崎県: ALL,
  熊本県: ALL,
  大分県: { all: true, hours: "平日・土曜は午後7時〜翌朝8時・日祝は午前8時〜翌朝8時（お盆・年末年始を含む）" },
  // ※４ 与那国町・北大東村を除く
  沖縄県: { all: true, except: ["与那国町", "北大東村"] },
  // 未実施（2026-10-23 の一覧に無い）: 三重県・島根県・佐賀県・宮崎県・鹿児島県
};

/** 電話をかけるリンク（#7119 の # は %23。lib/ask/bridge.ts の telHref と同じ。急ぎの画面の荷を軽くするため、bridge を読み込まない） */
export function telLink(tel: string): string {
  return `tel:${tel.replace(/#/g, "%23").replace(/[^0-9%+]/g, "")}`;
}

/** 家族が入れた都道府県を、47の名前のどれかに寄せる（「埼玉」「東京」のように都・府・県の無い書き方も）。当たらなければ null */
export function normPref(s: string | undefined | null): Prefecture | null {
  const t = (s ?? "").replace(/\s+/g, "");
  if (!t) return null;
  return PREFECTURES.find((p) => p === t || p.replace(/[都府県]$/, "") === t) ?? null;
}

/**
 * 市区町村の書き方をそろえる。頭の都道府県の名（「東京都八丈町」「東京八丈町」）と「◯◯郡」（「西牟婁郡白浜町」→「白浜町」）を外す。
 * 「京都市」「和歌山市」のように県の名で始まる市と、「大和郡山市」の「郡」は外さない。
 */
function normCity(city: string | undefined | null, pref: Prefecture): string {
  let c = (city ?? "").replace(/\s+/g, "");
  const short = pref.replace(/[都府県]$/, "");
  if (c.startsWith(pref)) c = c.slice(pref.length);
  else if (short !== pref && c.startsWith(short) && !/^[市区町村]/.test(c.slice(short.length))) c = c.slice(short.length);
  return c.replace(/^[^郡]+郡(?=[^市区]*[町村]$)/, "");
}

/**
 * この町の家族に #7119 を出すか。出す時は受付の時間（24時間なら null）と、かける番号（ふつうは "#7119"）を返す。
 * 出さない時（未実施・県の外れる町・一部だけの県で町が違う／分からない・都道府県が分からない）は null。
 * 市区町村は「札幌市中央区」のように区まで入っていても、頭で当てる。
 */
export function line7119(
  prefecture: string | undefined | null,
  city: string | undefined | null,
): { hours: string | null; tel: string } | null {
  const pref = normPref(prefecture);
  if (!pref) return null;
  const area = N7119[pref];
  if (!area) return null;
  const c = normCity(city, pref);
  const hit = (names: readonly string[]) => names.some((name) => c.startsWith(name));
  if ("only" in area) {
    if (!c || !hit(area.only)) return null;
  } else if (c && area.except && hit(area.except)) {
    return null;
  }
  const dial = area.dial ? Object.entries(area.dial).find(([name]) => c.startsWith(name))?.[1] : undefined;
  return { hours: area.hours ?? null, tel: dial ?? "#7119" };
}
