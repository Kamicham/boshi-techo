// 家族の形（アンケート1回目 2026-11-03 の結果から。11-03 に、設定しづらく真ん中でない欄を消した）。
// アプリが家族の形を知らないと、仕事のない母に職場の手続き、育休を取らない父に育休、第2子の家に上の子の事が無い…と、全員に同じ予定が出る。
// ここに家族の形を持ち、予定の組み方（lib/milestones.ts）・参謀（lib/advisor.ts）・画面が読む。
// どの欄も「わからない（undefined）」を許す。わからない欄は、今までと同じ動き（出す）にする。

export type Work = "会社員・公務員" | "パート・派遣" | "自営・フリー" | "仕事なし";
export type MotherWork = Work | "出産で辞める";
export type Leave = "取る" | "取らない" | "未定";

export interface Situation {
  /** 母の働き方（妊娠中）。「出産で辞める」は妊娠中は働いていて、出産を機に辞める */
  motherWork?: MotherWork;
  /** パートナーの働き方・育休（パートナーがいる時だけ。いるかどうかは members の role で決まる） */
  partnerWork?: Work;
  partnerLeave?: Leave;
  /** 上の子。true = いる、false = いない（第1子）、undefined = わからない */
  olderChildren?: boolean;
  /** 生まれる子の数（双子なら2）。undefined = 1 */
  babies?: number;
  /** 里帰り出産。true = する、false = しない、undefined = わからない */
  satogaeri?: boolean;
  /**
   * 静かにする（安心のデザイン #5）。loss = 流産・死産など、つらい別れがあった。nicu = 赤ちゃんが入院している。
   * 選ぶと今日の画面は日数・週数・「次は」・お知らせを止め、橋と本当に要る物だけを出す。記録は消さない。設定で戻せる
   */
  quiet?: Quiet;
  /** 父母のどちらかが公務員（児童手当は勤め先に申請する＝児童手当法第17条）。true = いる、undefined = わからない（役所） */
  publicServant?: boolean;
  /** 赤ちゃんが入る健康保険。勤め先 = 会社などの保険（扶養）、国保 = 国民健康保険。undefined = 働き方から近似（birth-trip.ts の babyInsuranceOf） */
  babyInsurance?: "勤め先" | "国保";
}

export type Quiet = "loss" | "nicu";
export const QUIETS: Quiet[] = ["loss", "nicu"];

/** 保存された値から「静かにする」を読む（決まりに無い値は捨てる） */
export function cleanQuiet(v: unknown): Quiet | undefined {
  return typeof v === "string" && (QUIETS as string[]).includes(v) ? (v as Quiet) : undefined;
}

/** 母が雇われて働いているか（わからない時は true = 今までどおり職場の事を出す） */
export function motherEmployed(s: Situation | undefined): boolean {
  const w = s?.motherWork;
  return w === undefined || w === "会社員・公務員" || w === "パート・派遣" || w === "出産で辞める";
}

/** パートナーが雇われて働いているか（わからない時は true） */
export function partnerEmployed(s: Situation | undefined): boolean {
  const w = s?.partnerWork;
  return w === undefined || w === "会社員・公務員" || w === "パート・派遣";
}

/** 第2子以降か（わからない時は false = 今までどおり第1子の扱い） */
export function hasOlderChildren(s: Situation | undefined): boolean {
  return s?.olderChildren === true;
}

/** パートナーが育休を取るかもしれないか（取る・未定・わからない、かつ雇われて働く・わからない時は true = 今までどおり育休の事を出す） */
export function partnerTakesLeave(s: Situation | undefined): boolean {
  return partnerEmployed(s) && s?.partnerLeave !== "取らない";
}

/** 生まれる子の数（わからない時は 1） */
export function babyCount(s: Situation | undefined): number {
  return s?.babies && s.babies > 1 ? Math.floor(s.babies) : 1;
}

/**
 * 母が国民年金の第1号・国民健康保険に入っていそうか（産前産後の保険料の免除の届けを出す人）。
 * 自営・フリーの母。仕事なしの母は、パートナーがいない時か、パートナーも自営・仕事なしの時（会社員の扶養なら当てはまらない）。
 * わからない時は false（出さない）。入っている保険は家族が確かめる
 */
export function isFirstNenkinMother(s: Situation | undefined, hasPartner: boolean): boolean {
  if (s?.motherWork === "自営・フリー") return true;
  if (s?.motherWork !== "仕事なし") return false;
  if (!hasPartner) return true;
  return s.partnerWork === "自営・フリー" || s.partnerWork === "仕事なし";
}
