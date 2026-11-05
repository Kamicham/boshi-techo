// 「済んだ」の意味の一言と、家族の間のありがとう（総点検 1-3・2-1。2026-11-04）。画面とサーバの両方で使う純関数（Claude は呼ばない）。
// - 意味の一言: 済んだにした時、その事が家族と子どもにとって何になったかを、事実だけで1行（体の判断・医療の助言はしない）。
//   出典はそれぞれの行に書く（届けの中身は lib/milestones.ts の basis と同じ法令）。
// - 家族から: ほかの家族が7日の間に済ませた事（ありがとうを送れる）と、自分に届いたありがとう（3日の間）を、今日の画面の「家族から」に並べる。
//   誰が済ませたか分からない記録（11/5 より前の記録・下書きや始める前の事から付いた済み）は並べない。
import { diffDays } from "./clock";
import type { Family, Member } from "./demo-family";
import { t } from "./i18n";

const WORDS: Record<string, (child: string) => string> = {
  // 母子保健法第15条・第16条（妊娠の届出をした人に、市町村が母子健康手帳を交付する）
  "pregnancy-report": (c) => t("母子手帳が、{c}の最初の持ち物になりました", { c }),
  // 健康保険法第63条・第101条の運用（出産育児一時金を健康保険から産院へ直接払う制度）
  "direct-payment": () => t("出産のお金は、健康保険から産院へ直接払われます"),
  // 戸籍法第49条（出生の届出で、子が戸籍に記載される）
  "birth-registration": (c) => t("{c}の名前が、戸籍にのります", { c }),
  // 健康保険法第3条第7項（被扶養者）・国民健康保険法第5条（住所のある人は国保の被保険者）
  "health-insurance": (c) => t("{c}が、健康保険に入ります", { c }),
  // 児童手当法第8条（申請した月の翌月分から支給）
  "child-allowance": (c) => t("{c}の児童手当は、申し込んだ月の次の月の分からです", { c }),
  // 母子保健法第11条（新生児の訪問指導）・児童福祉法第6条の3第4項（乳児家庭全戸訪問事業）
  "birth-notice": (c) => t("町の保健師さんに、{c}が生まれた事が届きます", { c }),
  "home-visit": (c) => t("町の保健師さんたちが、{c}に会いに来てくれました", { c }),
  // 健診は「通った」事だけを言う（結果や体の事には触れない）
  "one-month-checkup": () => t("1か月、おつかれさまでした"),
  "checkup-3-4m": () => t("3〜4か月、おつかれさまでした"),
  "checkup-9-10m": () => t("9〜10か月、おつかれさまでした"),
  "checkup-18m": () => t("1歳6か月、おつかれさまでした"),
  // 予防接種法（定期接種。生後2か月から始まる）
  "vaccines-start": (c) => t("{c}の予防接種が、始まりました", { c }),
  "return-to-work": () => t("ここまでの育休、おつかれさまでした"),
};

/** 済んだにした事の意味の一言（無い事は null。画面の言葉で返す＝サーバではいつも日本語） */
export function doneWords(milestoneId: string, childName?: string): string | null {
  const w = WORDS[milestoneId];
  return w ? w(childName?.trim() || t("赤ちゃん")) : null;
}

/** 意味の一言を持つ事の id（試験から使う） */
export const DONE_WORD_IDS: readonly string[] = Object.keys(WORDS);

export type Thanks = { by: string; today?: string; at: string };

export interface FamilyNews {
  /** ほかの家族が済ませた事（新しい順・2件まで）。thanked は自分がもう送った印 */
  done: { id: string; by: Member; on: string; thanked: boolean }[];
  /** 自分に届いたありがとう（新しい順・3件まで） */
  thanks: { id: string; from: Member; on: string }[];
}

/** ほかの家族が済ませた事を出す日数（済ませた日から） */
export const NEWS_DAYS = 7;
/** 届いたありがとうを出す日数（届いた日から） */
export const THANKS_DAYS = 3;

/**
 * 今日の画面の「家族から」。me は今この端末を使っている家族の一人。
 * doneOn は済んだにした日（押した時の画面の「今日」）、doneBy は済ませた人、thanks は届いたありがとう（/api/done の GET）
 */
export function familyNewsFor(
  family: Pick<Family, "members">,
  me: Member | null,
  today: string,
  r: { doneBy?: Record<string, string>; doneOn?: Record<string, string>; thanks?: Record<string, Thanks> },
): FamilyNews {
  if (!me || family.members.length < 2) return { done: [], thanks: [] };
  const member = (id: string | undefined) => family.members.find((m) => m.id === id);
  const within = (d: string | undefined, n: number) => !!d && diffDays(today, d) >= 0 && diffDays(today, d) < n;
  const done = Object.entries(r.doneBy ?? {})
    .flatMap(([id, by]) => {
      const p = member(by);
      const on = r.doneOn?.[id];
      if (!p || p.id === me.id || !on || !within(on, NEWS_DAYS)) return [];
      return [{ id, by: p, on, thanked: r.thanks?.[id]?.by === me.id }];
    })
    .sort((a, b) => b.on.localeCompare(a.on))
    .slice(0, 2);
  const thanks = Object.entries(r.thanks ?? {})
    .flatMap(([id, t]) => {
      const from = member(t.by);
      const on = t.today ?? t.at.slice(0, 10);
      if (r.doneBy?.[id] !== me.id || !from || from.id === me.id || !within(on, THANKS_DAYS)) return [];
      return [{ id, from, on }];
    })
    .sort((a, b) => b.on.localeCompare(a.on))
    .slice(0, 3);
  return { done, thanks };
}

/** 一冊・映画の終わりの「家族のありがとう」: 誰から誰へ・何に・いつ（古い順。時計を進めた家族は、画面の「今日」より後の物を出さない） */
export function thanksLog(
  family: Pick<Family, "members">,
  today: string,
  r: { doneBy?: Record<string, string>; thanks?: Record<string, Thanks> },
): { id: string; from: Member; to: Member; on: string }[] {
  return Object.entries(r.thanks ?? {})
    .flatMap(([id, t]) => {
      const from = family.members.find((m) => m.id === t.by);
      const to = family.members.find((m) => m.id === r.doneBy?.[id]);
      const on = t.today ?? t.at.slice(0, 10);
      if (!from || !to || from.id === to.id || on > today) return [];
      return [{ id, from, to, on }];
    })
    .sort((a, b) => a.on.localeCompare(b.on));
}
