// 家族の形（アンケート1回目 2026-11-03 の結果から）。
// アプリが家族の形を知らないと、仕事のない母に職場の手続き、育休を取らない父に育休、第2子の家に上の子の事が無い…と、全員に同じ予定が出る。
// ここに家族の形を持ち、予定の組み方（lib/milestones.ts）・参謀（lib/advisor.ts）・画面が読む。
// どの欄も「わからない（undefined）」を許す。わからない欄は、今までと同じ動き（出す）にする。

export type Work = "会社員・公務員" | "パート・派遣" | "自営・フリー" | "仕事なし";
export type MotherWork = Work | "出産で辞める";
export type Leave = "取る" | "取らない" | "未定";
export type GrandparentPlace = "同居" | "近く" | "遠く" | "いない";

export interface Situation {
  /** 母の働き方（妊娠中）。「出産で辞める」は妊娠中は働いていて、出産を機に辞める */
  motherWork?: MotherWork;
  /** 母の育休（雇われて働く時だけ意味がある） */
  motherLeave?: Leave;
  /** パートナーの働き方・育休・夜勤・単身赴任（パートナーがいる時だけ。いるかどうかは members の role で決まる） */
  partnerWork?: Work;
  partnerLeave?: Leave;
  partnerNightShift?: boolean;
  partnerAway?: boolean;
  /** 上の子の生まれ年月（YYYY-MM）。空の配列 = 上の子はいない（第1子）。undefined = わからない */
  olderChildren?: string[];
  /** 生まれる子の数（双子なら2）。undefined = 1 */
  babies?: number;
  /** 里帰り出産。null = しない、undefined = わからない */
  satogaeri?: { prefecture: string; city: string; from?: string; until?: string } | null;
  /** 祖父母の住む所（母方・パートナー方） */
  grandparents?: { mother?: GrandparentPlace; partner?: GrandparentPlace };
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
  return !!s?.olderChildren?.length;
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
