// デモの家族。すべて作った家族で、実在の人物ではない。
// 住む町だけは実在の市にして、制度は本物を取りに行く。

import type { FamilyDates } from "./clock";
import type { Situation } from "./situation";

export interface Member {
  id: string;
  name: string;
  role: "母" | "パートナー" | "祖父母";
  /** 話しかける時の言葉づかいのヒント */
  voice: string;
  /** 祖父母が来る日（と帰る日）。来る前に、任せられる事を割り振る */
  visit?: { from: string; until?: string };
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
  /** 家族の形（働き方・育休・上の子・里帰り・祖父母）。わからない欄は空のまま（今までどおりの予定が出る） */
  situation?: Situation;
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
  members: [
    { id: "misaki", name: "美咲", role: "母", voice: "初めての出産。会社員で、細かい段取りは苦手ではないが、時間がない" },
    { id: "shota", name: "翔太", role: "パートナー", voice: "やる気はあるが、何をすればいいか分からない。短く具体的に" },
    { id: "kazuko", name: "和子", role: "祖父母", voice: "鹿児島に住む美咲の母。大きな字で、ゆっくり、やさしい言葉で", visit: { from: "2027-05-15", until: "2027-05-29" } },
  ],
};
