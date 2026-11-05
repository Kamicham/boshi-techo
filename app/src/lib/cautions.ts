// 気をつける事の札（総点検の85件から作り手が選んだ・2026-11-05）
// 期限が無く、済みにしなくてよい札。時期と家族の形を見て1枚ずつ、国の資料の言葉をそのまま差し出す（体の判断はしない）。
// 中身は、国の資料の言葉の引用（言い換えない。出典の名・年・頁を添える）と、電話・窓口への道だけ。
// 人数（亡くなった数など）は札に出さず「なぜ今？」の中に置く。眠り方や体の良し悪しは言わない。たばこは聞かず、責めない。
// Claude API は使わない。
//
// 守る線（cautionFor が見る。置き場は components/Techo.tsx が「今やる1つ」の下に決める）:
//   - 一度に1枚。「読んだ」で閉じた日は、次の札を出さない（seen.day）
//   - 生まれた日は誰の画面にも出さない（ようこその1枚の日）。生まれた翌日から14日は母の画面に出さない
//     （招待した祖父母の端末も、今の作りでは母として見るので同じ）
//   - 静かにする家族（つらい別れ・入院）には出さない
//   - お祝いの札・手帳の気づき・届けの束を全部出す日（busy）は出さない（大きな札を2枚並べない）
//   - 「読んだ」はこの端末にだけ覚える（祖父母は手帳に書けないため。家族の誰かが読んでも、ほかの家族の画面からは消えない）
//
// 出典（すべて 2026-11-05 に一次の原文で確かめた。URL も同じ日に開く事を確かめた）:
//   - こども家庭庁「乳幼児突然死症候群（SIDS）について」（2026年10月の版）
//   - こども家庭庁 報道発表「11月は「乳幼児突然死症候群(SIDS)」の対策強化月間です」（令和8年10月21日・29日差替え）
//   - こども家庭庁「こどもの事故防止ハンドブック」（令和8年3月版）p.4・5・6・10・11・16
//   - 母子健康手帳の任意様式「月齢・年齢別で見る起こりやすい事故」（こども家庭庁 令和7年12月23日）
//   - 母子健康手帳の府令様式（2026年4月施行版）p.1・18・28
//   - 厚生労働省「ハチミツを与えるのは１歳を過ぎてから。」
//   - こども家庭庁「赤ちゃんが泣きやまない」とガイドブック（制作 厚生労働省）p.2・3・7〜10
//   - 労働基準法 第65条（e-Gov 法令検索）
//   - 厚生労働省「高額療養費制度を利用される皆さまへ」・協会けんぽ「医療費が高額になりそうなとき（限度額適用認定証）」
//   - 厚生労働省「マイナンバーカードの健康保険証利用（マイナ保険証）について」
//   - マイナンバーカード総合サイト「顔写真なしのマイナンバーカードとはどのようなものですか？」
//   - こども家庭庁「児童手当制度のご案内」（現況届）
//   - （公財）日本中毒情報センター 中毒110番（ハンドブック p.16）
//   - 人数: 「令和7年には59名の乳児がSIDSで亡くなっており」（こども家庭庁のページ）は、人口動態統計 令和7年（確定数）の0歳
import { addDays, addMonths, diffDays, lmpFromDue } from "./clock";
import { t } from "./i18n";
import { backDate, satogaeriReach } from "./satogaeri";
import { motherEmployed, type Situation } from "./situation";

export type CautionCall = "8000" | "189" | "poison";
export type CautionKind = "safety" | "know" | "skip";

export interface CautionQuote {
  /** 国の資料の言葉（言い換えない。中の「」は、画面で『』にして引く） */
  text: string;
  /** 出典の名・年・頁 */
  from: string;
  /** alert = 命の橋の1行（赤。急ぎの時の札と同じ）、bold = 太字 */
  tone?: "alert" | "bold";
}

export interface CautionSource {
  label: string;
  href: string;
}

