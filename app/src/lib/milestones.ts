// 全国共通の「その時やる事」の骨組み。
// ここには法律・国の目安で決まっている物だけを置く。町ごとに違う中身（窓口・持ち物・助成の額）は、
// その家族の町についてエージェントが取りに行く（needsLocal = true の物）。
// 家族の形（lib/situation.ts）で、出す・出さない・言い方を変える（only と scheduleFor）。わからない欄は今までどおり出す。

import { addDays, addMonths, lmpFromDue, type FamilyDates } from "./clock";
import { babyCount, hasOlderChildren, isFirstNenkinMother, motherEmployed, partnerEmployed, partnerTakesLeave, type Situation } from "./situation";

export type Kind = "手続き" | "健診" | "仕事" | "準備";
/** 担当。法と制度で決まる人に振る。「家族」は誰がやってもよい事（予防接種・健診の付き添いなど）。画面には担当名を出さない */
export type Who = "家族" | "母" | "パートナー";

/**
 * 家族の形で出すかを決める印（並べた物すべてに当てはまる時だけ出す）。
 * わからない欄は「当てはまる」側に倒す物（今までの項目）と、わかった時だけ出す物（足した項目）がある。中身は applies を見る。
 */
export type Only =
  | "mother-employed" // 母が雇われて働く（わからない時も）
  | "mother-quits" // 母が出産で辞める（わかった時だけ）
  | "mother-kokuho" // 母が国民年金・国民健康保険に入っていそう（自営・フリー、など。わかった時だけ）
  | "partner-employed" // パートナーがいて、雇われて働く（わからない時も）
  | "partner-leave" // パートナーがいて、育休を取るかもしれない（わからない時も）
  | "single" // 家族にパートナーがいない（members でわかった時だけ）
  | "first-child" // 第1子（わからない時も）
  | "older-children" // 上の子がいる（わかった時だけ）
  | "satogaeri" // 里帰り出産をする（わかった時だけ）
  | "daycare" // 保育園に預けて働く家族: 母が働き続け（雇われて・自営。辞める・仕事なしは除く）、パートナーがいれば働いている（わからない欄は当てはまる側）
  | "low-birth-weight" // 出生体重が 2500g 未満（手帳の出産の記録でわかった時だけ）
  | "preterm-care"; // 出生体重が 2000g 以下（未熟児養育医療の対象の目安。わかった時だけ）

export interface MilestoneDef {
  id: string;
  /** 正式な言い方（下書き・調べ物・Why の中で使う） */
  title: string;
  /** やさしい見出し（中学生が読める・画面の表に出す） */
  plain: string;
  /** 一言の説明（1行まで） */
  hint: string;
  kind: Kind;
  who: Who;
  /** 何を起点に数えるか（lmp = 最終月経・due = 出産予定日・birth = 生まれた日） */
  anchor: "lmp" | "due" | "birth";
  /** 起点から何日目（または何か月目）に「起きる」か */
  start: { days?: number; months?: number };
  /** 期限（ある物だけ） */
  deadline?: { days?: number; months?: number };
  /** 期限が法で決まっているか（"目安" = 法の定めは無く、目安の日。無ければ "期限" 扱い。deadlineKindOf で読む） */
  deadlineKind?: "目安" | "期限";
  /** 期限の根拠（家族に見せる） */
  basis: string;
  /** 町ごとに中身が違い、取りに行く必要がある */
  needsLocal: boolean;
  /** 妊娠中だけの事（生まれた日で終わる。生まれた後は今やるに出さない） */
  pregnancyOnly?: boolean;
  /** 家族の形で出すかを決める印（無ければ全員に出す） */
  only?: Only[];
  /**
   * 起点からの月・日では決まらない日（4月入園・学年など）。起点の日（anchor の日）から始まりと期限の日を出す。
   * あれば start・deadline より先に使う（start・deadline は並べ方の目安として残す）
   */
  dates?: (base: string) => { start: string; deadline?: string };
}

const w = (weeks: number) => ({ days: weeks * 7 });

/** 予防接種の行き先と、遅れた時の案内（どの接種にも付ける） */
const VAX_WHERE = "受ける所は、町が決めた小児科などの医療機関（役所ではない。BCG は町の保健センターでの集団接種の町もある）。遅れても、定期接種の対象の年齢の中なら公費で受けられる。迷ったら町の保健センターに聞く";

const later = (a: string, b: string) => (a > b ? a : b);

