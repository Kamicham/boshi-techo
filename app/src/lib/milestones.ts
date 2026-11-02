// 全国共通の「その時やる事」の骨組み。
// ここには法律・国の目安で決まっている物だけを置く。町ごとに違う中身（窓口・持ち物・助成の額）は、
// その家族の町についてエージェントが取りに行く（needsLocal = true の物）。
// 家族の形（lib/situation.ts）で、出す・出さない・言い方を変える（only と scheduleFor）。わからない欄は今までどおり出す。

import { addDays, addMonths, lmpFromDue, type FamilyDates } from "./clock";
import { babyCount, hasOlderChildren, isFirstNenkinMother, motherEmployed, partnerEmployed, partnerTakesLeave, type Situation } from "./situation";

export type Kind = "手続き" | "健診" | "仕事" | "準備" | "記録";
export type Who = "家族" | "母" | "パートナー" | "祖父母";

/**
 * 家族の形で出すかを決める印（並べた物すべてに当てはまる時だけ出す）。
 * わからない欄は「当てはまる」側に倒す物（今までの項目）と、わかった時だけ出す物（足した項目）がある。中身は applies を見る。
 */
export type Only =
  | "mother-employed" // 母が雇われて働く（わからない時も）
  | "mother-quits" // 母が出産で辞める（わかった時だけ）
  | "mother-kokuho" // 母が国民年金・国民健康保険に入っていそう（自営・フリー、など。わかった時だけ）
  | "someone-employed" // 母かパートナーのどちらかが雇われて働く（わからない時も）
  | "partner-leave" // パートナーがいて、育休を取るかもしれない（わからない時も）
  | "partner-no-leave" // パートナーがいて、育休を取らない・自営・仕事なし（わかった時だけ）
  | "single" // 家族にパートナーがいない（members でわかった時だけ）
  | "first-child" // 第1子（わからない時も）
  | "older-children" // 上の子がいる（わかった時だけ）
  | "satogaeri"; // 里帰り出産をする（わかった時だけ）

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
}

const w = (weeks: number) => ({ days: weeks * 7 });

/** 予防接種の行き先と、遅れた時の案内（どの接種にも付ける） */
const VAX_WHERE = "受ける所は、町が決めた小児科などの医療機関（役所ではない。BCG は町の保健センターでの集団接種の町もある）。遅れても、定期接種の対象の年齢の中なら公費で受けられる。迷ったら町の保健センターに聞く";