export interface Caution {
  /** 端末の「読んだ」に使う（年ごとの札は年を入れる） */
  id: string;
  kind: CautionKind;
  title: string;
  /** 引用の前に、このアプリが添える一言（判断はしない・引用の外） */
  lead?: string;
  quotes: CautionQuote[];
  /** 引用の後に、このアプリが添える一言（引用の外） */
  after?: string;
  /** なぜ今？の中身（1行目は、この札をいつ出すか） */
  why: string[];
  sources: CautionSource[];
  calls: CautionCall[];
  /** 急ぎの時の画面への道（ラベルと行き先） */
  emergency?: { label: string; href: string };
  /** 町の保健センターを地図で探す道 */
  center?: boolean;
}

export const CAUTION_LABEL: Record<CautionKind, string> = { safety: "気をつける事", know: "知っておく事", skip: "しなくていい事" };
/** 札の種類（年の付く札は、年を外した形。試験と早送りの検査が「そろって出るか」を見る） */
export const CAUTION_IDS = ["skip-before", "sleep", "birth-proof", "cry", "skip-after", "acc-1m", "acc-5m", "acc-roll", "acc-crawl", "acc-stand", "acc-walk", "sleep-nov", "sleep-home", "skip-june"] as const;
const RANK: Record<CautionKind, number> = { safety: 0, know: 1, skip: 2 };

/** 中毒110番（ハンドブック p.16。24時間対応） */
export const POISON_LINES = [
  { name: "大阪中毒110番", tel: "072-727-2499" },
  { name: "つくば中毒110番", tel: "029-852-9999" },
] as const;
export const POISON_NOTE = "化学物質（たばこ、家庭用品など）、医薬品、動植物の毒などによる中毒事故が実際に起きて、どう対処したらよいか迷った場合は相談してください。";

