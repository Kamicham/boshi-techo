// 用語集: 母子保健と行政の言葉の訳（日本語 → 简体中文・English）。辞書（dict/）の訳は、ここの言葉にそろえる（i18n.test.ts が確かめる）。
//
// 決め事（2026-11-05 多言語化のプラン・作り手の承認）:
// - 母子保健の言葉は、こども家庭庁の外国語版の母子健康手帳を正にする（日本の窓口で家族が見る紙の手帳と、同じ言葉にする）。
// - 手帳に無い行政の言葉は、出入国在留管理庁の生活・就労ガイドブックを正にする。
// - 公の訳が見つからない言葉は「一般の訳」（general）と印を付け、日本で暮らす中国語の話者の家族に読んでもらって直す。
// - 公の外国語の資料は金額が古い（出産育児一時金42万円・児童手当の拡充の前）。言葉の手本にだけ使い、金額は日本語の一次の出典から。
// - 窓口で使う言葉は、訳した画面でも日本語を括弧で並べる（例: 提交出生登记（出生届））。窓口で指させるように。
// - 安全の文（119・#8000・急ぎの手当）は言い換えずに訳す。
// - 揺れる訳は alt に持つ（ガイドブックと手帳で訳が違う言葉など）。辞書の訳は、正の訳か alt のどれかを含める。

export type Source = "mch" | "isa" | "general";

export const SOURCES: Readonly<Record<Source, { title: string; year: string; url?: string }>> = {
  mch: {
    title: "こども家庭庁「外国語版の母子健康手帳」（R5。中文は简体字。R5_CN_240301.pdf・R5_EN_240301.pdf）",
    year: "2024-03",
    url: "https://mchbook.cfa.go.jp/category03/index.php",
  },
  isa: {
    title: "出入国在留管理庁「生活・就労ガイドブック」（中文・English 第7版）",
    year: "2025-03",
    url: "https://www.moj.go.jp/isa/support/portal/guidebook_all.html",
  },
  general: { title: "一般の訳（公の訳が見つからなかった言葉。家族に読んでもらって直す）", year: "2026-11" },
};

export interface Term {
  /** 日本語（辞書の鍵にこの言葉があれば、訳はこの用語集の言葉を使う） */
  ja: string;
  /** 日本語の別の書き方（略した言い方など） */
  jaAlt?: readonly string[];
  zh: string;
  zhAlt?: readonly string[];
  en: string;
  enAlt?: readonly string[];
  source: Source;
  /** 窓口で使う言葉（訳した画面でも、日本語を括弧で並べる） */
  counter?: boolean;
}

export const GLOSSARY: readonly Term[] = [
  { ja: "母子健康手帳", jaAlt: ["母子手帳"], zh: "母子健康手册", en: "Maternal and Child Health Handbook", source: "mch", counter: true },
  { ja: "妊婦健康診査", jaAlt: ["妊婦健診"], zh: "孕妇健康检查", en: "health checkup for expectant mothers", enAlt: ["prenatal checkup"], source: "mch", counter: true },
  { ja: "出生届", zh: "出生登记", zhAlt: ["出生申报"], en: "birth registration", source: "mch", counter: true },
  { ja: "児童手当", zh: "儿童补贴", zhAlt: ["儿童津贴"], en: "child allowance", source: "mch", counter: true },
  { ja: "予防接種", zh: "预防接种", en: "immunization", enAlt: ["vaccination"], source: "mch" },
  { ja: "1か月健診", zh: "满月儿健康检查", en: "checkup at one month old", enAlt: ["one-month checkup"], source: "mch" },
  { ja: "新生児訪問", zh: "新生儿访问", en: "newborn home visit", source: "mch" },
  { ja: "両親学級", zh: "双亲讲习班", en: "parenting class", source: "mch" },
  { ja: "出産予定日", jaAlt: ["予定日"], zh: "预产期", en: "due date", source: "mch" },
  { ja: "#8000", zh: "儿童医疗咨询热线（#8000）", zhAlt: ["#8000"], en: "Children's Medical Hotline (#8000)", enAlt: ["#8000"], source: "mch" },
  { ja: "救急車", zh: "救护车", en: "ambulance", source: "mch" },
  { ja: "保育所", zh: "保育所", en: "daycare center", enAlt: ["nursery"], source: "mch", counter: true },
  { ja: "転入届", zh: "迁入申报", en: "moving-in notification", source: "isa", counter: true },
  { ja: "住民票", zh: "住民票", en: "certificate of residence", source: "isa", counter: true },
  { ja: "健康保険証", zh: "健康保险证", en: "health insurance card", source: "isa", counter: true },
  { ja: "出産育児一時金", zh: "分娩育儿一次性补贴", en: "Childbirth and Childcare lump-sum grant", source: "isa", counter: true },
  { ja: "出産手当金", zh: "分娩补贴", en: "maternity allowance", source: "isa", counter: true },
  { ja: "育児休業給付", zh: "育儿休假补贴", en: "childcare leave benefit", source: "isa", counter: true },
  { ja: "産前産後休業", jaAlt: ["産休"], zh: "产前产后休假", en: "maternity leave", source: "isa" },
  { ja: "育児休業", jaAlt: ["育休"], zh: "育儿休假", en: "childcare leave", source: "isa" },
  { ja: "乳幼児健診", zh: "婴幼儿健康检查", en: "health checkup for infants and young children", source: "isa" },
  { ja: "子ども医療費助成", zh: "小儿医疗费补助", en: "medical expense subsidy for children", source: "isa", counter: true },
  { ja: "里帰り出産", zh: "回乡分娩", en: "giving birth in your hometown", source: "isa" },
  { ja: "妊婦のための支援給付", zh: "孕妇支援给付", en: "support benefit for pregnant women", source: "general", counter: true },
  { ja: "産婦健康診査", jaAlt: ["産婦健診"], zh: "产妇健康检查", en: "postpartum checkup for mothers", source: "general" },
  // 11/5 午後に足した言葉（窓口と地域の支え手）。出典は外国語版の母子健康手帳（R5）と生活・就労ガイドブック（中文・English 第7版）の本文で確かめた
  // （出生連絡票は、手帳の訳と今の訳「出生联络单・birth notification card」のどちらにそろえるかを決めてから足す）
  { ja: "こども家庭センター", zh: "儿童家庭中心", en: "Children and Family Center", source: "isa", counter: true },
  { ja: "子育て世代包括支援センター", zh: "育儿家庭综合支援中心", en: "comprehensive support center for families with children", source: "mch", counter: true },
  { ja: "保健センター", zh: "保健中心", en: "municipal health center", enAlt: ["health center"], source: "mch", counter: true },
  { ja: "保健所", zh: "保健所", en: "public health center", source: "mch", counter: true },
  { ja: "保健師", zh: "保健师", en: "public health nurse", source: "mch" },
  { ja: "産後ケア", zh: "产后护理", en: "postpartum care", source: "isa" },
  { ja: "国民健康保険", jaAlt: ["国保"], zh: "国民健康保险", en: "National Health Insurance", source: "isa", counter: true },
  { ja: "マイナンバーカード", zh: "个人编号卡", en: "Individual Number Card", enAlt: ["My Number Card"], source: "isa", counter: true },
  { ja: "戸籍", zh: "户籍", en: "family register", enAlt: ["koseki"], source: "isa", counter: true },
];