export const MILESTONES: MilestoneDef[] = [
  // ── 妊娠中 ──
  { id: "pregnancy-report", title: "妊娠の届出と母子健康手帳の受け取り", plain: "役所に妊娠を届ける", hint: "母子手帳と、健診の補助券がもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(6), deadline: w(11), deadlineKind: "目安", basis: "母子保健法第15条（期限の定めはなく、11週までが目安）", needsLocal: true, pregnancyOnly: true },
  { id: "checkup-plan", title: "妊婦健診の予定を立てる（23週まで4週ごと）", plain: "妊婦健診の予定を立てる", hint: "23週までは4週に1回が目安", kind: "健診", who: "母", anchor: "lmp", start: w(8), basis: "国の標準的な健診の回数（14回）", needsLocal: false, pregnancyOnly: true },
  { id: "satogaeri-hospital", title: "里帰り先の産院に、お産の予約をする", plain: "里帰り先の産院を予約する", hint: "早めに。多くの産院は妊娠中期までに予約が要ります", kind: "準備", who: "母", anchor: "lmp", start: w(8), deadline: w(20), deadlineKind: "目安", basis: "目安（予約の締め切りと、何週までに帰るかは産院ごとに違う。里帰り先の産院に確かめる）", needsLocal: false, pregnancyOnly: true, only: ["satogaeri"] },
  { id: "tell-work", title: "職場に妊娠を伝え、産休・育休の段取りを相談する", plain: "職場に妊娠を伝える", hint: "産休・育休の段取りを一緒に決めます", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(20), deadlineKind: "目安", basis: "目安（安定期のころ）", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "mother-quit-date", title: "退職の日を職場と決める（産休を取ってからか・出産手当金を受け取れるかも確かめる）", plain: "退職の日を職場と決める", hint: "産休の前か後かで、受け取れるお金が変わります", kind: "仕事", who: "母", anchor: "lmp", start: w(14), deadline: w(28), deadlineKind: "目安", basis: "労働基準法第65条（産前産後休業）・健康保険法第104条（辞めた後も出産手当金を受け取れる条件がある）。条件は入っている健康保険で確かめる", needsLocal: false, pregnancyOnly: true, only: ["mother-quits"] },
  { id: "partner-leave", title: "パートナーの育休（産後パパ育休）を職場に相談する", plain: "パパの育休を職場に伝える", hint: "産後すぐ休むなら、予定日の2週間前までに", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, basis: "育児・介護休業法（産後パパ育休の申し出は原則2週間前まで。予定日から休むなら予定日の2週間前）", needsLocal: false, only: ["partner-leave"] },
  { id: "partner-days-off", title: "出産の前後に、パートナーが休む日・家にいる日を決める（有休など）", plain: "産後すぐ家にいる日を決める", hint: "有休や仕事の調整で、退院の日や最初の週に", kind: "仕事", who: "パートナー", anchor: "lmp", start: w(20), deadline: { days: 280 - 14 }, deadlineKind: "目安", basis: "目安（育休を取らない時も、有休などで休める日を先に決めておく。予定日の2週間前までに）", needsLocal: false, only: ["partner-no-leave"] },
  { id: "nenkin-maternity-exempt", title: "国民年金の産前産後期間の保険料免除を届け出る", plain: "国民年金の産前産後の免除を届ける", hint: "予定日の6か月前から届けられます", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民年金法第88条の2（2019年4月から。予定月の前月から4か月分、双子などは3か月前から6か月分の保険料が免除。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国民年金の係。日本年金機構のページで確かめる）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "kokuho-maternity-exempt", title: "国民健康保険の産前産後期間の保険料の減額（免除）を届け出る", plain: "国保の産前産後の減額を届ける", hint: "国保に入っている人。予定日の6か月前から", kind: "手続き", who: "母", anchor: "due", start: { months: -6 }, deadline: { days: 0 }, deadlineKind: "目安", basis: "国民健康保険法施行令の改正（2024年1月から。予定月の前月から4か月分、双子などは3か月前から6か月分の所得割・均等割が減る（0円になるとは限らない）。予定日の6か月前から届けられ、生まれた後でも届けられる。窓口は役所の国保の係）", needsLocal: true, only: ["mother-kokuho"] },
  { id: "checkup-biweekly", title: "健診が2週ごとになる（24〜35週）", plain: "健診が2週に1回になる", hint: "24週から35週まで", kind: "健診", who: "母", anchor: "lmp", start: w(24), basis: "国の標準的な健診の回数", needsLocal: false, pregnancyOnly: true },
  { id: "older-child-care", title: "出産の入院中、上の子を見てもらう先を決める（一時保育・ファミリー・サポート・祖父母）", plain: "入院中の上の子の預け先を決める", hint: "一時保育やファミサポは、前もって登録が要ります", kind: "準備", who: "家族", anchor: "lmp", start: w(24), deadline: w(34), deadlineKind: "目安", basis: "一時預かり事業（児童福祉法第6条の3第7項）・ファミリー・サポート・センター（子ども・子育て支援法第59条の子育て援助活動支援事業）・ショートステイ（子育て短期支援事業）。使える物と登録の仕方は町ごとに違う", needsLocal: true, pregnancyOnly: true, only: ["older-children"] },
  { id: "satogaeri-visit", title: "赤ちゃん訪問を里帰り先で受けたい事を、住む町に伝える", plain: "里帰り先での訪問を頼む", hint: "住む町から、里帰り先の町へ頼んでもらえます", kind: "手続き", who: "母", anchor: "lmp", start: w(28), deadline: w(34), deadlineKind: "目安", basis: "新生児訪問（母子保健法第11条）・乳児家庭全戸訪問（児童福祉法第6条の3第4項）。里帰り先での訪問は、住む町が里帰り先の町に頼む形が多い。できるかと頼み方は住む町に確かめる", needsLocal: true, only: ["satogaeri"] },
  { id: "direct-payment", title: "出産育児一時金の直接支払制度の書類を産院で出す", plain: "出産のお金の書類を産院に出す", hint: "退院の時に大きなお金を払わずにすみます", kind: "手続き", who: "母", anchor: "lmp", start: w(30), deadline: w(36), deadlineKind: "目安", basis: "健康保険法（出産育児一時金。金額と手続きは制度が変わる事があるので、そのつど公式の情報で確かめる）", needsLocal: true, pregnancyOnly: true },
  { id: "maternity-leave", title: "産前休業が始められる（予定日の6週前）", plain: "産休に入れる", hint: "予定日の6週前から休めます", kind: "仕事", who: "母", anchor: "lmp", start: { days: 280 - 42 }, basis: "労働基準法第65条", needsLocal: false, pregnancyOnly: true, only: ["mother-employed"] },
  { id: "checkup-weekly", title: "健診が毎週になる（36週から）", plain: "健診が毎週になる", hint: "36週から", kind: "健診", who: "母", anchor: "lmp", start: w(36), basis: "国の標準的な健診の回数", needsLocal: false, pregnancyOnly: true },
  { id: "hospital-bag", title: "入院の持ち物をそろえる", plain: "入院の荷物をまとめる", hint: "陣痛が来たら、すぐ出られるように", kind: "準備", who: "家族", anchor: "lmp", start: w(34), deadline: w(36), deadlineKind: "目安", basis: "目安", needsLocal: false, pregnancyOnly: true },
  { id: "mother-insurance-switch", title: "退職したら、母の健康保険を切り替える（家族の扶養・国民健康保険・任意継続のどれか）", plain: "母の健康保険を切り替える", hint: "辞めた次の日から。国保なら14日以内に届けます", kind: "手続き", who: "母", anchor: "lmp", start: w(34), deadline: { days: 280 + 70 }, deadlineKind: "目安", basis: "国民健康保険法第9条・同法施行規則第3条（国保は入った日から14日以内に届ける）・健康保険法施行規則第38条（家族の扶養は家族の勤め先へ）・健康保険法第37条（任意継続は辞めた次の日から20日以内）。辞める日で期限が変わるので、日は目安", needsLocal: true, only: ["mother-quits"] },

  // ── 生まれてから ──
  { id: "birth-registration", title: "出生届を出す", plain: "出生届を出す", hint: "生まれた日から14日以内", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 0 }, deadline: { days: 13 }, basis: "戸籍法第49条（生まれた日を含めて14日以内）", needsLocal: true },
  { id: "child-allowance", title: "児童手当を申請する", plain: "児童手当を申し込む", hint: "遅れると、その月の分がもらえません", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法（生まれた日の翌日から15日以内に申請すると、翌月分から受け取れる）", needsLocal: true, only: ["first-child"] },
  { id: "child-allowance-change", title: "児童手当の額を変える届けを出す（額改定の請求）", plain: "児童手当の額を変える届けを出す", hint: "上の子の手当に足します。15日以内に", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, basis: "児童手当法第9条（額の改定。生まれた日の翌日から15日以内に請求すると、生まれた月の翌月分から増える。過ぎると、請求した月の翌月分から）", needsLocal: true, only: ["older-children"] },
  { id: "health-insurance", title: "赤ちゃんを健康保険に入れる", plain: "赤ちゃんの保険証を作る", hint: "1か月健診までに", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "1か月健診までが目安", needsLocal: false },
  { id: "medical-subsidy", title: "子ども医療費助成の受給者証を申請する", plain: "子どもの医療費助成を申し込む", hint: "病院代の助成が受けられます", kind: "手続き", who: "パートナー", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "町の制度（保険証が届いたら）", needsLocal: true },
  { id: "single-child-support", title: "児童扶養手当を申請する（ひとり親の家庭）", plain: "児童扶養手当を申し込む", hint: "申し込んだ次の月の分から。早めに", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 15 }, deadlineKind: "目安", basis: "児童扶養手当法第6条（認定の請求）・第7条（請求した月の翌月分から。さかのぼらない）。所得の制限がある。窓口は役所", needsLocal: true, only: ["single"] },
  { id: "single-medical", title: "ひとり親家庭等医療費助成を申請する", plain: "ひとり親の医療費助成を申し込む", hint: "親と子の病院代の助成。町ごとに中身が違います", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { months: 1 }, deadlineKind: "目安", basis: "都道府県・町の制度（名前・所得の制限・助成の中身は町ごとに違う。窓口は役所。確かめる）", needsLocal: true, only: ["single"] },
  { id: "birth-notice", title: "出生連絡票（新生児訪問の申し込み）を出す", plain: "出生連絡票を出す", hint: "保健師さんが家に来てくれます", kind: "手続き", who: "母", anchor: "birth", start: { days: 1 }, deadline: { days: 14 }, deadlineKind: "目安", basis: "母子保健法第11条（新生児訪問）", needsLocal: true },
  { id: "tell-work-birth", title: "職場に出産の報告と育休の開始を伝える", plain: "職場に生まれた事を伝える", hint: "育休の始まりも一緒に", kind: "仕事", who: "家族", anchor: "birth", start: { days: 1 }, deadline: { days: 7 }, deadlineKind: "目安", basis: "目安", needsLocal: false, only: ["someone-employed"] },
  { id: "one-month-checkup", title: "1か月健診", plain: "1か月健診", hint: "ママと赤ちゃん、両方みてもらいます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, basis: "国の目安", needsLocal: false },
  { id: "home-visit", title: "乳児家庭全戸訪問（こんにちは赤ちゃん訪問）", plain: "赤ちゃん訪問を受ける", hint: "町の人が家に来てくれます", kind: "健診", who: "家族", anchor: "birth", start: { months: 1 }, deadline: { months: 4 }, deadlineKind: "目安", basis: "児童福祉法（生後4か月まで）", needsLocal: true },
  { id: "satogaeri-checkup-refund", title: "里帰り先で補助券が使えなかった妊婦健診の分を、住む町に申請する（償還払い）", plain: "里帰り先の健診代を申請する", hint: "補助券が使えない所の分は、後から町に申請します。期限は町ごと（1年以内が多い）", kind: "手続き", who: "母", anchor: "birth", start: { months: 1 }, deadline: { months: 12, days: -1 }, deadlineKind: "目安", basis: "妊婦健康診査の公費負担（母子保健法第13条）。町の外で受けた健診は、後から払い戻す町が多い。申請の期限は町ごとに違い、出産から1年以内（杉並区など）・最後の健診から1年以内（栃木市など）・受けた日から2年以内（船橋市など）がある（2026年に各町のページで確かめた）。期限と書類（領収書・健診の記録）は住む町で確かめる", needsLocal: true, only: ["satogaeri"] },
  { id: "vaccines-start", title: "生後2か月の予防接種（B型肝炎・ロタ・小児用肺炎球菌・五種混合の1回目）", plain: "予防接種を始める", hint: "生後2か月から。小児科などに予約します", kind: "健診", who: "家族", anchor: "birth", start: { months: 2 }, deadline: { days: 14 * 7 + 6 }, deadlineKind: "目安", basis: `予防接種法（定期接種。五種混合は2024年4月から）。標準は生後2か月から同じ日にまとめて受ける。ロタの1回目は生後14週6日までに受けるのが望ましい。${VAX_WHERE}`, needsLocal: true },
  { id: "vaccines-3m", title: "生後3か月の予防接種（B型肝炎・ロタ・小児用肺炎球菌・五種混合の2回目）", plain: "予防接種の2回目", hint: "1回目から4週ほどあけて。小児科などで", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 4 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。肺炎球菌・ロタは27日以上、五種混合は20日以上あける。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-3-4m", title: "3〜4か月健診", plain: "3〜4か月健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 3 }, deadline: { months: 5 }, deadlineKind: "目安", basis: "町の乳幼児健診（母子保健法第13条。ほとんどの町で行う。日と場所は町ごとに違う）", needsLocal: true },
  { id: "vaccines-4m", title: "生後4か月の予防接種（小児用肺炎球菌・五種混合の3回目。ロタは種類による）", plain: "予防接種の3回目", hint: "肺炎球菌・五種混合。ロタは3回の種類だけ", kind: "健診", who: "家族", anchor: "birth", start: { months: 4 }, deadline: { months: 5 }, deadlineKind: "目安", basis: `予防接種法（定期接種）。ロタは2回の種類（24週まで）と3回の種類（32週まで）がある。${VAX_WHERE}`, needsLocal: true },
  { id: "daycare-research", title: "保育園の情報を集め、見学の予約をする", plain: "保育園を調べて、見学を申し込む", hint: "申し込みの時期は町ごとに違います", kind: "準備", who: "家族", anchor: "birth", start: { months: 4 }, basis: "町ごとに申込の時期が違う", needsLocal: true },
  { id: "bcg", title: "BCG の予防接種", plain: "BCG を受ける", hint: "生後5〜8か月が目安。1歳になる前に", kind: "健診", who: "家族", anchor: "birth", start: { months: 5 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令（対象は1歳になるまで。標準は生後5〜8か月）。${VAX_WHERE}`, needsLocal: true },
  { id: "vaccines-7m", title: "B型肝炎の予防接種（3回目）", plain: "B型肝炎の3回目を受ける", hint: "1回目から139日以上あけて。生後7〜8か月ごろ", kind: "健診", who: "家族", anchor: "birth", start: { months: 7 }, deadline: { months: 12, days: -1 }, basis: `予防接種法施行令（B型肝炎は1歳になるまでに3回。3回目は1回目から139日以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-9-10m", title: "9〜10か月健診", plain: "9〜10か月健診", hint: "多くの町で。受け方は町ごとに違います", kind: "健診", who: "家族", anchor: "birth", start: { months: 9 }, deadline: { months: 11 }, deadlineKind: "目安", basis: "町の乳児健診（母子保健法第13条。行うか・小児科で受けるか集団かは町ごとに違う。町の案内で確かめる）", needsLocal: true },
  { id: "first-birthday-vaccines", title: "1歳の予防接種（麻しん風しん・水痘・小児用肺炎球菌の追加・五種混合の追加）", plain: "1歳の予防接種", hint: "1歳になったら早めに。麻しん風しん・水ぼうそうなど", kind: "健診", who: "家族", anchor: "birth", start: { months: 12 }, deadline: { months: 24, days: -1 }, basis: `予防接種法施行令（麻しん風しんの1期は1歳から2歳になるまで。水痘は1歳から3歳になるまでに2回。肺炎球菌の追加は標準で生後12〜15か月。五種混合の追加は3回目から6か月以上あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "checkup-18m", title: "1歳6か月健診", plain: "1歳半健診", hint: "町から案内が届きます", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 24 }, basis: "母子保健法第12条", needsLocal: true },
  { id: "vaccines-18m", title: "水痘（水ぼうそう）の予防接種（2回目）", plain: "水ぼうそうの2回目を受ける", hint: "1回目から6〜12か月あけて", kind: "健診", who: "家族", anchor: "birth", start: { months: 18 }, deadline: { months: 36, days: -1 }, basis: `予防接種法施行令（水痘は1歳から3歳になるまでに2回。2回目は1回目から3か月以上、標準は6〜12か月あける）。${VAX_WHERE}`, needsLocal: true },
  { id: "the-book", title: "1000日の一冊を作る", plain: "1000日の一冊を作る", hint: "記録と声を、一冊にまとめます", kind: "記録", who: "家族", anchor: "birth", start: { months: 24 }, basis: "この手帳の約束", needsLocal: false },
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
}

/** scheduleFor に渡す家族（FamilyDates に、家族の形と人の役を足した物。どちらも無ければ今までどおり） */
export interface ScheduleInput extends FamilyDates {
  situation?: Situation;
  members?: { role: string }[];
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
    case "partner-no-leave":
      // 仕事のないパートナーには「有休・仕事の調整」は合わない
      return hasPartner(f) && s?.partnerWork !== "仕事なし" && !partnerTakesLeave(s);
    case "someone-employed":
      return motherEmployed(s) || (hasPartner(f) && partnerEmployed(s));
    case "single":
      return !hasPartner(f);
    case "first-child":
      return !hasOlderChildren(s);
    case "older-children":
      return hasOlderChildren(s);
    case "satogaeri":
      return !!s?.satogaeri;
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
 */
export function scheduleFor(f: ScheduleInput): Milestone[] {
  const lmp = lmpFromDue(f.dueDate);
  const birth = f.birthDate ?? f.dueDate;
  return MILESTONES.filter((m) => !m.only || m.only.every((o) => applies(o, f)))
    .map((def) => {
      const m = adjust(def, f);
      const base = m.anchor === "lmp" ? lmp : m.anchor === "due" ? f.dueDate : birth;
      return {
        ...m,
        startDate: resolve(base, m.start),
        deadlineDate: m.deadline ? resolve(base, m.deadline) : undefined,
        ...(m.anchor === "birth" && !f.birthDate ? { awaitingBirth: true } : {}),
        ...(m.pregnancyOnly && f.birthDate ? { endsOn: f.birthDate } : {}),
      };
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
}

export type Status = "まだ先" | "今やる" | "期限が近い" | "期限切れ" | "済み" | "過ぎた";

/** 期限の無い事（健診の回数が変わる、など）を「今」に出しておく日数 */
export const OPEN_WINDOW_DAYS = 14;

/** その事が「今」でなくなる日（期限、無ければ始まりから14日） */
export function endOf(m: Milestone): string {
  return m.deadlineDate ?? addDays(m.startDate, OPEN_WINDOW_DAYS);
}

/** 今日の時点での状態 */
export function statusOf(m: Milestone, today: string, done: Set<string>): Status {
  if (done.has(m.id)) return "済み";
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