// ── 出典 ──
const SRC = {
  sids: { label: "こども家庭庁「乳幼児突然死症候群（SIDS）について」", href: "https://www.cfa.go.jp/policies/boshihoken/kenkou/sids/" },
  press: { label: "こども家庭庁「11月は乳幼児突然死症候群（SIDS）の対策強化月間です」（令和8年10月）", href: "https://www.cfa.go.jp/press/e64cf5c5-1de9-4983-af20-e9f5cfc3f4bc" },
  handbook: { label: "こども家庭庁「こどもの事故防止ハンドブック」（令和8年3月版）", href: "https://www.cfa.go.jp/policies/child-safety-actions/handbook" },
  nini: { label: "母子健康手帳の任意様式「月齢・年齢別で見る起こりやすい事故」（こども家庭庁）", href: "https://mchbook.cfa.go.jp/pdf/item_3_2.pdf" },
  techo: { label: "こども家庭庁「母子健康手帳について」（府令様式）", href: "https://www.cfa.go.jp/policies/boshihoken/techou" },
  honey: { label: "厚生労働省「ハチミツを与えるのは１歳を過ぎてから。」", href: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/0000161461.html" },
  cry: { label: "こども家庭庁「赤ちゃんが泣きやまない」", href: "https://www.cfa.go.jp/policies/jidougyakutai/nakiyamanai" },
  law65: { label: "労働基準法 第65条（e-Gov 法令検索）", href: "https://laws.e-gov.go.jp/law/322AC0000000049" },
  kougaku: { label: "厚生労働省「高額療養費制度を利用される皆さまへ」", href: "https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryouhoken/juuyou/kougakuiryou/index.html" },
  kenpo: { label: "協会けんぽ「医療費が高額になりそうなとき」", href: "https://www.kyoukaikenpo.or.jp/benefit/high_cost_medical_expenses/001/index.html" },
  myna: { label: "厚生労働省「マイナンバーカードの健康保険証利用（マイナ保険証）について」", href: "https://www.mhlw.go.jp/stf/newpage_08277.html" },
  photo: { label: "マイナンバーカード総合サイト「顔写真なしのマイナンバーカードとはどのようなものですか？」", href: "https://www.kojinbango-card.go.jp/faq_photo13/" },
  teate: { label: "こども家庭庁「児童手当制度のご案内」", href: "https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai" },
} satisfies Record<string, CautionSource>;

const FROM = {
  sids: "こども家庭庁「乳幼児突然死症候群（SIDS）について」",
  press: "こども家庭庁 報道発表（令和8年10月）",
  hb: (p: number) => `こどもの事故防止ハンドブック（令和8年3月版）p.${p}`,
  nini: (age: string) => `母子健康手帳の任意様式「月齢・年齢別で見る起こりやすい事故」（令和7年12月）${age}`,
  techo: (p: string) => `母子健康手帳（府令様式 2026年4月施行版）${p}`,
  cry: (p: string) => `ガイドブック「赤ちゃんが泣きやまない」${p}`,
};

/** 泣きやまない時: こども家庭庁のガイドブック（制作 厚生労働省）の文（言い換えない）。急ぎの時の画面と札の両方がここを読む */
export interface CryLine {
  says: string[];
  page: string;
  /** 引用の外に添える言葉（括弧で） */
  after?: string;
  /** 命の橋の1行（赤） */
  alert?: boolean;
  /** 今日の画面の札に出す文の数（頭から。無い時は札に出さない。全文は急ぎの時の画面） */
  card?: number;
}
export const CRY_SOURCE = SRC.cry;
export const CRY_LINES: readonly CryLine[] = [
  { says: ["赤ちゃんが泣いても、誰が悪いわけでもないのです。", "泣かれてイライラしても、当然のことです。"], page: "p.3", card: 1 },
  { says: ["これまでの研究で、関わり方によらず生後1-2か月に泣きのピークがあることがわかりました。", "しかし、ピークが過ぎれば、泣きはだんだん収まってきます。"], page: "p.2", card: 1 },
  { says: ["まず、赤ちゃんが欲しがっていると思うものをたしかめてみましょう。"], page: "p.7", after: "ミルクをあげる・おむつを替える・抱っこをする" },
  { says: ["また、高熱が出ていたり、心配であれば、医療機関を受診しましょう。"], page: "p.8" },
  {
    says: ["いろいろ試しても泣きやまない。それでも問題ありません。", "その時は、赤ちゃんを安全な場所に寝かせて、その場を離れましょう。", "そして自分がリラックスしましょう。", "少ししたら、戻って赤ちゃんの様子を確認しましょう。"],
    page: "p.9",
    card: 4,
  },
  { says: ["無理に泣きやませようと激しく揺さぶらないでください。", "また、泣き声が周囲に聞こえないようにと赤ちゃんの口をふさがないでください。"], page: "p.10", alert: true, card: 2 },
];

// ── 札の中身（時期と関係のない部分） ──
type Body = Omit<Caution, "id" | "why"> & { why?: string[] };

const SIDS_POINTS = [
  "（1）1歳になるまでは、「あおむけ」に寝かせましょう: SIDSは睡眠中に起こります。うつぶせ寝、あおむけ寝のどちらの体勢でも起こっていますが、あおむけに寝かせたほうが発症率が低いことが研究でわかっています。医学上の理由でうつぶせ寝を勧められている場合以外は、赤ちゃんの顔が見えるあおむけに寝かせましょう。睡眠中の窒息事故を防ぐ上でも有効です。",
  "（2）無理のない範囲で母乳育児を: 母乳で育てられている赤ちゃんのほうが、SIDSの発症率が低いことが研究でわかっています。様々な事情があり、すべての人が母乳育児ができるわけではありません。授乳に関して少しでも不安を感じる場合は、授乳支援を実施している病院（産科や小児科等）や保健センターなどに相談してみましょう。",
  "（3）たばこはやめましょう: たばこもSIDSの発症要因のひとつであるといわれています。赤ちゃんのそばにいる人がたばこを吸うことは、SIDSの発症率を高くすることがわかっています。また、妊婦自身の喫煙、まわりの人が吸ったたばこの副流煙を妊婦が吸う「受動喫煙」も生まれた後のSIDSの発症リスクになります。こどもに関わるすべての大人は喫煙をやめましょう。",
  "（4）あたためすぎには注意しましょう: 赤ちゃんの過度な保温によって、SIDSの発症率が上がります。赤ちゃんの胸元を触ってみて、汗ばんでいる場合には、着るものや室温で調整しましょう。",
];
const SIDS_COUNT = "「令和7年には59名の乳児がSIDSで亡くなっており、乳児期の死亡原因としては第4位となっています。」（こども家庭庁のページ。人数は人口動態統計 令和7年の確定数の0歳）";
const SIDS_NOT_BAN = "なお、上記の記載は、いずれも、予防策をお示しするものであり、当該行為を禁止するものではありません。";

function sleepBody(title: string): Body {
  return {
    kind: "safety",
    title,
    quotes: [
      { text: "1歳になるまでは、「あおむけ」に寝かせましょう", from: FROM.sids },
      { text: "寝具は硬めで傾斜のないものを", from: FROM.sids },
      { text: "寝床には何も置かずにすっきりと", from: FROM.sids },
      { text: "赤ちゃん専用の寝床が安心につながります", from: FROM.sids },
      { text: "あたためすぎには注意しましょう", from: FROM.sids },
      { text: "大人用ベッドに取り付ける幼児用ベッドガードは、生後18か月未満の乳幼児には絶対に使用しないでください。", from: FROM.hb(4), tone: "bold" },
      { text: SIDS_NOT_BAN, from: FROM.sids },
    ],
    why: [
      SIDS_COUNT,
      "SIDSの発症リスクを下げる4つのポイント（こども家庭庁のページの全文）:",
      ...SIDS_POINTS,
      `母子健康手帳の保護者の記録（2週間頃 p.18 ほか）にも「寝かせるときは、あお向けに寝かせていますか。」の問いがあります。`,
    ],
    sources: [SRC.sids, SRC.handbook, SRC.techo],
    calls: [],
    center: true,
  };
}

const BODIES = {
  sleep: () => sleepBody("赤ちゃんの寝る所"),
  "sleep-home": () => ({ ...sleepBody("戻る家の、赤ちゃんの寝る所"), lead: "戻る家の寝る所も、同じ点で整えておく時期です。" }),
  "sleep-nov": (): Body => ({
    kind: "safety",
    title: "11月は SIDS の対策強化月間",
    quotes: [
      { text: "乳幼児突然死症候群(SIDS)は12月以降の冬期に発症しやすい傾向があることから、こども家庭庁は、毎年11月を乳幼児突然死症候群(SIDS)の対策強化月間と定め…", from: FROM.press },
      { text: "あたためすぎには注意しましょう", from: FROM.sids },
      { text: "赤ちゃんの過度な保温によって、SIDSの発症率が上がります。赤ちゃんの胸元を触ってみて、汗ばんでいる場合には、着るものや室温で調整しましょう。", from: FROM.sids },
      { text: SIDS_NOT_BAN, from: FROM.sids },
    ],
    why: [SIDS_COUNT, "SIDSの発症リスクを下げる4つのポイント（こども家庭庁のページの全文）:", ...SIDS_POINTS],
    sources: [SRC.press, SRC.sids],
    calls: [],
  }),
  cry: (): Body => ({
    kind: "safety",
    title: "赤ちゃんが泣きやまない時",
    quotes: CRY_LINES.filter((l) => l.card).flatMap((l) => l.says.slice(0, l.card).map((s) => ({ text: s, from: FROM.cry(l.page), tone: l.alert ? ("alert" as const) : undefined }))),
    why: ["ガイドブックの全文（欲しがっているものをたしかめる・高熱が出ていたら受診する、も）は、急ぎの時の画面にあります。"],
    sources: [SRC.cry],
    calls: ["8000", "189"],
    emergency: { label: "急ぎの時の画面（泣きやまない時の全文）", href: "/emergency#crying" },
  }),
  "acc-1m": (): Body => ({
    kind: "safety",
    title: "1か月ごろからの事故",
    quotes: [
      { text: "ベッドやソファー、抱っこひも、ベビーカーなどから落ちる（大人用ベッドではなく、出来るだけベビーベッドで寝かせ、常に柵を上げる）", from: FROM.nini("１～６か月") },
      { text: "抱いているこどもに熱い飲料をこぼす", from: FROM.nini("１～６か月") },
    ],
    sources: [SRC.nini],
    calls: ["8000"],
    emergency: { label: "急ぎの時の画面（119・#8000・手当の手順）", href: "/emergency" },
  }),
  "acc-5m": (): Body => ({
    kind: "safety",
    title: "食べ物で気をつける事",
    quotes: [
      { text: "１歳未満の赤ちゃんにハチミツやハチミツ入りの飲料・お菓子などの食品は与えないようにしましょう。", from: "厚生労働省「ハチミツを与えるのは１歳を過ぎてから。」" },
      {
        text: "球形や大きさから、気道に入り、つまりやすい食材（ミニトマト、ぶどう、さくらんぼ、個装チーズ、うずらの卵など）は、４等分して形や大きさを変え、皮を取り除くなど工夫しましょう。",
        from: FROM.hb(5),
      },
    ],
    sources: [SRC.honey, SRC.handbook],
    calls: ["8000"],
    emergency: { label: "急ぎの時の画面（のどに物が詰まった時の手当）", href: "/emergency#choke" },
  }),
  "acc-roll": (): Body => ({
    kind: "safety",
    title: "寝返りのころの事故",
    quotes: [
      { text: "寝ている間に動き回り、大人用ベッドと壁や後付け柵の隙間などに頭や顔が挟まるなどしないよう、できるだけベビーベッドに寝かせましょう。", from: FROM.hb(4) },
      { text: "寝ているこどもの顔の近くに、口や鼻を覆ったり、首に巻き付いたりする物は置かないようにしましょう。", from: FROM.hb(4) },
    ],
    sources: [SRC.handbook],
    calls: ["8000"],
    emergency: { label: "急ぎの時の画面（119・#8000・手当の手順）", href: "/emergency" },
  }),
  "acc-crawl": (): Body => ({
    kind: "safety",
    title: "はいはいのころの事故",
    quotes: [
      { text: "ボタン電池の誤飲は、食道に詰まったり胃の中にとどまったりすると重症事故につながります。ボタン電池を利用している器具は、電池が取り出せないようカバーを固定しましょう。", from: FROM.hb(5) },
      { text: "入浴後は、浴槽の水を抜き、浴室には外鍵を付けてこどもが入れないようにしましょう。", from: FROM.hb(10) },
    ],
    sources: [SRC.handbook],
    calls: ["8000", "poison"],
    emergency: { label: "急ぎの時の画面（119・#8000・手当の手順）", href: "/emergency" },
  }),
  "acc-stand": (): Body => ({
    kind: "safety",
    title: "つかまり立ちのころの事故",
    quotes: [
      { text: "たばこや豆などの異物誤飲に注意しましょう。", from: FROM.techo("p.28（9～10か月頃）") },
      { text: "電気ケトルなどにつかまり立ちをしたり、コードを引っ張ったりして倒してしまい、熱湯を浴びてやけどをすることがあります。", from: FROM.hb(11) },
    ],
    sources: [SRC.techo, SRC.handbook],
    calls: ["8000", "poison"],
    emergency: { label: "急ぎの時の画面（119・#8000・手当の手順）", href: "/emergency" },
  }),
  "acc-walk": (): Body => ({
    kind: "safety",
    title: "歩き始めのころの事故",
    quotes: [
      { text: "ベランダに植木鉢、椅子などの踏み台になるものを置かないようにしましょう。", from: FROM.hb(6) },
      { text: "窓に補助錠やストッパーをつけて、大きく開かないようにしましょう。", from: FROM.hb(6) },
    ],
    sources: [SRC.handbook],
    calls: ["8000"],
    emergency: { label: "急ぎの時の画面（119・#8000・手当の手順）", href: "/emergency" },
  }),
  "birth-proof": (): Body => ({
    kind: "know",
    title: "出生届と一緒に、手帳の1ページ目",
    lead: "出生届を出しに行く時は、母子手帳も持って行きます。",
    quotes: [{ text: "赤ちゃんが生まれたら14日以内に出生届をして、同時に上欄に出生届出済の証明を受けてください。", from: FROM.techo("p.1") }],
    why: ["手帳の1ページ目の「出生届出済証明」の欄は、出生届と同時に市区町村の窓口で証明を受ける欄です（府令様式 p.1「出生の届出があったことを証明する。」市区町村長の印）。"],
    sources: [SRC.techo],
    calls: [],
  }),
  "skip-after": (): Body => ({
    kind: "skip",
    title: "しなくていい事（生まれた後）",
    quotes: [
      {
        text: "当分の間、マイナ保険証を保有していない（マイナンバーカードの健康保険証利用登録をしていない）方等に、「資格確認書」が無償で申請によらず交付されます。",
        from: "厚生労働省「マイナンバーカードの健康保険証利用（マイナ保険証）について」",
      },
      { text: "交付申請者が申請時に１歳未満である場合については、顔写真は不要となります。", from: "マイナンバーカード総合サイト（マイナンバーカードの交付申請）" },
    ],
    after: "赤ちゃんを健康保険に入れる届けは要ります（「やる事」にあります）。",
    why: ["「従来の健康保険証は、2024年12月２日以降新たに発行されなくなり、マイナンバーカードの健康保険証利用（マイナ保険証）を基本とする仕組みに移行しています。」（厚生労働省）"],
    sources: [SRC.myna, SRC.photo],
    calls: [],
  }),
  "skip-june": (): Body => ({
    kind: "skip",
    title: "しなくていい事（6月の現況届）",
    quotes: [
      { text: "毎年6月分以降の児童手当を受けるには現況届の提出が必要でしたが、令和4年6月分以降については、原則提出が不要になります。", from: "こども家庭庁「児童手当制度のご案内」" },
      { text: "ただし、各市区町村の判断により、引き続き現況届の提出を求めることも可能ですので、お住いの市区町村の取り扱いに従ってご対応ください。", from: "こども家庭庁「児童手当制度のご案内」" },
    ],
    why: [
      "「なお、以下に該当する方は、引き続き現況届の提出が必要です。」（こども家庭庁）",
      "1．住民基本台帳上で住所を把握できない、法人である未成年後見人",
      "2．離婚協議中で配偶者と別居されている方",
      "3．配偶者からの暴力等により、住民票の住所地と異なる市区町村で受給している方",
      "4．支給要件児童の戸籍がない方",
      "5．施設等受給者",
      "6．その他、市区町村から提出の案内があった方",
    ],
    sources: [SRC.teate],
    calls: [],
  }),
};

/** しなくていい事（生まれる前）。母が雇われて働いている時だけ、労働基準法の産休の行を入れる */
function skipBeforeBody(s: Situation | undefined): Body {
  // 働き方が分からない時は、働いている側に数える（アプリのほかの所の motherEmployed と同じ）
  const work = motherEmployed(s);
  return {
    kind: "skip",
    title: "しなくていい事（生まれる前）",
    lead: work ? "産後8週の休みは、申し出なくても法律で決まっています（産前の6週は、請求した時です）。" : undefined,
    quotes: [
      ...(work
        ? [
            { text: "使用者は、産後八週間を経過しない女性を就業させてはならない。", from: "労働基準法 第65条第2項" },
            { text: "使用者は、六週間（多胎妊娠の場合にあつては、十四週間）以内に出産する予定の女性が休業を請求した場合においては、その者を就業させてはならない。", from: "労働基準法 第65条第1項" },
          ]
        : []),
      {
        text: "この取扱いを受けるには、マイナ保険証をご利用いただくか、事前に「限度額適用認定証（認定証）」を入手していただく必要があります。",
        from: "厚生労働省「高額療養費制度を利用される皆さまへ」",
      },
    ],
    after: "入院や手術で医療費が高くなった時の、窓口の支払いの上限の話です。マイナ保険証で受診するなら、認定証を前もって申請しなくてかまいません。",
    why: [
      ...(work ? ["第65条第2項の続き: 「ただし、産後六週間を経過した女性が請求した場合において、その者について医師が支障がないと認めた業務に就かせることは、差し支えない。」"] : []),
      "協会けんぽのページ: 「オンライン資格確認を導入していない医療機関等を受診される場合や、協会けんぽにマイナンバーの登録を行っていない場合に予め（医療機関等へ医療費を支払う前に）申請いただく必要があります。マイナ保険証を利用される場合は申請不要です。」「なお、被保険者が低所得者に該当する場合はマイナ保険証を利用される場合であっても、「限度額適用・標準負担額減額認定証」をご申請ください。」",
    ],
    sources: [...(work ? [SRC.law65] : []), SRC.kougaku, SRC.kenpo],
    calls: [],
  };
}

/** 月齢の事故の札: 月齢の目安と、手帳の「できた日」の早い方から60日の間 */
const ACCIDENTS = [
  { id: "acc-1m", months: 1 },
  { id: "acc-5m", months: 5 },
  { id: "acc-roll", months: 6, item: "寝返り" },
  { id: "acc-crawl", months: 8, item: "はいはい" },
  { id: "acc-stand", months: 10, item: "つかまり立ち" },
  { id: "acc-walk", months: 12, item: "ひとり歩き" },
] as const;
export type CautionDevItem = "寝返り" | "はいはい" | "つかまり立ち" | "ひとり歩き";
export const CAUTION_DEV_ITEMS: readonly CautionDevItem[] = ["寝返り", "はいはい", "つかまり立ち", "ひとり歩き"];
const ACCIDENT_DAYS = 60;

export interface CautionFamily {
  dueDate: string;
  birthDate?: string;
  city?: string;
  prefecture?: string;
  situation?: Situation;
}
export interface CautionSeen {
  /** この端末で「読んだ」札の id */
  ids: readonly string[];
  /** 最後に「読んだ」を押した日（その日は次の札を出さない） */
  day?: string;
}
export interface CautionCtx {
  /** 使う人の役（招待した祖父母の端末は、今の作りでは母） */
  role: "母" | "パートナー";
  /** お祝いの札・手帳の気づき・届けの束を全部出す日 */
  busy: boolean;
  /** 手帳の「できた日」（寝返り・はいはい・つかまり立ち・ひとり歩き） */
  dev?: Partial<Record<CautionDevItem, string>>;
}

const md = (d: string) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`;

/**
 * 手帳の記録（GET /api/techo の techo。{ id, data: TechoEntry } か平らな形）から、発達の「できた日」の一番早い日を読む。
 * OK 前の候補と、日付の無い記録（dateUnsure: none）は使わない。
 */
export function devDatesOf(raw: readonly unknown[]): Partial<Record<CautionDevItem, string>> {
  const out: Partial<Record<CautionDevItem, string>> = {};
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as { data?: unknown };
    const e = (o.data && typeof o.data === "object" ? o.data : r) as { page?: unknown; date?: unknown; values?: { item?: unknown }; pending?: unknown; dateUnsure?: unknown };
    const item = e.values?.item;
    if (e.page !== "development" || e.pending || e.dateUnsure === "none" || typeof e.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) continue;
    if (typeof item !== "string" || !(CAUTION_DEV_ITEMS as readonly string[]).includes(item)) continue;
    const k = item as CautionDevItem;
    if (!out[k] || e.date < out[k]!) out[k] = e.date;
  }
  return out;
}

/**
 * 今日この人に出す札（無ければ null）。期限は無く、時期の中で「読んだ」まで同じ札を出す。
 * 時期が重なった時は、命に関わる札 → 知っておく事 → しなくていい事の順、同じ種類なら始まりの早い順に1枚。
 */
export function cautionFor(f: CautionFamily, today: string, seen: CautionSeen, ctx: CautionCtx): Caution | null {
  if (f.situation?.quiet || ctx.busy || seen.day === today) return null;
  const lmp = lmpFromDue(f.dueDate);
  const b = f.birthDate && today >= f.birthDate ? f.birthDate : null;
  const d = b ? diffDays(today, b) : null;
  const mom = ctx.role !== "パートナー";
  if (d !== null && (d === 0 || (mom && d <= 14))) return null;

  const due: { c: Caution; from: string }[] = [];
  const add = (id: string, from: string, because: string, body: () => Body) => {
    if (seen.ids.includes(id)) return;
    const x = body();
    // 時期の1行は画面の言葉で（辞書は lib/i18n/dict/today.ts。サーバと試験ではいつも日本語）
    due.push({ c: { ...x, id, why: [t("この札を出す時期: {because}。", { because: t(because) }), ...(x.why ?? [])] }, from });
  };
  const week = b ? null : Math.floor(diffDays(today, lmp) / 7);
  const wk = (n: number) => addDays(lmp, n * 7);
  const ym = today.slice(0, 7);

  if (week !== null) {
    if (week >= 33) add("skip-before", wk(33), "妊娠33週から生まれるまで", () => skipBeforeBody(f.situation));
    if (week >= 34) add("sleep", wk(34), "妊娠34週から1歳まで", BODIES.sleep);
    if (week >= 36) add("birth-proof", wk(36), "妊娠36週から生まれるまで", BODIES["birth-proof"]);
  }
  if (b && d !== null) {
    if (today < addMonths(b, 12)) add("sleep", wk(34), "妊娠34週から1歳まで", BODIES.sleep);
    if (d >= 15 && today < addMonths(b, 3)) add("cry", addDays(b, 15), "生後15日から3か月まで", BODIES.cry);
    if (d >= (mom ? 15 : 1) && d < 90) add("skip-after", addDays(b, mom ? 15 : 1), mom ? "生後15日から3か月まで" : "生まれた翌日から3か月まで", BODIES["skip-after"]);
    for (const a of ACCIDENTS) {
      const byAge = addMonths(b, a.months);
      const did = "item" in a ? ctx.dev?.[a.item] : undefined;
      const early = did && did >= b && did <= today && did < byAge ? did : null;
      const start = early ?? byAge;
      if (today >= start && today < addDays(start, ACCIDENT_DAYS))
        add(
          a.id,
          start,
          early && "item" in a ? t("手帳の「{item}」のできた日（{date}）から60日の間", { item: t(a.item), date: md(early) }) : t("生後{n}か月から60日の間", { n: a.months }),
          BODIES[a.id],
        );
    }
    if (ym.endsWith("-11") && today < addMonths(b, 12)) add(`sleep-nov-${ym.slice(0, 4)}`, `${ym}-01`, "0歳の子がいる家の11月（SIDS の対策強化月間）", BODIES["sleep-nov"]);
    if (f.situation?.satogaeri && satogaeriReach(f, f.situation) !== "同じ市") {
      const back = backDate(b, f.situation.satogaeriBack);
      if (today >= addDays(back, -7) && today < back) add("sleep-home", addDays(back, -7), t("住む町に戻る日（{date}ごろ）の前の週", { date: md(back) }), BODIES["sleep-home"]);
    }
  }
  // 6月の現況届: 子のいる家（生まれた後か、上の子がいる家は妊娠中も）
  if (ym.endsWith("-06") && (b || f.situation?.olderChildren === true)) add(`skip-june-${ym.slice(0, 4)}`, `${ym}-01`, "子のいる家の6月（児童手当の現況届の月）", BODIES["skip-june"]);
  due.sort((x, y) => RANK[x.c.kind] - RANK[y.c.kind] || (x.from < y.from ? -1 : x.from > y.from ? 1 : 0));
  return due[0]?.c ?? null;
}

/** 引用の中の「」を『』にする（画面で「」に入れて引くため） */
export const nestQuote = (s: string) => s.replace(/「/g, "『").replace(/」/g, "』");

/**
 * 札の言葉を画面の言葉にする（画面に出す時と、家族に送る文を作る前に通す）。中身の文は辞書（lib/i18n/dict/today.ts）の鍵。
 * 国の資料の引用は、意味を変えずに訳した文（出典はそのまま並べる）。日本語の画面では1字も変えない
 */
export function cautionInLang(c: Caution): Caution {
  return {
    ...c,
    title: t(c.title),
    ...(c.lead ? { lead: t(c.lead) } : {}),
    quotes: c.quotes.map((q) => ({ ...q, text: t(q.text), from: t(q.from) })),
    ...(c.after ? { after: t(c.after) } : {}),
    why: c.why.map((w) => t(w)),
    sources: c.sources.map((s) => ({ ...s, label: t(s.label) })),
    ...(c.emergency ? { emergency: { ...c.emergency, label: t(c.emergency.label) } } : {}),
  };
}

/** 家族に送る文（端末の共有。送る相手は使う人が選ぶ）。札の言葉と出典だけ */
export function cautionShareText(c: Caution): string {
  return [
    t("【{title}】", { title: c.title }),
    ...(c.lead ? [c.lead] : []),
    ...c.quotes.map((q) => t("「{text}」（{from}）", { text: nestQuote(q.text), from: q.from })),
    ...(c.after ? [c.after] : []),
    "",
    ...c.sources.map((s) => `${s.label} ${s.href}`),
  ].join("\n");
}
