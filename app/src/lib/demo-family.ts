// デモの家族。すべて作った家族で、実在の人物ではない。
// 住む町だけは実在の市にして、制度は本物を取りに行く。

import type { FamilyDates } from "./clock";

export interface Member {
  id: string;
  name: string;
  role: "母" | "パートナー" | "祖父母";
  /** 話しかける時の言葉づかいのヒント */
  voice: string;
}

export interface Family extends FamilyDates {
  id: string;
  city: string;
  prefecture: string;
  childName?: string;
  members: Member[];
  /** わが家がこの手帳を使い始めた日（途中から始めた時、それより前に期限が過ぎた事は済み扱いにする） */
  startedOn?: string;
}

export const DEMO_FAMILY: Family = {
  id: "demo-sato",
  city: "さいたま市",
  prefecture: "埼玉県",
  dueDate: "2027-05-10",
  birthDate: "2027-05-08",
  childName: "ひなた",
  members: [
    { id: "misaki", name: "美咲", role: "母", voice: "初めての出産。会社員で、細かい段取りは苦手ではないが、時間がない" },
    { id: "shota", name: "翔太", role: "パートナー", voice: "やる気はあるが、何をすればいいか分からない。短く具体的に" },
    { id: "kazuko", name: "和子", role: "祖父母", voice: "鹿児島に住む美咲の母。大きな字で、ゆっくり、やさしい言葉で" },
  ],
};
