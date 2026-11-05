// 予定（lib/milestones.ts・lib/older.ts）の言葉を、画面の言葉にする。予定のデータは日本語のまま持ち（下書き・Claude への頼み・試験はそのまま）、
// 画面に描く時だけここを通す。辞書は dict/milestones.ts。家族の形で変わる言い方（名前・人数・町）は、形を見て差し込みの鍵で引く
import { t } from ".";

/** 予定の見出し・一言を今の言葉に（訳が無ければ日本語のまま） */
export function msWords(s: string): string {
  return t(s);
}
