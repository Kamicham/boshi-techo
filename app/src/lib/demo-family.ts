// デモの家族。すべて作った家族で、実在の人物ではない。
// 住む町だけは実在の市にして、制度は本物を取りに行く。

import type { FamilyDates } from "./clock";
import type { Situation } from "./situation";

export interface Member {
  id: string;
  name: string;
  /** 家族の人は母とパートナーだけ（2026-11-03 に祖父母の役を消した） */
  role: "母" | "パートナー";
}

export interface Family extends FamilyDates {
  id: string;
  city: string;
  prefecture: string;
  childName?: string;
  members: Member[];
  /** わが家がこの手帳を使い始めた日（途中から始めた時、それより前に期限が過ぎた事は済み扱いにする） */
  startedOn?: string;
  /** 前に住んでいた町と、引っ越した日（町を変えた時に覚える。引き継がれない制度の差に気づくため） */
  previousCity?: string;
  previousPrefecture?: string;
  movedOn?: string;
  /** 家族の形（働き方・育休・上の子・双子・里帰り）。わからない欄は空のまま（今までどおりの予定が出る） */
  situation?: Situation;
  /** 生まれた時の体重 g と在胎週数。保存はせず、サーバ（lib/family.ts）が手帳の出産の記録から埋めて返す。双子などは一番小さい子の体重 */
  birthWeightG?: number;
  birthWeek?: number;
}

export const DEMO_FAMILY: Family = {
  id: "demo-sato",
  city: "さいたま市",
  prefecture: "埼玉県",
  dueDate: "2027-05-10",
  // 予定日より2週間早く生まれる（参謀の気づき「早く生まれた」の場面）
  birthDate: "2027-04-26",
  // 妊娠24週で横浜市から引っ越してきた（参謀の気づき「町が変わった」の場面）
  previousCity: "横浜市",
  previousPrefecture: "神奈川県",
  movedOn: "2027-01-18",
  childName: "ひなた",
  // 家族の形: 美咲は会社員で育休を取る。翔太も会社員で、産後パパ育休を取る（参謀の「早く生まれた」場面で、始まる日を早める）。
  // 初めての子で1人。里帰りはしない。
  situation: {
    motherWork: "会社員・公務員",
    partnerWork: "会社員・公務員",
    partnerLeave: "取る",
    olderChildren: false,
    babies: 1,
    satogaeri: false,
  },
  members: [
    // 美咲: 初めての出産。会社員で、細かい段取りは苦手ではないが、時間がない
    { id: "misaki", name: "美咲", role: "母" },
    // 翔太: やる気はあるが、何をすればいいか分からない
    { id: "shota", name: "翔太", role: "パートナー" },
  ],
};
