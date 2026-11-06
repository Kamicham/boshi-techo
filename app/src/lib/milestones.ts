// 全国共通の「その時やる事」の骨組み。
// ここには法律・国の目安で決まっている物だけを置く。町ごとに違う中身（窓口・持ち物・助成の額）は、
// その家族の町についてエージェントが取りに行く（needsLocal = true の物）。
// 家族の形（lib/situation.ts）で、出す・出さない・言い方を変える（only と scheduleFor）。わからない欄は今までどおり出す。

import { addDays, addMonths, diffDays, lmpFromDue, type FamilyDates } from "./clock";
import { babyInsuranceOf } from "./birth-trip";
import { benefitDrop, benefitFirst, papaBenefit } from "./leave-money";
import { olderDefs, olderSchedule } from "./older";
import { backDays, satogaeriReach } from "./satogaeri";
import { type ReturnAt, babyCount, hasOlderChildren, isFirstNenkinMother, motherEmployed, partnerEmployed, partnerTakesLeave, type Situation } from "./situation";

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
  | "older-daycare" // 上の子が保育園に通っている（上の子の欄でわかった時だけ）
  | "older-commute" // 上の子が保育園か幼稚園に通っている（わかった時だけ）
  | "mother-leave" // 母が雇われて働き続ける（会社員・公務員・パート・派遣。わからない時も。出産で辞める・自営・仕事なしは除く）
  | "leave-short" // パートナーの育休が14日に届かない（14日未満と答えた時だけ。長さがわからない時は、パートナーの育休の一言に足す）
  | "return-late" // ママが1歳を過ぎてから仕事に戻りたい（わかった時だけ）
  | "satogaeri" // 里帰り出産をする（わかった時だけ）
  | "satogaeri-away" // 里帰りの実家が住む市の外（同じ市と答えた時は出さない。町がわからない時は出す）
  | "satogaeri-place" // 里帰りの実家が住む市の外で、里帰り先の町を答えた時だけ
  | "daycare" // 保育園に預けて働く家族: 母が働き続け（雇われて・自営。辞める・仕事なしは除く）、パートナーがいれば働いている（わからない欄は当てはまる側）
  | "low-birth-weight" // 出生体重が 2500g 未満（手帳の出産の記録でわかった時だけ）
  | "preterm-care" // 出生体重が 2000g 以下（未熟児養育医療の対象の目安。わかった時だけ）
  | "moved" // 町を変えた（前の町と引っ越した日を覚えている家族だけ。見直し C10①）
  | "moved-pregnant" // 妊娠中に引っ越した（引っ越した日が最終月経の日から生まれた日の前まで）
  | "moved-with-child" // 引っ越した時に子がいた（その日までに生まれていた・上の子がいる）
  | "born-early"; // 予定日より7日以上早く生まれた（生まれた日を入れた家族だけ。見直し C10②）

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
  /** 何を起点に数えるか（lmp = 最終月経・due = 出産予定日・birth = 生まれた日・moved = 引っ越した日＝印 "moved" の行だけ） */
  anchor: "lmp" | "due" | "birth" | "moved";
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
   * あれば start・deadline より先に使う（start・deadline は並べ方の目安として残す）。
   * due は出産予定日（scheduleFor が渡す）。予定日より早く生まれた時に予定日から数える決まり（産後パパ育休の給付の申請）が使う
   */
  dates?: (base: string, due?: string) => { start: string; deadline?: string };
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
export function daycarePlan(base: string, returnAt?: ReturnAt) {
  const year = entryYear(base, returnAt);
  const entry = `${year}-04-01`;
  const prev = year - 1;
  const oneMonth = addMonths(base, 1);
  const applyStart = later(`${prev}-10-01`, oneMonth);
  const applyEnd = later(`${prev}-11-30`, addDays(applyStart, 21));
  const certStart = later(`${prev}-09-01`, oneMonth);
  const certEnd = later(addDays(applyEnd, -14), addDays(certStart, 14));
  // 結果が届くころ（入る年の2月1日）と、1歳6か月まで延ばす申し出の期限（1歳の誕生日の2週間前）
  const result = `${year}-02-01`;
  const extendBy = addDays(addMonths(base, 12), -14);
  return {
    entry,
    research: { start: later(`${prev}-06-01`, oneMonth) },
    cert: { start: certStart, deadline: certEnd },
    apply: { start: applyStart, deadline: applyEnd },
    back: { start: `${year}-02-01`, deadline: `${year}-03-01` },
    // 入れなかった時の育休の延長（第2波④）: 1歳6か月までの延長は1歳の誕生日の2週間前まで、2歳までは1歳6か月の2週間前までに申し出る
    extend: { start: result < extendBy ? result : addDays(extendBy, -60), deadline: extendBy },
    extend2: { start: addDays(addMonths(base, 18), -74), deadline: addDays(addMonths(base, 18), -14) },
    // 入園の準備（慣らし保育の送り迎え・病児保育の登録）: 入る日の45日前から、入る日の1週後まで
    prep: { start: addDays(entry, -45), deadline: addDays(entry, 7) },
  };
}

/**
 * 入る4月の年（第2波④）。
 * - 1歳まで: 1歳の誕生日までの最後の4月1日（0歳児クラス）。その日に生後57日（産休明け）に満たなければ次の4月
 * - 1歳を過ぎて: 1歳の誕生日の後の最初の4月1日（1歳児クラス）。それまでは、入れなかった時の育休の延長で休む
 * - 決めていない: 生後6か月を過ぎて最初の4月（前からの近似）
 * 4月1日生まれの子は、その4月1日を「誕生日までの4月」に含める
 */
export function entryYear(base: string, returnAt?: ReturnAt): number {
  const ymd = (s: string) => s.split("-").map(Number);
  if (returnAt === "1歳まで") {
    const [y, m] = ymd(addMonths(base, 12));
    let year = m >= 4 ? y : y - 1;
    if (`${year}-04-01` < addDays(base, 57)) year += 1;
    return year;
  }
  const [y, m, d] = ymd(addMonths(base, returnAt === "1歳を過ぎて" ? 12 : 6));
  return m < 4 || (m === 4 && d === 1) ? y : y + 1;
}

/**
 * 小学校に入る日（学校教育法第17条: 満6歳に達した日の翌日以後の最初の学年の初め＝4月1日）。
 * 満6歳に達するのは6歳の誕生日の前の日（年齢計算ニ関スル法律）なので、6歳の誕生日以後の最初の4月1日。4月1日生まれは1学年早い。これは近似ではない
 */
export function schoolEntry(birth: string): string {
  const [y, m, d] = addMonths(birth, 72).split("-").map(Number);
  return m < 4 || (m === 4 && d === 1) ? `${y}-04-01` : `${y + 1}-04-01`;
}

/** 保育園の予定の日を、daycarePlan のどこから取るか（仕事に戻りたい時期で動かす時に使う） */
const DAYCARE_DATES: Record<string, (p: ReturnType<typeof daycarePlan>) => { start: string; deadline?: string }> = {
  "daycare-apply": (p) => p.apply,
  "daycare-cert-mother": (p) => p.cert,
  "daycare-cert-partner": (p) => p.cert,
  "return-to-work": (p) => p.back,
  "daycare-extend": (p) => p.extend,
  "daycare-extend-2": (p) => p.extend2,
  "daycare-prep": (p) => p.prep,
  "shorttime-benefit": (p) => p.back,
};

const DAYCARE_BASIS = "子ども・子育て支援法第19条・第20条（保育の必要性の認定）・児童福祉法第24条（町が保育所の利用を調整する）。4月入園の一斉の申し込みは、前の年の秋〜冬（10〜12月の締切が多い）。締切・書類・点数のつけ方は町ごとに違うので、町で確かめる";

