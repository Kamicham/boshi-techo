// 母子手帳の魂（記録の背骨）。国の様式（母子保健法施行規則 様式第三号＝府令様式、2026年4月施行版）のページの並びで、
// 家族が話す・撮るだけで記録が積み上がる。紙の手帳が正本のまま、二重に書かせない。
// 出典: こども家庭庁「母子健康手帳について」https://www.cfa.go.jp/policies/boshihoken/techou （府令様式 2026年・任意様式 2026-01-16版）
// 約束: 体の判断はしない。数字・色・発達に「異常」「正常」を言わない。手帳と同じ注意書きと、相談先への橋だけ。
// このファイルは画面からもサーバからも読む（server-only にしない）。保存は db の type "techo"（中身は TechoEntry）。

/** 府令様式のページ（並びもこの順。最後に一冊） */
export const TECHO_PAGES = [
  { id: "mother-health", title: "妊婦の健康状態", note: "本人が書く（既往歴・アレルギー・前のお産など）", part: "妊娠" },
  { id: "pregnancy-checkup", title: "妊娠中の経過（妊婦健診）", note: "健診ごとの週数・体重・血圧・尿など。医師が紙に書いた物を撮る", part: "妊娠" },
  { id: "pregnancy-test", title: "検査の記録（妊娠）", note: "血液型・感染症など。とりわけ配慮が要る記録", part: "妊娠" },
  { id: "feeling", title: "気持ちの記録", note: "迎える気持ち・父親や周りの人の記録・誕生日のメッセージ", part: "妊娠" },
  { id: "birth", title: "出産の状態", note: "生まれた日・週数・体重・身長・頭囲など", part: "出産" },
  { id: "postpartum", title: "産後の母の経過", note: "産後の健診・気分（自分の言葉で）・産後ケアの利用", part: "出産" },
  { id: "newborn", title: "新生児の記録", note: "退院時の体重・ビタミンK2・新生児の検査・2週間ごろ", part: "新生児" },
  { id: "stool", title: "便色カード", note: "国の7色と見比べて、選んだ番号を記録する", part: "新生児" },
  { id: "growth", title: "成長（身長・体重・頭囲）", note: "発育曲線に点を打つ", part: "成長" },
  { id: "development", title: "できた日", note: "首すわり・寝返り・ひとりすわり・はいはい・つかまり立ち・ひとり歩き・指さし・ことば", part: "成長" },
  { id: "child-checkup", title: "乳幼児健診", note: "1か月〜の健診の結果（医師が紙に書いた物を撮る）", part: "成長" },
  { id: "vaccine", title: "予防接種の記録", note: "接種日・ワクチン・ロット・医療機関。証明の控え", part: "接種" },
  { id: "consult", title: "相談した記録", note: "相談できる人・相談した日と相手", part: "つなぐ" },
] as const;

export type TechoPageId = (typeof TECHO_PAGES)[number]["id"];
export const TECHO_PAGE_IDS = TECHO_PAGES.map((p) => p.id) as readonly TechoPageId[];

/** 誰が書いた・話したか */
export type TechoSource = "voice" | "photo" | "text" | "seed";

/** 便色カードの7色（府令様式の備考の色名。番号は手帳と同じ 1〜7）。sample は画面の見本で、印刷の色の近似（実物は紙の手帳のカードで見比べる） */
export const STOOL_COLORS = [
  { no: 1, name: "灰白色", sample: "#e9e7df" },
  { no: 2, name: "象牙色", sample: "#efe3c2" },
  { no: 3, name: "明るい黄緑色", sample: "#e3e39a" },
  { no: 4, name: "暗い黄色", sample: "#cfae3c" },
  { no: 5, name: "黄土色", sample: "#c39a3a" },
  { no: 6, name: "金茶色", sample: "#a8701f" },
  { no: 7, name: "暗いオリーブ色", sample: "#6b5a1e" },
] as const;
/** 便色カードの案内（手帳の文言の要約。判定ではない） */
export const STOOL_NOTE = "1〜3番に近い色の時は、1日も早く小児科などを受診してください（便色カード・母子健康手帳）。迷う時は #8000。";

/** 発達の「できた日」の項目（府令様式の保護者の記録。時期を書く形＝その子のペースを守る） */
export const DEVELOPMENT_ITEMS = ["首すわり", "寝返り", "ひとりすわり", "はいはい", "つかまり立ち", "つたい歩き", "ひとり歩き", "指さし", "意味のあることば"] as const;
export const DEVELOPMENT_NOTE = "できた時期は子どもによって違います。目安より早くても遅くても、その子のペースです。気になる事は健診で聞いてください（母子健康手帳の考え方）。";

/** 発育曲線の注意書き（手帳の文言） */
export const GROWTH_NOTE = "「ふつう」の帯に入らないからといって、ただちに異常というわけではありません。気になる事は健診で聞いてください（母子健康手帳）。";

/**
 * 1件の記録。page ごとに values の中身が違う（下の型）。
 * 体の数字は、家族が話したか、紙の手帳から写した物だけ。Claude が作った数字は入れない。
 */
export interface TechoEntry {
  page: TechoPageId;
  /** その事の日（YYYY-MM-DD） */
  date: string;
  /** 一覧に出す短い見出し（例: 「妊娠24週の健診」「寝返り」「BCG」） */
  title: string;
  /** page ごとの値（下の *Values） */
  values: Record<string, string | number | boolean | null>;
  /** 誰の事・誰が書いたか（呼び名。気持ちの記録は書いた人） */
  who?: string;
  source: TechoSource;
  /** 撮った・話した元の言葉（短く） */
  note?: string;
  /** 同じ1回の入力から生まれた束（capture の captureId と同じ考え方） */
  captureId?: string;
  /** まだ家族が OK していない（撮った・話した直後の候補） */
  pending?: boolean;
}

/** page ごとの values の決まり（キーは英字。単位はキー名の通り。分からない値は入れない） */
export interface TechoValueKeys {
  "mother-health": { heightCm?: number; weightKg?: number; history?: string; allergy?: string; medicine?: string; pastBirths?: string; smoking?: string };
  "pregnancy-checkup": { week?: string; weightKg?: number; bpHigh?: number; bpLow?: number; fundusCm?: number; edema?: string; urineProtein?: string; urineSugar?: string; memo?: string; facility?: string };
  "pregnancy-test": { test: string; result?: string };
  feeling: { text: string; occasion?: string };
  birth: { week?: string; weightG?: number; heightCm?: number; headCm?: number; chestCm?: number; method?: string; place?: string };
  postpartum: { days?: number; text?: string; care?: string };
  newborn: { dayAge?: number; weightG?: number; feeding?: string; vitaminK?: string; test?: string; result?: string };
  stool: { colorNo: number; ageText?: string };
  growth: { weightKg?: number; heightCm?: number; headCm?: number };
  development: { item: string };
  "child-checkup": { checkup: string; result?: string; weightKg?: number; heightCm?: number; memo?: string };
  vaccine: { vaccine: string; dose?: string; lot?: string; facility?: string; doctor?: string };
  consult: { has?: boolean; whom?: string; text?: string };
}

/** 時期ごとに1つだけ聞く「相談できる人はいますか」（府令様式の保護者の記録で毎回聞く問い） */
export const CONSULT_QUESTION = "困った時に相談できる人はいますか？";