/**
 * 保育園の4月入園の段取り（近似）。base は生まれた日（まだなら予定日）。
 * - 入る4月: 生後6か月を過ぎて最初の4月（0歳児クラス）。育休は原則1歳まで、保育所に入れない時は最長2歳まで延ばせる
 *   （育児・介護休業法第5条）ので、秋〜冬生まれは翌々年の4月（1歳児クラス）になる。育休の長さは家族の形にまだ無いので、この近似で置く
 * - 一斉の申し込み: 入る年の前の年の10月1日〜11月30日（多くの町の締切は10〜12月。町ごとに違う）。生後1か月より前には置かない
 * - 就労証明書: 申し込みの前（9月1日から、締切の2週前まで）
 * - 復職の日: 結果が届くころ（入る年の2月1日〜3月1日）
 */
export function daycarePlan(base: string) {
  const [y, m, d] = addMonths(base, 6).split("-").map(Number);
  const year = m < 4 || (m === 4 && d === 1) ? y : y + 1;
  const entry = `${year}-04-01`;
  const prev = year - 1;
  const oneMonth = addMonths(base, 1);
  const applyStart = later(`${prev}-10-01`, oneMonth);
  const applyEnd = later(`${prev}-11-30`, addDays(applyStart, 21));
  const certStart = later(`${prev}-09-01`, oneMonth);
  const certEnd = later(addDays(applyEnd, -14), addDays(certStart, 14));
  return {
    entry,
    research: { start: later(`${prev}-06-01`, oneMonth) },
    cert: { start: certStart, deadline: certEnd },
    apply: { start: applyStart, deadline: applyEnd },
    back: { start: `${year}-02-01`, deadline: `${year}-03-01` },
  };
}

/**
 * 小学校に入る日（学校教育法第17条: 満6歳に達した日の翌日以後の最初の学年の初め＝4月1日）。
 * 満6歳に達するのは6歳の誕生日の前の日（年齢計算ニ関スル法律）なので、6歳の誕生日以後の最初の4月1日。4月1日生まれは1学年早い。これは近似ではない
 */
export function schoolEntry(birth: string): string {
  const [y, m, d] = addMonths(birth, 72).split("-").map(Number);
  return m < 4 || (m === 4 && d === 1) ? `${y}-04-01` : `${y + 1}-04-01`;
}

const DAYCARE_BASIS = "子ども・子育て支援法第19条・第20条（保育の必要性の認定）・児童福祉法第24条（町が保育所の利用を調整する）。4月入園の一斉の申し込みは、前の年の秋〜冬（10〜12月の締切が多い）。締切・書類・点数のつけ方は町ごとに違うので、町で確かめる";