export const MILESTONES: MilestoneDef[] = [
  // ── 妊娠中 ──
  { id: "pregnancy-report", title: "妊娠の届出と母子健康手帳の受け取り", plain: "役所に妊娠を届ける", hint: "母子手帳と健診の補助券。面談で支援給付の1回目も", kind: "手続き", who: "母", anchor: "lmp", start: w(6), deadline: w(11), deadlineKind: "目安", basis: "母子保健法第15条（期限の定めはなく、11週までが目安）。届けの時の面談で、妊婦のための支援給付の1回目（妊婦1人に5万円の目安）を申請できる（子ども・子育て支援法の改正・2025年4月から。心拍が確かめられた後。申請の期限は町ごと＝2年が多い。受け取り方は町で確かめる）", needsLocal: true, pregnancyOnly: true },
  { id: "satogaeri-hospital", title: "里帰り先の産院に、お産の予約をする", plain: "里帰り先の産院を予約する", hint: "早めに。多くの産院は妊娠中期までに予約が要ります", kind: "準備", who: "母", anchor: "lmp", start: w(8), deadline: w(20), deadlineKind: "目安", basis: "目安（予約の締め切りと、何週までに帰るかは産院ごとに違う。里帰り先の産院に確かめる）", needsLocal: false, pregnancyOnly: true, only: ["satogaeri"] },
  { id: "tell-work", title: "職場に妊娠を伝え、産休・育休の段取りを相談する", plain: "職場に妊娠を伝える", hint: "産休・育休の段取りを一緒に決めます", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(20), deadlineKind: "目安", basis: "目安（安定期のころ）", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "mother-quit-date", title: "退職の日を職場と決める（産休を取ってからか・出産手当金を受け取れるかも確かめる）", plain: "退職の日を職場と決める", hint: "産休の前か後かで、受け取れるお金が変わります", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(28), deadlineKind: "目安", basis: "労働基準法第65条（産前産後休業）・健康保険法第104条（辞めた後も出産手当金を受け取れる条件がある）。条件は入っている健康保険で確かめる", needsLocal: false, pregnancyOnly: true, only: ["mother-quits"] },
  // 産後パパ育休（出生時育児休業）は、申し出が始める日の2週間前まで。期限の日はこの休みの物なので、やさしい題にも「産後パパ育休」と書く（デモの会話の見つけ ⑦）
  { id: "partner-leave", title: "パートナーの育休（産後パパ育休）を職場に相談する", plain: "パートナーの産後パパ育休を職場に伝える", hint: "産後すぐ休むなら、予定日の2週間前までに", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, basis: "育児・介護休業法（産後パパ育休の申し出は原則2週間前まで。予定日から休むなら予定日の2週間前）", needsLocal: false, only: ["partner-leave"] },
  // ふつうの育休（育児休業）は、申し出が始める日の1か月前まで。産後パパ育休とは別に申し出る（デモの会話の見つけ ⑦。予定日から休むなら予定日の1か月前）
  { id: "partner-leave-regular", title: "パートナーのふつうの育休（育児休業）を職場に申し出る", plain: "パートナーの育休を職場に伝える", hint: "始める日の1か月前までに。予定日から休むなら予定日の1か月前", kind: "仕事", who: "パートナー", anchor: "due", start: { days: -140 }, deadline: { months: -1 }, deadlineKind: "目安", basis: "育児・介護休業法第5条（育児休業）・第6条第3項（始める日が申し出の日の翌日から1か月より前の時は、会社が始まりの日を、その1か月を過ぎる日までの間で決められる）。産後パパ育休（出生時育児休業）は別に申し出て、申し出は2週間前まで（第9条の3第3項）。期限の日は、予定日から休む時の目安（予定日の1か月前）。両方取るか・いつから休むかは家族と職場で決める。職場に確かめる", needsLocal: false, only: ["partner-leave"] },
  { id: "nenkin-maternity-exempt", title: "国民年金の産前産後期間の保険料免除を届け出る", plain: "国民年金の産前産後の免除を届ける", hint: "予定日の6か月前から届けられます", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民年金法第88条の2（2019年4月から。予定月の前月から4か月分、双子などは3か月前から6か月分の保険料が免除。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国民年金の係。日本年金機構のページで確かめる）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "kokuho-maternity-exempt", title: "国民健康保険の産前産後期間の保険料の減額（免除）を届け出る", plain: "国保の産前産後の減額を届ける", hint: "国保に入っている人。予定日の6か月前から", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民健康保険法施行令の改正（2024年1月から。予定月の前月から4か月分、双子などは3か月前から6か月分の所得割・均等割が減る（0円になるとは限らない）。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国保の係）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "older-child-care", title: "出産の入院中、上の子を見てもらう先を決める（一時保育・ファミリー・サポート・祖父母）", plain: "入院中の上の子の預け先を決める", hint: "夜中の陣痛の時に見る人も。一時保育は登録が要ります", kind: "準備", who: "家族", anchor: "lmp", start: w(24), deadline: w(34), deadlineKind: "目安", basis: "一時預かり事業（児童福祉法第6条の3第7項）・ファミリー・サポート・センター（子ども・子育て支援法第59条の子育て援助活動支援事業）・ショートステイ（子育て短期支援事業）。使える物と登録の仕方は町ごとに違う", needsLocal: true, pregnancyOnly: true, only: ["older-children"] },
  { id: "older-daycare-continue", title: "育休中も上の子が保育園に通い続けられるか、町の決まりを確かめて申請する", plain: "上の子の保育園を育休中も続ける申請", hint: "続けられる期間と申請の期限は町ごとに違います。生まれる前に確かめると安心", kind: "手続き", who: "家族", anchor: "due", start: { days: -84 }, deadline: { days: 30 }, deadlineKind: "目安", basis: "子ども・子育て支援法施行規則第1条の5（保育が必要な理由の1つに「育児休業をする時、すでに保育を使っている子が続けて使う必要がある時」がある）。続けられるか・期間（育休の終わりまで・赤ちゃんが1歳になる年度の終わりまで・上の子の年で分けるなど）・申請の書類と期限は町ごとに違う。町の利用案内で確かめる", needsLocal: true, only: ["older-children", "older-daycare"] },
  { id: "older-pickup", title: "入院中と産後1か月の、上の子の送り迎えの担当を決める", plain: "上の子の送り迎えの担当を決める", hint: "入院中と、産後しばらくの分。決めておくと当日あわてません", kind: "準備", who: "家族", anchor: "lmp", start: w(28), deadline: w(36), deadlineKind: "目安", basis: "法の決まりは無い。母は産後8週まで休業の期間（労働基準法第65条）。入院は出産で数日〜1週間ほどが多い（近似）。送り迎えの担当は家族で決める", needsLocal: false, only: ["older-children", "older-commute"] },
  { id: "satogaeri-visit", title: "赤ちゃん訪問を里帰り先で受けたい事を、住む町に伝える", plain: "里帰り先での訪問を頼む", hint: "住む町から、里帰り先の町へ頼んでもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(28), deadline: w(34), deadlineKind: "目安", basis: "新生児訪問（母子保健法第11条）・乳児家庭全戸訪問（児童福祉法第6条の3第4項）。里帰り先での訪問は、住む町が里帰り先の町に頼む形が多い。できるかと頼み方は住む町に確かめる", needsLocal: true, only: ["satogaeri-away"] },
  { id: "satogaeri-local", title: "里帰り先の町で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる", plain: "里帰り先の町で確かめる", hint: "訪問の受け方・受診券・出生届の窓口", kind: "準備", who: "母", anchor: "lmp", start: w(20), deadline: w(32), deadlineKind: "目安", basis: "新生児訪問は町の間で頼める（母子保健法第11条・第19条）。妊婦健診の受診券が里帰り先で使えるかは町ごと（同法第13条・各町の公費負担の決まり）。出生届は住む町・本籍地・生まれた所の役所に出せる（戸籍法第25条・第51条）。調べは里帰り先の町の公式ページで行う", needsLocal: true, pregnancyOnly: true, only: ["satogaeri-place"] },
  { id: "pregnancy-support-2", title: "妊婦のための支援給付の2回目を申請する（町の面談を受けて、おなかの子の数を届ける）", plain: "支援給付の2回目を申請する", hint: "予定日の8週前から。1人5万円の目安（町で確かめる）", kind: "手続き", who: "母", anchor: "due", start: { days: -56 }, deadline: { months: 24, days: -57 }, deadlineKind: "期限", basis: "子ども・子育て支援法の改正（妊婦のための支援給付・2025年4月から）。2回目は出産予定日の8週前の日から申請でき、おなかの子1人につき5万円の目安。町の面談（妊婦等包括相談支援）を受けてから申請する町が多い。申請の期限は8週前の日から2年（秋田市・広島市などの案内で確かめた・2026年）。面談の予約・受け取り方は町で確かめる。流産・死産でも対象", needsLocal: true },
  // 母子免疫ワクチン（2026年度から妊婦の定期接種）。受けるかは産院で相談する形だけ（体の判断はしない）
  { id: "rsv-maternal", title: "RSウイルスの母子免疫ワクチン（妊婦の定期接種）を受けるか、健診で相談する", plain: "RSウイルスのワクチンを相談する", hint: "28〜36週に1回。受けるかは健診で", kind: "健診", who: "母", anchor: "lmp", start: w(28), deadline: { days: 36 * 7 + 6 }, deadlineKind: "目安", basis: "予防接種法の定期接種（2026年度から。接種の時に妊娠28週0日〜36週6日の妊婦に1回。厚生労働省「RSウイルスワクチン」）。母子健康手帳の予防接種の記録にも、妊娠週数を書くRSウイルスの欄がある（府令様式 2026年4月施行版 p.52）。費用・予診票・受けられる医療機関は町ごと。受けるかどうかは産院で相談する", needsLocal: true, pregnancyOnly: true },
  // 産後ケア（母子保健法第17条の2）。申し込みを産前から受ける町もあるので、妊娠後期に町の申し込み方を確かめる
  { id: "postpartum-care", title: "産後ケアの申し込み方を町で確かめる（泊まり・通い・家に来てもらう）", plain: "産後ケアの申し込み方を確かめる", hint: "出産後1年まで。泊まり・通い・訪問", kind: "準備", who: "母", anchor: "lmp", start: w(28), deadline: w(36), deadlineKind: "目安", basis: "母子保健法第17条の2（産後ケア事業。出産後1年を経過しない母と子に、市区町村が行うよう努める。泊まり・通い・家に来てもらう形がある）。使える人・料金・申し込みの時期は町ごと（こども家庭庁「産後ケア事業ガイドライン」2026年3月）。祖父母に頼れない時・ひとりで育てる時は、町の家事・育児の手伝い（子育て世帯訪問支援事業など。児童福祉法の改正で2024年4月から）も同じ窓口で聞ける", needsLocal: true, pregnancyOnly: true },
  { id: "direct-payment", title: "出産育児一時金の直接支払制度の書類を産院で出す", plain: "出産のお金の書類を産院に出す", hint: "退院の時に大きなお金を払わずにすみます", kind: "手続き", who: "母", anchor: "lmp", start: w(30), deadline: w(36), deadlineKind: "目安", basis: "健康保険法（出産育児一時金。金額と手続きは制度が変わる事があるので、そのつど公式の情報で確かめる）", needsLocal: true, pregnancyOnly: true },
  { id: "leave-money-request", title: "産休・育休のお金の手続きを、勤め先にまとめて頼む（出産手当金・保険料の免除・育児休業給付・振込の口座）", plain: "産休・育休のお金の手続きを職場に頼む", hint: "出産手当金・保険料の免除・育休の給付。産休の前に", kind: "仕事", who: "母", anchor: "lmp", start: w(28), deadline: { days: 280 - 42 }, deadlineKind: "目安", basis: "健康保険法第102条（出産手当金: 産前42日・産後56日の間で休んだ日に、賃金のおよそ3分の2）・健康保険法第159条・厚生年金保険法第81条の2の2（産休中の保険料の免除）・同法第81条の2（育休中の免除。どちらも勤め先が届ける）・雇用保険法第61条の7（育児休業給付: 180日まで賃金の67%・その後50%）。パートでも勤め先の健康保険・雇用保険に入っていれば対象。入っているか・手続きの順は勤め先に確かめる", needsLocal: false, pregnancyOnly: true, only: ["mother-leave"] },
  { id: "partner-leave-14", title: "パートナーの育休を、生まれて8週の間に通算14日以上にするか決める（出生後休業支援給付の上乗せ）", plain: "パートナーの育休の日数を決める", hint: "14日以上で、賃金の13%の上乗せ（最大28日分）", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, deadlineKind: "目安", basis: "雇用保険法第61条の10（出生後休業支援給付・2025年4月から。父は子が生まれて8週の間に通算14日以上の育休を取り、母も14日以上の育休を取る時に、28日分まで賃金の13%を上乗せ。母が産後休業中・働いていない時などは、母の条件は要らない）。足りるかは勤め先とハローワークで確かめる", needsLocal: false, only: ["partner-leave", "leave-short"] },
  // 産前休業の6週（42日）は、出産の当日を産前に入れて数える。予定日を含めた42日の1日目は、予定日の41日前（双子などの14週＝98日は97日前。adjust）。
  // 出典（2026-11-05 確認）: 厚生労働省「働く女性の心とからだの応援サイト」用語辞典「産前・産後休業」（出産日は産前休業に含まれます） https://www.bosei-navi.mhlw.go.jp/glossary/provide01.html
  //   協会けんぽ「出産手当金」（出産の日以前42日。出産日は出産の日以前の期間に含まれます） https://www.kyoukaikenpo.or.jp/benefit/childbirth/001/index.html
  //   協会けんぽ よくあるご質問「出産日は産前、産後のどちらの期間に入りますか？」（出産日は産前期間に入ります） https://www.kyoukaikenpo.or.jp/g6/cat620/r311/
  { id: "maternity-leave", title: "産前休業が始められる（予定日の6週前）", plain: "産休に入れる", hint: "予定日も入れて6週。予定日の41日前から休めます", kind: "仕事", who: "母", anchor: "due", start: { days: -41 }, basis: "労働基準法第65条第1項（6週間以内に出産する予定の人は、請求すれば休める。出産の当日は産前に入るので、予定日を含めて6週（42日）と数え、1日目は予定日の41日前。厚生労働省「働く女性の心とからだの応援サイト」の用語辞典で確かめた・2026年11月）。出産手当金の「出産の日以前42日」も、出産の日を入れて数える（健康保険法第102条・協会けんぽ）", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "mother-insurance-switch", title: "退職したら、母の健康保険を切り替える（家族の扶養・国民健康保険・任意継続のどれか）", plain: "母の健康保険を切り替える", hint: "辞めた次の日から。国保なら14日以内に届けます", kind: "手続き", who: "母", anchor: "lmp", start: w(34), deadline: { days: 280 + 70 }, deadlineKind: "目安", basis: "国民健康保険法第9条・同法施行規則第3条（国保は入った日から14日以内に届ける）・健康保険法施行規則第38条（家族の扶養は家族の勤め先へ）・健康保険法第37条（任意継続は辞めた次の日から20日以内）。辞める日で期限が変わるので、日は目安", needsLocal: true, only: ["mother-quits"] },

  // ── 生まれてから ──
  { id: "birth-registration", title: "出生届を出す", plain: "出生届を出す", hint: "生まれた日から14日以内", kind: "手続き", who: "家族", anchor: "birth", start: { days: 0 }, deadline: { days: 13 }, basis: "戸籍法第49条（生まれた日を含めて14日以内）・第52条（届け出る人は父か母。父母が結婚していない時は母）。署名した届書を窓口へ持っていくのは、ほかの家族でもよい（使者）。誰が行くかは家族で決める", needsLocal: true },
  { id: "child-allowance", title: "児童手当を申請する", plain: "児童手当を申し込む", hint: "生まれた日の翌日から15日以内に出すと、翌月分から受け取れます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法第8条（生まれた日の翌日から15日以内に申請すると、翌月分から受け取れる）・第4条（受け取るのは父母のうち家計を主に支える人。ふつうは所得の高い方）", needsLocal: true, only: ["first-child"] },
  { id: "child-allowance-change", title: "児童手当の額を変える届けを出す（額改定の請求）", plain: "児童手当の額を変える届けを出す", hint: "上の子の手当に足します。15日以内に", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法第9条（額の改定。生まれた日の翌日から15日以内に請求すると、生まれた月の翌月分から増える。過ぎると、請求した月の翌月分から）", needsLocal: true, only: ["older-children"] },
  { id: "health-insurance", title: "赤ちゃんを健康保険に入れる", plain: "赤ちゃんの保険証を作る", hint: "1か月健診までに", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "1か月健診までが目安", needsLocal: false },
  { id: "medical-subsidy", title: "子ども医療費助成の受給者証を申請する", plain: "子どもの医療費助成を申し込む", hint: "病院代の助成が受けられます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "町の制度（保険証が届いたら）", needsLocal: true },
  { id: "single-child-support", title: "児童扶養手当を申請する（ひとり親の家庭）", plain: "児童扶養手当を申し込む", hint: "申し込んだ次の月の分から。早めに", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, deadlineKind: "目安", basis: "児童扶養手当法第6条（認定の請求）・第7条（請求した月の翌月分から。さかのぼらない）。所得の制限がある。窓口は役所", needsLocal: true, only: ["single"] },
  { id: "single-medical", title: "ひとり親家庭等医療費助成を申請する", plain: "ひとり親の医療費助成を申し込む", hint: "親と子の病院代の助成。町ごとに中身が違います", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "都道府県・町の制度（名前・所得の制限・助成の中身は町ごとに違う。窓口は役所。確かめる）", needsLocal: true, only: ["single"] },
  { id: "birth-notice", title: "出生連絡票（新生児訪問の申し込み）を出す", plain: "出生連絡票を出す", hint: "保健師さんが家に来てくれます", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第11条（新生児訪問）", needsLocal: true },
  // 小さく生まれた子（手帳の出産の記録の体重から。体の判断ではなく、法で決まった届けと助成の入口だけ）
  { id: "low-birth-weight-report", title: "低出生体重児の届出（2500g 未満で生まれた子）", plain: "小さく生まれた子の届けを出す", hint: "生まれた時の体重が2500g未満の時。住む町に届けます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第18条（体重が2500g未満の子が生まれた時は、保護者が速やかに住む町に届け出る。期限の日の定めは無い。出生連絡票と一緒に出せる町が多い。出し方は町で確かめる）", needsLocal: true, only: ["low-birth-weight"] },
  { id: "preterm-medical", title: "未熟児養育医療の給付を申請する（入院が要る、小さく生まれた子の医療費）", plain: "養育医療を申し込む", hint: "入院中の医療費の助成。病院で書類をもらいます", kind: "手続き", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第20条（養育のため入院が要る未熟児の医療の給付。生まれた時の体重が2000g以下か、医師が入院を要すると認めた子が対象。指定の医療機関の医師の意見書が要る。申請の期限と書類は町ごとに違う（入院中に早めに、が多い）。住む町で確かめる）", needsLocal: true, only: ["preterm-care"] },
  // 職場の事は、働いている人がそれぞれの職場へ（母の職場・パートナーの職場）
  { id: "tell-work-birth", title: "職場に出産の報告と育休の開始を伝える", plain: "職場に生まれた事を伝える", hint: "育休の始まりも一緒に", kind: "仕事", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, deadlineKind: "目安", basis: "目安（育休は、始める日の1か月前までに申し出るのが原則＝育児・介護休業法。産後休業の8週のあとに育休を続けるなら、生まれたら早めに伝える）", needsLocal: false, only: ["mother-employed"] },
  { id: "partner-tell-work-birth", title: "パートナーの職場に出産の報告をする（扶養・育休の届けの入口）", plain: "パートナーの職場に生まれた事を伝える", hint: "赤ちゃんを扶養に入れる・育休の届けの入口です", kind: "仕事", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, deadlineKind: "目安", basis: "目安（赤ちゃんを健康保険の扶養に入れる届けは、勤め先が5日以内に出す＝健康保険法施行規則第38条。どちらの扶養に入れるかは収入で決まる。勤め先に確かめる）", needsLocal: false, only: ["partner-employed"] },
  // 産婦健診（国の産婦健康診査事業。産後2週間・1か月ごろの2回を町が助成する事が多い）。1か月は「1か月健診」の一言に入れる（同じ日に2行並ばないように）
  { id: "postpartum-checkup-2w", title: "産婦健診（産後2週間ごろ）を受ける", plain: "産婦健診（産後2週間）を受ける", hint: "健診の券は町ごと。赤ちゃんの便の色も見る", kind: "健診", who: "母", anchor: "birth", start: { days: 10 }, deadline: { days: 21 }, deadlineKind: "目安", basis: "母子保健法第13条（市区町村の健康診査）による国の産婦健康診査事業（産後2週間・1か月ごろなど。2017年度から）。行うか・健診の券（受診票）・助成の中身は町ごと。生後4か月ごろまでは、赤ちゃんの便の色を母子健康手帳の便色カードと見比べる（府令様式）", needsLocal: true },
  { id: "one-month-checkup", title: "1か月健診", plain: "1か月健診", hint: "ママの産婦健診も一緒に。便色カードも", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, basis: "国の目安。ママの1か月の健診は、国の産婦健康診査事業（母子保健法第13条。助成の中身は町ごと）。生後4か月ごろまでは、赤ちゃんの便の色を母子健康手帳の便色カードと見比べる（府令様式）", needsLocal: false },
  { id: "home-visit", title: "乳児家庭全戸訪問（こんにちは赤ちゃん訪問）", plain: "赤ちゃん訪問を受ける", hint: "町の人が家に来てくれます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, deadline: { months: 4 }, deadlineKind: "目安", basis: "児童福祉法（生後4か月まで）", needsLocal: true },
  { id: "satogaeri-checkup-refund", title: "里帰り先で補助券が使えなかった妊婦健診の分を、住む町に申請する（償還払い）", plain: "里帰り先の健診代を申請する", hint: "補助券が使えない所の分は、後から町に申請します。期限は町ごと（1年以内が多い）", kind: "手続き", who: "母", anchor: "birth", start: { months: 1 }, deadline: { months: 12, days: -1 }, deadlineKind: "目安", basis: "妊婦健康診査の公費負担（母子保健法第13条）。町の外で受けた健診は、後から払い戻す町が多い。申請の期限は町ごとに違い、出産から1年以内（杉並区など）・最後の健診から1年以内（栃木市など）・受けた日から2年以内（船橋市など）がある（2026年に各町のページで確かめた）。期限と書類（領収書・健診の記録）は住む町で確かめる", needsLocal: true, only: ["satogaeri-away"] },
  { id: "satogaeri-return", title: "住む町に戻る日の段取りを組む（保健センターへの連絡・小児科・チャイルドシート）", plain: "戻る日の段取りを組む", hint: "保健センターへ連絡・チャイルドシート", kind: "準備", who: "家族", anchor: "birth", start: { days: 21 }, deadline: { days: 35 }, deadlineKind: "目安", basis: "目安（戻る日は、答えてもらった戻る時期から置いた近似。決めていなければ1か月健診のあと＝生後35日ごろ）。戻ったら住む町の保健センターに連絡し、赤ちゃん訪問と乳幼児健診の案内を受ける（母子保健法第11条・第12条・児童福祉法第6条の3第4項）。車で戻るならチャイルドシートが要る（道路交通法第71条の3第3項）。かかりつけの小児科は住む町で探しておく", needsLocal: false, only: ["satogaeri-away"] },
  { id: "vaccines-start", title: "生後2か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の1回目）", plain: "予防接種を始める", hint: "生後2か月から。小児科などに予約します", kind: "健診", who: "家族", anchor: "birth", start: { months: 2 }, deadline: { days: 14 * 7 + 6 }, deadlineKind: "目安", basis: `予防接種法（定期接種。五種混合は2024年4月から）。標準は生後2か月から同じ日にまとめて受ける。ロタの1回目は生後14週6日までに受けるのが望ましい。${VAX_WHERE}`, needsLocal: true },
  { id: "vaccines-3m", title: "生後3か月の予防接種（B型肝炎・ロタウイルス・小児用肺炎球菌・五種混合の2回目）", plain: "予防接種の2回目", hint: "1回目から4週ほどあけて。小児科などで", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 4 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。肺炎球菌・ロタは27日以上、五種混合は20日以上あける。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-3-4m", title: "3〜4か月健診", plain: "3〜4か月健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 5 }, deadlineKind: "目安", basis: "町の乳幼児健診（母子保健法第13条。ほとんどの町で行う。日と場所は町ごとに違う）", needsLocal: true },
  { id: "vaccines-4m", title: "生後4か月の予防接種（小児用肺炎球菌・五種混合の3回目。ロタは種類による）", plain: "予防接種の3回目", hint: "肺炎球菌・五種混合。ロタは3回の種類だけ", kind: "健診", who: "家族", anchor: "birth", start: { months: 4 }, deadline: { months: 5 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。ロタは2回の種類（24週まで）と3回の種類（32週まで）がある。${VAX_WHERE}`, needsLocal: true },
  { id: "daycare-research", title: "保育園の情報を集め、見学の予約をする", plain: "保育園を調べて、見学を申し込む", hint: "申し込みの時期は町ごとに違います", kind: "準備", who: "家族", anchor: "birth", start: { months: 4 }, basis: "町ごとに申込の時期が違う", needsLocal: true },
  // 保育園に預けて働く家族: 4月入園の一斉の申し込みに合わせる（日は daycarePlan の近似。町で確かめる）
  { id: "daycare-apply", title: "保育園の利用を申し込む（4月入園の一斉の申し込み・保育の必要性の認定）", plain: "保育園を申し込む", hint: "4月入園は前の年の秋〜冬に申し込みます。締切は町ごと", kind: "手続き", who: "家族", anchor: "birth", start: { months: 6 }, deadline: { months: 8 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).apply, basis: `${DAYCARE_BASIS}。入る4月は、生後6か月を過ぎて最初の4月で置いた（近似）`, needsLocal: true, only: ["daycare"] },
  { id: "daycare-cert-mother", title: "保育園の申し込みに要る就労証明書を、職場に頼む", plain: "ママの就労証明書を職場に頼む", hint: "保育園の申し込みに要ります。職場が書くので早めに", kind: "仕事", who: "母", anchor: "birth", start: { months: 5 }, deadline: { months: 7 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).cert, basis: `子ども・子育て支援法施行規則第1条の5（就労を保育の必要性の理由にする時は、働いている事を示す書類が要る。国の標準の様式がある＝こども家庭庁）。${DAYCARE_BASIS}`, needsLocal: true, only: ["daycare", "mother-employed"] },
  { id: "daycare-cert-partner", title: "保育園の申し込みに要る就労証明書を、パートナーの職場に頼む", plain: "パートナーの就労証明書を頼む", hint: "パートナーの分も要ります。職場が書くので早めに", kind: "仕事", who: "パートナー", anchor: "birth", start: { months: 5 }, deadline: { months: 7 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).cert, basis: `子ども・子育て支援法施行規則第1条の5（父母それぞれの、働いている事を示す書類が要る）。${DAYCARE_BASIS}`, needsLocal: true, only: ["daycare", "partner-employed"] },
  { id: "return-to-work", title: "保育園の結果が届いたら、復職の日を職場と決める", plain: "復職の日を職場と決める", hint: "入園の日と慣らし保育に合わせて決めます", kind: "仕事", who: "母", anchor: "birth", start: { months: 10 }, deadline: { months: 11 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).back, basis: "育児・介護休業法第5条（育休は原則1歳まで。保育所に入れない時は1歳6か月・2歳まで延ばせる）。結果の届く時期と慣らし保育の長さは町と園ごとに違う。町と職場で確かめる", needsLocal: false, only: ["daycare", "mother-employed"] },
  { id: "maternity-allowance-cert", title: "出産手当金の申請書の、医師の証明の欄を産院で書いてもらう", plain: "出産手当金の書類に医師の証明をもらう", hint: "入院中か1か月健診で。用紙は勤め先から", kind: "手続き", who: "母", anchor: "birth", start: { days: 0 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "健康保険法第102条・同法施行規則第84条（出産手当金の申請書には、出産の日などを医師か助産師が証明する欄がある）。出産で辞めた人も、1年以上入っていて辞める日に休んでいれば受け取れる事がある（同法第104条）。勤め先と健康保険に確かめる", needsLocal: false, only: ["mother-employed"] },
  { id: "maternity-allowance-apply", title: "出産手当金を申請する（勤め先を通して健康保険へ）", plain: "出産手当金を申請する", hint: "産後56日を過ぎたら。振込は申請から1〜2か月ほど", kind: "手続き", who: "母", anchor: "birth", start: { days: 57 }, deadline: { months: 3 }, deadlineKind: "目安", basis: "健康保険法第102条（産前42日・産後56日の間で休んだ日に、賃金のおよそ3分の2）・第193条（休んだ日ごとに、その次の日から2年で時効）。振込までの日数は健康保険ごとに違う（1〜2か月ほど＝近似）", needsLocal: false, only: ["mother-employed"] },
  { id: "childcare-benefit-first", title: "育児休業給付の初回の申請を、勤め先に頼む（その後は2か月ごと）", plain: "育休の給付の初回の申請を頼む", hint: "勤め先がハローワークへ。期限は育休の4か月目の月末", kind: "仕事", who: "母", anchor: "birth", start: { days: 57 }, deadline: { months: 5 }, deadlineKind: "期限", dates: (b) => benefitFirst(b), basis: "雇用保険法第61条の7（育児休業給付: 180日まで賃金の67%・その後50%）・同法施行規則第101条の30（初回の申請は、育休を始めた日から4か月を経過する日の属する月の末日まで。その後は2か月ごと）。育休は産後休業の次の日から始まる形で置いた（近似）", needsLocal: false, only: ["mother-leave"] },
  // 申請の起点は、生まれた日（予定日より早く生まれた時は予定日）。日は papaBenefit（lib/leave-money.ts。出典の URL と確かめた日もそこに）
  { id: "partner-childcare-benefit", title: "パートナーの育休の給付（産後パパ育休の出生時育児休業給付）を、勤め先に申請してもらう", plain: "パートナーの育休の給付を申請してもらう", hint: "生まれて8週を過ぎてから。勤め先がハローワークへ", kind: "仕事", who: "パートナー", anchor: "birth", start: { days: 56 }, deadline: { months: 3 }, deadlineKind: "期限", dates: (b, due) => papaBenefit(b, due ?? b), basis: "雇用保険法第61条の8（出生時育児休業給付: 産後パパ育休の日に、賃金の67%）・同法施行規則第101条の33（生まれた日（予定日より早く生まれた時は予定日）から8週を経過する日の翌日から、その日から2か月を経過する日の属する月の末日まで。産後パパ育休を28日取り終えた時・2回目を終えた時は、その次の日から申請でき、期限もその日から数えるので早まる。厚生労働省「育児休業等給付の内容と支給申請手続」2026年8月改訂版で確かめた・2026年11月）。ふつうの育休だけを取った時は、育児休業給付の申請になる。休みの取り方で日が変わるので、勤め先に確かめる", needsLocal: false, only: ["partner-leave"] },
  { id: "benefit-drop", title: "育休の181日目から、育児休業給付が賃金の67%から50%に下がる。その前の月に家計を見ておく", plain: "育休の給付が下がる前に家計を見る", hint: "育休が半年を超える時。181日目から67%が50%に", kind: "準備", who: "家族", anchor: "birth", start: { days: 207 }, deadline: { days: 237 }, deadlineKind: "目安", dates: (b) => benefitDrop(b), basis: "雇用保険法第61条の7（育児休業給付は、育休を始めて180日までは賃金の67%、181日目から50%）。育休は産後休業の次の日から始まる形で数えた（近似）。手取りの額は勤め先の明細で確かめる", needsLocal: false, only: ["mother-leave"] },
  { id: "shorttime-benefit", title: "時短で仕事に戻るなら、育児時短就業給付（時短の間の賃金の10%）を勤め先に頼む", plain: "時短で戻るなら時短の給付を頼む", hint: "子が2歳になるまで。勤め先がハローワークへ", kind: "仕事", who: "母", anchor: "birth", start: { months: 10 }, deadline: { months: 11 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).back, basis: "雇用保険法第61条の12（育児時短就業給付・2025年4月から。2歳になるまでの子を育てて時短で働く時、時短の間に払われた賃金の10%まで）。時短で戻るか・受け取れるかは勤め先に確かめる", needsLocal: false, only: ["daycare", "mother-leave"] },
  { id: "lump-sum-diff", title: "出産育児一時金の差額を、健康保険に申請する（直接支払で、出産の費用が一時金より少なかった時）", plain: "一時金の差額を申請する", hint: "費用が一時金より少なかった時だけ。明細書で見る", kind: "手続き", who: "母", anchor: "birth", start: { days: 7 }, deadline: { months: 3 }, deadlineKind: "目安", basis: "出産育児一時金（健康保険法第101条）。直接支払で産院に払われた額が一時金より少なければ、差額を健康保険に申請する（健康保険から案内が届く所もある）。時効は2年（同法第193条）なので、ここは早めの目安。差額があるかは退院の時の明細書（直接支払の合意文書）で見る", needsLocal: false },
  { id: "medical-deduction", title: "出産の年の医療費を、医療費控除として確定申告する（妊婦健診の自己負担・通院の交通費も入る）", plain: "医療費控除を申告する", hint: "出産の翌年2/16〜3/15。領収書を残す", kind: "手続き", who: "家族", anchor: "birth", start: { months: 13 }, deadline: { months: 14 }, deadlineKind: "目安", dates: (b) => ({ start: `${Number(b.slice(0, 4)) + 1}-02-16`, deadline: `${Number(b.slice(0, 4)) + 1}-03-15` }), basis: "医療費控除（所得税法第73条）。家族の1年（1月〜12月）の医療費が10万円（所得が少なければ所得の5%）を超えた分。出産の費用は出産育児一時金を引いて数える。妊婦健診の自己負担・通院の交通費も入る（国税庁 No.1124・2025年）。確定申告は翌年2月16日〜3月15日、会社員の還付の申告は1月から5年までできる。控除になるかは税務署の案内で確かめる", needsLocal: false },
  { id: "daycare-extend", title: "保育園に入れなかった時: 保留の通知を受け取り、育休を1歳6か月まで延ばす事を職場に申し出る", plain: "入れなかった時、育休の延長を申し出る", hint: "入れた時は「済んだ」を。1歳の誕生日の2週間前まで", kind: "仕事", who: "母", anchor: "birth", start: { months: 10 }, deadline: { months: 12, days: -14 }, deadlineKind: "期限", dates: (b) => daycarePlan(b).extend, basis: "育児・介護休業法第5条第3項（保育所に入れない時は1歳6か月まで延ばせる）・同法施行規則（1歳を過ぎた分の申し出は、始める日の2週間前まで）。育児休業給付の延長は、2025年4月から、保育所の申込書の写し・入れなかった通知（保留の通知）・延長事由の申告書が要る（雇用保険法施行規則・厚生労働省）。町の通知の名前と届く時期は町ごとに違う", needsLocal: false, only: ["daycare", "mother-employed"] },
  { id: "daycare-extend-2", title: "1歳6か月でも入れなかった時: もう一度申し込み、育休を2歳まで延ばす事を職場に申し出る", plain: "2回目の育休の延長を申し出る", hint: "入れた時は「済んだ」を。1歳6か月の2週間前まで", kind: "仕事", who: "母", anchor: "birth", start: { months: 16 }, deadline: { months: 18, days: -14 }, deadlineKind: "期限", dates: (b) => daycarePlan(b).extend2, basis: "育児・介護休業法第5条第4項（1歳6か月でも保育所に入れない時は2歳まで延ばせる）。1歳6か月の時点の申し込みと保留の通知が、もう一度要る（雇用保険法施行規則・2025年4月から）", needsLocal: false, only: ["daycare", "mother-employed", "return-late"] },
  { id: "daycare-prep", title: "入園が決まったら: 慣らし保育の送り迎えの担当を決め、病児保育に登録しておく", plain: "慣らし保育と病児保育の準備", hint: "慣らし保育は1〜2週間ほどが多い。病児保育は登録が要ります", kind: "準備", who: "家族", anchor: "birth", start: { months: 11 }, deadline: { months: 12 }, deadlineKind: "目安", dates: (b) => daycarePlan(b).prep, basis: "慣らし保育の長さは園ごと（1〜2週間ほどが多い＝近似）。病児保育（児童福祉法第6条の3第13項の病児保育事業）は、使う前に登録が要る所が多い。町と園で確かめる", needsLocal: true, only: ["daycare"] },
  { id: "bcg", title: "BCG の予防接種", plain: "BCG を受ける", hint: "生後5〜8か月が目安。1歳になる前に", kind: "健診", who: "家族", anchor: "birth", start: { months: 5 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令（対象は1歳になるまで。標準は生後5〜8か月）。${VAX_WHERE}`, needsLocal: true },
  // B型肝炎の3回目・水痘の2回目の期限は、公費（定期接種）で受けられる年齢の上限（法の期限）。予防接種法施行令第3条の表（2026年10月1日施行の版）:
  // B型肝炎「一歳に至るまでの間にある者」・水痘「生後十二月から生後三十六月に至るまでの間にある者」。「至るまで」は誕生日の前日まで（days: -1）。
  // 接種の日から数え直しても（vax-next.ts の applyRetime）、この2行の期限は動かさない。出典（2026-11-05 確認）: e-Gov 法令検索 https://laws.e-gov.go.jp/law/323CO0000000197
  { id: "vaccines-7m", title: "B型肝炎の予防接種（3回目）", plain: "B型肝炎の3回目を受ける", hint: "1回目から139日以上あけて。生後7〜8か月ごろ", kind: "健診", who: "家族", anchor: "birth", start: { months: 7 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令第3条（B型肝炎は1歳になるまでに3回。3回目は1回目から139日以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-9-10m", title: "9〜10か月健診", plain: "9〜10か月健診", hint: "多くの町で。受け方は町ごとに違います", kind: "健診", who: "家族", anchor: "birth", start: { months: 9 }, deadline: { months: 11 }, deadlineKind: "目安", basis: "町の乳児健診（母子保健法第13条。行うか・小児科で受けるか集団かは町ごとに違う。町の案内で確かめる）", needsLocal: true },
  { id: "first-birthday-vaccines", title: "1歳の予防接種（麻しん風しん（MR）・水ぼうそう（水痘）・小児用肺炎球菌の追加）", plain: "1歳の予防接種", hint: "1歳になったら早めに。麻しん風しん（MR）・水ぼうそう（水痘）など", kind: "健診", who: "家族", anchor: "birth", start: { months: 12 }, deadline: { months: 24, days: -1 }, basis: `予防接種法施行令（麻しん風しん（MR）の1期は1歳から2歳になるまで。水ぼうそう（水痘）は1歳から3歳になるまでに2回。肺炎球菌の追加は標準で生後12〜15か月。五種混合の追加は3回目から6か月以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "five-booster", title: "五種混合の追加（4回目）", plain: "五種混合の追加を受ける", hint: "3回目から6か月以上あけて。1歳から1歳半ごろ", kind: "健診", who: "家族", anchor: "birth", start: { months: 12 }, deadline: { months: 18 }, deadlineKind: "目安", basis: `予防接種法施行令（五種混合の1期の追加は、3回目から6か月以上あけて。標準は3回目から6〜18か月の間）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-18m", title: "1歳6か月健診", plain: "1歳半健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 24 }, basis: "母子保健法第12条", needsLocal: true },
  { id: "vaccines-18m", title: "水ぼうそう（水痘）の予防接種（2回目）", plain: "水ぼうそう（水痘）の2回目を受ける", hint: "1回目から6〜12か月あけて", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 36, days: -1 }, basis: `予防接種法施行令第3条（水ぼうそう（水痘）は1歳から3歳になるまでに2回。2回目は1回目から3か月以上、標準は6〜12か月あける）。${VAX_WHERE}`, needsLocal: true },

  // ── 早く生まれた時（見直し C10②）: 予定日から休む申し出をしていたパートナーは、始まりを1回だけ早められる ──
  // 起点は予定日（始まりは生まれた日に寄る＝scheduleFor の「予定日から数える事」）。期限は予定日の前日（もとの始まりの日の前日まで＝目安）
  { id: "partner-leave-earlier", title: "パートナーの育休（産後パパ育休）の始まりを早める申し出をする（予定日より早く生まれた時）", plain: "パートナーの育休の始まりを早める", hint: "1回だけ早められます。申し出は早める日の1週間前までが原則", kind: "仕事", who: "パートナー", anchor: "due", start: { days: -1 }, deadline: { days: -1 }, deadlineKind: "目安", basis: "育児・介護休業法第7条第1項（予定日より早く生まれた時は、育休の始まりの日を1回だけ早められる＝同法施行規則第10条第1号）・第7条第2項と施行規則第14条（早める日の1週間前より後の申し出は、もとの始まりの日までの間で会社が始まりの日を決められる）。産後パパ育休も同じ（同法第9条の4・施行規則第21条の8・第21条の9）。期限の日は、予定日から休む申し出をしていた時の目安（もとの始まりの日の前日まで）。職場に確かめる", needsLocal: false, only: ["partner-leave", "born-early"] },

  // ── 町を変えた時（見直し C10①）: 起点は引っ越した日。期限は初日を数えない（引っ越した日の翌日を1日目とする） ──
  { id: "moved-tennyu", title: "新しい町に転入届を出す", plain: "転入届を出す", hint: "引っ越した日から14日以内に。新しい町の役所へ", kind: "手続き", who: "家族", anchor: "moved", start: { days: 0 }, deadline: { days: 14 }, basis: "住民基本台帳法第22条（転入をした日から14日以内に、新しい町の市町村長に届け出る）。前の町には、引っ越す前に転出届を出す（同法第24条）", needsLocal: true, only: ["moved"] },
  { id: "moved-child-allowance", title: "児童手当を、新しい町に申し込む（認定の請求）", plain: "児童手当を新しい町に申し込む", hint: "引っ越した日の翌日から15日以内に", kind: "手続き", who: "家族", anchor: "moved", start: { days: 0 }, deadline: { days: 15 }, basis: "児童手当法第8条第3項（住所を変えた後15日以内に請求すれば、引っ越した月の翌月分から途切れずに受け取れる）・同法第7条第1項（認定は住む町の市町村長が行う）。公務員の人が受け取っている時は、勤め先に申し出る（同法第17条）", needsLocal: true, only: ["moved", "moved-with-child"] },
  { id: "moved-checkup-tickets", title: "妊婦健診の受診券（補助券）を、新しい町で受け取る", plain: "妊婦健診の券を新しい町で受け取る", hint: "次の健診の前に。替え方は町ごとに違います", kind: "手続き", who: "母", anchor: "moved", start: { days: 0 }, basis: "町の運用（妊婦健診の券は住む町が出している。前の町の券の扱いと、新しい町での受け取り方・持ち物は町ごとに違う）。新しい町に確かめる", needsLocal: true, pregnancyOnly: true, only: ["moved", "moved-pregnant"] },
  { id: "moved-medical-card", title: "子どもの医療費の受給者証（医療証）を、新しい町で申し込む", plain: "子どもの医療証を新しい町で申し込む", hint: "医療証は住む町が出します。1か月を目安に", kind: "手続き", who: "家族", anchor: "moved", start: { days: 0 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "町の制度（子どもの医療費の助成は、住む町が決めて出している。申し込みの期限・さかのぼって払い戻せるか・持ち物は町ごとに違う）。新しい町に確かめる", needsLocal: true, only: ["moved", "moved-with-child"] },

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
  /** 予防接種で、手帳の接種の日付から始まりを数え直した時の理由（vax-next.ts の applyRetime） */
  retimeNote?: string;
  /** 数え直した時の、打つ物と前の回（予約の電話メモに使う） */
  retime?: { doses: string[]; lastDate: string; lastFacility?: string };
  /**
   * 数え直した始まりが、公費（定期接種）で受けられる年齢の期限（deadlineDate。動かさない）を越える見込み（vax-next.ts の applyRetime）。
   * 判断はせず、retimeNote に確かめる先（小児科・保健センター）を添える
   */
  beyondPublic?: boolean;
  /** 上の子の予定（第2波①。lib/older.ts）。何人目か（0から）と、画面に出す呼び方 */
  older?: { index: number; label: string };
}

/** scheduleFor に渡す家族（FamilyDates に、家族の形と人の役を足した物。どちらも無ければ今までどおり） */
export interface ScheduleInput extends FamilyDates {
  situation?: Situation;
  /** 住む町（里帰り先と同じ市かを見る。第2波⑦） */
  city?: string;
  prefecture?: string;
  /** 前に住んでいた町と、引っ越した日（町を変えた家族。引っ越しの行の起点＝見直し C10①） */
  previousCity?: string;
  previousPrefecture?: string;
  movedOn?: string;
  members?: { role: string; name?: string }[];
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
    case "mother-leave": {
      const w = s?.motherWork;
      return w === undefined || w === "会社員・公務員" || w === "パート・派遣";
    }
    case "leave-short":
      return s?.partnerLeaveLen === "14日未満";
    case "return-late":
      return s?.returnAt === "1歳を過ぎて";
    case "older-daycare":
      return hasOlderChildren(s) && !!s?.olderKids?.some((k) => k.care === "保育園");
    case "older-commute":
      return hasOlderChildren(s) && !!s?.olderKids?.some((k) => k.care === "保育園" || k.care === "幼稚園");
    case "satogaeri":
      return !!s?.satogaeri;
    case "satogaeri-away":
      return !!s?.satogaeri && satogaeriReach(f, s) !== "同じ市";
    case "satogaeri-place": {
      const r = satogaeriReach(f, s);
      return r === "同じ県" || r === "ほかの県";
    }
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
    case "moved":
      return movedTown(f);
    case "moved-pregnant":
      return movedTown(f) && f.movedOn! >= lmpFromDue(f.dueDate) && (!f.birthDate || f.movedOn! < f.birthDate);
    case "moved-with-child":
      return movedTown(f) && ((!!f.birthDate && f.birthDate <= f.movedOn!) || hasOlderChildren(s));
    case "born-early":
      return !!f.birthDate && diffDays(f.dueDate, f.birthDate) >= EARLY_BIRTH_DAYS;
  }
}

/** 予定日より何日以上早く生まれたら「早く生まれた」とするか（参謀の気づき BIRTH_SHIFT_DAYS と同じ） */
export const EARLY_BIRTH_DAYS = 7;

/** 町を変えた家族か（前の町と引っ越した日を覚えていて、今の町と違う） */
function movedTown(f: ScheduleInput): boolean {
  if (!f.movedOn || !f.previousCity) return false;
  return f.previousCity !== f.city || (f.previousPrefecture ?? f.prefecture) !== f.prefecture;
}

/**
 * 法律上の親（父母）が出す届け。担当は「家族」にして、誰が窓口へ行くかを家族で選ぶ（今日の画面の「誰がやる？」）。
 * パートナーに決め打ちすると、同性の家族・結婚していない父母（出生届は母）に合わない（2026-11-04 見直し L2-2）
 */
export const PARENT_FILINGS = new Set(["birth-registration", "child-allowance", "child-allowance-change", "health-insurance", "medical-subsidy", "moved-child-allowance", "moved-medical-card"]);

/** 短い題に入れる呼び名の長さの上限（これより長い呼び名は「パートナー」のまま） */
const PARTNER_NAME_MAX = 6;

/** 双子などで「（2人分）」を付ける事 */
const PER_BABY = new Set(["birth-registration", "child-allowance", "child-allowance-change", "health-insurance", "medical-subsidy", "birth-notice"]);

/** 家族の形で言い方・日を変える（項目は増やさない） */
function adjust(m: MilestoneDef, f: ScheduleInput): MilestoneDef {
  const s = f.situation;
  let out = m;
  // パートナーがいない家族: パートナーの担当は母へ
  if (!hasPartner(f) && out.who === "パートナー") out = { ...out, who: "母" };
  // 短い題の「パートナーの…」は、家族が付けた呼び名で（「奈央の育休を職場に伝える」。長い名前は「パートナー」のまま＝画面で折れないように）
  const partnerName = f.members?.find((x) => x.role === "パートナー")?.name?.trim();
  if (partnerName && partnerName.length <= PARTNER_NAME_MAX && out.plain.startsWith("パートナーの")) out = { ...out, plain: `${partnerName}${out.plain.slice("パートナー".length)}` };
  // パートナーがいない家族: 法律上の親が出す届け（担当は「家族」＝誰が行くかを家族で選ぶ）は、母の事にする
  if (!hasPartner(f) && PARENT_FILINGS.has(out.id)) out = { ...out, who: "母" };
  // パートナーがいない家族: 産後ケアの確かめに、町の家事・育児の手伝いを一言足す
  if (!hasPartner(f) && out.id === "postpartum-care") out = { ...out, hint: "出産後1年まで。町の家事の手伝いも" };
  const n = babyCount(s);
  if (n >= 2 && PER_BABY.has(out.id)) out = { ...out, title: `${out.title}（${n}人分）`, plain: `${out.plain}（${n}人分）` };
  // 双子など: 産前休業は予定日を含めて14週（98日）。1日目は予定日の97日前（労働基準法第65条第1項。出典は MILESTONES の maternity-leave の上）
  if (n >= 2 && out.id === "maternity-leave") {
    out = { ...out, title: "産前休業が始められる（双子などは予定日の14週前）", hint: "双子などは予定日も入れて14週。予定日の97日前から", start: { days: -97 }, basis: "労働基準法第65条第1項（多胎妊娠は、14週間以内に出産する予定の人が、請求すれば休める。出産の当日は産前に入るので、予定日を含めて14週（98日）と数え、1日目は予定日の97日前。厚生労働省「働く女性の心とからだの応援サイト」の用語辞典で確かめた・2026年11月）。出産手当金の「出産の日以前98日」も、出産の日を入れて数える（健康保険法第102条・協会けんぽ）" };
  }
  // 双子など: 産休が8週早く始まる（予定日の97日前）ので、産休の前に済ませる目安の2つも8週早く締める
  // （1人の時の締めのまま＝妊娠34週・28週だと、双子の産休が始まった後になる。始まりとの間は1人の時と同じ）
  if (n >= 2 && out.id === "leave-money-request") {
    out = { ...out, start: { days: 280 - 98 - 42 }, deadline: { days: 280 - 98 }, hint: "出産手当金・保険料の免除・育休の給付。産休（双子などは14週前から）の前に", basis: `${out.basis}。双子などは産前休業が予定日を含めて14週（労働基準法第65条第1項）なので、目安を8週早めた` };
  }
  if (n >= 2 && out.id === "mother-quit-date") {
    out = { ...out, deadline: w(20), hint: "産休（双子などは14週前から）の前か後かで、受け取れるお金が変わります" };
  }
  // 予定日より早く生まれた時: 産後パパ育休の給付の申請は、予定日から8週を過ぎてから（雇用保険法施行規則第101条の33。日は papaBenefit）
  if (out.id === "partner-childcare-benefit" && f.birthDate && f.birthDate < f.dueDate) {
    out = { ...out, hint: "予定日から8週を過ぎてから。勤め先がハローワークへ" };
  }
  // 保育園に預けて働く家族: 調べる・見学は、4月入園の申し込みの前に（daycarePlan の近似）
  if (out.id === "daycare-research" && applies("daycare", f)) {
    out = { ...out, hint: "申し込みの前に。時期と締切は町ごとに違います", dates: (b) => daycarePlan(b, s?.returnAt).research, basis: DAYCARE_BASIS };
  }
  // 仕事に戻りたい時期で、入る4月を動かす（第2波④）
  const plan = DAYCARE_DATES[out.id];
  if (plan && s?.returnAt) {
    out = { ...out, dates: (b) => plan(daycarePlan(b, s.returnAt)) };
    if (out.id === "daycare-apply") out = { ...out, basis: `${DAYCARE_BASIS}。入る4月は、仕事に戻りたい時期（${s.returnAt === "1歳まで" ? "1歳になるまでに" : "1歳を過ぎてから"}）から置いた（近似）` };
  }
  // パートナーの育休の長さがわからない時: 14日以上で上乗せになる事を、育休の相談の一言に足す（第2波⑤。別の1件にすると同じ期限で2行並ぶ）
  if (out.id === "partner-leave" && s?.partnerLeave !== "取らない" && s?.partnerLeaveLen === undefined) {
    out = { ...out, hint: "予定日の2週前までに。14日以上で給付の上乗せ", basis: `${out.basis}。生まれて8週の間に通算14日以上取ると、2025年4月からの出生後休業支援給付で賃金の13%が上乗せされる（雇用保険法第61条の10・最大28日分。母の条件もある）` };
  }
  // 双子など: 支援給付の2回目は、おなかの子の数だけ（1人5万円の目安）
  if (n >= 2 && out.id === "pregnancy-support-2") {
    out = { ...out, title: `${out.title}（おなかの子${n}人分）`, plain: `${out.plain}（${n}人分）`, hint: `予定日の8週前から。${n}人分（1人5万円の目安）` };
  }
  // 里帰り出産: 2回目の面談を里帰り先やオンラインで受けられるかは、住む町に聞く
  if (s?.satogaeri && out.id === "pregnancy-support-2") {
    out = { ...out, hint: "予定日の8週前から。里帰り中の受け方は町に聞く" };
  }
  // 赤ちゃんが国保に入る家族: 加入は役所に14日以内（国民健康保険法施行規則第3条）。目安ではなく法の期限
  if (out.id === "health-insurance" && babyInsuranceOf(s) === "国保") {
    out = { ...out, hint: "国保は役所に14日以内。出生届と同じ日に", deadline: { days: 13 }, deadlineKind: "期限", basis: "国民健康保険法第9条・同法施行規則第3条（国保に入った日から14日以内に届ける。生まれた子は生まれた日から）", needsLocal: true };
  }
  // 公務員の家族: 児童手当は勤め先に申請する
  if (s?.publicServant && (out.id === "child-allowance" || out.id === "child-allowance-change")) {
    out = { ...out, hint: "公務員は勤め先に申請。15日以内に", basis: `${out.basis}・第17条（公務員は勤め先が払う。独立行政法人の職員などは町へ。勤め先で確かめる）`, needsLocal: false };
  }
  // 里帰り出産: 出生届は生まれた所の役所でも出せる。里帰り先の町がわかれば、出せる町の名前を並べる（どちらに出すかは家族が決める）
  if (s?.satogaeri && out.id === "birth-registration") {
    const reach = satogaeriReach(f, s);
    const there = s.satogaeriPlace?.city;
    out =
      there && f.city && (reach === "同じ県" || reach === "ほかの県")
        ? { ...out, hint: `14日以内。${f.city}・${there}・本籍地で出せる`, basis: `${out.basis}・第25条・第51条（住所地・本籍地・生まれた所の役所に出せる。どちらに出すかは家族が決める）` }
        : { ...out, hint: "14日以内。里帰り先の役所でも出せます", basis: `${out.basis}・戸籍法第51条（生まれた所の役所でも出せる）` };
  }
  // 里帰り（第2波⑦）: 里帰り先の町の名前を題に、戻る日を段取りと健診代の申請に
  if (s?.satogaeri) {
    const reach = satogaeriReach(f, s);
    const back = backDays(s.satogaeriBack);
    const backWord = s.satogaeriBack ? `答えてもらった戻る時期（${s.satogaeriBack}）から` : "戻る時期を決めていないので、1か月健診のあと＝";
    if (out.id === "satogaeri-local" && s.satogaeriPlace) {
      out = { ...out, title: `里帰り先の町（${s.satogaeriPlace.city}）で、赤ちゃん訪問の受け方・妊婦健診の受診券の扱い・出生届を出せる所を確かめる` };
    }
    if (out.id === "satogaeri-return") {
      out = { ...out, start: { days: back - 14 }, deadline: { days: back }, basis: out.basis.replace(/^目安（[^）]*）/, `目安（${backWord}生後${back}日ごろに置いた近似）`) };
    }
    if (out.id === "satogaeri-checkup-refund") {
      out = { ...out, start: { days: back } };
      if (reach === "同じ県") out = { ...out, hint: "県の中は受診券が使える事が多い。使えなかった分だけ", basis: `${out.basis}。同じ都道府県の中は、町の間の取り決めで受診券が使える事が多い（近似。町ごとに違う）` };
    }
    if (out.id === "one-month-checkup" && reach !== "同じ市") {
      out = { ...out, hint: "里帰り先の産院で受けてから戻る家族が多い" };
    }
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
  const b = input.birthDate && today && input.birthDate > today ? { ...input, birthDate: undefined } : input;
  // 今日より先の引っ越しも、まだ引っ越していない（前の町に住んでいる）。見本の家族は24週で引っ越すので、8週の画面に転入届が出ていた
  // （本物の家族の引っ越した日は今日まで＝設定の欄。早送りの検査の viewAt と同じ見方）
  const f =
    b.movedOn && today && b.movedOn > today
      ? { ...b, city: b.previousCity ?? b.city, prefecture: b.previousPrefecture ?? b.prefecture, previousCity: undefined, previousPrefecture: undefined, movedOn: undefined }
      : b;
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  const trying = !!today && today < lmp && !f.birthDate;
  const own = MILESTONES.filter((m) => !m.only || m.only.every((o) => applies(o, f)))
    .map((def) => {
      const m = adjust(def, f);
      // 引っ越しの行（anchor "moved"）は印 "moved" で、引っ越した日を持つ家族だけに残っている
      const base = m.anchor === "lmp" ? lmp : m.anchor === "due" ? f.dueDate : m.anchor === "moved" ? f.movedOn! : birth;
      const fixed = m.dates?.(base, f.dueDate);
      const start = fixed ? fixed.start : resolve(base, m.start);
      return {
        ...m,
        // 予定日から数える事は、それより早く生まれたら生まれた日から（28週で生まれた家族で、支援給付の2回目がずっと「まだ先」にならないように）
        startDate: m.anchor === "due" && f.birthDate && f.birthDate < start ? f.birthDate : start,
        deadlineDate: fixed ? fixed.deadline : m.deadline ? resolve(base, m.deadline) : undefined,
        ...(trying ? { awaitingPregnancy: true } : {}),
        ...(m.anchor === "birth" && !f.birthDate ? { awaitingBirth: true } : {}),
        ...(m.pregnancyOnly && f.birthDate ? { endsOn: f.birthDate } : {}),
      };
    });
  return [...own, ...olderSchedule(f, olderDefs(MILESTONES), today)].sort((a, b) => a.startDate.localeCompare(b.startDate));
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
  // 上の子の健診・接種は、期限を過ぎても急かさない（上の子の母子手帳が正。lib/older.ts）
  if (m.older && m.deadlineDate && today > m.deadlineDate) return "過ぎた";
  if (today < m.startDate) return "まだ先";
  if (!m.deadlineDate && today > endOf(m)) return "過ぎた";
  if (m.deadlineDate) {
    if (today > m.deadlineDate) return "期限切れ";
    const left = (Date.parse(m.deadlineDate) - Date.parse(today)) / 86_400_000;
    if (left <= 3) return "期限が近い";
  }
  return "今やる";
}
