// 「手帳に聞く」の画面とサーバで共有する形（画面からも読む。server-only にしない）。
// 手帳は答えるだけでなく、下の「動き」を返事に添える。書き込む動きは、家族が押すまで何も変えない（ビジョン③ 最後の「OK」は家族）。

export type AskAction =
  /** 画面へ連れて行く（画面の地図にある行き先だけ） */
  | { type: "open"; href: string; label: string }
  /** 次の健診で聞く事に足す（押すと /api/ask/act。子の事は子の健診、ママの事はママの健診へ） */
  | { type: "concern"; text: string; for?: "child" | "mother" }
  /** 記録に残す（押すと /api/ask/act → 話す・撮るの記録。手帳のページに入る物は今どおり候補になる） */
  | { type: "record"; text: string }
  /** やる事を済みにする（押すと /api/done） */
  | { type: "done"; milestoneId: string; label: string }
  /** やる事の窓口調べ・下書き（今日の画面と同じ部品を、返事の下に出す） */
  | { type: "milestone"; milestoneId: string; label: string }
  /** そのまま渡せる文（コピー・メール・LINE で開く。送るのは家族） */
  | { type: "message"; to: string; via: "mail" | "line"; subject?: string; body: string }
  /** 電話の案内（番号は文字でも見せる） */
  | { type: "call"; label: string; tel: string };

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
  actions?: AskAction[];
  /** 家族が押して済んだ動き（actions の番号） */
  used?: number[];
  /** 調べたページ（公式の出典） */
  sources?: { title: string; url: string }[];
  /** 聞いた人（家族の呼び名） */
  who?: string;
  /** その時の画面の「今日」 */
  today: string;
  at: string;
}

/** /api/ask が流す1行（NDJSON） */
export type AskEvent =
  | { t: "status"; text: string }
  | { t: "done"; turn: ChatTurn }
  | { t: "error"; error: string };