export const MILESTONES: MilestoneDef[] = [
  // ── 妊娠中 ──
  { id: "pregnancy-report", title: "妊娠の届出と母子健康手帳の受け取り", plain: "役所に妊娠を届ける", hint: "母子手帳と、健診の補助券がもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(6), deadline: w(11), deadlineKind: "目安", basis: "母子保健法第15条（期限の定めはなく、11週までが目安）", needsLocal: true, pregnancyOnly: true },
  { id: "satogaeri-hospital", title: "里帰り先の産院に、お産の予約をする", plain: "里帰り先の産院を予約する", hint: "早めに。多くの産院は妊娠中期までに予約が要ります", kind: "準備", who: "母", anchor: "lmp", start: w(8), deadline: w(20), deadlineKind: "目安", basis: "目安（予約の締め切りと、何週までに帰るかは産院ごとに違う。里帰り先の産院に確かめる）", needsLocal: false, pregnancyOnly: true, only: ["satogaeri"] },
  { id: "tell-work", title: "職場に妊娠を伝え、産休・育休の段取りを相談する", plain: "職場に妊娠を伝える", hint: "産休・育休の段取りを一緒に決めます", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(20), deadlineKind: "目安", basis: "目安（安定期のころ）", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "mother-quit-date", title: "退職の日を職場と決める（産休を取ってからか・出産手当金を受け取れるかも確かめる）", plain: "退職の日を職場と決める", hint: "産休の前か後かで、受け取れるお金が変わります", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(28), deadlineKind: "目安", basis: "労働基準法第65条（産前産後休業）・健康保険法第104条（辞めた後も出産手当金を受け取れる条件がある）。条件は入っている健康保険で確かめる", needsLocal: false, pregnancyOnly: true, only: ["mother-quits"] },
  { id: "partner-leave", title: "パートナーの育休（産後パパ育休）を職場に相談する", plain: "パパの育休を職場に伝える", hint: "産後すぐ休むなら、予定日の2週間前までに", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, basis: "育児・介護休業法（産後パパ育休の申し出は原則2週間前まで。予定日から休むなら予定日の2週間前）", needsLocal: false, only: ["partner-leave"] },
  { id: "nenkin-maternity-exempt", title: "国民年金の産前産後期間の保険料免除を届け出る", plain: "国民年金の産前産後の免除を届ける", hint: "予定日の6か月前から届けられます", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民年金法第88条の2（2019年4月から。予定月の前月から4か月分、双子などは3か月前から6か月分の保険料が免除。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国民年金の係。日本年金機構のページで確かめる）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "kokuho-maternity-exempt", title: "国民健康保険の産前産後期間の保険料の減額（免除）を届け出る", plain: "国保の産前産後の減額を届ける", hint: "国保に入っている人。予定日の6か月前から", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民健康保険法施行令の改正（2024年1月から。予定月の前月から4か月分、双子などは3か月前から6か月分の所得割・均等割が減る（0円になるとは限らない）。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国保の係）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "older-child-care", title: "出産の入院中、上の子を見てもらう先を決める（一時保育・ファミリー・サポート・祖父母）", plain: "入院中の上の子の預け先を決める", hint: "一時保育やファミサポは、前もって登録が要ります", kind: "準備", who: "家族", anchor: "lmp", start: w(24), deadline: w(34), deadlineKind: "目安", basis: "一時預かり事業（児童福祉法第6条の3第7項）・ファミリー・サポート・センター（子ども・子育て支援法第59条の子育て援助活動支援事業）・ショートステイ（子育て短期支援事業）。使える物と登録の仕方は町ごとに違う", needsLocal: true, pregnancyOnly: true, only: ["older-children"] },
  { id: "satogaeri-visit", title: "赤ちゃん訪問を里帰り先で受けたい事を、住む町に伝える", plain: "里帰り先での訪問を頼む", hint: "住む町から、里帰り先の町へ頼んでもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(28), deadline: w(34), deadlineKind: "目安", basis: "新生児訪問（母子保健法第11条）・乳児家庭全戸訪問（児童福祉法第6条の3第4項）。里帰り先での訪問は、住む町が里帰り先の町に頼む形が多い。できるかと頼み方は住む町に確かめる", needsLocal: true, only: ["satogaeri"] },
  { id: "direct-payment", title: "出産育児一時金の直接支払制度の書類を産院で出す", plain: "出産のお金の書類を産院に出す", hint: "退院の時に大きなお金を払わずにすみます", kind: "手続き", who: "母", anchor: "lmp", start: w(30), deadline: w(36), deadlineKind: "目安", basis: "健康保険法（出産育児一時金。金額と手続きは制度が変わる事があるので、そのつど公式の情報で確かめる）", needsLocal: true, pregnancyOnly: true },
  { id: "maternity-leave", title: "産前休業が始められる（予定日の6週前）", plain: "産休に入れる", hint: "予定日の6週前から休めます", kind: "仕事", who: "母", anchor: "lmp", start: { days: 280 - 42 }, basis: "労働基準法第65条", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "mother-insurance-switch", title: "退職したら、母の健康保険を切り替える（家族の扶養・国民健康保険・任意継続のどれか）", plain: "母の健康保険を切り替える", hint: "辞めた次の日から。国保なら14日以内に届けます", kind: "手続き", who: "母", anchor: "lmp", start: w(34), deadline: { days: 280 + 70 }, deadlineKind: "目安", basis: "国民健康保険法第9条・同法施行規則第3条（国保は入った日から14日以内に届ける）・健康保険法施行規則第38条（家族の扶養は家族の勤め先へ）・健康保険法第37条（任意継続は辞めた次の日から20日以内）。辞める日で期限が変わるので、日は目安", needsLocal: true, only: ["mother-quits"] },

  // ── 生まれてから ──
  { id: "birth-registration", title: "出生届を出す", plain: "出生届を出す", hint: "生まれた日から14日以内", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 0 }, deadline: { days: 13 }, basis: "戸籍法第49条（生まれた日を含めて14日以内）", needsLocal: true },
  { id: "child-allowance", title: "児童手当を申請する", plain: "児童手当を申し込む", hint: "遅れると、その月の分がもらえません", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法第8条（生まれた日の翌日から15日以内に申請すると、翌月分から受け取れる）・第4条（受け取るのは父母のうち家計を主に支える人。ふつうは所得の高い方）", needsLocal: true, only: ["first-child"] },
  { id: "child-allowance-change", title: "児童手当の額を変える届けを出す（額改定の請求）", plain: "児童手当の額を変える届けを出す", hint: "上の子の手当に足します。15日以内に", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法第9条（額の改定。生まれた日の翌日から15日以内に請求すると、生まれた月の翌月分から増える。過ぎると、請求した月の翌月分から）", needsLocal: true, only: ["older-children"] },
  { id: "health-insurance", title: "赤ちゃんを健康保険に入れる", plain: "赤ちゃんの保険証を作る", hint: "1か月健診までに", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "1か月健診までが目安", needsLocal: false },
  { id: "medical-subsidy", title: "子ども医療費助成の受給者証を申請する", plain: "子どもの医療費助成を申し込む", hint: "病院代の助成が受けられます", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "町の制度（保険証が届いたら）", needsLocal: true },
  { id: "single-child-support", title: "児童扶養手当を申請する（ひとり親の家庭）", plain: "児童扶養手当を申し込む", hint: "申し込んだ次の月の分から。早めに", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, deadlineKind: "目安", basis: "児童扶養手当法第6条（認定の請求）・第7条（請求した月の翌月分から。さかのぼらない）。所得の制限がある。窓口は役所", needsLocal: true, only: ["single"] },
  { id: "single-medical", title: "ひとり親家庭等医療費助成を申請する", plain: "ひとり親の医療費助成を申し込む", hint: "親と子の病院代の助成。町ごとに中身が違います", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "都道府県・町の制度（名前・所得の制限・助成の中身は町ごとに違う。窓口は役所。確かめる）", needsLocal: true, only: ["single"] },
  { id: "birth-notice", title: "出生連絡票（新生児訪問の申し込み）を出す", plain: "出生連絡票を出す", hint: "保健師さんが家に来てくれます", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第11条（新生児訪問）", needsLocal: true },
  // 小さく生まれた子（手帳の出産の記録の体重から。体の判断ではなく、法で決まった届けと助成の入口だけ）
  { id: "low-birth-weight-report", title: "低出生体重児の届出（2500g 未満で生まれた子）", plain: "小さく生まれた子の届けを出す", hint: "生まれた時の体重が2500g未満の時。住む町に届けます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第18条（体重が2500g未満の子が生まれた時は、保護者が速やかに住む町に届け出る。期限の日の定めは無い。出生連絡票と一緒に出せる町が多い。出し方は町で確かめる）", needsLocal: true, only: ["low-birth-weight"] },
  { id: "preterm-medical", title: "未熟児養育医療の給付を申請する（入院が要る、小さく生まれた子の医療費）", plain: "養育医療を申し込む", hint: "入院中の医療費の助成。病院で書類をもらいます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第20条（養育のため入院が要る未熟児の医療の給付。生まれた時の体重が2000g以下か、医師が入院を要すると認めた子が対象。指定の医療機関の医師の意見書が要る。申請の期限と書類は町ごとに違う（入院中に早めに、が多い）。住む町で確かめる）", needsLocal: true, only: ["preterm-care"] },
  // 職場の事は、働いている人がそれぞれの職場へ（母の職場・パートナーの職場）
  { id: "tell-work-birth", title: "職場に出産の報告と育休の開始を伝える", plain: "職場に生まれた事を伝える", hint: "育休の始まりも一緒に", kind: "仕事", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, deadlineKind: "目安", basis: "目安（育休は、始める日の1か月前までに申し出るのが原則＝育児・介護休業法。産後休業の8週のあとに育休を続けるなら、生まれたら早めに伝える）", needsLocal: false, only: ["mother-employed"] },
  { id: "partner-tell-work-birth", title: "パートナーの職場に出産の報告をする（扶養・育休の届けの入口）", plain: "パートナーの職場に生まれた事を伝える", hint: "赤ちゃんを扶養に入れる・育休の届けの入口です", kind: "仕事", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, deadlineKind: "目安", basis: "目安（赤ちゃんを健康保険の扶養に入れる届けは、勤め先が5日以内に出す＝健康保険法施行規則第38条。どちらの扶養に入れるかは収入で決まる。勤め先に確かめる）", needsLocal: false, only: ["partner-employed"] },
  { id: "one-month-checkup", title: "1か月健診", plain: "1か月健診", hint: "ママと赤ちゃん、両方みてもらいます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, basis: "国の目安", needsLocal: false },
  { id: "home-visit", title: "乳児家庭全戸訪問（こんにちは赤ちゃん訪問）", plain: "赤ちゃん訪問を受ける", hint: "町の人が家に来てくれます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, deadline: { months: 4 }, deadlineKind: "目安", basis: "児童福祉法（生後4か月まで）", needsLocal: true },
  { id: "satogaeri-checkup-refund", title: "里帰り先で補助券が使えなかった妊婦健診の分を、住む町に申請する（償還払い）", plain: "里帰り先の健診代を申請する", hint: "補助券が使えない所の分は、後から町に申請します。期限は町ごと（1年以内が多い）", kind: "手続き", who: "母", anchor: "birth", start: { months: 1 }, deadline: { months: 12, days: -1 }, deadlineKind: "目安", basis: "妊婦健康診査の公費負担（母子保健法第13条）。町の外で受けた健診は、後から払い戻す町が多い。申請の期限は町ごとに違い、出産から1年以内（杉並区など）・最後の健診から1年以内（栃木市など）・受けた日から2年以内（船橋市など）がある（2026年に各町のページで確かめた）。期限と書類（領収書・健診の記録）は住む町で確かめる", needsLocal: true, only: ["satogaeri"] },
  { id: "vaccines-start", title: "生後2か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の1回目）", plain: "予防接種を始める", hint: "生後2か月から。小児科などに予約します", kind: "健診", who: "家族", anchor: "birth", start: { months: 2 }, deadline: { days: 14 * 7 + 6 }, deadlineKind: "目安", basis: `予防接種法（定期接種。五種混合は2024年4月から）。標準は生後2か月から同じ日にまとめて受ける。ロタの1回目は生後14週6日までに受けるのが望ましい。${VAX_WHERE}`, needsLocal: true },
  { id: "vaccines-3m", title: "生後3か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の2回目）", plain: "予防接種の2回目", hint: "1回目から4週ほどあけて。小児科などで", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 4 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。肺炎球菌・ロタは27日以上、五種混合は20日以上あける。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-3-4m", title: "3〜4か月健診", plain: "3〜4か月健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 5 }, deadlineKind: "目安", basis: "町の乳幼児健診（母子保健法第13条。ほとんどの町で行う。日と場所は町ごとに違う）", needsLocal: true },
  { id: "vaccines-4m", title: "生後4か月の予防接種（小児用肺炎球菌・五種混合の3回目。ロタは種類による）", plain: "予防接種の3回目", hint: "肺炎球菌・五種混合。ロタは3回の種類だけ", kind: "健診", who: "家族", anchor: "birth", start: { months: 4 }, deadline: { months: 5 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。ロタは2回の種類（24週まで）と3回の種類（32週まで）がある。${VAX_WHERE}`, needsLocal: true },
  { id: "daycare-research", title: "保育園の情報を集め、見学の予約をする", plain: "保育園を調べて、見学を申し込む", hint: "申し込みの時期は町ごとに違います", kind: "準備", who: "家族", anchor: "birth", start: { months: 4 }, basis: "町ごとに申込の時期が違う", needsLocal: true },
  // 保育園に預けて働く家族: 4月入園の一斉の申し込みに合わせる（日は daycarePlan の近似。町で確かめる）
  { id: "daycare-apply", title: "保育園の利用を申し込む（4月入園の一斉の申し込み・保育の必要性の認定）", plain: "保育園を申し込む", hint: "4月入園は前の年の秋〜冬に申し込みます。締切は町ごと", kind: "手続き", who: "家族", anchor: "birth", start: { months: 6 }, deadline: { months: 8 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).apply, basis: `${DAYCARE_BASIS}。入る4月は、生後6か月を過ぎて最初の4月で置いた（近似）`, needsLocal: true, only: ["daycare"] },
  { id: "daycare-cert-mother", title: "保育園の申し込みに要る就労証明書を、職場に頼む", plain: "就労証明書を職場に頼む", hint: "保育園の申し込みに要ります。職場が書くので早めに", kind: "仕事", who: "母", anchor: "birth", start: { months: 5 }, deadline: { months: 7 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).cert, basis: `子ども・子育て支援法施行規則第1条の5（就労を保育の必要性の理由にする時は、働いている事を示す書類が要る。国の標準の様式がある＝こども家庭庁）。${DAYCARE_BASIS}`, needsLocal: true, only: ["daycare", "mother-employed"] },
  { id: "daycare-cert-partner", title: "保育園の申し込みに要る就労証明書を、パートナーの職場に頼む", plain: "就労証明書を職場に頼む", hint: "パートナーの分も要ります。職場が書くので早めに", kind: "仕事", who: "パートナー", anchor: "birth", start: { months: 5 }, deadline: { months: 7 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).cert, basis: `子ども・子育て支援法施行規則第1条の5（父母それぞれの、働いている事を示す書類が要る）。${DAYCARE_BASIS}`, needsLocal: true, only: ["daycare", "partner-employed"] },
  { id: "return-to-work", title: "保育園の結果が届いたら、復職の日を職場と決める", plain: "復職の日を職場と決める", hint: "入園の日と慣らし保育に合わせて決めます", kind: "仕事", who: "母", anchor: "birth", start: { months: 10 }, deadline: { months: 11 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).back, basis: "育児・介護休業法第5条（育休は原則1歳まで。保育所に入れない時は1歳6か月・2歳まで延ばせる）。結果の届く時期と慣らし保育の長さは町と園ごとに違う。町と職場で確かめる", needsLocal: false, only: ["daycare", "mother-employed"] },
  { id: "bcg", title: "BCG の予防接種", plain: "BCG を受ける", hint: "生後5〜8か月が目安。1歳になる前に", kind: "健診", who: "家族", anchor: "birth", start: { months: 5 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令（対象は1歳になるまで。標準は生後5〜8か月）。${VAX_WHERE}`, needsLocal: true },
  { id: "vaccines-7m", title: "B型肝炎の予防接種（3回目）", plain: "B型肝炎の3回目を受ける", hint: "1回目から139日以上あけて。生後7〜8か月ごろ", kind: "健診", who: "家族", anchor: "birth", start: { months: 7 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令（B型肝炎は1歳になるまでに3回。3回目は1回目から139日以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-9-10m", title: "9〜10か月健診", plain: "9〜10か月健診", hint: "多くの町で。受け方は町ごとに違います", kind: "健診", who: "家族", anchor: "birth", start: { months: 9 }, deadline: { months: 11 }, deadlineKind: "目安", basis: "町の乳児健診（母子保健法第13条。行うか・小児科で受けるか集団かは町ごとに違う。町の案内で確かめる）", needsLocal: true },
  { id: "first-birthday-vaccines", title: "1歳の予防接種（麻しん風しん（MR）・水ぼうそう（水痘）・小児用肺炎球菌の追加・五種混合の追加）", plain: "1歳の予防接種", hint: "1歳になったら早めに。麻しん風しん（MR）・水ぼうそう（水痘）など", kind: "健診", who: "家族", anchor: "birth", start: { months: 12 }, deadline: { months: 24, days: -1 }, basis: `予防接種法施行令（麻しん風しん（MR）の1期は1歳から2歳になるまで。水ぼうそう（水痘）は1歳から3歳になるまでに2回。肺炎球菌の追加は標準で生後12〜15か月。五種混合の追加は3回目から6か月以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-18m", title: "1歳6か月健診", plain: "1歳半健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 24 }, basis: "母子保健法第12条", needsLocal: true },
  { id: "vaccines-18m", title: "水ぼうそう（水痘）の予防接種（2回目）", plain: "水ぼうそう（水痘）の2回目を受ける", hint: "1回目から6〜12か月あけて", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 36, days: -1 }, basis: `予防接種法施行令（水ぼうそう（水痘）は1歳から3歳になるまでに2回。2回目は1回目から3か月以上、標準は6〜12か月あける）。${VAX_WHERE}`, needsLocal: true },

  // ── 1000日の先（2歳を過ぎてから） ──
  { id: "checkup-3y", title: "3歳児健診", plain: "3歳児健診", hint: "町から案内が届きます。目や耳の検査もあります", kind: "健診", who: "家族", anchor: "birth", start: { months: 36 }, deadline: { months: 48, days: -1 }, basis: "母子保健法第12条（満3歳を超え満4歳に達しない子に、町が行う。日と場所は町ごとに違い、3歳〜3歳6か月ごろが多い。町の案内で確かめる）", needsLocal: true },
  { id: "je-vaccine-1", title: "日本脳炎の予防接種（1期の初回2回）", plain: "日本脳炎の予防接種を受ける", hint: "標準は3歳で2回。6〜28日あけて", kind: "健診", who: "家族", anchor: "birth", start: { months: 36 }, deadline: { months: 48 }, deadlineKind: "目安", basis: `予防接種法施行令（日本脳炎の1期は生後6か月から7歳6か月になるまで。標準は3歳で初回2回）。生後6か月から受けるよう勧める町もある。${VAX_WHERE}`, needsLocal: true },
  { id: "je-vaccine-1-booster", title: "日本脳炎の予防接種（1期の追加）", plain: "日本脳炎の追加を受ける", hint: "標準は4歳。初回の2回目からおよそ1年あけて", kind: "健診", who: "家族", anchor: "birth", start: { months: 48 }, deadline: { months: 60 }, deadlineKind: "目安", basis: `予防接種法施行令（日本脳炎の1期の追加は、初回の2回目からおよそ1年あけて。標準は4歳。7歳6か月になるまで公費）。${VAX_WHERE}`, needsLocal: true },
  { id: "mr-vaccine-2", title: "麻しん風しん（MR）の予防接種（2期）", plain: "麻しん風しん（MR）の2期を受ける", hint: "小学校に入る前の1年間（年長の4月〜3月）", kind: "健診", who: "家族", anchor: "birth", start: { months: 60 }, deadline: { months: 72 }, dates: (b) => { const e = schoolEntry(b); return { start: addMonths(e, -12), deadline: addDays(e, -1) }; }, basis: `予防接種法施行令（麻しん風しん（MR）の2期は、小学校に入る前の1年間＝年長の4月1日〜3月31日。入学の年は学校教育法第17条から出す。4月1日生まれは1学年早い）。${VAX_WHERE}`, needsLocal: true },
];

/** 期限の言い方（法で決まった期限か、目安か） */
export function deadlineKindOf(m: Pick<MilestoneDef, "deadlineKind">): "目安" | "期限" {
  return m.deadlineKind ?? "期限";
}

/** 妊娠中だけの事の id（生まれた後は今やるに出さない） */
export const PREGNANCY_ONLY: ReadonlySet<string> = new Set(MILESTONES.filter((m) => m.pregnancyOnly).map((m) => m.id));

export interface Milestone extends MilestoneDef {
  startDate: string;
  deadlineDate?: string;
  /** まだ生まれていない（生まれてからの事。「生まれたら」の印で「まだ先」に置く。日付は予定日で仮置き） */
  awaitingBirth?: boolean;
  /** 妊娠中だけの事が終わった日（生まれた日）。この日から「過ぎた」 */
  endsOn?: string;
  /**
   * まだ授かる前（今日が最終月経の日より前）。予定日は仮の日なので、どの事も日付を出さず「授かったら」として「まだ先」に置く。
   * scheduleFor に today を渡した時だけ付く。画面は awaitingBirth と同じく日数・日付を出さない
   */
  awaitingPregnancy?: boolean;
}

/** scheduleFor に渡す家族（FamilyDates に、家族の形と人の役を足した物。どちらも無ければ今までどおり） */
export interface ScheduleInput extends FamilyDates {
  situation?: Situation;
  members?: { role: string }[];
  /** 生まれた時の体重 g（手帳の出産の記録から。双子などは一番小さい子）。わからなければ無し */
  birthWeightG?: number;
  /** 生まれた時の在胎週数（手帳の出産の記録から） */
  birthWeek?: number;
}

function resolve(base: string, off: { days?: number; months?: number }): string {
  return addDays(addMonths(base, off.months ?? 0), off.days ?? 0);
}

/** 家族にパートナーがいるか（members が無い時は、わからないので「いる」= 今までどおり） */
function hasPartner(f: ScheduleInput): boolean {
  return !f.members || f.members.some((m) => m.role === "パートナー");
}

/** 家族の形の印に当てはまるか */
export function applies(only: Only, f: ScheduleInput): boolean {
  const s = f.situation;
  switch (only) {
    case "mother-employed":
      return motherEmployed(s);
    case "mother-quits":
      return s?.motherWork === "出産で辞める";
    case "mother-kokuho":
      return isFirstNenkinMother(s, hasPartner(f));
    case "partner-leave":
      return hasPartner(f) && partnerTakesLeave(s);
    case "partner-employed":
      return hasPartner(f) && partnerEmployed(s);
    case "single":
      return !hasPartner(f);
    case "first-child":
      return !hasOlderChildren(s);
    case "older-children":
      return hasOlderChildren(s);
    case "satogaeri":
      return !!s?.satogaeri;
    case "daycare": {
      const mw = s?.motherWork;
      const motherWorks = mw === undefined || mw === "会社員・公務員" || mw === "パート・派遣" || mw === "自営・フリー";
      const pw = s?.partnerWork;
      return motherWorks && (!hasPartner(f) || pw !== "仕事なし");
    }
    case "low-birth-weight":
      return typeof f.birthWeightG === "number" && f.birthWeightG > 0 && f.birthWeightG < 2500;
    case "preterm-care":
      return typeof f.birthWeightG === "number" && f.birthWeightG > 0 && f.birthWeightG <= 2000;
  }
}

/** 双子などで「（2人分）」を付ける事 */
const PER_BABY = new Set(["birth-registration", "child-allowance", "child-allowance-change", "health-insurance", "medical-subsidy", "birth-notice"]);

/** 家族の形で言い方・日を変える（項目は増やさない） */
function adjust(m: MilestoneDef, f: ScheduleInput): MilestoneDef {
  const s = f.situation;
  let out = m;
  // パートナーがいない家族: パートナーの担当は母へ
  if (!hasPartner(f) && out.who === "パートナー") out = { ...out, who: "母" };
  const n = babyCount(s);
  if (n >= 2 && PER_BABY.has(out.id)) out = { ...out, title: `${out.title}（${n}人分）`, plain: `${out.plain}（${n}人分）` };
  // 双子など: 産前休業は予定日の14週前から（労働基準法第65条）
  if (n >= 2 && out.id === "maternity-leave") {
    out = { ...out, title: "産前休業が始められる（双子などは予定日の14週前）", hint: "双子などは予定日の14週前から休めます", start: { days: 280 - 98 }, basis: "労働基準法第65条（多胎妊娠は14週間前から）" };
  }
  // 保育園に預けて働く家族: 調べる・見学は、4月入園の申し込みの前に（daycarePlan の近似）
  if (out.id === "daycare-research" && applies("daycare", f)) {
    out = { ...out, hint: "申し込みの前に。時期と締切は町ごとに違います", dates: (b) => daycarePlan(b).research, basis: DAYCARE_BASIS };
  }
  // 里帰り出産: 出生届は生まれた所の役所でも出せる
  if (s?.satogaeri && out.id === "birth-registration") {
    out = { ...out, hint: "14日以内。里帰り先の役所でも出せます", basis: `${out.basis}・戸籍法第51条（生まれた所の役所でも出せる）` };
  }
  return out;
}

/**
 * 家族の日付と形に当てはめる。
 * - 家族の形（situation・members）に合わない事は出さない（only）。わからない欄は今までどおり出す
 * - 生まれていなければ、生まれてからの事は予定日で仮置きし、awaitingBirth の印を付ける（statusOf が「まだ先」にする）
 * - 生まれていれば、妊娠中だけの事に endsOn（生まれた日）を付ける（statusOf がその日から「過ぎた」にする）
 * - today を渡して、それが最終月経の日より前（授かる前）なら、どの事にも awaitingPregnancy を付ける（予定日は仮なので日付で急かさない）
 */
export function scheduleFor(input: ScheduleInput, today?: string): Milestone[] {
  // 今日より先の生まれた日は、まだ生まれていない（作った家族は先の生まれた日を持っている。予定がその日で組まれ、
  // 「授かる前」「予定日を過ぎた」日に、生まれる日を知っているような日付が出ていた＝なりきり 2026-11-03）
  const f = input.birthDate && today && input.birthDate > today ? { ...input, birthDate: undefined } : input;
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  const trying = !!today && today < lmp && !f.birthDate;
  return MILESTONES.filter((m) => !m.only || m.only.every((o) => applies(o, f)))
    .map((def) => {
      const m = adjust(def, f);
      const base = m.anchor === "lmp" ? lmp : m.anchor === "due" ? f.dueDate : birth;
      const fixed = m.dates?.(base);
      return {
        ...m,
        startDate: fixed ? fixed.start : resolve(base, m.start),
        deadlineDate: fixed ? fixed.deadline : m.deadline ? resolve(base, m.deadline) : undefined,
        ...(trying ? { awaitingPregnancy: true } : {}),
        ...(m.anchor === "birth" && !f.birthDate ? { awaitingBirth: true } : {}),
        ...(m.pregnancyOnly && f.birthDate ? { endsOn: f.birthDate } : {}),
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export type Status = "まだ先" | "今やる" | "期限が近い" | "期限切れ" | "済み" | "過ぎた";

/** 期限の無い事（保育園を調べる、など）を「今」に出しておく日数 */
export const OPEN_WINDOW_DAYS = 14;

/** その事が「今」でなくなる日（期限、無ければ始まりから14日） */
export function endOf(m: Milestone): string {
  return m.deadlineDate ?? addDays(m.startDate, OPEN_WINDOW_DAYS);
}

/** 今日の時点での状態 */
export function statusOf(m: Milestone, today: string, done: Set<string>): Status {
  if (done.has(m.id)) return "済み";
  // 授かる前は、どの事も「まだ先」（授かったら）
  if (m.awaitingPregnancy) return "まだ先";
  // まだ生まれていない間は、生まれてからの事は予定日を過ぎても「まだ先」（生まれたら）
  if (m.awaitingBirth) return "まだ先";
  // 生まれた後は、妊娠中だけの事は「過ぎた」（済んでいない物は、画面が「済みましたか？」で1回だけ聞く）
  if (m.endsOn && today >= m.endsOn) return "過ぎた";
  if (today < m.startDate) return "まだ先";
  if (!m.deadlineDate && today > endOf(m)) return "過ぎた";
  if (m.deadlineDate) {
    if (today > m.deadlineDate) return "期限切れ";
    const left = (Date.parse(m.deadlineDate) - Date.parse(today)) / 86_400_000;
    if (left <= 3) return "期限が近い";
  }
  return "今やる";
}
