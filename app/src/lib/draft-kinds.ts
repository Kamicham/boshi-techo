// 下書きが意味を持つ事と、作る前に見込む種類（画面のボタンの言葉と、鍵の無い見本の下書きの両方で使う）。
// 画面（MilestoneActions・NowCard）とサーバ（lib/samples.ts）の両方から読むので、server-only の物を import しない。
import { MONEY, paidId } from "./money";
import type { DraftKind } from "./drafts";

/** 下書きが意味を持つ事と、作る前に見込む種類（ボタンの言葉を種類で言い分ける） */
export const DRAFTABLE: Record<string, DraftKind> = {
  "pregnancy-report": "記入メモ",
  "tell-work": "メール",
  "partner-leave": "メール",
  "partner-leave-earlier": "メール",
  "moved-tennyu": "記入メモ",
  "moved-child-allowance": "記入メモ",
  "moved-checkup-tickets": "質問リスト",
  "moved-medical-card": "記入メモ",
  "direct-payment": "記入メモ",
  "pregnancy-support-2": "メール",
  "birth-registration": "記入メモ",
  "child-allowance": "記入メモ",
  "health-insurance": "記入メモ",
  "medical-subsidy": "記入メモ",
  "birth-notice": "記入メモ",
  "tell-work-birth": "メール",
  "partner-tell-work-birth": "メール",
  "daycare-research": "質問リスト",
  "vaccines-start": "質問リスト",
  "checkup-3-4m": "質問リスト",
  "checkup-18m": "質問リスト",
  "older-child-care": "頼み文",
  "older-pickup": "頼み文",
  "older-daycare-continue": "メール",
  "daycare-extend": "メール",
  "satogaeri-return": "メール",
  "daycare-extend-2": "メール",
  "daycare-prep": "頼み文",
  "leave-money-request": "メール",
  "partner-leave-14": "メール",
  "childcare-benefit-first": "メール",
  // 届いたか確かめる件（lib/money.ts）: 届く時期を過ぎた時の問い合わせ
  ...Object.fromEntries(Object.keys(MONEY).map((k) => [paidId(k), "メール" as DraftKind])),
};
